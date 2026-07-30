const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function text(value) {
  return String(value || '').trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validate(form) {
  if (!form.requestId || !form.tripId) return 'missing_refs';
  const serviceFeeQuote = number(form.serviceFeeQuote);
  if (!serviceFeeQuote || serviceFeeQuote <= 0) return 'invalid_fee';
  if (serviceFeeQuote > 500) return 'fee_too_high_for_mvp';
  return null;
}

async function getDoc(db, collection, id) {
  try {
    return (await db.collection(collection).doc(id).get()).data;
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
  if (Number.isNaN(deadline) || Number.isNaN(arrival)) return false;
  return deadline >= arrival;
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
  if (!Array.isArray(trip.acceptableCategories) || !trip.acceptableCategories.includes(request.category)) return 'category_not_accepted';
  if (Number(trip.luggageCapacityKg) < Number(request.estimatedWeightKg)) return 'capacity_not_enough';
  if (!isRouteCompatible(request, trip)) return 'route_not_compatible';
  if (!isDateCompatible(request, trip)) return 'date_not_compatible';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const form = event.form || {};
  const error = validate(form);
  if (error) return { ok: false, error };

  const db = cloud.database();
  const now = new Date();
  const request = await getDoc(db, 'item_requests', form.requestId);
  const trip = await getDoc(db, 'trips', form.tripId);
  const blockReason = getOfferBlockReason(request, trip, OPENID);
  if (blockReason) return { ok: false, error: blockReason };

  const serviceFeeQuote = number(form.serviceFeeQuote);
  const offer = await db.collection('offers').add({
    data: {
      requestId: form.requestId,
      tripId: form.tripId,
      travellerOpenid: OPENID,
      serviceFeeQuote,
      currency: 'CNY',
      message: text(form.message),
      conditions: text(form.conditions),
      status: 'pending',
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'offer',
      targetId: offer._id,
      action: 'offer.create',
      before: null,
      after: {
        status: 'pending',
        serviceFeeQuote,
        requestId: form.requestId,
        tripId: form.tripId,
      },
      operationId: event.operationId || '',
      createdAt: now,
    },
  });

  return { ok: true, offerId: offer._id };
};
