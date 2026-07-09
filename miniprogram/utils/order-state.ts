import type { OrderStatus } from '../types/index';

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  approved: '审核通过',
  pending_payment: '待支付',
  paid_locked: '服务费已锁定',
  item_handed_to_carrier: '出发地已交接',
  in_transit: '携带在途',
  arrived: '已到达',
  delivered: '已交付待确认',
  completed: '已完成',
  disputed: '争议中',
  cancelled: '已取消',
  refunded: '已退款',
};

export const orderTimeline: OrderStatus[] = [
  'pending_review',
  'approved',
  'pending_payment',
  'paid_locked',
  'item_handed_to_carrier',
  'in_transit',
  'arrived',
  'delivered',
  'completed',
];

export const allowedNextStatuses: Partial<Record<OrderStatus, OrderStatus[]>> = {
  approved: ['pending_payment', 'cancelled', 'disputed'],
  pending_payment: ['paid_locked', 'cancelled', 'disputed'],
  paid_locked: ['item_handed_to_carrier', 'cancelled', 'refunded', 'disputed'],
  item_handed_to_carrier: ['in_transit', 'disputed'],
  in_transit: ['arrived', 'disputed'],
  arrived: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  disputed: ['refunded', 'completed', 'cancelled'],
};

export function getOrderProgress(status: OrderStatus): number {
  const index = orderTimeline.indexOf(status);
  if (index < 0) return 0;
  return Math.round(((index + 1) / orderTimeline.length) * 100);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return Boolean(allowedNextStatuses[from]?.includes(to));
}
