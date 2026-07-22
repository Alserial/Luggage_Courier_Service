const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const reviewerRoles = new Set(['admin', 'reviewer']);

async function getCurrentUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

function canReview(user) {
  return Boolean(user && Array.isArray(user.roleFlags) && user.roleFlags.some((role) => reviewerRoles.has(role)));
}

async function getDoc(db, collection, id) {
  if (!id) return null;
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const limit = Math.min(Math.max(Number(event.limit) || 30, 1), 50);
  const db = cloud.database();
  const reviewer = await getCurrentUser(db, OPENID);
  if (!canReview(reviewer)) return { ok: false, error: 'permission_denied' };

  const result = await db.collection('message_reports')
    .where({ status: db.command.in(['open', 'reviewing']) })
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();

  const reports = await Promise.all((result.data || []).map(async (report) => {
    const message = await getDoc(db, 'messages', report.messageId);
    return {
      id: report._id,
      orderId: report.orderId,
      conversationId: report.conversationId,
      messageId: report.messageId,
      messageContent: message ? message.content : '[消息不存在]',
      senderRole: message ? message.senderRole : 'unknown',
      moderationStatus: message ? message.moderationStatus : 'missing',
      reason: report.reason,
      description: report.description || '',
      systemGenerated: report.reporterOpenid === 'system',
      status: report.status,
      createdAt: toIso(report.createdAt),
    };
  }));

  return { ok: true, reports };
};
