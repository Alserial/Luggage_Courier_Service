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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = text(event.orderId);
  const operationId = text(event.operationId).slice(0, 128);
  if (!orderId) return { ok: false, error: 'missing_order_id' };
  if (!operationId) return { ok: false, error: 'missing_operation_id' };

  const db = cloud.database();
  const paymentId = documentId('payment', orderId, operationId);
  const paymentEvidenceId = documentId('evidence', 'payment', orderId, operationId);
  const paymentAuditId = documentId('audit', 'payment-confirm', orderId, operationId);
  const orderAuditId = documentId('audit', 'payment-order-transition', orderId, operationId);
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existingPayment = await getDoc(transaction, 'payments', paymentId);
      if (existingPayment) {
        if (existingPayment.orderId !== orderId || existingPayment.createdByOpenid !== OPENID) {
          throw businessError('idempotency_conflict');
        }
        response = {
          ok: true,
          paymentId,
          evidenceId: paymentEvidenceId,
          lockStatus: existingPayment.lockStatus,
          nextStatus: 'paid_locked',
          amount: existingPayment.amount,
          idempotent: true,
        };
        return;
      }

      const order = await getDoc(transaction, 'orders', orderId);
      if (!order) throw businessError('order_not_found');
      if (order.requesterOpenid !== OPENID) throw businessError('permission_denied');
      if (order.status !== 'pending_payment') {
        throw businessError('illegal_transition', {
          currentStatus: order.status,
          nextStatus: 'paid_locked',
        });
      }

      const paidAmount = Number(order.feeBreakdown && order.feeBreakdown.total);
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) throw businessError('invalid_order_amount');

      const now = new Date();
      const providerPaymentId = documentId('mockpay', orderId, operationId);
      await transaction.collection('payments').doc(paymentId).set({
        data: {
          orderId,
          provider: 'mock',
          providerPaymentId,
          providerRefundId: '',
          amount: paidAmount,
          currency: 'CNY',
          paymentStatus: 'paid',
          lockStatus: 'locked',
          refundStatus: 'none',
          createdByOpenid: OPENID,
          operationId,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.collection('evidence').doc(paymentEvidenceId).set({
        data: {
          orderId,
          uploaderOpenid: 'system',
          evidenceType: 'payment_record',
          fileIds: [],
          storagePath: `system://payment/${paymentId}`,
          fileCount: 0,
          description: 'Mock 服务费支付记录。',
          visibility: 'both_parties',
          metadata: {
            source: 'payment-confirm-mock',
            provider: 'mock',
            providerPaymentId,
            paymentId,
          },
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('orders').doc(orderId).update({
        data: {
          status: 'paid_locked',
          paymentId,
          updatedAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(paymentAuditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole: 'requester',
          targetType: 'payment',
          targetId: paymentId,
          action: 'payment.mockConfirm',
          before: null,
          after: {
            orderId,
            amount: paidAmount,
            paymentStatus: 'paid',
            lockStatus: 'locked',
            providerPaymentId,
          },
          evidenceIds: [paymentEvidenceId],
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(orderAuditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole: 'requester',
          targetType: 'order',
          targetId: orderId,
          action: 'order.transition',
          before: { status: order.status },
          after: { status: 'paid_locked' },
          reason: 'mock_service_fee_payment_confirmed',
          evidenceIds: [paymentEvidenceId],
          operationId,
          createdAt: now,
        },
      });
      response = {
        ok: true,
        paymentId,
        evidenceId: paymentEvidenceId,
        lockStatus: 'locked',
        currentStatus: order.status,
        nextStatus: 'paid_locked',
        amount: paidAmount,
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
    console.error('payment-confirm-mock transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
