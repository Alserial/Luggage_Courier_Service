const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function text(value) {
  return String(value || '').trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function documentId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
  return `${prefix}_${digest}`;
}

function businessError(code, details = {}) {
  const error = new Error(code);
  error.businessCode = code;
  Object.assign(error, details);
  return error;
}

async function getDoc(database, collection, id) {
  try {
    return (await database.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

function isRouteCompatible(request, trip) {
  return (
    request.pickupLocation &&
    request.deliveryLocation &&
    text(request.pickupLocation.city) === text(trip.fromCity) &&
    text(request.deliveryLocation.city) === text(trip.toCity)
  );
}

function isDateCompatible(request, trip) {
  const deadline = Date.parse(request.deadline);
  const arrival = Date.parse(trip.arrivalTime);
  return !Number.isNaN(deadline) && !Number.isNaN(arrival) && deadline >= arrival;
}

function getOfferBlockReason(request, trip, openid) {
  if (!request) return 'request_not_found';
  if (!trip) return 'trip_not_found';
  if (request.isDeleted) return 'request_deleted';
  if (request.requesterOpenid === openid) return 'self_offer_not_allowed';
  if (trip.travellerOpenid !== openid) return 'permission_denied';
  if (request.reviewStatus !== 'approved') return 'request_not_approved';
  if (trip.status !== 'active') return 'trip_not_active';
  if (trip.verificationStatus !== 'approved') return 'trip_not_verified';
  if (!Array.isArray(trip.acceptableCategories) || !trip.acceptableCategories.includes(request.category)) {
    return 'category_not_accepted';
  }
  if (Number(trip.luggageCapacityKg) < Number(request.estimatedWeightKg)) return 'capacity_not_enough';
  if (!isRouteCompatible(request, trip)) return 'route_not_compatible';
  if (!isDateCompatible(request, trip)) return 'date_not_compatible';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const form = event.form || {};
  const operationId = text(event.operationId).slice(0, 128);
  const serviceFeeQuote = number(form.serviceFeeQuote);

  if (!operationId) return { ok: false, error: 'missing_operation_id' };
  if (!form.requestId || !form.tripId) return { ok: false, error: 'missing_refs' };
  if (!serviceFeeQuote || serviceFeeQuote <= 0) return { ok: false, error: 'invalid_fee' };
  if (serviceFeeQuote > 500) return { ok: false, error: 'fee_too_high_for_mvp' };

  const db = cloud.database();
  const offerId = documentId('offer', OPENID, operationId);
  const auditId = documentId('audit', 'offer-create', OPENID, operationId);
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existing = await getDoc(transaction, 'offers', offerId);
      if (existing) {
        if (existing.travellerOpenid !== OPENID || existing.requestId !== form.requestId || existing.tripId !== form.tripId) {
          throw businessError('idempotency_conflict');
        }
        response = { ok: true, offerId, idempotent: true };
        return;
      }

      const request = await getDoc(transaction, 'item_requests', form.requestId);
      const trip = await getDoc(transaction, 'trips', form.tripId);
      const blockReason = getOfferBlockReason(request, trip, OPENID);
      if (blockReason) throw businessError(blockReason);

      const now = new Date();
      await transaction.collection('offers').doc(offerId).set({
        data: {
          requestId: form.requestId,
          tripId: form.tripId,
          travellerOpenid: OPENID,
          serviceFeeQuote,
          currency: 'CNY',
          message: text(form.message),
          conditions: text(form.conditions),
          status: 'pending',
          operationId,
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(auditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole: 'traveller',
          targetType: 'offer',
          targetId: offerId,
          action: 'offer.create',
          before: null,
          after: {
            status: 'pending',
            serviceFeeQuote,
            requestId: form.requestId,
            tripId: form.tripId,
          },
          operationId,
          createdAt: now,
        },
      });
      response = { ok: true, offerId };
    });
    return response || { ok: false, error: 'transaction_failed' };
  } catch (error) {
    if (error && error.businessCode) return { ok: false, error: error.businessCode };
    console.error('offer-create transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
