const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const reviewerRoles = new Set(['admin', 'reviewer']);

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

function participantRole(order, openid) {
  if (order.requesterOpenid === openid) return 'requester';
  if (order.travellerOpenid === openid) return 'traveller';
  return null;
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function selectRange(messages, fromMessageId, toMessageId) {
  let start = 0;
  let end = messages.length;
  if (fromMessageId) {
    const index = messages.findIndex((message) => message._id === fromMessageId);
    if (index >= 0) start = index;
  }
  if (toMessageId) {
    const index = messages.findIndex((message) => message._id === toMessageId);
    if (index >= 0) end = index + 1;
  }
  return messages.slice(Math.min(start, end), Math.max(start, end));
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = text(event.orderId);
  const fromMessageId = text(event.fromMessageId);
  const toMessageId = text(event.toMessageId);
  const disputeId = text(event.disputeId);
  const operationId = text(event.operationId);
  if (!orderId) return { ok: false, error: 'missing_order_id' };
  const db = cloud.database();
  const order = await getDoc(db, 'orders', orderId);
  if (!order) return { ok: false, error: 'order_not_found' };
  const callerRole = participantRole(order, OPENID);
  const currentUser = callerRole ? null : await getCurrentUser(db, OPENID);
  const adminAccess = !callerRole && canReview(currentUser);
  if (!callerRole && !adminAccess) return { ok: false, error: 'permission_denied' };

  if (disputeId) {
    const dispute = await getDoc(db, 'disputes', disputeId);
    if (!dispute || dispute.orderId !== orderId) return { ok: false, error: 'invalid_dispute_id' };
  }

  const conversation = await getDoc(db, 'conversations', orderId);
  if (!conversation) return { ok: false, error: 'conversation_not_found' };
  const messageResult = await db.collection('messages')
    .where({ conversationId: conversation._id || orderId })
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get();
  const permittedMessages = (messageResult.data || []).filter((message) => (
    adminAccess || message.moderationStatus === 'visible'
  ));
  const selectedMessages = selectRange(permittedMessages, fromMessageId, toMessageId);
  if (!selectedMessages.length) return { ok: false, error: 'missing_messages' };

  const now = new Date();
  const transcript = {
    schemaVersion: 1,
    orderId,
    conversationId: orderId,
    generatedAt: now.toISOString(),
    generatedByRole: callerRole || 'admin',
    visibility: adminAccess ? 'admin_only' : 'both_parties',
    messageCount: selectedMessages.length,
    messages: selectedMessages.map((message) => ({
      id: message._id,
      senderRole: message.senderRole,
      messageType: message.messageType,
      content: message.content,
      moderationStatus: message.moderationStatus,
      orderStatusAtSend: message.orderStatusAtSend,
      createdAt: toIso(message.createdAt),
    })),
  };
  const fileContent = Buffer.from(JSON.stringify(transcript, null, 2), 'utf8');
  const contentHash = crypto.createHash('sha256').update(fileContent).digest('hex');
  const storagePath = `evidence/in-app-chat/${orderId}/${Date.now()}-${contentHash.slice(0, 12)}.json`;
  const uploaded = await cloud.uploadFile({ cloudPath: storagePath, fileContent });
  if (!uploaded.fileID) return { ok: false, error: 'transcript_upload_failed' };

  const evidence = await db.collection('evidence').add({
    data: {
      orderId,
      uploaderOpenid: OPENID,
      evidenceType: 'in_app_chat',
      fileIds: [uploaded.fileID],
      storagePath,
      fileCount: 1,
      description: `站内沟通记录，共 ${selectedMessages.length} 条消息`,
      visibility: adminAccess ? 'admin_only' : 'both_parties',
      metadata: {
        source: 'chat_evidence_snapshot',
        conversationId: orderId,
        messageIds: selectedMessages.map((message) => message._id),
        fromMessageId: selectedMessages[0]._id,
        toMessageId: selectedMessages[selectedMessages.length - 1]._id,
        fromTime: toIso(selectedMessages[0].createdAt),
        toTime: toIso(selectedMessages[selectedMessages.length - 1].createdAt),
        contentHash,
        disputeId,
      },
      createdAt: now,
    },
  });

  if (disputeId) {
    await db.collection('disputes').doc(disputeId).update({
      data: {
        evidenceIds: db.command.addToSet(evidence._id),
        updatedAt: now,
      },
    });
  }

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: callerRole || 'admin',
      targetType: 'evidence',
      targetId: evidence._id,
      action: 'chat.evidenceSnapshot',
      before: null,
      after: {
        orderId,
        conversationId: orderId,
        evidenceType: 'in_app_chat',
        messageCount: selectedMessages.length,
        contentHash,
        disputeId,
      },
      evidenceIds: [evidence._id],
      operationId,
      createdAt: now,
    },
  });

  return {
    ok: true,
    evidenceId: evidence._id,
    fileId: uploaded.fileID,
    storagePath,
    contentHash,
  };
};
