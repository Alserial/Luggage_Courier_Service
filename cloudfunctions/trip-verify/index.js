const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const allowedDecisions = new Set(['approved', 'rejected', 'manual_review']);
const reviewerRoles = new Set(['admin', 'reviewer']);

function text(value) {
  return String(value || '').trim();
}

async function getCurrentUser(db, openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

function canReview(user) {
  return Boolean(user && Array.isArray(user.roleFlags) && user.roleFlags.some((role) => reviewerRoles.has(role)));
}

async function getTrip(db, tripId) {
  try {
    return (await db.collection('trips').doc(tripId).get()).data;
  } catch (error) {
    return null;
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { tripId, decision, operationId = '' } = event;
  const reviewReason = text(event.reviewReason);
  const verificationEvidenceIds = Array.isArray(event.verificationEvidenceIds) ? event.verificationEvidenceIds : [];

  if (!tripId) return { ok: false, error: 'missing_trip_id' };
  if (!allowedDecisions.has(decision)) return { ok: false, error: 'invalid_decision' };
  if (!verificationEvidenceIds.every((item) => typeof item === 'string')) return { ok: false, error: 'invalid_evidence_ids' };
  if (decision !== 'approved' && !reviewReason) return { ok: false, error: 'missing_review_reason' };

  const db = cloud.database();
  const reviewer = await getCurrentUser(db, OPENID);
  if (!canReview(reviewer)) return { ok: false, error: 'permission_denied' };

  const before = await getTrip(db, tripId);
  if (!before) return { ok: false, error: 'trip_not_found' };

  const now = new Date();
  const after = {
    verificationStatus: decision,
    verificationReason: reviewReason,
    verificationEvidenceIds,
    verifiedByOpenid: OPENID,
    verifiedAt: now,
    updatedAt: now,
  };

  await db.collection('trips').doc(tripId).update({ data: after });

  await db.collection('audit_logs').add({
    data: {
      actorOpenid: OPENID,
      actorRole: 'reviewer',
      targetType: 'trip',
      targetId: tripId,
      action: 'trip.verify',
      before: {
        verificationStatus: before.verificationStatus,
        verificationReason: before.verificationReason || '',
      },
      after,
      evidenceIds: verificationEvidenceIds,
      operationId,
      createdAt: now,
    },
  });

  return { ok: true, tripId, verificationStatus: decision };
};
