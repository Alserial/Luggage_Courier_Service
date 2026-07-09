const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function canTransition(from, to) {
  return from === 'pending_payment' && to === 'paid_locked';
}

async function getOrder(db, orderId) {
  try {
    return (await db.collection('orders').doc(orderId).get()).data;
  } catch (error) {
    return null;
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, amount, operationId = '' } = event;
  const paidAmount = Number(amount);

  if (!orderId || !paidAmount) return { ok: false, error: 'missing_params' };
  if (paidAmount <= 0) return { ok: false, error: 'invalid_amount' };

  const db = cloud.database();
  const now = new Date();
  const order = await getOrder(db, orderId);

  if (!order) return { ok: false, error: 'order_not_found' };
  if (order.requesterOpenid && order.requesterOpenid !== OPENID) {
    return { ok: false, error: 'permission_denied' };
  }
  if (!canTransition(order.status, 'paid_locked')) {
    return { ok: false, error: 'illegal_transition', currentStatus: order.status, nextStatus: 'paid_locked' };
  }
  if (order.feeBreakdown && Number(order.feeBreakdown.total) !== paidAmount) {
    return { ok: false, error: 'amount_mismatch' };
  }

  const providerPaymentId = `mock_${Date.now()}`;
  const payment = await db.collection('payments').add({
    data: {
      orderId,
      provider: 'mock',
      providerPaymentId,
      amount: paidAmount,
      currency: 'CNY',
      paymentStatus: 'paid',
      lockStatus: 'locked',
      refundStatus: 'none',
      createdByOpenid: OPENID,
      createdAt: now,
      updatedAt: now,
    },
  });

  const evidence = await db.collection('evidence').add({
    data: {
      orderId,
      uploaderOpenid: OPENID,
      evidenceType: 'payment_record',
      fileIds: [],
      fileCount: 0,
      description: 'Mock service-fee payment record.',
      visibility: 'both_parties',
      metadata: {
        source: 'payment-confirm-mock',
        provider: 'mock',
        providerPaymentId,
        paymentId: payment._id,
      },
      createdAt: now,
    },
  });

  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'paid_locked',
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'requester',
      targetType: 'payment',
      targetId: payment._id,
      action: 'payment.mockConfirm',
      before: null,
      after: {
        orderId,
        amount: paidAmount,
        paymentStatus: 'paid',
        lockStatus: 'locked',
        providerPaymentId,
      },
      evidenceIds: [evidence._id],
      operationId,
      createdAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'requester',
      targetType: 'order',
      targetId: orderId,
      action: 'order.transition',
      before: { status: order.status },
      after: { status: 'paid_locked' },
      reason: 'mock_service_fee_payment_confirmed',
      evidenceIds: [evidence._id],
      operationId,
      createdAt: now,
    },
  });

  return {
    ok: true,
    paymentId: payment._id,
    evidenceId: evidence._id,
    lockStatus: 'locked',
    currentStatus: order.status,
    nextStatus: 'paid_locked',
  };
};
