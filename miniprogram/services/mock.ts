import { calculateFeeBreakdown } from '../utils/fees';
import type { OrderStatus } from '../types/index';

export type MockOrder = {
  id: string;
  route: string;
  itemName: string;
  categoryLabel: string;
  travellerName: string;
  requesterName: string;
  status: OrderStatus;
  feeBreakdown: ReturnType<typeof calculateFeeBreakdown>;
  taxRule: string;
  handoverCity: string;
  deliveryCity: string;
  evidenceCount: number;
};

export const demoOrder: MockOrder = {
  id: 'demo_order_001',
  route: '上海 -> 墨尔本',
  itemName: '普通外套',
  categoryLabel: '普通服饰鞋帽',
  travellerName: '携带人 A',
  requesterName: '需求方 B',
  status: 'pending_payment',
  feeBreakdown: calculateFeeBreakdown(120),
  taxRule: '如入境被要求补税，默认由需求方承担；携带人需如实申报并上传证明。',
  handoverCity: '上海',
  deliveryCity: '墨尔本',
  evidenceCount: 0,
};

export const demoTrip = {
  id: 'demo_trip_001',
  route: '上海 -> 墨尔本',
  fromCity: '上海',
  toCity: '墨尔本',
  departureDate: '2026-08-18',
  arrivalDate: '2026-08-19',
  flightNo: 'MU737',
  capacityKg: 3,
  categories: ['普通服饰鞋帽', '书籍资料', '无电池 3C 配件'],
};

export const demoRequest = {
  id: 'demo_request_001',
  route: '上海 -> 墨尔本',
  itemName: '普通外套',
  categoryLabel: '普通服饰鞋帽',
  declaredValue: 480,
  estimatedWeightKg: 1.2,
  deadline: '2026-08-22',
  reviewStatus: 'approved',
  riskFlags: ['低风险品类', '个人合理数量', '需交接照片'],
};

export const demoOffer = {
  id: 'demo_offer_001',
  requestId: demoRequest.id,
  tripId: demoTrip.id,
  travellerName: demoOrder.travellerName,
  serviceFeeQuote: 120,
  conditions: '出发地机场附近交接，到达后 24 小时内完成交付。',
  status: 'pending',
};
