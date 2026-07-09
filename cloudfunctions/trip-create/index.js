const cloud = require('wx-server-sdk');

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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const form = event.form || {};
  const error = validate(form);
  if (error) return { ok: false, error };

  const db = cloud.database();
  const now = new Date();
  const acceptableCategories = Array.from(new Set(form.acceptableCategories));
  const flightNo = text(form.flightNo);

  const result = await db.collection('trips').add({
    data: {
      travellerOpenid: OPENID,
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
      unacceptableCategories: Array.isArray(form.unacceptableCategories) ? form.unacceptableCategories.filter((item) => allowedCategories.has(item)) : [],
      handoverPreference: text(form.handoverPreference),
      note: text(form.note),
      status: 'active',
      verificationStatus: flightNo ? 'pending' : 'manual_review',
      verificationEvidenceIds: [],
      createdAt: now,
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'trip',
      targetId: result._id,
      action: 'trip.create',
      before: null,
      after: {
        status: 'active',
        verificationStatus: flightNo ? 'pending' : 'manual_review',
        luggageCapacityKg: number(form.luggageCapacityKg),
        acceptableCategories,
      },
      operationId: event.operationId || '',
      createdAt: now,
    },
  });

  return { ok: true, tripId: result._id };
};
