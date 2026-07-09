import type { MatchCandidate } from '../types/index';

type MatchInput = {
  sameRoute: boolean;
  dateCompatible: boolean;
  categoryApproved: boolean;
  capacityEnough: boolean;
  locationAcceptable: boolean;
  travellerTrust: number;
  requesterTrust: number;
  priceCompatible: boolean;
  riskPenalty: number;
};

export function calculateMatchScore(input: MatchInput): number {
  const score =
    (input.sameRoute ? 28 : 0) +
    (input.dateCompatible ? 20 : 0) +
    (input.categoryApproved ? 18 : 0) +
    (input.capacityEnough ? 12 : 0) +
    (input.locationAcceptable ? 8 : 0) +
    Math.min(input.travellerTrust, 5) +
    Math.min(input.requesterTrust, 5) +
    (input.priceCompatible ? 4 : 0) -
    input.riskPenalty;

  return Math.max(0, Math.min(100, score));
}

export function buildDemoMatchCandidate(): MatchCandidate {
  return {
    id: 'demo_match_001',
    tripId: 'demo_trip_001',
    requestId: 'demo_request_001',
    route: '上海 -> 墨尔本',
    dateWindow: '2026-08-18 至 2026-08-22',
    categoryLabel: '普通服饰鞋帽',
    capacityKg: 3,
    score: calculateMatchScore({
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

export function validateOfferAmount(amount: number): string | null {
  if (!amount || amount <= 0) return '请填写帮带服务费';
  if (amount > 500) return 'MVP 阶段单笔帮带服务费建议不超过 500 元';
  return null;
}
