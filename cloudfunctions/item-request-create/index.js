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

function validate(form) {
  if (!form.itemName) return 'missing_item_name';
  if (!allowedCategories.has(form.category)) return 'invalid_category';
  if (!form.quantity || form.quantity <= 0) return 'invalid_quantity';
  if (!form.declaredValue || form.declaredValue <= 0 || form.declaredValue > 2000) return 'invalid_declared_value';
  if (!form.estimatedWeightKg || form.estimatedWeightKg <= 0 || form.estimatedWeightKg > 5) return 'invalid_weight';
  if (!form.pickupCity || !form.deliveryCity) return 'missing_locations';
  if (!form.deadline) return 'missing_deadline';
  if (!form.riskDeclarationAccepted) return 'risk_declaration_required';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const form = event.form || {};
  const error = validate(form);
  if (error) return { ok: false, error };

  const db = cloud.database();
  const now = new Date();
  const result = await db.collection('item_requests').add({
    data: {
      requesterOpenid: OPENID,
      itemName: form.itemName,
      category: form.category,
      quantity: Number(form.quantity),
      declaredValue: Number(form.declaredValue),
      currency: 'CNY',
      estimatedWeightKg: Number(form.estimatedWeightKg),
      estimatedSize: {},
      purchaseMethod: '',
      pickupLocation: { city: form.pickupCity },
      deliveryLocation: { city: form.deliveryCity },
      deadline: form.deadline,
      itemPhotos: [],
      riskFlags: [],
      reviewStatus: 'pending',
      reviewReason: '',
      riskDeclarationAccepted: true,
      note: form.note || '',
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
      after: { reviewStatus: 'pending' },
      createdAt: now,
    },
  });

  return { ok: true, requestId: result._id };
};
