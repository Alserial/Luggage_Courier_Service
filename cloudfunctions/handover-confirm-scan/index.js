const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function text(value) {
  return String(value || '').trim();
}

function documentId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
  return `${prefix}_${digest}`;
}

function businessError(code, details = {}) {
  const error = new Error(code);
  error.businessCode = code;
  Object.assign(error, details);
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

function expectedHandoverCode(orderId) {
  return `HANDOVER-${String(orderId).slice(-6).toUpperCase()}`;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = text(event.orderId);
  const handoverCode = text(event.handoverCode);
  const operationId = text(event.operationId).slice(0, 128);
  const evidenceIds = Array.isArray(event.evidenceIds) ? event.evidenceIds.map(text) : [];

  if (!orderId || !handoverCode) return { ok: false, error: 'missing_params' };
  if (!operationId) return { ok: false, error: 'missing_operation_id' };
  if (!evidenceIds.length) return { ok: false, error: 'handover_photo_required' };

  const db = cloud.database();
  const recordId = documentId('handover', orderId, operationId);
  const handoverEvidenceId = documentId('evidence', 'handover-scan', orderId, operationId);
  const recordAuditId = documentId('audit', 'handover-record', orderId, operationId);
  const orderAuditId = documentId('audit', 'handover-transition', orderId, operationId);
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existingRecord = await getDoc(transaction, 'handover_records', recordId);
      if (existingRecord) {
        if (existingRecord.orderId !== orderId || existingRecord.confirmedByOpenid !== OPENID) {
          throw businessError('idempotency_conflict');
        }
        response = {
          ok: true,
          handoverRecordId: recordId,
          evidenceId: handoverEvidenceId,
          nextStatus: 'item_handed_to_carrier',
          idempotent: true,
        };
        return;
      }

      const order = await getDoc(transaction, 'orders', orderId);
      if (!order) throw businessError('order_not_found');
      const actorRole = participantRole(order, OPENID);
      if (!actorRole) throw businessError('permission_denied');
      if (order.status !== 'paid_locked') {
        throw businessError('illegal_transition', {
          currentStatus: order.status,
          nextStatus: 'item_handed_to_carrier',
        });
      }
      if (handoverCode !== expectedHandoverCode(orderId)) throw businessError('invalid_handover_code');

      let hasItemPhoto = false;
      for (const evidenceId of evidenceIds) {
        const evidence = await getDoc(transaction, 'evidence', evidenceId);
        if (!evidence || evidence.orderId !== orderId) throw businessError('invalid_evidence_reference');
        if (evidence.evidenceType === 'item_photo') hasItemPhoto = true;
      }
      if (!hasItemPhoto) throw businessError('handover_photo_required');

      const now = new Date();
      const allEvidenceIds = [...evidenceIds, handoverEvidenceId];
      await transaction.collection('handover_records').doc(recordId).set({
        data: {
          orderId,
          handoverCode,
          confirmedByOpenid: OPENID,
          confirmationType: 'qr_scan_mock',
          metadata: {
            source: 'mini_program',
            evidenceIds,
          },
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('evidence').doc(handoverEvidenceId).set({
        data: {
          orderId,
          uploaderOpenid: 'system',
          evidenceType: 'handover_qr_scan',
          fileIds: [],
          storagePath: `system://handover/${recordId}`,
          fileCount: 0,
          description: '平台内交接确认码记录。',
          visibility: 'both_parties',
          metadata: {
            source: 'handover-confirm-scan',
            handoverRecordId: recordId,
            confirmedByOpenid: OPENID,
          },
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('orders').doc(orderId).update({
        data: {
          status: 'item_handed_to_carrier',
          updatedAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(recordAuditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'handover_record',
          targetId: recordId,
          action: 'handover.confirmScan',
          before: null,
          after: { orderId, confirmationType: 'qr_scan_mock', evidenceCount: allEvidenceIds.length },
          evidenceIds: allEvidenceIds,
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(orderAuditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'order',
          targetId: orderId,
          action: 'order.transition',
          before: { status: order.status },
          after: { status: 'item_handed_to_carrier' },
          reason: 'handover_confirmed',
          evidenceIds: allEvidenceIds,
          operationId,
          createdAt: now,
        },
      });
      response = {
        ok: true,
        handoverRecordId: recordId,
        evidenceId: handoverEvidenceId,
        currentStatus: order.status,
        nextStatus: 'item_handed_to_carrier',
      };
    });
    return response || { ok: false, error: 'transaction_failed' };
  } catch (error) {
    if (error && error.businessCode) {
      return {
        ok: false,
        error: error.businessCode,
        currentStatus: error.currentStatus,
        nextStatus: error.nextStatus,
      };
    }
    console.error('handover-confirm-scan transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
