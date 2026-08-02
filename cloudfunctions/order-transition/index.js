const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const transitionRules = {
  pending_payment: {
    cancelled: { roles: ['requester', 'traveller'], reasonRequired: true },
  },
  item_handed_to_carrier: {
    in_transit: { roles: ['traveller'] },
  },
  in_transit: {
    arrived: { roles: ['traveller'] },
  },
  arrived: {
    delivered: { roles: ['traveller'], evidenceType: 'delivery_photo_or_video' },
  },
  delivered: {
    completed: { roles: ['requester'], createConfirmation: true },
  },
};

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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = text(event.orderId);
  const nextStatus = text(event.nextStatus);
  const reason = text(event.reason).slice(0, 500);
  const operationId = text(event.operationId).slice(0, 128);
  const evidenceIds = Array.isArray(event.evidenceIds) ? event.evidenceIds.map(text) : [];

  if (!orderId || !nextStatus) return { ok: false, error: 'missing_params' };
  if (!operationId) return { ok: false, error: 'missing_operation_id' };

  const db = cloud.database();
  const auditId = documentId('audit', 'order-transition', orderId, operationId);
  const confirmationEvidenceId = documentId('evidence', 'mutual-confirmation', orderId, operationId);
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existingAudit = await getDoc(transaction, 'audit_logs', auditId);
      if (existingAudit) {
        if (
          existingAudit.actorOpenid !== OPENID ||
          existingAudit.targetId !== orderId ||
          !existingAudit.after ||
          existingAudit.after.status !== nextStatus
        ) {
          throw businessError('idempotency_conflict');
        }
        response = {
          ok: true,
          currentStatus: existingAudit.before && existingAudit.before.status,
          nextStatus,
          evidenceIds: existingAudit.evidenceIds || [],
          idempotent: true,
        };
        return;
      }

      const order = await getDoc(transaction, 'orders', orderId);
      if (!order) throw businessError('order_not_found');
      const actorRole = participantRole(order, OPENID);
      if (!actorRole) throw businessError('permission_denied');
      if (order.activeDisputeId || order.status === 'disputed') throw businessError('active_dispute');

      const rule = transitionRules[order.status] && transitionRules[order.status][nextStatus];
      if (!rule) {
        throw businessError('illegal_transition', {
          currentStatus: order.status,
          nextStatus,
        });
      }
      if (!rule.roles.includes(actorRole)) throw businessError('permission_denied');
      if (rule.reasonRequired && !reason) throw businessError('missing_reason');

      let hasRequiredEvidence = !rule.evidenceType;
      for (const evidenceId of evidenceIds) {
        const evidence = await getDoc(transaction, 'evidence', evidenceId);
        if (!evidence || evidence.orderId !== orderId) throw businessError('invalid_evidence_reference');
        if (evidence.evidenceType === rule.evidenceType) hasRequiredEvidence = true;
      }
      if (!hasRequiredEvidence) throw businessError('required_evidence_missing');

      const now = new Date();
      const transitionEvidenceIds = [...evidenceIds];
      if (rule.createConfirmation) {
        await transaction.collection('evidence').doc(confirmationEvidenceId).set({
          data: {
            orderId,
            uploaderOpenid: OPENID,
            evidenceType: 'mutual_confirmation',
            fileIds: [],
            storagePath: `system://confirmation/${confirmationEvidenceId}`,
            fileCount: 0,
            description: '需求方已在平台内确认收货并完成订单。',
            visibility: 'both_parties',
            metadata: {
              source: 'order-transition',
              confirmationType: 'requester_delivery_confirmation',
            },
            operationId,
            createdAt: now,
          },
        });
        transitionEvidenceIds.push(confirmationEvidenceId);
      }

      await transaction.collection('orders').doc(orderId).update({
        data: {
          status: nextStatus,
          updatedAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(auditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'order',
          targetId: orderId,
          action: 'order.transition',
          before: { status: order.status },
          after: { status: nextStatus },
          reason,
          evidenceIds: transitionEvidenceIds,
          operationId,
          createdAt: now,
        },
      });
      response = {
        ok: true,
        currentStatus: order.status,
        nextStatus,
        evidenceIds: transitionEvidenceIds,
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
    console.error('order-transition transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
