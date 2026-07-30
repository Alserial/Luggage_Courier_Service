const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function text(value) {
  return String(value || '').trim();
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
  const digest = crypto.createHash('sha256').update(`request-delete:${openid}:${operationId}`).digest('hex').slice(0, 32);
  return `audit_${digest}`;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const requestId = text(event.requestId);
  const operationId = text(event.operationId).slice(0, 128);
  if (!requestId) return { ok: false, error: 'missing_request_id' };

  const db = cloud.database();
  const request = await getDoc(db, 'item_requests', requestId);
  if (!request) return { ok: false, error: 'request_not_found' };
  if (request.requesterOpenid !== OPENID) return { ok: false, error: 'permission_denied' };
  if (request.isDeleted) return { ok: true, requestId, idempotent: true };
  if (await hasLinkedOrder(db, requestId)) return { ok: false, error: 'linked_order_exists' };

  const now = new Date();
  await cancelPendingOffers(db, requestId, now);
  await db.collection('item_requests').doc(requestId).update({
    data: {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    },
  });

  const auditData = {
    actorOpenid: OPENID,
    actorRole: 'user',
    targetType: 'item_request',
    targetId: requestId,
    action: 'itemRequest.delete',
    before: { isDeleted: false, reviewStatus: request.reviewStatus },
    after: { isDeleted: true },
    operationId,
    createdAt: now,
  };
  if (operationId) {
    await db.collection('audit_logs').doc(auditId(OPENID, operationId)).set({ data: auditData });
  } else {
    await db.collection('audit_logs').add({ data: auditData });
  }

  return { ok: true, requestId };
};
