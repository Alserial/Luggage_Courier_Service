import { demoOrder } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatOrderRecord } from '../../utils/records';
import { orderStatusLabels, orderTimeline } from '../../utils/order-state';

Page({
  data: {
    orders: [] as ReturnType<typeof formatOrderRecord>[],
    hasOrders: false,
    loading: true,
    errorText: '',
    statuses: orderTimeline.map((value) => ({ value, label: orderStatusLabels[value] })),
  },

  onShow() {
    this.loadOrders();
  },

  async loadOrders() {
    this.setData({ loading: true, errorText: '' });
    const result = await callCloud<{ ok: boolean; orders?: Array<Record<string, unknown>>; error?: string }>({
      name: 'order-list',
      data: { limit: 20 },
      fallback: { ok: true, orders: [demoOrder] },
    });
    if (!result.ok) {
      this.setData({
        orders: [],
        hasOrders: false,
        loading: false,
        errorText: result.error || '订单记录加载失败，请稍后重试',
      });
      return;
    }
    const orders = (result.orders || []).map((item) => formatOrderRecord(item));
    this.setData({ orders, hasOrders: orders.length > 0, loading: false });
  },

  retryLoad() {
    this.loadOrders();
  },

  goDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id || demoOrder.id;
    wx.navigateTo({ url: `/pages/orders/detail?id=${id}` });
  },
});
