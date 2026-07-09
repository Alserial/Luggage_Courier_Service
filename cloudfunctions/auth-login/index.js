const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  const db = cloud.database();
  const now = new Date();

  const existing = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (existing.data.length) {
    const user = existing.data[0];
    await db.collection('users').doc(user._id).update({
      data: { lastLoginAt: now, updatedAt: now },
    });
    return { ok: true, userId: user._id, isNew: false };
  }

  const created = await db.collection('users').add({
    data: {
      openid: OPENID,
      unionid: UNIONID || '',
      nickname: '',
      avatarUrl: '',
      phoneMasked: '',
      roleFlags: [],
      verificationStatus: 'unverified',
      ratingAvg: 0,
      completedOrders: 0,
      disputeCount: 0,
      riskLevel: 'low',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    },
  });

  return { ok: true, userId: created._id, isNew: true };
};
