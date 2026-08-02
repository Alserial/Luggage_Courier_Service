const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function getDoc(db, collection, id) {
  if (!id) return null;
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

function isParticipant(order, openid) {
  return order.requesterOpenid === openid || order.travellerOpenid === openid;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { conversationId, lastReadMessageId = '' } = event;
  if (!conversationId) return { ok: false, error: 'missing_conversation_id' };
  const db = cloud.database();
  const conversation = await getDoc(db, 'conversations', conversationId);
  if (!conversation) return { ok: false, error: 'conversation_not_found' };
  const order = await getDoc(db, 'orders', conversation.orderId);
  if (!order) return { ok: false, error: 'order_not_found' };
  if (!isParticipant(order, OPENID)) return { ok: false, error: 'permission_denied' };

  if (lastReadMessageId) {
    const message = await getDoc(db, 'messages', lastReadMessageId);
    if (!message || message.conversationId !== conversationId) return { ok: false, error: 'invalid_message_id' };
  }

  const now = new Date();
  const receiptId = `${conversationId}_${OPENID}`;
  await db.collection('message_receipts').doc(receiptId).set({
    data: {
      conversationId,
      orderId: order._id,
      readerOpenid: OPENID,
      lastReadMessageId,
      lastReadAt: now,
      updatedAt: now,
    },
  });
  return { ok: true, lastReadAt: now };
};
