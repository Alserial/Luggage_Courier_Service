const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, reason, description } = event;
  if (!orderId) return { ok: false, error: 'missing_order_id' };
  if (!reason) return { ok: false, error: 'missing_reason' };
  if (!description) return { ok: false, error: 'missing_description' };

  const db = cloud.database();
  const now = new Date();
  const dispute = await db.collection('disputes').add({
    data: {
      orderId,
      openedByOpenid: OPENID,
      reason,
      description,
      evidenceIds: [],
      status: 'open',
      decision: null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'dispute',
      targetId: dispute._id,
      action: 'dispute.open',
      before: null,
      after: { orderId, reason, status: 'open' },
      createdAt: now,
    },
  });

  return { ok: true, disputeId: dispute._id };
};
