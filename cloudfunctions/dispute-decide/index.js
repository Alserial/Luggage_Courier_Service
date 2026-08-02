const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const reviewerRoles = new Set(['admin', 'reviewer']);
const actions = new Set(['refund', 'complete', 'cancel_order', 'keep_in_dispute']);

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
  if (!id) return null;
  try {
    return (await database.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

async function getCurrentReviewer(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  const user = result.data[0] || null;
  if (!user || !Array.isArray(user.roleFlags)) return null;
  return user.roleFlags.some((role) => reviewerRoles.has(role)) ? user : null;
}

async function findLegacyPayment(db, order) {
  if (order.paymentId) return getDoc(db, 'payments', order.paymentId);
  const result = await db.collection('payments').where({ orderId: order._id }).limit(1).get();
  return result.data[0] || null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const disputeId = text(event.disputeId);
  const action = text(event.action);
  const reason = text(event.reason).slice(0, 1000);
  const operationId = text(event.operationId).slice(0, 128);
  const evidenceIdsReviewed = Array.isArray(event.evidenceIdsReviewed)
    ? [...new Set(event.evidenceIdsReviewed.map(text).filter(Boolean))]
    : [];

  if (!disputeId || !action) return { ok: false, error: 'missing_params' };
  if (!actions.has(action)) return { ok: false, error: 'invalid_action' };
  if (!reason) return { ok: false, error: 'missing_reason' };
  if (!operationId) return { ok: false, error: 'missing_operation_id' };
  if (!evidenceIdsReviewed.length) return { ok: false, error: 'evidence_review_required' };

  const db = cloud.database();
  const reviewer = await getCurrentReviewer(db, OPENID);
  if (!reviewer) return { ok: false, error: 'permission_denied' };
  const actorRole = reviewer.roleFlags.includes('admin') ? 'admin' : 'reviewer';

  const disputeSnapshot = await getDoc(db, 'disputes', disputeId);
  if (!disputeSnapshot) return { ok: false, error: 'dispute_not_found' };
  const orderSnapshot = await getDoc(db, 'orders', disputeSnapshot.orderId);
  if (!orderSnapshot) return { ok: false, error: 'order_not_found' };

  let paymentSnapshot = null;
  if (action === 'refund') {
    paymentSnapshot = await findLegacyPayment(db, { ...orderSnapshot, _id: disputeSnapshot.orderId });
    if (!paymentSnapshot) return { ok: false, error: 'payment_not_found' };
    if (paymentSnapshot.provider !== 'mock') return { ok: false, error: 'unsupported_payment_provider' };
  }

  const auditId = documentId('audit', 'dispute-decide', disputeId, operationId);
  const orderAuditId = documentId('audit', 'dispute-order-decision', disputeId, operationId);
  const systemEvidenceId = documentId('evidence', 'dispute-decision', disputeId, operationId);
  const nextStatusByAction = {
    refund: 'refunded',
    complete: 'completed',
    cancel_order: 'cancelled',
    keep_in_dispute: 'disputed',
  };
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existingAudit = await getDoc(transaction, 'audit_logs', auditId);
      if (existingAudit) {
        if (
          existingAudit.actorOpenid !== OPENID ||
          existingAudit.targetId !== disputeId ||
          !existingAudit.after ||
          existingAudit.after.action !== action
        ) {
          throw businessError('idempotency_conflict');
        }
        response = {
          ok: true,
          disputeId,
          action,
          nextStatus: nextStatusByAction[action],
          idempotent: true,
        };
        return;
      }

      const dispute = await getDoc(transaction, 'disputes', disputeId);
      if (!dispute) throw businessError('dispute_not_found');
      if (!['open', 'under_review'].includes(dispute.status)) throw businessError('dispute_already_resolved');

      const order = await getDoc(transaction, 'orders', dispute.orderId);
      if (!order) throw businessError('order_not_found');
      if (order.status !== 'disputed' || order.activeDisputeId !== disputeId) {
        throw businessError('order_dispute_mismatch');
      }

      for (const evidenceId of evidenceIdsReviewed) {
        const evidence = await getDoc(transaction, 'evidence', evidenceId);
        if (!evidence || evidence.orderId !== dispute.orderId) throw businessError('invalid_evidence_reference');
      }

      const now = new Date();
      const nextStatus = nextStatusByAction[action];
      const decision = {
        adminOpenid: OPENID,
        action,
        reason,
        evidenceIds: evidenceIdsReviewed,
        decidedAt: now,
      };
      const generatedEvidenceIds = [];

      if (action === 'refund') {
        const paymentId = order.paymentId || paymentSnapshot._id;
        const payment = await getDoc(transaction, 'payments', paymentId);
        if (!payment || payment.orderId !== dispute.orderId) throw businessError('payment_not_found');
        if (payment.provider !== 'mock') throw businessError('unsupported_payment_provider');
        if (payment.paymentStatus !== 'paid' || payment.refundStatus === 'refunded') {
          throw businessError('payment_not_refundable');
        }

        const providerRefundId = documentId('mockrefund', dispute.orderId, operationId);
        await transaction.collection('payments').doc(paymentId).update({
          data: {
            providerRefundId,
            paymentStatus: 'paid',
            lockStatus: 'none',
            refundStatus: 'refunded',
            refundedAt: now,
            updatedAt: now,
          },
        });
        await transaction.collection('evidence').doc(systemEvidenceId).set({
          data: {
            orderId: dispute.orderId,
            uploaderOpenid: 'system',
            evidenceType: 'payment_record',
            fileIds: [],
            storagePath: `system://payment/refund/${paymentId}`,
            fileCount: 0,
            description: '管理员已将 Mock 服务费记录标记为退款；不涉及商品货款。',
            visibility: 'both_parties',
            metadata: {
              source: 'dispute-decide',
              provider: 'mock',
              paymentId,
              providerRefundId,
            },
            operationId,
            createdAt: now,
          },
        });
        generatedEvidenceIds.push(systemEvidenceId);
      }

      if (action === 'complete') {
        await transaction.collection('evidence').doc(systemEvidenceId).set({
          data: {
            orderId: dispute.orderId,
            uploaderOpenid: 'system',
            evidenceType: 'mutual_confirmation',
            fileIds: [],
            storagePath: `system://confirmation/admin/${systemEvidenceId}`,
            fileCount: 0,
            description: '管理员依据已审查证据完成订单。',
            visibility: 'both_parties',
            metadata: { source: 'dispute-decide', disputeId },
            operationId,
            createdAt: now,
          },
        });
        generatedEvidenceIds.push(systemEvidenceId);
      }

      if (action === 'keep_in_dispute') {
        await transaction.collection('disputes').doc(disputeId).update({
          data: {
            status: 'under_review',
            decision,
            updatedAt: now,
          },
        });
        await transaction.collection('orders').doc(dispute.orderId).update({
          data: { updatedAt: now },
        });
      } else {
        await transaction.collection('disputes').doc(disputeId).update({
          data: {
            status: 'resolved',
            decision,
            resolvedAt: now,
            updatedAt: now,
          },
        });
        await transaction.collection('orders').doc(dispute.orderId).update({
          data: {
            status: nextStatus,
            activeDisputeId: null,
            updatedAt: now,
          },
        });
      }

      await transaction.collection('audit_logs').doc(auditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'dispute',
          targetId: disputeId,
          action: 'dispute.decide',
          before: { status: dispute.status, decision: dispute.decision || null },
          after: { status: action === 'keep_in_dispute' ? 'under_review' : 'resolved', action },
          reason,
          evidenceIds: [...evidenceIdsReviewed, ...generatedEvidenceIds],
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(orderAuditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'order',
          targetId: dispute.orderId,
          action: 'order.disputeDecision',
          before: { status: order.status },
          after: { status: nextStatus },
          reason,
          evidenceIds: [...evidenceIdsReviewed, ...generatedEvidenceIds],
          operationId,
          createdAt: now,
        },
      });
      response = {
        ok: true,
        disputeId,
        action,
        nextStatus,
        evidenceIds: generatedEvidenceIds,
      };
    });
    return response || { ok: false, error: 'transaction_failed' };
  } catch (error) {
    if (error && error.businessCode) return { ok: false, error: error.businessCode };
    console.error('dispute-decide transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
