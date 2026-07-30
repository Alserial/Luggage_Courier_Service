const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedScopes = new Set(['market', 'mine']);

function toListItem(trip, isOwner) {
  return {
    _id: trip._id,
    fromCity: trip.fromCity,
    toCity: trip.toCity,
    departureTime: trip.departureTime,
    arrivalTime: trip.arrivalTime,
    flightNo: trip.flightNo,
    luggageCapacityKg: trip.luggageCapacityKg,
    acceptableCategories: trip.acceptableCategories || [],
    status: trip.status,
    verificationStatus: trip.verificationStatus,
    isOwner,
    createdAt: trip.createdAt,
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const limit = Math.min(Number(event.limit) || 20, 50);
  const scope = event.scope || 'market';
  if (!OPENID) return { ok: false, error: 'login_required' };
  if (!allowedScopes.has(scope)) return { ok: false, error: 'invalid_scope' };
  const db = cloud.database();

  if (scope === 'mine') {
    const result = await db
      .collection('trips')
      .where({ travellerOpenid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return {
      ok: true,
      scope,
      trips: (result.data || []).filter((trip) => trip.status !== 'cancelled').map((trip) => toListItem(trip, true)),
    };
  }

  const result = await db
    .collection('trips')
    .where({ verificationStatus: 'approved' })
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit * 2, 100))
    .get();

  const trips = (result.data || [])
    .filter((trip) => trip.travellerOpenid !== OPENID && trip.status === 'active')
    .slice(0, limit)
    .map((trip) => toListItem(trip, false));

  return { ok: true, scope, trips };
};
