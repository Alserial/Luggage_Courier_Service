const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function isParticipant(order, openid) {
  return order.requesterOpenid === openid || order.travellerOpenid === openid;
}

function canViewEvidence(evidence, viewerRole) {
  const visibility = evidence.visibility || 'both_parties';
  if (visibility === 'both_parties') return true;
  if (visibility === 'requester_only') return viewerRole === 'requester';
  if (visibility === 'traveller_only') return viewerRole === 'traveller';
  return false;
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
  const { orderId } = event;
  if (!orderId) return { ok: false, error: 'missing_order_id' };

  const db = cloud.database();
  let order;
  try {
    order = (await db.collection('orders').doc(orderId).get()).data;
  } catch (error) {
    return { ok: false, error: 'order_not_found' };
  }

  if (!isParticipant(order, OPENID)) return { ok: false, error: 'permission_denied' };

  const evidenceResult = await db
    .collection('evidence')
    .where({ orderId })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  const viewerRole = order.requesterOpenid === OPENID ? 'requester' : 'traveller';
  const evidence = (evidenceResult.data || []).filter((item) => canViewEvidence(item, viewerRole)).map((item) => ({
    _id: item._id,
    evidenceType: item.evidenceType,
    description: item.description,
    fileIds: Array.isArray(item.fileIds) ? item.fileIds : [],
    fileCount: Number(item.fileCount) || 0,
    storagePath: item.storagePath,
    metadata: item.metadata || {},
    uploaderOpenid: item.uploaderOpenid,
    createdAt: item.createdAt,
  }));
  return {
    ok: true,
    viewerRole,
    evidence,
    order: {
      ...(await enrichOrder(db, order)),
      evidenceCount: evidence.length,
    },
  };
};
