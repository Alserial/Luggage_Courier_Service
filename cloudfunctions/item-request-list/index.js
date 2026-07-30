const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedScopes = new Set(['market', 'mine']);

function toListItem(request, isOwner) {
  return {
    _id: request._id,
    itemName: request.itemName,
    category: request.category,
    quantity: request.quantity,
    declaredValue: request.declaredValue,
    currency: request.currency,
    estimatedWeightKg: request.estimatedWeightKg,
    pickupLocation: request.pickupLocation,
    deliveryLocation: request.deliveryLocation,
    deadline: request.deadline,
    itemPhotos: Array.isArray(request.itemPhotos) ? request.itemPhotos.slice(0, 1) : [],
    riskFlags: request.riskFlags || [],
    reviewStatus: request.reviewStatus,
    isOwner,
    createdAt: request.createdAt,
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const limit = Math.min(Number(event.limit) || 20, 50);
  const scope = event.scope || 'market';
  if (!OPENID) return { ok: false, error: 'login_required' };
  if (!allowedScopes.has(scope)) return { ok: false, error: 'invalid_scope' };
  const db = cloud.database();

  if (scope === 'mine') {
    const result = await db
      .collection('item_requests')
      .where({ requesterOpenid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return {
      ok: true,
      scope,
      requests: (result.data || []).filter((request) => !request.isDeleted).map((request) => toListItem(request, true)),
    };
  }

  const result = await db
    .collection('item_requests')
    .where({ reviewStatus: 'approved' })
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit * 2, 100))
    .get();

  const requests = (result.data || [])
    .filter((request) => request.requesterOpenid !== OPENID && !request.isDeleted)
    .slice(0, limit)
    .map((request) => toListItem(request, false));

  return { ok: true, scope, requests };
};
