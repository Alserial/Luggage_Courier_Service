const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

function expectedHandoverCode(orderId) {
  return `HANDOVER-${String(orderId).slice(-6).toUpperCase()}`;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, handoverCode, evidenceIds = [], operationId = '' } = event;
  if (!orderId || !handoverCode) return { ok: false, error: 'missing_params' };
  if (!Array.isArray(evidenceIds)) return { ok: false, error: 'invalid_evidence_ids' };

  const db = cloud.database();
  const now = new Date();
  const order = await getOrder(db, orderId);

  if (!order) return { ok: false, error: 'order_not_found' };
  if (!isParticipant(order, OPENID)) return { ok: false, error: 'permission_denied' };
  if (order.status !== 'paid_locked') {
    return { ok: false, error: 'illegal_transition', currentStatus: order.status, nextStatus: 'item_handed_to_carrier' };
  }
  if (handoverCode !== expectedHandoverCode(orderId)) {
    return { ok: false, error: 'invalid_handover_code' };
  }

  const record = await db.collection('handover_records').add({
    data: {
      orderId,
      handoverCode,
      confirmedByOpenid: OPENID,
      confirmationType: 'qr_scan_mock',
      metadata: {
        source: 'mini_program',
        evidenceIds,
      },
      createdAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'handover_record',
      targetId: record._id,
      action: 'handover.confirmScan',
      before: null,
      after: { orderId, confirmationType: 'qr_scan_mock', evidenceCount: evidenceIds.length },
      evidenceIds,
      operationId,
      createdAt: now,
    },
  });

  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'item_handed_to_carrier',
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
      after: { status: 'item_handed_to_carrier' },
      reason: 'handover_confirmed',
      evidenceIds,
      operationId,
      createdAt: now,
    },
  });

  return {
    ok: true,
    handoverRecordId: record._id,
    currentStatus: order.status,
    nextStatus: 'item_handed_to_carrier',
  };
};
