const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedReasons = new Set([
  'external_contact',
  'external_payment',
  'prohibited_item',
  'harassment',
  'fraud',
  'spam',
  'other',
]);

function text(value) {
  return String(value || '').trim();
}

async function getDoc(db, collection, id) {
  if (!id) return null;
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

function participantRole(order, openid) {
  if (order.requesterOpenid === openid) return 'requester';
  if (order.travellerOpenid === openid) return 'traveller';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const messageId = text(event.messageId);
  const reason = text(event.reason);
  const description = text(event.description).slice(0, 500);
  const operationId = text(event.operationId);
  if (!messageId || !reason) return { ok: false, error: 'missing_params' };
  if (!allowedReasons.has(reason)) return { ok: false, error: 'invalid_reason' };
  if (reason === 'other' && !description) return { ok: false, error: 'missing_description' };
  const db = cloud.database();
  const message = await getDoc(db, 'messages', messageId);
  if (!message) return { ok: false, error: 'message_not_found' };
  const order = await getDoc(db, 'orders', message.orderId);
  if (!order) return { ok: false, error: 'order_not_found' };
  const reporterRole = participantRole(order, OPENID);
  if (!reporterRole) return { ok: false, error: 'permission_denied' };
  if (message.senderOpenid === OPENID) return { ok: false, error: 'cannot_report_own_message' };

  const duplicate = await db.collection('message_reports').where({
    messageId,
    reporterOpenid: OPENID,
    status: db.command.in(['open', 'reviewing']),
  }).limit(1).get();
  if (duplicate.data.length) return { ok: true, reportId: duplicate.data[0]._id, idempotent: true };

  const now = new Date();
  const created = await db.collection('message_reports').add({
    data: {
      orderId: order._id,
      conversationId: message.conversationId,
      messageId,
      reporterOpenid: OPENID,
      reason,
      description,
      status: 'open',
      decision: null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: reporterRole,
      targetType: 'message_report',
      targetId: created._id,
      action: 'chat.messageReport',
      before: null,
      after: { orderId: order._id, messageId, reason, status: 'open' },
      operationId,
      createdAt: now,
    },
  });

  return { ok: true, reportId: created._id };
};
