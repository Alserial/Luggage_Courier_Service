const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const terminalStates = new Set(['completed', 'cancelled', 'refunded']);

function text(value) {
  return String(value || '').trim();
}

function documentId(prefix, ...parts) {
  const digest = crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
  return `${prefix}_${digest}`;
}

function businessError(code, details = {}) {
  const error = new Error(code);
  error.businessCode = code;
  Object.assign(error, details);
  return error;
}

async function getDoc(database, collection, id) {
  try {
    return (await database.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

function participantRole(order, openid) {
  if (order.requesterOpenid === openid) return 'requester';
  if (order.travellerOpenid === openid) return 'traveller';
  return null;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = text(event.orderId);
  const reason = text(event.reason).slice(0, 200);
  const description = text(event.description).slice(0, 1000);
  const operationId = text(event.operationId).slice(0, 128);
  const evidenceIds = Array.isArray(event.evidenceIds) ? event.evidenceIds.map(text) : [];

  if (!orderId) return { ok: false, error: 'missing_order_id' };
  if (!reason) return { ok: false, error: 'missing_reason' };
  if (!description) return { ok: false, error: 'missing_description' };
  if (!operationId) return { ok: false, error: 'missing_operation_id' };
  if (!evidenceIds.length) return { ok: false, error: 'evidence_required' };

  const db = cloud.database();
  const disputeId = documentId('dispute', OPENID, operationId);
  const disputeAuditId = documentId('audit', 'dispute-open', OPENID, operationId);
  const orderAuditId = documentId('audit', 'dispute-order-transition', OPENID, operationId);
  let response;

  try {
    await db.runTransaction(async (transaction) => {
      const existing = await getDoc(transaction, 'disputes', disputeId);
      if (existing) {
        if (existing.orderId !== orderId || existing.openedByOpenid !== OPENID) {
          throw businessError('idempotency_conflict');
        }
        response = { ok: true, disputeId, nextStatus: 'disputed', idempotent: true };
        return;
      }

      const order = await getDoc(transaction, 'orders', orderId);
      if (!order) throw businessError('order_not_found');
      const actorRole = participantRole(order, OPENID);
      if (!actorRole) throw businessError('permission_denied');
      if (order.activeDisputeId || order.status === 'disputed') throw businessError('order_already_disputed');
      if (terminalStates.has(order.status)) {
        throw businessError('terminal_order_state', { currentStatus: order.status });
      }

      for (const evidenceId of evidenceIds) {
        const evidence = await getDoc(transaction, 'evidence', evidenceId);
        if (!evidence || evidence.orderId !== orderId) throw businessError('invalid_evidence_reference');
      }

      const now = new Date();
      await transaction.collection('disputes').doc(disputeId).set({
        data: {
          orderId,
          openedByOpenid: OPENID,
          reason,
          description,
          evidenceIds,
          status: 'open',
          decision: null,
          operationId,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.collection('orders').doc(orderId).update({
        data: {
          statusBeforeDispute: order.status,
          status: 'disputed',
          activeDisputeId: disputeId,
          updatedAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(disputeAuditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'dispute',
          targetId: disputeId,
          action: 'dispute.open',
          before: null,
          after: { orderId, reason, status: 'open', evidenceCount: evidenceIds.length },
          evidenceIds,
          operationId,
          createdAt: now,
        },
      });
      await transaction.collection('audit_logs').doc(orderAuditId).set({
        data: {
          actorOpenid: OPENID,
          actorRole,
          targetType: 'order',
          targetId: orderId,
          action: 'order.transition',
          before: { status: order.status },
          after: { status: 'disputed' },
          reason: 'dispute_opened',
          evidenceIds,
          operationId,
          createdAt: now,
        },
      });
      response = {
        ok: true,
        disputeId,
        currentStatus: order.status,
        nextStatus: 'disputed',
      };
    });
    return response || { ok: false, error: 'transaction_failed' };
  } catch (error) {
    if (error && error.businessCode) {
      return {
        ok: false,
        error: error.businessCode,
        currentStatus: error.currentStatus,
      };
    }
    console.error('dispute-open transaction failed', error);
    return { ok: false, error: 'transaction_failed' };
  }
};
