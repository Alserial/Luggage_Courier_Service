import { demoOrder } from '../../services/mock';
import { formatMoney } from '../../utils/fees';
import { orderStatusLabels, orderTimeline } from '../../utils/order-state';

Page({
  data: {
    order: {
      ...demoOrder,
      statusLabel: orderStatusLabels[demoOrder.status],
      totalText: formatMoney(demoOrder.feeBreakdown.total),
    },
    statuses: orderTimeline.map((value) => ({ value, label: orderStatusLabels[value] })),
  },

  goDetail() {
    wx.navigateTo({ url: `/pages/orders/detail?id=${demoOrder.id}` });
  },
});
