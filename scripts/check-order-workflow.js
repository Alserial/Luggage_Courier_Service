const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const { createDatabaseMock } = require('./helpers/cloud-database-mock');

async function main() {
  const database = createDatabaseMock();
  let currentOpenid = 'requester_openid';
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    getWXContext() {
      return { OPENID: currentOpenid };
    },
    database() {
      return database;
    },
  };

  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock;
    return originalLoad.call(this, request, parent, isMain);
  };
  const offerAccept = require('../cloudfunctions/offer-accept/index.js');
  const paymentConfirm = require('../cloudfunctions/payment-confirm-mock/index.js');
  const orderTransition = require('../cloudfunctions/order-transition/index.js');
  const disputeOpen = require('../cloudfunctions/dispute-open/index.js');
  const disputeDecide = require('../cloudfunctions/dispute-decide/index.js');
  Module._load = originalLoad;

  database.seed('item_requests', 'request_1', {
    requesterOpenid: 'requester_openid',
    reviewStatus: 'approved',
    isDeleted: false,
    itemName: '普通外套',
    category: 'clothing',
    estimatedWeightKg: 1,
  });
  database.seed('trips', 'trip_1', {
    travellerOpenid: 'traveller_openid',
    status: 'active',
    verificationStatus: 'approved',
  });
  database.seed('offers', 'offer_1', {
    requestId: 'request_1',
    tripId: 'trip_1',
    travellerOpenid: 'traveller_openid',
    serviceFeeQuote: 100,
    status: 'pending',
  });

  database.conflictOnNextTransaction();
  const accepted = await Promise.all([
    offerAccept.main({ offerId: 'offer_1', operationId: 'accept_operation_1' }),
    offerAccept.main({ offerId: 'offer_1', operationId: 'accept_operation_1' }),
  ]);
  assert.equal(accepted[0].ok, true);
  assert.equal(accepted[1].ok, true);
  assert.equal(accepted[0].orderId, accepted[1].orderId);
  assert.equal(database.size('orders'), 1, 'double accept must create one order');
  const orderId = accepted[0].orderId;

  const paymentEvent = { orderId, operationId: 'payment_operation_1' };
  const paid = await paymentConfirm.main(paymentEvent);
  const paidAgain = await paymentConfirm.main(paymentEvent);
  assert.equal(paid.ok, true);
  assert.equal(paidAgain.idempotent, true);
  assert.equal(database.size('payments'), 1, 'repeated payment must create one payment');
  assert.equal(
    database.list('evidence').filter((item) => item.evidenceType === 'payment_record').length,
    1,
    'repeated payment must create one payment evidence',
  );

  database.seed('orders', 'rollback_order', {
    requesterOpenid: 'requester_openid',
    travellerOpenid: 'traveller_openid',
    status: 'pending_payment',
    feeBreakdown: { serviceFee: 100, platformFee: 8, total: 108, currency: 'CNY' },
  });
  const paymentCountBeforeFailure = database.size('payments');
  database.failTransactionAtWrite(2);
  const originalConsoleError = console.error;
  console.error = () => undefined;
  const failedPayment = await paymentConfirm.main(
    {
      orderId: 'rollback_order',
      operationId: 'rollback_payment_operation',
    },
  );
  console.error = originalConsoleError;
  database.clearFailure();
  assert.equal(failedPayment.ok, false);
  assert.equal(database.get('orders', 'rollback_order').status, 'pending_payment');
  assert.equal(database.size('payments'), paymentCountBeforeFailure, 'failed transaction must roll back payment');

  database.seed('orders', 'delivery_order', {
    requesterOpenid: 'requester_openid',
    travellerOpenid: 'traveller_openid',
    status: 'arrived',
    activeDisputeId: null,
  });
  currentOpenid = 'traveller_openid';
  const missingDeliveryEvidence = await orderTransition.main({
    orderId: 'delivery_order',
    nextStatus: 'delivered',
    evidenceIds: [],
    operationId: 'delivery_missing_evidence',
  });
  assert.equal(missingDeliveryEvidence.error, 'required_evidence_missing');
  database.seed('evidence', 'delivery_evidence', {
    orderId: 'delivery_order',
    evidenceType: 'delivery_photo_or_video',
  });
  const delivered = await orderTransition.main({
    orderId: 'delivery_order',
    nextStatus: 'delivered',
    evidenceIds: ['delivery_evidence'],
    operationId: 'delivery_success',
  });
  assert.equal(delivered.ok, true);
  currentOpenid = 'requester_openid';
  const completed = await orderTransition.main({
    orderId: 'delivery_order',
    nextStatus: 'completed',
    evidenceIds: [],
    operationId: 'complete_success',
  });
  assert.equal(completed.ok, true);
  assert.equal(database.get('orders', 'delivery_order').status, 'completed');
  assert.equal(
    database.list('evidence').filter((item) => item.orderId === 'delivery_order' && item.evidenceType === 'mutual_confirmation')
      .length,
    1,
  );

  database.seed('orders', 'dispute_order', {
    requesterOpenid: 'requester_openid',
    travellerOpenid: 'traveller_openid',
    status: 'paid_locked',
    activeDisputeId: null,
    paymentId: 'payment_for_dispute',
  });
  database.seed('payments', 'payment_for_dispute', {
    orderId: 'dispute_order',
    provider: 'mock',
    amount: 108,
    paymentStatus: 'paid',
    lockStatus: 'locked',
    refundStatus: 'none',
  });
  database.seed('evidence', 'dispute_evidence', {
    orderId: 'dispute_order',
    evidenceType: 'item_photo',
    fileIds: ['cloud://test/photo.jpg'],
  });
  const opened = await disputeOpen.main({
    orderId: 'dispute_order',
    reason: '物品异常',
    description: '物品包装与交接记录不一致',
    evidenceIds: ['dispute_evidence'],
    operationId: 'dispute_open_operation',
  });
  assert.equal(opened.ok, true);
  const duplicateDispute = await disputeOpen.main({
    orderId: 'dispute_order',
    reason: '再次发起',
    description: '同一个订单不能有第二个活动争议',
    evidenceIds: ['dispute_evidence'],
    operationId: 'another_dispute_operation',
  });
  assert.equal(duplicateDispute.error, 'order_already_disputed');

  const participantDecision = await disputeDecide.main({
    disputeId: opened.disputeId,
    action: 'refund',
    reason: '参与方不能裁决',
    evidenceIdsReviewed: ['dispute_evidence'],
    operationId: 'participant_decision',
  });
  assert.equal(participantDecision.error, 'permission_denied');

  currentOpenid = 'admin_openid';
  database.seed('users', 'admin_user', {
    openid: 'admin_openid',
    roleFlags: ['admin'],
  });
  const refundDecision = await disputeDecide.main({
    disputeId: opened.disputeId,
    action: 'refund',
    reason: '依据交接证据退回 Mock 服务费',
    evidenceIdsReviewed: ['dispute_evidence'],
    operationId: 'admin_refund_operation',
  });
  assert.equal(refundDecision.ok, true, JSON.stringify(refundDecision));
  assert.equal(database.get('orders', 'dispute_order').status, 'refunded');
  assert.equal(database.get('payments', 'payment_for_dispute').amount, 108, 'refund must not rewrite the amount');
  assert.equal(database.get('payments', 'payment_for_dispute').refundStatus, 'refunded');
  assert.equal(database.get('payments', 'payment_for_dispute').lockStatus, 'none');

  const cloudServiceSource = fs.readFileSync(
    path.join(process.cwd(), 'miniprogram/services/cloud.ts'),
    'utf8',
  );
  assert.match(cloudServiceSource, /error: 'cloud_unavailable'/);
  assert.doesNotMatch(cloudServiceSource, /\bfallback\s*\?:/);
  assert.match(cloudServiceSource, /if \(appConfig\.demoMode\)/);

  console.log(
    'Order workflow checks OK. Transactions, rollback, idempotency, evidence gates, role gates, disputes, and Mock refund passed.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
