const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function writeLoginAudit(db, userId, openid, isNew, now) {
  await db.collection('audit_logs').add({
    data: {
      actorOpenid: openid,
      actorRole: 'user',
      targetType: 'user',
      targetId: userId,
      action: 'user.wechatLogin',
      before: null,
      after: { loginMethod: 'wechat', isNew },
      operationId: '',
      createdAt: now,
    },
  });
}

function loginResult(user, isNew) {
  return {
    ok: true,
    userId: user._id,
    isNew,
    roleFlags: user.roleFlags || [],
    verificationStatus: user.verificationStatus || 'unverified',
    completedOrders: Number(user.completedOrders || 0),
    ratingAvg: Number(user.ratingAvg || 0),
  };
}

exports.main = async () => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: 'wechat_identity_unavailable' };
  const db = cloud.database();
  const now = new Date();

  const existing = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (existing.data.length) {
    const user = existing.data[0];
    await db.collection('users').doc(user._id).update({
      data: { lastLoginAt: now, updatedAt: now },
    });
    await writeLoginAudit(db, user._id, OPENID, false, now);
    return loginResult(user, false);
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

  const user = {
    _id: created._id,
    roleFlags: [],
    verificationStatus: 'unverified',
    completedOrders: 0,
    ratingAvg: 0,
  };
  await writeLoginAudit(db, created._id, OPENID, true, now);
  return loginResult(user, true);
};
