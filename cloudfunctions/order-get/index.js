const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { orderId } = event;
  if (!orderId) return { ok: false, error: 'missing_order_id' };

  if (orderId === 'demo_order_001') {
    return {
      ok: true,
      order: {
        id: 'demo_order_001',
        route: '上海 -> 墨尔本',
        itemName: '普通外套',
        categoryLabel: '普通服饰鞋帽',
        travellerName: '携带人 A',
        requesterName: '需求方 B',
        status: 'pending_payment',
        feeBreakdown: {
          serviceFee: 120,
          platformFee: 10,
          total: 130,
          currency: 'CNY',
        },
        taxRule: '如入境被要求补税，默认由需求方承担；携带人需如实申报并上传证明。',
        handoverCity: '上海',
        deliveryCity: '墨尔本',
        evidenceCount: 0,
      },
    };
  }

  const db = cloud.database();
  const order = await db.collection('orders').doc(orderId).get();
  return { ok: true, order: order.data };
};
