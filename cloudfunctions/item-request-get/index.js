const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function toSafeRequest(request, isOwner) {
  const safeRequest = {
    _id: request._id,
    itemName: request.itemName,
    category: request.category,
    quantity: request.quantity,
    declaredValue: request.declaredValue,
    currency: request.currency,
    estimatedWeightKg: request.estimatedWeightKg,
    estimatedSize: request.estimatedSize || {},
    purchaseMethod: request.purchaseMethod,
    pickupLocation: request.pickupLocation,
    deliveryLocation: request.deliveryLocation,
    deadline: request.deadline,
    itemPhotos: request.itemPhotos || [],
    riskFlags: request.riskFlags || [],
    reviewStatus: request.reviewStatus,
    riskDeclarationAccepted: Boolean(request.riskDeclarationAccepted),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    isOwner,
  };

  if (isOwner) {
    safeRequest.reviewReason = request.reviewReason || '';
    safeRequest.note = request.note || '';
  }

  return safeRequest;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { requestId } = event;
  if (!requestId) return { ok: false, error: 'missing_request_id' };

  const db = cloud.database();
  let request;
  try {
    request = (await db.collection('item_requests').doc(requestId).get()).data;
  } catch (error) {
    return { ok: false, error: 'request_not_found' };
  }

  const isOwner = request.requesterOpenid === OPENID;
  if (request.isDeleted) return { ok: false, error: 'request_deleted' };
  if (!isOwner && request.reviewStatus !== 'approved') return { ok: false, error: 'permission_denied' };

  if (!isOwner) {
    return { ok: true, request: toSafeRequest(request, false), offers: [], isOwner: false };
  }

  const offers = await db
    .collection('offers')
    .where({ requestId, status: 'pending' })
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  return { ok: true, request: toSafeRequest(request, true), offers: offers.data || [], isOwner: true };
};
