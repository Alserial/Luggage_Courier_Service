const assert = require('assert');
const Module = require('module');

function createDatabaseMock() {
  const collections = new Map();
  let generatedId = 0;

  function records(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  function query(name, criteria) {
    let queryLimit = Infinity;
    return {
      limit(value) {
        queryLimit = value;
        return this;
      },
      orderBy() {
        return this;
      },
      async get() {
        const data = Array.from(records(name).entries())
          .map(([id, value]) => ({ _id: id, ...value }))
          .filter((item) => Object.entries(criteria).every(([key, value]) => item[key] === value))
          .slice(0, queryLimit);
        return { data };
      },
    };
  }

  return {
    collection(name) {
      const collectionRecords = records(name);
      return {
        doc(id) {
          return {
            async get() {
              if (!collectionRecords.has(id)) throw new Error('document_not_found');
              return { data: { _id: id, ...collectionRecords.get(id) } };
            },
            async set({ data }) {
              collectionRecords.set(id, { ...data });
              return { _id: id };
            },
            async update({ data }) {
              if (!collectionRecords.has(id)) throw new Error('document_not_found');
              collectionRecords.set(id, { ...collectionRecords.get(id), ...data });
              return { updated: 1 };
            },
          };
        },
        where(criteria) {
          return query(name, criteria);
        },
        async add({ data }) {
          generatedId += 1;
          const id = `generated_${generatedId}`;
          collectionRecords.set(id, { ...data });
          return { _id: id };
        },
      };
    },
    seed(name, id, data) {
      records(name).set(id, { ...data });
    },
    get(name, id) {
      return records(name).get(id);
    },
  };
}

const tripForm = {
  fromCity: '上海',
  toCity: '悉尼',
  departureDate: '2026-09-01',
  arrivalDate: '2026-09-02',
  flightNo: 'MU561',
  luggageCapacityKg: 2,
  acceptableCategories: ['clothing'],
  note: '',
};

const requestForm = {
  itemName: '普通外套（修改）',
  category: 'clothing',
  quantity: 1,
  declaredValue: 520,
  estimatedWeightKg: 1.3,
  pickupCity: '上海',
  deliveryCity: '悉尼',
  deadline: '2026-09-05',
  itemPhotos: ['cloud://test/item-photo.jpg'],
  riskDeclarationAccepted: true,
  note: '',
};

async function main() {
  let database = createDatabaseMock();
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    getWXContext() {
      return { OPENID: 'owner_openid' };
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
  const tripUpdate = require('../cloudfunctions/trip-update/index.js');
  const tripDelete = require('../cloudfunctions/trip-delete/index.js');
  const requestUpdate = require('../cloudfunctions/item-request-update/index.js');
  const requestDelete = require('../cloudfunctions/item-request-delete/index.js');
  Module._load = originalLoad;

  database.seed('trips', 'trip_owned', {
    travellerOpenid: 'owner_openid',
    fromCity: '上海',
    toCity: '墨尔本',
    departureTime: '2026-08-18',
    arrivalTime: '2026-08-19',
    luggageCapacityKg: 3,
    acceptableCategories: ['clothing'],
    status: 'active',
    verificationStatus: 'approved',
  });
  database.seed('offers', 'trip_offer', { tripId: 'trip_owned', status: 'pending' });

  const updatedTrip = await tripUpdate.main({
    tripId: 'trip_owned',
    operationId: 'trip_update_test_001',
    form: tripForm,
  });
  assert.equal(updatedTrip.ok, true);
  assert.equal(database.get('trips', 'trip_owned').toCity, '悉尼');
  assert.equal(database.get('trips', 'trip_owned').verificationStatus, 'pending');
  assert.equal(database.get('offers', 'trip_offer').status, 'cancelled');

  const deletedTrip = await tripDelete.main({
    tripId: 'trip_owned',
    operationId: 'trip_delete_test_001',
  });
  assert.equal(deletedTrip.ok, true);
  assert.equal(database.get('trips', 'trip_owned').status, 'cancelled');
  const repeatedTripDelete = await tripDelete.main({
    tripId: 'trip_owned',
    operationId: 'trip_delete_test_001',
  });
  assert.equal(repeatedTripDelete.idempotent, true);

  database = createDatabaseMock();
  database.seed('trips', 'trip_with_order', {
    travellerOpenid: 'owner_openid',
    status: 'active',
    verificationStatus: 'approved',
  });
  database.seed('orders', 'order_for_trip', { tripId: 'trip_with_order' });
  const blockedTripUpdate = await tripUpdate.main({
    tripId: 'trip_with_order',
    operationId: 'trip_update_blocked_001',
    form: tripForm,
  });
  assert.equal(blockedTripUpdate.error, 'linked_order_exists');
  const blockedTripDelete = await tripDelete.main({
    tripId: 'trip_with_order',
    operationId: 'trip_delete_blocked_001',
  });
  assert.equal(blockedTripDelete.error, 'linked_order_exists');

  database = createDatabaseMock();
  database.seed('trips', 'trip_other_owner', {
    travellerOpenid: 'another_openid',
    status: 'active',
    verificationStatus: 'approved',
  });
  const unauthorizedTripDelete = await tripDelete.main({
    tripId: 'trip_other_owner',
    operationId: 'trip_delete_unauthorized_001',
  });
  assert.equal(unauthorizedTripDelete.error, 'permission_denied');

  database = createDatabaseMock();
  database.seed('item_requests', 'request_owned', {
    requesterOpenid: 'owner_openid',
    itemName: '普通外套',
    category: 'clothing',
    declaredValue: 480,
    estimatedWeightKg: 1.2,
    pickupLocation: { city: '上海' },
    deliveryLocation: { city: '墨尔本' },
    deadline: '2026-08-22',
    reviewStatus: 'approved',
    isDeleted: false,
  });
  database.seed('offers', 'request_offer', { requestId: 'request_owned', status: 'pending' });

  const updatedRequest = await requestUpdate.main({
    requestId: 'request_owned',
    operationId: 'request_update_test_001',
    form: requestForm,
  });
  assert.equal(updatedRequest.ok, true);
  assert.equal(database.get('item_requests', 'request_owned').itemName, '普通外套（修改）');
  assert.equal(database.get('item_requests', 'request_owned').reviewStatus, 'pending');
  assert.equal(database.get('offers', 'request_offer').status, 'cancelled');

  const deletedRequest = await requestDelete.main({
    requestId: 'request_owned',
    operationId: 'request_delete_test_001',
  });
  assert.equal(deletedRequest.ok, true);
  assert.equal(database.get('item_requests', 'request_owned').isDeleted, true);

  database = createDatabaseMock();
  database.seed('item_requests', 'request_with_order', {
    requesterOpenid: 'owner_openid',
    reviewStatus: 'approved',
    isDeleted: false,
  });
  database.seed('orders', 'order_for_request', { requestId: 'request_with_order' });
  const blockedRequestUpdate = await requestUpdate.main({
    requestId: 'request_with_order',
    operationId: 'request_update_blocked_001',
    form: requestForm,
  });
  assert.equal(blockedRequestUpdate.error, 'linked_order_exists');
  const blockedRequestDelete = await requestDelete.main({
    requestId: 'request_with_order',
    operationId: 'request_delete_blocked_001',
  });
  assert.equal(blockedRequestDelete.error, 'linked_order_exists');

  database = createDatabaseMock();
  database.seed('item_requests', 'request_other_owner', {
    requesterOpenid: 'another_openid',
    reviewStatus: 'approved',
    isDeleted: false,
  });
  const unauthorizedRequestDelete = await requestDelete.main({
    requestId: 'request_other_owner',
    operationId: 'request_delete_unauthorized_001',
  });
  assert.equal(unauthorizedRequestDelete.error, 'permission_denied');

  console.log('Content mutation checks OK. Update, soft delete, ownership, offer cancellation, and order guards passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
