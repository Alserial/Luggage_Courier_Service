const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const reviewerRoles = new Set(['admin', 'reviewer']);

async function getDoc(db, collection, id) {
  if (!id) return null;
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

async function getCurrentUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

function canReview(user) {
  return Boolean(user && Array.isArray(user.roleFlags) && user.roleFlags.some((role) => reviewerRoles.has(role)));
}

function participantRole(order, openid) {
  if (order.requesterOpenid === openid) return 'requester';
  if (order.travellerOpenid === openid) return 'traveller';
  return null;
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function visibleToCaller(message, openid, adminAccess) {
  if (adminAccess) return true;
  if (message.moderationStatus === 'visible') return true;
  return message.senderOpenid === openid && ['under_review', 'blocked'].includes(message.moderationStatus);
}

function sanitizeMessage(message, openid) {
  return {
    id: message._id,
    conversationId: message.conversationId,
    orderId: message.orderId,
    senderRole: message.senderRole,
    isMine: message.senderOpenid === openid,
    messageType: message.messageType,
    content: message.content,
    moderationStatus: message.moderationStatus,
    moderationReason: message.moderationReason || '',
    orderStatusAtSend: message.orderStatusAtSend,
    createdAt: toIso(message.createdAt),
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { conversationId, cursor } = event;
  const limit = Math.min(Math.max(Number(event.limit) || 30, 1), 50);
  if (!conversationId) return { ok: false, error: 'missing_conversation_id' };

  const db = cloud.database();
  const conversation = await getDoc(db, 'conversations', conversationId);
  if (!conversation) return { ok: false, error: 'conversation_not_found' };
  const order = await getDoc(db, 'orders', conversation.orderId);
  if (!order) return { ok: false, error: 'order_not_found' };

  const role = participantRole(order, OPENID);
  const currentUser = role ? null : await getCurrentUser(db, OPENID);
  const adminAccess = !role && canReview(currentUser);
  if (!role && !adminAccess) return { ok: false, error: 'permission_denied' };

  const where = { conversationId };
  if (cursor && cursor.createdAt) {
    const cursorDate = new Date(cursor.createdAt);
    if (!Number.isNaN(cursorDate.getTime())) where.createdAt = db.command.lt(cursorDate);
  }

  const result = await db.collection('messages').where(where).orderBy('createdAt', 'desc').limit(limit).get();
  const visibleMessages = (result.data || [])
    .filter((message) => visibleToCaller(message, OPENID, adminAccess))
    .reverse()
    .map((message) => sanitizeMessage(message, OPENID));
  const oldest = visibleMessages[0];

  return {
    ok: true,
    messages: visibleMessages,
    nextCursor: result.data && result.data.length === limit && oldest
      ? { createdAt: oldest.createdAt, messageId: oldest.id }
      : null,
    callerRole: role || 'admin',
  };
};
