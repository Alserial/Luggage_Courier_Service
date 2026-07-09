const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const limit = Math.min(Number(event.limit) || 20, 50);
  const db = cloud.database();

  const result = await db
    .collection('trips')
    .where({ travellerOpenid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return { ok: true, trips: result.data || [] };
};
