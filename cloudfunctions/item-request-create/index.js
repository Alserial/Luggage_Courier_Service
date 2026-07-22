const cloud = require('wx-server-sdk');

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
  if (!form.deadline) return 'missing_deadline';
  if (Number.isNaN(Date.parse(form.deadline))) return 'invalid_deadline';
  if (!form.riskDeclarationAccepted) return 'risk_declaration_required';
  if (!Array.isArray(form.itemPhotos) || !form.itemPhotos.length) return 'item_photos_required';
  if (form.itemPhotos.length > 6) return 'too_many_item_photos';
  if (!form.itemPhotos.every((item) => typeof item === 'string' && item.startsWith('cloud://'))) return 'invalid_item_photos';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const form = event.form || {};
  const error = validate(form);
  if (error) return { ok: false, error };

  const db = cloud.database();
  const now = new Date();
  const declaredValue = number(form.declaredValue);
  const estimatedWeightKg = number(form.estimatedWeightKg);
  const itemPhotos = Array.isArray(form.itemPhotos) ? form.itemPhotos : [];
  const riskFlags = [
    'positive_list_category',
    'declared_value_within_mvp_cap',
    'weight_within_mvp_cap',
    itemPhotos.length ? 'item_photo_provided' : 'item_photo_pending',
  ];

  const result = await db.collection('item_requests').add({
    data: {
      requesterOpenid: OPENID,
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
      createdAt: now,
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'item_request',
      targetId: result._id,
      action: 'itemRequest.create',
      before: null,
      after: {
        reviewStatus: 'pending',
        category: form.category,
        declaredValue,
        estimatedWeightKg,
        itemPhotoCount: itemPhotos.length,
        riskFlags,
      },
      operationId: event.operationId || '',
      createdAt: now,
    },
  });

  return { ok: true, requestId: result._id };
};
