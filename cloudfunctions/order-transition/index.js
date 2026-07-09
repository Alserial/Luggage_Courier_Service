const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedTransitions = {
  approved: ['pending_payment', 'cancelled', 'disputed'],
  pending_payment: ['paid_locked', 'cancelled', 'disputed'],
  paid_locked: ['item_handed_to_carrier', 'cancelled', 'refunded', 'disputed'],
  item_handed_to_carrier: ['in_transit', 'disputed'],
  in_transit: ['arrived', 'disputed'],
  arrived: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  disputed: ['refunded', 'completed', 'cancelled'],
};

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, nextStatus, reason = '' } = event;
  if (!orderId || !nextStatus) return { ok: false, error: 'missing_params' };

  const db = cloud.database();
  const orderDoc = await db.collection('orders').doc(orderId).get();
  const order = orderDoc.data;
  const currentStatus = order.status;
  const allowed = allowedTransitions[currentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    return { ok: false, error: 'illegal_transition', currentStatus, nextStatus };
  }

  const now = new Date();
  await db.collection('orders').doc(orderId).update({
    data: {
      status: nextStatus,
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'order',
      targetId: orderId,
      action: 'order.transition',
      before: { status: currentStatus },
      after: { status: nextStatus },
      reason,
      createdAt: now,
    },
  });

  return { ok: true, currentStatus, nextStatus };
};
