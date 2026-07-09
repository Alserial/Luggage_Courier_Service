import { demoOrder } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatMoney } from '../../utils/fees';

Page({
  data: {
    orderId: '',
    submitting: false,
    fee: {
      serviceFee: formatMoney(demoOrder.feeBreakdown.serviceFee),
      platformFee: formatMoney(demoOrder.feeBreakdown.platformFee),
      total: formatMoney(demoOrder.feeBreakdown.total),
    },
  },

  onLoad(query) {
    this.setData({ orderId: query.orderId || demoOrder.id });
  },

  async confirmMockPayment() {
    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'payment-confirm-mock',
      data: {
        orderId: this.data.orderId,
        amount: demoOrder.feeBreakdown.total,
      },
      fallback: { ok: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '支付失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '服务费已锁定', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
