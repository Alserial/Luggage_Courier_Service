const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const reviewerRoles = new Set(['admin', 'reviewer']);
const allowedActions = new Set(['hide', 'restore', 'dismiss']);

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

async function getCurrentUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

function canReview(user) {
  return Boolean(user && Array.isArray(user.roleFlags) && user.roleFlags.some((role) => reviewerRoles.has(role)));
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const reportId = text(event.reportId);
  const action = text(event.action);
  const reason = text(event.reason);
  const operationId = text(event.operationId);
  if (!reportId || !action) return { ok: false, error: 'missing_params' };
  if (!allowedActions.has(action)) return { ok: false, error: 'invalid_action' };
  if (!reason) return { ok: false, error: 'missing_reason' };

  const db = cloud.database();
  const reviewer = await getCurrentUser(db, OPENID);
  if (!canReview(reviewer)) return { ok: false, error: 'permission_denied' };
  const report = await getDoc(db, 'message_reports', reportId);
  if (!report) return { ok: false, error: 'report_not_found' };
  const message = await getDoc(db, 'messages', report.messageId);
  if (!message) return { ok: false, error: 'message_not_found' };

  const now = new Date();
  const nextModerationStatus = action === 'hide'
    ? 'admin_hidden'
    : action === 'restore'
      ? 'visible'
      : message.moderationStatus;
  const nextReportStatus = action === 'dismiss' ? 'dismissed' : 'resolved';

  if (action !== 'dismiss') {
    await db.collection('messages').doc(message._id).update({
      data: {
        moderationStatus: nextModerationStatus,
        moderationReason: action === 'hide' ? 'admin_hidden' : '',
        moderatedByOpenid: OPENID,
        moderatedAt: now,
      },
    });
  }

  const decision = {
    adminOpenid: OPENID,
    action,
    reason,
    previousModerationStatus: message.moderationStatus,
    resultingModerationStatus: nextModerationStatus,
    decidedAt: now,
  };
  await db.collection('message_reports').doc(reportId).update({
    data: { status: nextReportStatus, decision, updatedAt: now },
  });

  if (action === 'hide') {
    const conversation = await getDoc(db, 'conversations', message.conversationId);
    if (conversation && conversation.lastMessageId === message._id) {
      await db.collection('conversations').doc(message.conversationId).update({
        data: { lastMessageId: '', lastMessagePreview: '', updatedAt: now },
      });
    }
  }

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'reviewer',
      targetType: 'message_report',
      targetId: reportId,
      action: 'chat.adminReview',
      before: { reportStatus: report.status, moderationStatus: message.moderationStatus },
      after: { reportStatus: nextReportStatus, moderationStatus: nextModerationStatus, action },
      reason,
      operationId,
      createdAt: now,
    },
  });

  return {
    ok: true,
    reportId,
    reportStatus: nextReportStatus,
    moderationStatus: nextModerationStatus,
  };
};
