const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item._id)) return false;
    seen.add(item._id);
    return true;
  });
}

const categoryLabels = {
  clothing: '普通服饰鞋帽',
  books: '书籍资料',
  stationery: '文具',
  small_gifts: '小礼品',
  phone_accessories: '无电池 3C 配件',
  daily_items: '普通小件日用品',
};

function city(location) {
  return location && location.city ? location.city : '';
}

async function getDoc(db, collection, id) {
  if (!id) return null;
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

async function enrichOrder(db, order) {
  const request = await getDoc(db, 'item_requests', order.requestId);
  const trip = await getDoc(db, 'trips', order.tripId);
  const fromCity = city(request && request.pickupLocation) || (trip && trip.fromCity) || '';
  const toCity = city(request && request.deliveryLocation) || (trip && trip.toCity) || '';

  return {
    ...order,
    route: fromCity && toCity ? `${fromCity} -> ${toCity}` : '',
    itemName: request ? request.itemName : '',
    categoryLabel: request ? categoryLabels[request.category] || request.category : '',
    handoverCity: fromCity,
    deliveryCity: toCity,
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const limit = Math.min(Number(event.limit) || 20, 50);
  const db = cloud.database();

  const requesterOrders = await db
    .collection('orders')
    .where({ requesterOpenid: OPENID })
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();

  const travellerOrders = await db
    .collection('orders')
    .where({ travellerOpenid: OPENID })
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();

  const orders = uniqueById([...(requesterOrders.data || []), ...(travellerOrders.data || [])])
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, limit);

  return { ok: true, orders: await Promise.all(orders.map((order) => enrichOrder(db, order))) };
};
