const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function feeBreakdown(serviceFee) {
  const platformFee = Math.ceil(serviceFee * 0.08);
  return {
    serviceFee,
    platformFee,
    total: serviceFee + platformFee,
    currency: 'CNY',
  };
}

async function getItemRequest(db, requestId) {
  try {
    return (await db.collection('item_requests').doc(requestId).get()).data;
  } catch (error) {
    return null;
  }
}

async function getTrip(db, tripId) {
  try {
    return (await db.collection('trips').doc(tripId).get()).data;
  } catch (error) {
    return null;
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { offerId, operationId = '' } = event;
  if (!offerId) return { ok: false, error: 'missing_offer_id' };

  const db = cloud.database();
  const now = new Date();

  let offer;
  try {
    offer = (await db.collection('offers').doc(offerId).get()).data;
  } catch (error) {
    if (offerId !== 'demo_offer_001') return { ok: false, error: 'offer_not_found' };
    offer = {
      _id: offerId,
      requestId: 'demo_request_001',
      tripId: 'demo_trip_001',
      travellerOpenid: 'demo_traveller',
      serviceFeeQuote: 120,
      status: 'pending',
    };
  }

  if (offer.status !== 'pending') return { ok: false, error: 'offer_not_pending' };

  if (offerId !== 'demo_offer_001') {
    const request = await getItemRequest(db, offer.requestId);
    if (!request) return { ok: false, error: 'request_not_found' };
    if (request.isDeleted) return { ok: false, error: 'request_deleted' };
    if (request.requesterOpenid !== OPENID) return { ok: false, error: 'permission_denied' };
    if (request.reviewStatus !== 'approved') return { ok: false, error: 'request_not_approved' };
    const trip = await getTrip(db, offer.tripId);
    if (!trip) return { ok: false, error: 'trip_not_found' };
    if (trip.status !== 'active') return { ok: false, error: 'trip_not_active' };
    if (trip.verificationStatus !== 'approved') return { ok: false, error: 'trip_not_verified' };
    if (trip.travellerOpenid !== offer.travellerOpenid) return { ok: false, error: 'offer_trip_mismatch' };
  }

  const order = await db.collection('orders').add({
    data: {
      requestId: offer.requestId,
      offerId,
      tripId: offer.tripId,
      travellerOpenid: offer.travellerOpenid,
      requesterOpenid: OPENID,
      status: 'pending_payment',
      feeBreakdown: feeBreakdown(Number(offer.serviceFeeQuote)),
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
      createdAt: now,
      updatedAt: now,
    },
  });

  if (offerId !== 'demo_offer_001') {
    await db.collection('offers').doc(offerId).update({
      data: { status: 'accepted', updatedAt: now },
    });
  }

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'order',
      targetId: order._id,
      action: 'offer.accept',
      before: null,
      after: { status: 'pending_payment', offerId },
      operationId,
      createdAt: now,
    },
  });

  return { ok: true, orderId: order._id };
};
