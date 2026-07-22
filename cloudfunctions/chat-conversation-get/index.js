const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const reviewerRoles = new Set(['admin', 'reviewer']);
const readOnlyOrderStatuses = new Set(['completed', 'cancelled', 'refunded']);

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

function conversationStatus(orderStatus) {
  return readOnlyOrderStatuses.has(orderStatus) ? 'read_only' : 'active';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId } = event;
  if (!orderId) return { ok: false, error: 'missing_order_id' };

  if (orderId === 'demo_order_001') {
    return {
      ok: true,
      conversation: {
        id: 'demo_conversation_001',
        orderId,
        status: 'active',
        callerRole: 'requester',
      },
    };
  }

  const db = cloud.database();
  const order = await getDoc(db, 'orders', orderId);
  if (!order) return { ok: false, error: 'order_not_found' };

  const role = participantRole(order, OPENID);
  const currentUser = role ? null : await getCurrentUser(db, OPENID);
  const adminAccess = !role && canReview(currentUser);
  if (!role && !adminAccess) return { ok: false, error: 'permission_denied' };

  const now = new Date();
  const status = conversationStatus(order.status);
  const conversationId = orderId;
  let conversation = await getDoc(db, 'conversations', conversationId);

  if (!conversation) {
    conversation = {
      orderId,
      participantOpenids: [order.requesterOpenid, order.travellerOpenid],
      status,
      lastMessageId: '',
      lastMessagePreview: '',
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('conversations').doc(conversationId).set({ data: conversation });
    const systemContent = '订单沟通已开启。请在平台内确认交接安排，并通过证据页面提交物品、交接和送达凭证。';
    const systemMessageId = `${conversationId}_system_created`;
    await db.collection('messages').doc(systemMessageId).set({
      data: {
        conversationId,
        orderId,
        participantOpenids: [order.requesterOpenid, order.travellerOpenid],
        senderOpenid: 'system',
        senderRole: 'system',
        messageType: 'system',
        content: systemContent,
        moderationStatus: 'visible',
        moderationReason: '',
        clientMessageId: 'system_conversation_created',
        orderStatusAtSend: order.status,
        createdAt: now,
      },
    });
    await db.collection('conversations').doc(conversationId).update({
      data: {
        lastMessageId: systemMessageId,
        lastMessagePreview: systemContent.slice(0, 60),
        lastMessageAt: now,
        updatedAt: now,
      },
    });
    conversation.lastMessageAt = now;
  } else if (conversation.status !== status) {
    await db.collection('conversations').doc(conversationId).update({
      data: { status, updatedAt: now },
    });
    conversation.status = status;
  }

  return {
    ok: true,
    conversation: {
      id: conversationId,
      orderId,
      status: conversation.status,
      callerRole: role || 'admin',
      lastMessageAt: conversation.lastMessageAt || null,
    },
  };
};
