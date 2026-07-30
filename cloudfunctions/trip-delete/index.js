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

async function hasLinkedOrder(db, tripId) {
  const result = await db.collection('orders').where({ tripId }).limit(1).get();
  return Boolean(result.data && result.data.length);
}

async function cancelPendingOffers(db, tripId, now) {
  const result = await db.collection('offers').where({ tripId, status: 'pending' }).limit(100).get();
  await Promise.all(
    (result.data || []).map((offer) =>
      db.collection('offers').doc(offer._id).update({
        data: { status: 'cancelled', updatedAt: now },
      }),
    ),
  );
}

function auditId(openid, operationId) {
  const digest = crypto.createHash('sha256').update(`trip-delete:${openid}:${operationId}`).digest('hex').slice(0, 32);
  return `audit_${digest}`;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const tripId = text(event.tripId);
  const operationId = text(event.operationId).slice(0, 128);
  if (!tripId) return { ok: false, error: 'missing_trip_id' };

  const db = cloud.database();
  const trip = await getDoc(db, 'trips', tripId);
  if (!trip) return { ok: false, error: 'trip_not_found' };
  if (trip.travellerOpenid !== OPENID) return { ok: false, error: 'permission_denied' };
  if (trip.status === 'cancelled') return { ok: true, tripId, idempotent: true };
  if (await hasLinkedOrder(db, tripId)) return { ok: false, error: 'linked_order_exists' };

  const now = new Date();
  await cancelPendingOffers(db, tripId, now);
  await db.collection('trips').doc(tripId).update({
    data: {
      status: 'cancelled',
      deletedAt: now,
      updatedAt: now,
    },
  });

  const auditData = {
    actorOpenid: OPENID,
    actorRole: 'user',
    targetType: 'trip',
    targetId: tripId,
    action: 'trip.delete',
    before: { status: trip.status, verificationStatus: trip.verificationStatus },
    after: { status: 'cancelled' },
    operationId,
    createdAt: now,
  };
  if (operationId) {
    await db.collection('audit_logs').doc(auditId(OPENID, operationId)).set({ data: auditData });
  } else {
    await db.collection('audit_logs').add({ data: auditData });
  }

  return { ok: true, tripId };
};
