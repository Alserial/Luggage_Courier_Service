const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { orderId, handoverCode } = event;
  if (!orderId || !handoverCode) return { ok: false, error: 'missing_params' };

  const db = cloud.database();
  const now = new Date();
  const record = await db.collection('handover_records').add({
    data: {
      orderId,
      handoverCode,
      confirmedByOpenid: OPENID,
      confirmationType: 'qr_scan_mock',
      metadata: {
        source: 'mini_program',
      },
      createdAt: now,
    },
  });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'user',
      targetType: 'handover_record',
      targetId: record._id,
      action: 'handover.confirmScan',
      before: null,
      after: { orderId, confirmationType: 'qr_scan_mock' },
      createdAt: now,
    },
  });

  return { ok: true, handoverRecordId: record._id };
};
