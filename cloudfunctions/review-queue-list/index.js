const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const reviewerRoles = new Set(['admin', 'reviewer']);
const reviewStatuses = ['pending', 'manual_review'];

async function getCurrentUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

function canReview(user) {
  return Boolean(user && Array.isArray(user.roleFlags) && user.roleFlags.some((role) => reviewerRoles.has(role)));
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const limit = Math.min(Number(event.limit) || 20, 50);
  const db = cloud.database();
  const _ = db.command;

  const reviewer = await getCurrentUser(db, OPENID);
  if (!canReview(reviewer)) return { ok: false, error: 'permission_denied' };

  const [requestResult, tripResult] = await Promise.all([
    db
      .collection('item_requests')
      .where({ reviewStatus: _.in(reviewStatuses) })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get(),
    db
      .collection('trips')
      .where({ verificationStatus: _.in(reviewStatuses) })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get(),
  ]);

  return {
    ok: true,
    requests: (requestResult.data || []).filter((request) => !request.isDeleted),
    trips: (tripResult.data || []).filter((trip) => trip.status !== 'cancelled'),
  };
};
