const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function validate(form) {
  if (!form.requestId || !form.tripId) return 'missing_refs';
  if (!form.serviceFeeQuote || form.serviceFeeQuote <= 0) return 'invalid_fee';
  if (form.serviceFeeQuote > 500) return 'fee_too_high_for_mvp';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const form = event.form || {};
  const error = validate(form);
  if (error) return { ok: false, error };

  const db = cloud.database();
  const now = new Date();
  const offer = await db.collection('offers').add({
    data: {
      requestId: form.requestId,
      tripId: form.tripId,
      travellerOpenid: OPENID,
      serviceFeeQuote: Number(form.serviceFeeQuote),
      currency: 'CNY',
      message: form.message || '',
      conditions: form.conditions || '',
      status: 'pending',
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'offer',
      targetId: offer._id,
      action: 'offer.create',
      before: null,
      after: { status: 'pending', serviceFeeQuote: Number(form.serviceFeeQuote) },
      createdAt: now,
    },
  });

  return { ok: true, offerId: offer._id };
};
