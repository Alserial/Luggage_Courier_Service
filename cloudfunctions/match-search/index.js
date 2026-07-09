const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const categoryLabels = {
  clothing: '普通服饰鞋帽',
  books: '书籍资料',
  stationery: '文具办公',
  small_gifts: '低值小礼品',
  phone_accessories: '手机配件',
  daily_items: '日用品',
};

function calculateScore(input) {
  const score =
    (input.sameRoute ? 28 : 0) +
    (input.dateCompatible ? 20 : 0) +
    (input.categoryApproved ? 18 : 0) +
    (input.capacityEnough ? 12 : 0) +
    (input.locationAcceptable ? 8 : 0) +
    Math.min(input.travellerTrust || 0, 5) +
    Math.min(input.requesterTrust || 0, 5) +
    (input.priceCompatible ? 4 : 0) -
    (input.riskPenalty || 0);

  return Math.max(0, Math.min(100, score));
}

function text(value) {
  return String(value || '').trim();
}

function isDemoId(id, prefix) {
  return typeof id === 'string' && id.indexOf(prefix) === 0;
}

async function getDoc(db, collection, id) {
  try {
    return (await db.collection(collection).doc(id).get()).data;
  } catch (error) {
    return null;
  }
}

async function getList(db, collection, statusField, statusValue) {
  const result = await db.collection(collection).where({ [statusField]: statusValue }).limit(50).get();
  return result.data || [];
}

function sameRoute(request, trip) {
  return (
    request.pickupLocation &&
    request.deliveryLocation &&
    text(request.pickupLocation.city) === text(trip.fromCity) &&
    text(request.deliveryLocation.city) === text(trip.toCity)
  );
}

function dateCompatible(request, trip) {
  const deadline = Date.parse(request.deadline);
  const arrival = Date.parse(trip.arrivalTime);
  if (Number.isNaN(deadline) || Number.isNaN(arrival)) return false;
  return deadline >= arrival;
}

function categoryApproved(request, trip) {
  return request.reviewStatus === 'approved' && Array.isArray(trip.acceptableCategories) && trip.acceptableCategories.includes(request.category);
}

function capacityEnough(request, trip) {
  return Number(trip.luggageCapacityKg) >= Number(request.estimatedWeightKg);
}

function buildCandidate(request, trip) {
  const checks = {
    sameRoute: sameRoute(request, trip),
    dateCompatible: dateCompatible(request, trip),
    categoryApproved: categoryApproved(request, trip),
    capacityEnough: capacityEnough(request, trip),
    locationAcceptable: true,
    travellerTrust: 3,
    requesterTrust: 3,
    priceCompatible: true,
    riskPenalty: Array.isArray(request.riskFlags) && request.riskFlags.includes('manual_review_required') ? 8 : 0,
  };

  if (!checks.sameRoute || !checks.dateCompatible || !checks.categoryApproved || !checks.capacityEnough) {
    return null;
  }

  const reasons = [
    '路线一致',
    '时间窗口兼容',
    '物品已审核',
    '容量满足',
    '交接城市可接受',
  ];

  return {
    id: `${trip._id}_${request._id}`,
    tripId: trip._id,
    requestId: request._id,
    route: `${trip.fromCity} -> ${trip.toCity}`,
    dateWindow: `${trip.departureTime} 至 ${trip.arrivalTime}`,
    categoryLabel: categoryLabels[request.category] || request.category,
    capacityKg: Number(trip.luggageCapacityKg),
    score: calculateScore(checks),
    reasons,
  };
}

function demoMatch(tripId, requestId) {
  return {
    id: 'demo_match_001',
    tripId: tripId || 'demo_trip_001',
    requestId: requestId || 'demo_request_001',
    route: '上海 -> 墨尔本',
    dateWindow: '2026-08-18 至 2026-08-22',
    categoryLabel: '普通服饰鞋帽',
    capacityKg: 3,
    score: calculateScore({
      sameRoute: true,
      dateCompatible: true,
      categoryApproved: true,
      capacityEnough: true,
      locationAcceptable: true,
      travellerTrust: 4,
      requesterTrust: 4,
      priceCompatible: true,
      riskPenalty: 0,
    }),
    reasons: ['路线一致', '时间窗口兼容', '物品已审核', '容量满足', '交接城市可接受'],
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { tripId, requestId } = event;
  if (!tripId && !requestId) return { ok: false, error: 'missing_search_target' };

  if (isDemoId(tripId, 'demo_') || isDemoId(requestId, 'demo_')) {
    return { ok: true, matches: [demoMatch(tripId, requestId)] };
  }

  const db = cloud.database();

  if (tripId) {
    const trip = await getDoc(db, 'trips', tripId);
    if (!trip) return { ok: false, error: 'trip_not_found' };
    if (trip.travellerOpenid !== OPENID) return { ok: false, error: 'permission_denied' };
    if (trip.status !== 'active') return { ok: false, error: 'trip_not_active' };

    const requests = await getList(db, 'item_requests', 'reviewStatus', 'approved');
    const matches = requests
      .map((request) => buildCandidate(request, trip))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return { ok: true, matches };
  }

  const request = await getDoc(db, 'item_requests', requestId);
  if (!request) return { ok: false, error: 'request_not_found' };
  if (request.requesterOpenid !== OPENID) return { ok: false, error: 'permission_denied' };
  if (request.reviewStatus !== 'approved') return { ok: false, error: 'request_not_approved' };

  const trips = await getList(db, 'trips', 'status', 'active');
  const matches = trips
    .map((trip) => buildCandidate(request, trip))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return { ok: true, matches };
};
