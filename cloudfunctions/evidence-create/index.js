const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const userEvidenceTypes = new Set([
  'item_photo',
  'flight_record',
  'customs_or_airline_proof',
  'delivery_photo_or_video',
]);

function text(value) {
  return String(value || '').trim();
}

function documentId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
  return `${prefix}_${digest}`;
}

function businessError(code) {
  const error = new Error(code);
  error.businessCode = code;
  return error;
}

async function getDoc(database, collection, id) {
  try {
    return (await database.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

function participantRole(order, openid) {
  if (order.requesterOpenid === openid) return 'requester';
  if (order.travellerOpenid === openid) return 'traveller';
  return null;
}

function normalizeFileMetadata(fileIds, metadata) {
  if (!Array.isArray(metadata) || metadata.length !== fileIds.length) return null;
  return metadata.map((item, index) => ({
    fileId: fileIds[index],
    fileType: item && item.fileType === 'video' ? 'video' : 'image',
    sizeBytes: Math.max(0, Number(item && item.sizeBytes) || 0),
  }));
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = text(event.orderId);
  const evidenceType = text(event.evidenceType);
  const description = text(event.description).slice(0, 1000);
  const operationId = text(event.operationId).slice(0, 128);
  const fileIds = Array.isArray(event.fileIds) ? event.fileIds.map(text) : [];

  if (!orderId) return { ok: false, error: 'missing_order_id' };
  if (!operationId) return { ok: false, error: 'missing_operation_id' };
  if (!userEvidenceTypes.has(evidenceType)) return { ok: false, error: 'invalid_evidence_type' };
  if (!fileIds.length || fileIds.length > 6) return { ok: false, error: 'invalid_file_count' };
  if (fileIds.some((fileId) => !fileId.startsWith('cloud://'))) return { ok: false, error: 'invalid_file_ids' };

  const files = normalizeFileMetadata(fileIds, event.fileMetadata);
  if (!files) return { ok: false, error: 'invalid_file_metadata' };
  if (
    files.some(
      (file) =>
        file.sizeBytes <= 0 ||
        (file.fileType === 'image' && file.sizeBytes > 5 * 1024 * 1024) ||
        (file.fileType === 'video' && file.sizeBytes > 20 * 1024 * 1024),
    )
  ) {
    return { ok: false, error: 'file_size_exceeded' };
  }

  const db = cloud.database();
  const evidenceId = documentId('evidence', OPENID, operationId);
  const auditId = documentId('audit', 'evidence-create', OPENID, operationId);
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existing = await getDoc(transaction, 'evidence', evidenceId);
      if (existing) {
        if (existing.orderId !== orderId || existing.uploaderOpenid !== OPENID || existing.evidenceType !== evidenceType) {
          throw businessError('idempotency_conflict');
        }
        response = { ok: true, evidenceId, idempotent: true };
        return;
      }

      const order = await getDoc(transaction, 'orders', orderId);
      if (!order) throw businessError('order_not_found');
      const actorRole = participantRole(order, OPENID);
      if (!actorRole) throw businessError('permission_denied');

      const now = new Date();
      await transaction.collection('evidence').doc(evidenceId).set({
        data: {
          orderId,
          uploaderOpenid: OPENID,
          evidenceType,
          fileIds,
          storagePath: fileIds[0],
          fileCount: fileIds.length,
          description,
          visibility: 'both_parties',
          metadata: {
            source: 'mini_program',
            files,
          },
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(auditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'evidence',
          targetId: evidenceId,
          action: 'evidence.create',
          before: null,
          after: { orderId, evidenceType, fileCount: fileIds.length },
          evidenceIds: [evidenceId],
          operationId,
          createdAt: now,
        },
      });
      response = { ok: true, evidenceId };
    });
    return response || { ok: false, error: 'transaction_failed' };
  } catch (error) {
    if (error && error.businessCode) return { ok: false, error: error.businessCode };
    console.error('evidence-create transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
