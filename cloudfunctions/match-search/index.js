const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

exports.main = async (event) => {
  const { tripId, requestId } = event;
  if (!tripId && !requestId) return { ok: false, error: 'missing_search_target' };

  return {
    ok: true,
    matches: [
      {
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
      },
    ],
  };
};
