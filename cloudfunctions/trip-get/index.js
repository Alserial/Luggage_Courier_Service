const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { tripId } = event;
  if (!tripId) return { ok: false, error: 'missing_trip_id' };

  const db = cloud.database();
  let trip;
  try {
    trip = (await db.collection('trips').doc(tripId).get()).data;
  } catch (error) {
    return { ok: false, error: 'trip_not_found' };
  }

  if (trip.travellerOpenid !== OPENID) return { ok: false, error: 'permission_denied' };

  return { ok: true, trip };
};
