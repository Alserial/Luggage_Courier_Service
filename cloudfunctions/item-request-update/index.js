const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedCategories = new Set([
  'clothing',
  'books',
  'stationery',
  'small_gifts',
  'phone_accessories',
  'daily_items',
]);

function text(value) {
  return String(value || '').trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeSize(size) {
  if (!size || typeof size !== 'object') return {};
  return {
    lengthCm: number(size.lengthCm) > 0 ? number(size.lengthCm) : undefined,
    widthCm: number(size.widthCm) > 0 ? number(size.widthCm) : undefined,
    heightCm: number(size.heightCm) > 0 ? number(size.heightCm) : undefined,
    note: text(size.note),
  };
}

function validate(form) {
  const quantity = number(form.quantity);
  const declaredValue = number(form.declaredValue);
  const estimatedWeightKg = number(form.estimatedWeightKg);

  if (!text(form.itemName)) return 'missing_item_name';
  if (!allowedCategories.has(form.category)) return 'invalid_category';
  if (!quantity || quantity <= 0) return 'invalid_quantity';
  if (!declaredValue || declaredValue <= 0 || declaredValue > 2000) return 'invalid_declared_value';
  if (!estimatedWeightKg || estimatedWeightKg <= 0 || estimatedWeightKg > 5) return 'invalid_weight';
  if (!text(form.pickupCity) || !text(form.deliveryCity)) return 'missing_locations';
  if (!form.deadline || Number.isNaN(Date.parse(form.deadline))) return 'invalid_deadline';
  if (!form.riskDeclarationAccepted) return 'risk_declaration_required';
  if (!Array.isArray(form.itemPhotos) || !form.itemPhotos.length) return 'item_photos_required';
  if (form.itemPhotos.length > 6) return 'too_many_item_photos';
  if (!form.itemPhotos.every((item) => typeof item === 'string' && item.startsWith('cloud://'))) return 'invalid_item_photos';
  return null;
}

async function getDoc(db, collection, id) {
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

async function hasLinkedOrder(db, requestId) {
  const result = await db.collection('orders').where({ requestId }).limit(1).get();
  return Boolean(result.data && result.data.length);
}

async function cancelPendingOffers(db, requestId, now) {
  const result = await db.collection('offers').where({ requestId, status: 'pending' }).limit(100).get();
  await Promise.all(
    (result.data || []).map((offer) =>
      db.collection('offers').doc(offer._id).update({
        data: { status: 'cancelled', updatedAt: now },
      }),
    ),
  );
}

function auditId(openid, operationId) {
  const digest = crypto.createHash('sha256').update(`request-update:${openid}:${operationId}`).digest('hex').slice(0, 32);
  return `audit_${digest}`;
}

async function writeAudit(db, data, openid, operationId) {
  if (operationId) {
    await db.collection('audit_logs').doc(auditId(openid, operationId)).set({ data });
  } else {
    await db.collection('audit_logs').add({ data });
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const requestId = text(event.requestId);
  const operationId = text(event.operationId).slice(0, 128);
  const form = event.form || {};
  if (!requestId) return { ok: false, error: 'missing_request_id' };
  const validationError = validate(form);
  if (validationError) return { ok: false, error: validationError };

  const db = cloud.database();
  const request = await getDoc(db, 'item_requests', requestId);
  if (!request) return { ok: false, error: 'request_not_found' };
  if (request.requesterOpenid !== OPENID) return { ok: false, error: 'permission_denied' };
  if (request.isDeleted) return { ok: false, error: 'request_not_editable' };
  if (await hasLinkedOrder(db, requestId)) return { ok: false, error: 'linked_order_exists' };

  const now = new Date();
  const declaredValue = number(form.declaredValue);
  const estimatedWeightKg = number(form.estimatedWeightKg);
  const itemPhotos = form.itemPhotos;
  const riskFlags = [
    'positive_list_category',
    'declared_value_within_mvp_cap',
    'weight_within_mvp_cap',
    'item_photo_provided',
  ];
  const updateData = {
    itemName: text(form.itemName),
    category: form.category,
    quantity: number(form.quantity),
    declaredValue,
    currency: 'CNY',
    estimatedWeightKg,
    estimatedSize: normalizeSize(form.estimatedSize),
    purchaseMethod: text(form.purchaseMethod) || 'unknown',
    pickupLocation: {
      country: text(form.pickupCountry),
      city: text(form.pickupCity),
      addressText: text(form.pickupAddress),
    },
    deliveryLocation: {
      country: text(form.deliveryCountry),
      city: text(form.deliveryCity),
      addressText: text(form.deliveryAddress),
    },
    deadline: form.deadline,
    itemPhotos,
    riskFlags,
    reviewStatus: 'pending',
    reviewReason: '',
    riskDeclarationAccepted: true,
    note: text(form.note),
    updatedAt: now,
  };

  await cancelPendingOffers(db, requestId, now);
  await db.collection('item_requests').doc(requestId).update({ data: updateData });
  await writeAudit(
    db,
    {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'item_request',
      targetId: requestId,
      action: 'itemRequest.update',
      before: {
        itemName: request.itemName,
        category: request.category,
        declaredValue: request.declaredValue,
        estimatedWeightKg: request.estimatedWeightKg,
        pickupLocation: request.pickupLocation,
        deliveryLocation: request.deliveryLocation,
        deadline: request.deadline,
        reviewStatus: request.reviewStatus,
      },
      after: {
        itemName: updateData.itemName,
        category: updateData.category,
        declaredValue,
        estimatedWeightKg,
        pickupLocation: updateData.pickupLocation,
        deliveryLocation: updateData.deliveryLocation,
        deadline: updateData.deadline,
        reviewStatus: 'pending',
      },
      operationId,
      createdAt: now,
    },
    OPENID,
    operationId,
  );

  return { ok: true, requestId, reviewStatus: 'pending' };
};
