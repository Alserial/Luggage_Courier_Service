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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, evidenceType, description = '', fileIds = [], fileCount = 0 } = event;

  if (!orderId) return { ok: false, error: 'missing_order_id' };
  if (!allowedEvidenceTypes.has(evidenceType)) return { ok: false, error: 'invalid_evidence_type' };
  if (!fileIds.length && !fileCount) return { ok: false, error: 'missing_files' };

  const db = cloud.database();
  const now = new Date();
  const evidence = await db.collection('evidence').add({
    data: {
      orderId,
      uploaderOpenid: OPENID,
      evidenceType,
      fileIds,
      fileCount,
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
      after: { orderId, evidenceType, fileCount: fileIds.length || fileCount },
      createdAt: now,
    },
  });

  return { ok: true, evidenceId: evidence._id };
};
