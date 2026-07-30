const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedCategories = new Set([
  'clothing',
  'books',
  'stationery',
  'small_gifts',
  'phone_accessories',
  'daily_items',
]);

function text(value) {
  return String(value || '').trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validate(form) {
  const fromCity = text(form.fromCity);
  const toCity = text(form.toCity);
  const departureTime = Date.parse(form.departureDate || form.departureTime);
  const arrivalTime = Date.parse(form.arrivalDate || form.arrivalTime);
  const luggageCapacityKg = number(form.luggageCapacityKg);

  if (!fromCity || !toCity) return 'missing_route';
  if (fromCity === toCity) return 'same_city';
  if (!form.departureDate || !form.arrivalDate) return 'missing_dates';
  if (Number.isNaN(departureTime) || Number.isNaN(arrivalTime)) return 'invalid_dates';
  if (arrivalTime < departureTime) return 'arrival_before_departure';
  if (!luggageCapacityKg || luggageCapacityKg <= 0 || luggageCapacityKg > 5) return 'invalid_capacity';
  if (!Array.isArray(form.acceptableCategories) || !form.acceptableCategories.length) return 'missing_categories';
  if (!form.acceptableCategories.every((item) => allowedCategories.has(item))) return 'invalid_category';
  if (/什么都|都可以|不限|随便/.test(form.note || '')) return 'overbroad_claim';
  return null;
}

async function getDoc(db, collection, id) {
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

async function hasLinkedOrder(db, tripId) {
  const result = await db.collection('orders').where({ tripId }).limit(1).get();
  return Boolean(result.data && result.data.length);
}

async function cancelPendingOffers(db, tripId, now) {
  const result = await db.collection('offers').where({ tripId, status: 'pending' }).limit(100).get();
  await Promise.all(
    (result.data || []).map((offer) =>
      db.collection('offers').doc(offer._id).update({
        data: { status: 'cancelled', updatedAt: now },
      }),
    ),
  );
}

function auditId(openid, operationId) {
  const digest = crypto.createHash('sha256').update(`trip-update:${openid}:${operationId}`).digest('hex').slice(0, 32);
  return `audit_${digest}`;
}

async function writeAudit(db, data, openid, operationId) {
  if (operationId) {
    await db.collection('audit_logs').doc(auditId(openid, operationId)).set({ data });
  } else {
    await db.collection('audit_logs').add({ data });
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const tripId = text(event.tripId);
  const operationId = text(event.operationId).slice(0, 128);
  const form = event.form || {};
  if (!tripId) return { ok: false, error: 'missing_trip_id' };
  const validationError = validate(form);
  if (validationError) return { ok: false, error: validationError };

  const db = cloud.database();
  const trip = await getDoc(db, 'trips', tripId);
  if (!trip) return { ok: false, error: 'trip_not_found' };
  if (trip.travellerOpenid !== OPENID) return { ok: false, error: 'permission_denied' };
  if (!['draft', 'active', 'paused'].includes(trip.status)) return { ok: false, error: 'trip_not_editable' };
  if (await hasLinkedOrder(db, tripId)) return { ok: false, error: 'linked_order_exists' };

  const now = new Date();
  const flightNo = text(form.flightNo);
  const acceptableCategories = Array.from(new Set(form.acceptableCategories));
  const nextVerificationStatus = flightNo ? 'pending' : 'manual_review';
  const updateData = {
    fromCountry: text(form.fromCountry),
    fromCity: text(form.fromCity),
    fromAirportOrStation: text(form.fromAirportOrStation),
    toCountry: text(form.toCountry),
    toCity: text(form.toCity),
    toAirportOrStation: text(form.toAirportOrStation),
    departureTime: form.departureDate,
    arrivalTime: form.arrivalDate,
    flightNo,
    luggageCapacityKg: number(form.luggageCapacityKg),
    acceptableCategories,
    unacceptableCategories: Array.isArray(form.unacceptableCategories)
      ? form.unacceptableCategories.filter((item) => allowedCategories.has(item))
      : [],
    handoverPreference: text(form.handoverPreference),
    note: text(form.note),
    verificationStatus: nextVerificationStatus,
    verificationReason: '',
    updatedAt: now,
  };

  await cancelPendingOffers(db, tripId, now);
  await db.collection('trips').doc(tripId).update({ data: updateData });
  await writeAudit(
    db,
    {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'trip',
      targetId: tripId,
      action: 'trip.update',
      before: {
        fromCity: trip.fromCity,
        toCity: trip.toCity,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        luggageCapacityKg: trip.luggageCapacityKg,
        acceptableCategories: trip.acceptableCategories || [],
        verificationStatus: trip.verificationStatus,
      },
      after: {
        fromCity: updateData.fromCity,
        toCity: updateData.toCity,
        departureTime: updateData.departureTime,
        arrivalTime: updateData.arrivalTime,
        luggageCapacityKg: updateData.luggageCapacityKg,
        acceptableCategories,
        verificationStatus: nextVerificationStatus,
      },
      operationId,
      createdAt: now,
    },
    OPENID,
    operationId,
  );

  return { ok: true, tripId, verificationStatus: nextVerificationStatus };
};
