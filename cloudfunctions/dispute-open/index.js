const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const terminalStates = new Set(['completed', 'cancelled', 'refunded']);

async function getOrder(db, orderId) {
  try {
    return (await db.collection('orders').doc(orderId).get()).data;
  } catch (error) {
    return null;
  }
}

function isParticipant(order, openid) {
  return order.requesterOpenid === openid || order.travellerOpenid === openid;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, reason, description, evidenceIds = [], operationId = '' } = event;
  if (!orderId) return { ok: false, error: 'missing_order_id' };
  if (!reason) return { ok: false, error: 'missing_reason' };
  if (!description) return { ok: false, error: 'missing_description' };
  if (!Array.isArray(evidenceIds)) return { ok: false, error: 'invalid_evidence_ids' };

  const db = cloud.database();
  const now = new Date();
  const order = await getOrder(db, orderId);

  if (!order) return { ok: false, error: 'order_not_found' };
  if (!isParticipant(order, OPENID)) return { ok: false, error: 'permission_denied' };
  if (order.status === 'disputed') return { ok: false, error: 'order_already_disputed' };
  if (terminalStates.has(order.status)) {
    return { ok: false, error: 'terminal_order_state', currentStatus: order.status };
  }

  const dispute = await db.collection('disputes').add({
    data: {
      orderId,
      openedByOpenid: OPENID,
      reason,
      description,
      evidenceIds,
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
      after: { orderId, reason, status: 'open', evidenceCount: evidenceIds.length },
      evidenceIds,
      operationId,
      createdAt: now,
    },
  });

  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'disputed',
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
      before: { status: order.status },
      after: { status: 'disputed' },
      reason: 'dispute_opened',
      evidenceIds,
      operationId,
      createdAt: now,
    },
  });

  return { ok: true, disputeId: dispute._id, currentStatus: order.status, nextStatus: 'disputed' };
};
