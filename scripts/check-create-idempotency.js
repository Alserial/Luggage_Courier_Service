const assert = require('assert');
const Module = require('module');

function createDatabaseMock() {
  const collections = new Map();
  let generatedId = 0;

  function records(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
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
          };
        },
        async add({ data }) {
          generatedId += 1;
          const id = `generated_${generatedId}`;
          collectionRecords.set(id, { ...data });
          return { _id: id };
        },
      };
    },
    size(name) {
      return records(name).size;
    },
  };
}

async function main() {
  const database = createDatabaseMock();
  const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    getWXContext() {
      return { OPENID: 'test_openid' };
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

  const tripCreate = require('../cloudfunctions/trip-create/index.js');
  const requestCreate = require('../cloudfunctions/item-request-create/index.js');
  Module._load = originalLoad;

  const tripEvent = {
    operationId: 'trip_test_operation_001',
    form: {
      fromCity: '上海',
      toCity: '墨尔本',
      departureDate: '2026-08-18',
      arrivalDate: '2026-08-19',
      flightNo: 'MU737',
      luggageCapacityKg: 2,
      acceptableCategories: ['clothing'],
      note: '',
    },
  };
  const concurrentTrips = await Promise.all([tripCreate.main(tripEvent), tripCreate.main(tripEvent)]);
  assert.equal(concurrentTrips[0].tripId, concurrentTrips[1].tripId);
  assert.equal(database.size('trips'), 1);
  assert.equal(database.size('audit_logs'), 1);
  const repeatedTrip = await tripCreate.main(tripEvent);
  assert.equal(repeatedTrip.idempotent, true);
  assert.equal(database.size('trips'), 1);

  const requestEvent = {
    operationId: 'request_test_operation_001',
    form: {
      itemName: '普通外套',
      category: 'clothing',
      quantity: 1,
      declaredValue: 480,
      estimatedWeightKg: 1.2,
      pickupCity: '上海',
      deliveryCity: '墨尔本',
      deadline: '2026-08-22',
      itemPhotos: ['cloud://test/item-photo.jpg'],
      riskDeclarationAccepted: true,
      note: '',
    },
  };
  const concurrentRequests = await Promise.all([requestCreate.main(requestEvent), requestCreate.main(requestEvent)]);
  assert.equal(concurrentRequests[0].requestId, concurrentRequests[1].requestId);
  assert.equal(database.size('item_requests'), 1);
  assert.equal(database.size('audit_logs'), 2);
  const repeatedRequest = await requestCreate.main(requestEvent);
  assert.equal(repeatedRequest.idempotent, true);
  assert.equal(database.size('item_requests'), 1);

  console.log('Create idempotency OK. Duplicate trip and request submissions produced one record each.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
