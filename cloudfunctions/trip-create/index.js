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

function validate(form) {
  if (!form.fromCity || !form.toCity) return 'missing_route';
  if (form.fromCity === form.toCity) return 'same_city';
  if (!form.departureDate || !form.arrivalDate) return 'missing_dates';
  if (!form.luggageCapacityKg || form.luggageCapacityKg <= 0 || form.luggageCapacityKg > 5) return 'invalid_capacity';
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
  const result = await db.collection('trips').add({
    data: {
      travellerOpenid: OPENID,
      fromCountry: '',
      fromCity: form.fromCity,
      fromAirportOrStation: '',
      toCountry: '',
      toCity: form.toCity,
      toAirportOrStation: '',
      departureTime: form.departureDate,
      arrivalTime: form.arrivalDate,
      flightNo: form.flightNo || '',
      luggageCapacityKg: Number(form.luggageCapacityKg),
      acceptableCategories: form.acceptableCategories,
      unacceptableCategories: [],
      handoverPreference: '',
      note: form.note || '',
      status: 'active',
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
      after: { status: 'active' },
      createdAt: now,
    },
  });

  return { ok: true, tripId: result._id };
};
