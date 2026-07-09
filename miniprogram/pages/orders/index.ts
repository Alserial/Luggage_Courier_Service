import { demoOrder } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatOrderRecord } from '../../utils/records';
import { orderStatusLabels, orderTimeline } from '../../utils/order-state';

Page({
  data: {
    orders: [formatOrderRecord(demoOrder)],
    hasOrders: true,
    statuses: orderTimeline.map((value) => ({ value, label: orderStatusLabels[value] })),
  },

  onShow() {
    this.loadOrders();
  },

  async loadOrders() {
    const result = await callCloud<{ ok: boolean; orders?: Array<Record<string, unknown>> }>({
      name: 'order-list',
      data: { limit: 20 },
      fallback: { ok: true, orders: [demoOrder] },
    });
    const orders = (result.orders || [demoOrder]).map((item) => formatOrderRecord(item));
    this.setData({ orders, hasOrders: orders.length > 0 });
  },

  goDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id || demoOrder.id;
    wx.navigateTo({ url: `/pages/orders/detail?id=${id}` });
  },
});
