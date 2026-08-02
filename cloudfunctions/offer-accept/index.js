const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function text(value) {
  return String(value || '').trim();
}

function documentId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
  return `${prefix}_${digest}`;
}

function businessError(code) {
  const error = new Error(code);
  error.businessCode = code;
  return error;
}

async function getDoc(database, collection, id) {
  try {
    return (await database.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

function feeBreakdown(serviceFee) {
  const platformFee = Math.ceil(serviceFee * 0.08);
  return {
    serviceFee,
    platformFee,
    total: serviceFee + platformFee,
    currency: 'CNY',
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const offerId = text(event.offerId);
  const operationId = text(event.operationId).slice(0, 128);
  if (!offerId) return { ok: false, error: 'missing_offer_id' };
  if (!operationId) return { ok: false, error: 'missing_operation_id' };
  if (offerId.startsWith('demo_')) return { ok: false, error: 'offer_not_found' };

  const db = cloud.database();
  const legacyOrderResult = await db.collection('orders').where({ offerId }).limit(1).get();
  const legacyOrder = legacyOrderResult.data[0] || null;
  const orderId = legacyOrder ? legacyOrder._id : documentId('order', offerId);
  const auditId = documentId('audit', 'offer-accept', offerId);
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existingOrder = await getDoc(transaction, 'orders', orderId);
      if (existingOrder) {
        if (existingOrder.offerId !== offerId || existingOrder.requesterOpenid !== OPENID) {
          throw businessError('idempotency_conflict');
        }
        response = { ok: true, orderId, idempotent: true };
        return;
      }

      const offer = await getDoc(transaction, 'offers', offerId);
      if (!offer) throw businessError('offer_not_found');
      if (offer.status !== 'pending') throw businessError('offer_not_pending');

      const request = await getDoc(transaction, 'item_requests', offer.requestId);
      if (!request) throw businessError('request_not_found');
      if (request.isDeleted) throw businessError('request_deleted');
      if (request.requesterOpenid !== OPENID) throw businessError('permission_denied');
      if (request.reviewStatus !== 'approved') throw businessError('request_not_approved');

      const trip = await getDoc(transaction, 'trips', offer.tripId);
      if (!trip) throw businessError('trip_not_found');
      if (trip.status !== 'active') throw businessError('trip_not_active');
      if (trip.verificationStatus !== 'approved') throw businessError('trip_not_verified');
      if (trip.travellerOpenid !== offer.travellerOpenid) throw businessError('offer_trip_mismatch');

      const now = new Date();
      await transaction.collection('orders').doc(orderId).set({
        data: {
          requestId: offer.requestId,
          offerId,
          tripId: offer.tripId,
          travellerOpenid: offer.travellerOpenid,
          requesterOpenid: OPENID,
          status: 'pending_payment',
          feeBreakdown: feeBreakdown(Number(offer.serviceFeeQuote)),
          paymentId: '',
          activeDisputeId: '',
          statusBeforeDispute: '',
          taxRule: {
            defaultPayer: 'requester',
            note: '如入境被要求补税，默认由需求方承担；携带人需如实申报并上传证明。',
          },
          cancellationRule: {
            beforeHandover: 'eligible_refund',
            afterHandover: 'requires_agreement_or_dispute',
          },
          evidenceRequired: [
            'item_photo',
            'handover_qr_scan',
            'delivery_photo_or_video',
            'mutual_confirmation',
          ],
          currentRiskLevel: 'low',
          operationId,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.collection('offers').doc(offerId).update({
        data: { status: 'accepted', acceptedOrderId: orderId, updatedAt: now },
      });
      await transaction.collection('audit_logs').doc(auditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole: 'requester',
          targetType: 'order',
          targetId: orderId,
          action: 'offer.accept',
          before: null,
          after: { status: 'pending_payment', offerId },
          operationId,
          createdAt: now,
        },
      });
      response = { ok: true, orderId };
    });
    return response || { ok: false, error: 'transaction_failed' };
  } catch (error) {
    if (error && error.businessCode) return { ok: false, error: error.businessCode };
    console.error('offer-accept transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
