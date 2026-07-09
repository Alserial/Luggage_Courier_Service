const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function isParticipant(order, openid) {
  return order.requesterOpenid === openid || order.travellerOpenid === openid;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
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
  let order;
  try {
    order = (await db.collection('orders').doc(orderId).get()).data;
  } catch (error) {
    return { ok: false, error: 'order_not_found' };
  }

  if (!isParticipant(order, OPENID)) return { ok: false, error: 'permission_denied' };

  return { ok: true, order };
};
