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

  const [requestResult, tripResult, disputeResult] = await Promise.all([
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
    db
      .collection('disputes')
      .where({ status: _.in(['open', 'under_review']) })
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get(),
  ]);

  const disputes = await Promise.all(
    (disputeResult.data || []).map(async (dispute) => {
      let order = null;
      try {
        order = (await db.collection('orders').doc(dispute.orderId).get()).data;
      } catch (error) {
        order = null;
      }
      const evidence = await Promise.all(
        (dispute.evidenceIds || []).map(async (evidenceId) => {
          try {
            return (await db.collection('evidence').doc(evidenceId).get()).data;
          } catch (error) {
            return null;
          }
        }),
      );
      return {
        ...dispute,
        order: order
          ? {
              _id: order._id,
              status: order.status,
              feeBreakdown: order.feeBreakdown,
              requesterOpenid: order.requesterOpenid,
              travellerOpenid: order.travellerOpenid,
            }
          : null,
        evidence: evidence.filter(Boolean),
      };
    }),
  );

  return {
    ok: true,
    requests: (requestResult.data || []).filter((request) => !request.isDeleted),
    trips: (tripResult.data || []).filter((trip) => trip.status !== 'cancelled'),
    disputes,
  };
};
