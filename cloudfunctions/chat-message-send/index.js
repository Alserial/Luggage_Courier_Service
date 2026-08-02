const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const writableOrderStatuses = new Set([
  'pending_payment',
  'paid_locked',
  'item_handed_to_carrier',
  'in_transit',
  'arrived',
  'delivered',
  'disputed',
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

function localRiskReason(content) {
  if (/(?:\+?86[- ]?)?1[3-9]\d{9}/.test(content)) return 'external_phone_number';
  if (/(微信号|加我微信|vx|v信|扫码加|联系方式)/i.test(content)) return 'external_contact';
  if (/(私下交易|私下转账|微信转账|支付宝|银行卡|站外支付|绕过平台)/i.test(content)) return 'external_payment';
  if (/(处方药|香烟|电子烟|酒类|生鲜|肉类|种子|现金|储值卡|武器|刀具|化学品|仿冒品)/i.test(content)) return 'prohibited_item';
  if (/(威胁|恐吓|人身攻击|弄死|打死)/i.test(content)) return 'threat_or_harassment';
  return '';
}

function interpretSecurityResult(result) {
  const detail = result && result.result ? result.result : result || {};
  const suggest = detail.suggest || result.suggest;
  if (suggest === 'pass') return { status: 'visible', reason: '' };
  if (suggest === 'review') return { status: 'under_review', reason: 'content_security_review' };
  if (suggest === 'risky') return { status: 'blocked', reason: 'content_security_risky' };
  if (result && result.errCode === 87014) return { status: 'blocked', reason: 'content_security_risky' };
  if (result && result.errCode === 0) return { status: 'visible', reason: '' };
  return { status: 'under_review', reason: 'content_security_unknown' };
}

async function checkWeChatContent(content, openid) {
  if (!cloud.openapi || !cloud.openapi.security || !cloud.openapi.security.msgSecCheck) {
    return { status: 'under_review', reason: 'content_security_unavailable' };
  }

  try {
    const result = await cloud.openapi.security.msgSecCheck({
      content,
      version: 2,
      scene: 2,
      openid,
    });
    return interpretSecurityResult(result);
  } catch (firstError) {
    try {
      const legacyResult = await cloud.openapi.security.msgSecCheck({ content });
      return interpretSecurityResult(legacyResult);
    } catch (legacyError) {
      console.warn('msgSecCheck unavailable', firstError, legacyError);
      return { status: 'under_review', reason: 'content_security_unavailable' };
    }
  }
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
    createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt || ''),
  };
}

async function findExistingMessage(db, conversationId, clientMessageId) {
  const result = await db.collection('messages').where({ conversationId, clientMessageId }).limit(1).get();
  return result.data[0] || null;
}

async function recentMessageCount(db, conversationId, senderOpenid) {
  const since = new Date(Date.now() - 60 * 1000);
  const result = await db.collection('messages').where({
    conversationId,
    senderOpenid,
    createdAt: db.command.gte(since),
  }).limit(20).get();
  return (result.data || []).length;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const conversationId = text(event.conversationId);
  const clientMessageId = text(event.clientMessageId);
  const messageType = text(event.messageType);
  const content = text(event.content);

  if (!conversationId || !clientMessageId) return { ok: false, error: 'missing_params' };
  if (messageType !== 'text') return { ok: false, error: 'invalid_message_type' };
  if (!content || content.length > 500) return { ok: false, error: 'invalid_message_length' };

  const db = cloud.database();
  const conversation = await getDoc(db, 'conversations', conversationId);
  if (!conversation) return { ok: false, error: 'conversation_not_found' };
  const order = await getDoc(db, 'orders', conversation.orderId);
  if (!order) return { ok: false, error: 'order_not_found' };
  const senderRole = participantRole(order, OPENID);
  if (!senderRole) return { ok: false, error: 'permission_denied' };
  if (conversation.status !== 'active' || !writableOrderStatuses.has(order.status)) {
    return { ok: false, error: 'conversation_read_only' };
  }

  const existing = await findExistingMessage(db, conversationId, clientMessageId);
  if (existing) {
    if (existing.senderOpenid !== OPENID) return { ok: false, error: 'idempotency_conflict' };
    return {
      ok: true,
      messageId: existing._id,
      moderationStatus: existing.moderationStatus,
      message: sanitizeMessage(existing, OPENID),
      idempotent: true,
    };
  }

  if ((await recentMessageCount(db, conversationId, OPENID)) >= 10) {
    return { ok: false, error: 'rate_limited' };
  }

  const riskReason = localRiskReason(content);
  const moderation = riskReason
    ? { status: 'blocked', reason: riskReason }
    : await checkWeChatContent(content, OPENID);
  const now = new Date();
  const messageData = {
    conversationId,
    orderId: order._id,
    participantOpenids: [order.requesterOpenid, order.travellerOpenid],
    senderOpenid: OPENID,
    senderRole,
    messageType,
    content,
    moderationStatus: moderation.status,
    moderationReason: moderation.reason,
    clientMessageId,
    orderStatusAtSend: order.status,
    createdAt: now,
  };
  const created = await db.collection('messages').add({ data: messageData });
  const message = { _id: created._id, ...messageData };

  if (moderation.status === 'under_review') {
    await db.collection('message_reports').add({
      data: {
        orderId: order._id,
        conversationId,
        messageId: created._id,
        reporterOpenid: 'system',
        reason: moderation.reason,
        description: '系统内容安全检查未能自动放行，需要管理员复核。',
        status: 'open',
        decision: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  if (moderation.status === 'visible') {
    await db.collection('conversations').doc(conversationId).update({
      data: {
        lastMessageId: created._id,
        lastMessagePreview: content.slice(0, 60),
        lastMessageAt: now,
        updatedAt: now,
      },
    });
  } else {
    await db.collection('audit_logs').add({
      data: {
        actorOpenid: OPENID,
        actorRole: senderRole,
        targetType: 'message',
        targetId: created._id,
        action: moderation.status === 'blocked' ? 'chat.messageBlocked' : 'chat.messageHeld',
        before: null,
        after: {
          orderId: order._id,
          conversationId,
          moderationStatus: moderation.status,
          moderationReason: moderation.reason,
        },
        operationId: clientMessageId,
        createdAt: now,
      },
    });
  }

  return {
    ok: true,
    messageId: created._id,
    moderationStatus: moderation.status,
    message: sanitizeMessage(message, OPENID),
  };
};
