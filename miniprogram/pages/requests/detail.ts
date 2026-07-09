import { callCloud } from '../../services/cloud';
import { demoOffer, demoRequest } from '../../services/mock';

Page({
  data: {
    request: demoRequest,
    offer: demoOffer,
    accepting: false,
  },

  async acceptOffer() {
    this.setData({ accepting: true });
    const result = await callCloud<{ ok: boolean; orderId?: string; error?: string }>({
      name: 'offer-accept',
      data: { offerId: demoOffer.id },
      fallback: { ok: true, orderId: 'demo_order_001' },
    });
    this.setData({ accepting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '接受报价失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '订单已生成', icon: 'success' });
    setTimeout(() => wx.navigateTo({ url: `/pages/orders/detail?id=${result.orderId || 'demo_order_001'}` }), 600);
  },
});
