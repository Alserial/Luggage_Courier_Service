import { demoOrder } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatMoney } from '../../utils/fees';
import { formatOrderRecord } from '../../utils/records';
import { getOrderProgress, orderStatusLabels, orderTimeline } from '../../utils/order-state';
import type { MockOrder } from '../../services/mock';

Page({
  data: {
    order: formatOrderRecord(demoOrder),
    statusLabel: orderStatusLabels[demoOrder.status],
    progress: getOrderProgress(demoOrder.status),
    fee: {
      serviceFee: formatMoney(demoOrder.feeBreakdown.serviceFee),
      platformFee: formatMoney(demoOrder.feeBreakdown.platformFee),
      total: formatMoney(demoOrder.feeBreakdown.total),
    },
    timeline: orderTimeline.map((status) => ({
      value: status,
      label: orderStatusLabels[status],
      done: orderTimeline.indexOf(status) <= orderTimeline.indexOf(demoOrder.status),
    })),
  },

  onLoad(query) {
    this.loadOrder(query.id || demoOrder.id);
  },

  async loadOrder(orderId: string) {
    const result = await callCloud<{ ok: boolean; order?: MockOrder }>({
      name: 'order-get',
      data: { orderId },
      fallback: { ok: true, order: demoOrder },
    });

    const order = formatOrderRecord((result.order || demoOrder) as unknown as Record<string, unknown>);
    const statusIndex = orderTimeline.indexOf(order.status);
    this.setData({
      order,
      statusLabel: orderStatusLabels[order.status],
      progress: getOrderProgress(order.status),
      fee: {
        serviceFee: formatMoney(order.feeBreakdown.serviceFee),
        platformFee: formatMoney(order.feeBreakdown.platformFee),
        total: formatMoney(order.feeBreakdown.total),
      },
      timeline: orderTimeline.map((status) => ({
        value: status,
        label: orderStatusLabels[status],
        done: statusIndex >= 0 && orderTimeline.indexOf(status) <= statusIndex,
      })),
    });
  },

  goPayment() {
    wx.navigateTo({ url: `/pages/payment/index?orderId=${this.data.order.id}` });
  },

  goHandover() {
    wx.navigateTo({ url: `/pages/handover/index?orderId=${this.data.order.id}` });
  },

  goEvidence() {
    wx.navigateTo({ url: `/pages/evidence/upload?orderId=${this.data.order.id}` });
  },

  goChat() {
    wx.navigateTo({ url: `/pages/chat/index?orderId=${this.data.order.id}` });
  },

  goDispute() {
    wx.navigateTo({ url: `/pages/disputes/detail?orderId=${this.data.order.id}` });
  },
});
