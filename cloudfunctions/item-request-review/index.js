const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedDecisions = new Set(['approved', 'rejected', 'manual_review']);
const reviewerRoles = new Set(['admin', 'reviewer']);

function text(value) {
  return String(value || '').trim();
}

async function getCurrentUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

function canReview(user) {
  return Boolean(user && Array.isArray(user.roleFlags) && user.roleFlags.some((role) => reviewerRoles.has(role)));
}

async function getRequest(db, requestId) {
  try {
    return (await db.collection('item_requests').doc(requestId).get()).data;
  } catch (error) {
    return null;
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { requestId, decision, operationId = '' } = event;
  const reviewReason = text(event.reviewReason);

  if (!requestId) return { ok: false, error: 'missing_request_id' };
  if (!allowedDecisions.has(decision)) return { ok: false, error: 'invalid_decision' };
  if (decision !== 'approved' && !reviewReason) return { ok: false, error: 'missing_review_reason' };

  const db = cloud.database();
  const reviewer = await getCurrentUser(db, OPENID);
  if (!canReview(reviewer)) return { ok: false, error: 'permission_denied' };

  const before = await getRequest(db, requestId);
  if (!before) return { ok: false, error: 'request_not_found' };
  if (before.isDeleted) return { ok: false, error: 'request_deleted' };

  const now = new Date();
  const after = {
    reviewStatus: decision,
    reviewReason,
    reviewedByOpenid: OPENID,
    reviewedAt: now,
    updatedAt: now,
  };

  await db.collection('item_requests').doc(requestId).update({ data: after });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'reviewer',
      targetType: 'item_request',
      targetId: requestId,
      action: 'itemRequest.review',
      before: {
        reviewStatus: before.reviewStatus,
        reviewReason: before.reviewReason || '',
      },
      after,
      operationId,
      createdAt: now,
    },
  });

  return { ok: true, requestId, reviewStatus: decision };
};
