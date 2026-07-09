const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedEvidenceTypes = new Set([
  'item_photo',
  'handover_qr_scan',
  'in_app_chat',
  'payment_record',
  'flight_record',
  'customs_or_airline_proof',
  'delivery_photo_or_video',
  'mutual_confirmation',
]);

async function getOrder(db, orderId) {
  try {
    return (await db.collection('orders').doc(orderId).get()).data;
  } catch (error) {
    return null;
  }
}

function getParticipantRole(order, openid) {
  if (order.requesterOpenid === openid) return 'requester';
  if (order.travellerOpenid === openid) return 'traveller';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, evidenceType, description = '', fileIds = [], fileCount = 0, operationId = '' } = event;
  const normalizedFileCount = Number(fileCount);

  if (!orderId) return { ok: false, error: 'missing_order_id' };
  if (!Array.isArray(fileIds)) return { ok: false, error: 'invalid_file_ids' };
  if (!Number.isFinite(normalizedFileCount) || normalizedFileCount < 0) {
    return { ok: false, error: 'invalid_file_count' };
  }
  if (!allowedEvidenceTypes.has(evidenceType)) return { ok: false, error: 'invalid_evidence_type' };
  if (!fileIds.length && !normalizedFileCount) return { ok: false, error: 'missing_files' };

  const db = cloud.database();
  const now = new Date();
  const order = await getOrder(db, orderId);

  if (!order) return { ok: false, error: 'order_not_found' };

  const actorRole = getParticipantRole(order, OPENID);
  if (!actorRole) return { ok: false, error: 'permission_denied' };

  const evidence = await db.collection('evidence').add({
    data: {
      orderId,
      uploaderOpenid: OPENID,
      evidenceType,
      fileIds,
      fileCount: fileIds.length || normalizedFileCount,
      description,
      visibility: 'both_parties',
      metadata: {
        source: 'mini_program',
      },
      createdAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'evidence',
      targetId: evidence._id,
      action: 'evidence.create',
      before: null,
      after: { orderId, evidenceType, fileCount: fileIds.length || normalizedFileCount },
      operationId,
      createdAt: now,
    },
  });

  return { ok: true, evidenceId: evidence._id };
};
