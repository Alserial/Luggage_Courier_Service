const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { requestId } = event;
  if (!requestId) return { ok: false, error: 'missing_request_id' };

  const db = cloud.database();
  let request;
  try {
    request = (await db.collection('item_requests').doc(requestId).get()).data;
  } catch (error) {
    return { ok: false, error: 'request_not_found' };
  }

  if (request.requesterOpenid !== OPENID) return { ok: false, error: 'permission_denied' };

  const offers = await db
    .collection('offers')
    .where({ requestId, status: 'pending' })
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  return { ok: true, request, offers: offers.data || [] };
};
