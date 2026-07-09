const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, amount } = event;
  if (!orderId || !amount) return { ok: false, error: 'missing_params' };

  const db = cloud.database();
  const now = new Date();
  const payment = await db.collection('payments').add({
    data: {
      orderId,
      provider: 'mock',
      providerPaymentId: `mock_${Date.now()}`,
      amount: Number(amount),
      currency: 'CNY',
      paymentStatus: 'paid',
      lockStatus: 'locked',
      refundStatus: 'none',
      createdByOpenid: OPENID,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, paymentId: payment._id, lockStatus: 'locked' };
};
