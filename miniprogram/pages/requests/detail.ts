import { callCloud } from '../../services/cloud';
import { demoOffer, demoRequest } from '../../services/mock';
import { formatOfferRecord, formatRequestRecord } from '../../utils/records';

Page({
  data: {
    request: formatRequestRecord(demoRequest),
    offer: formatOfferRecord(demoOffer),
    hasOffer: true,
    accepting: false,
  },

  onLoad(query) {
    this.loadRequest(query.id || demoRequest.id);
  },

  async loadRequest(requestId: string) {
    const result = await callCloud<{ ok: boolean; request?: Record<string, unknown>; offers?: Array<Record<string, unknown>> }>({
      name: 'item-request-get',
      data: { requestId },
      fallback: { ok: true, request: demoRequest, offers: [demoOffer] },
    });

    const offer = result.offers && result.offers.length ? formatOfferRecord(result.offers[0]) : formatOfferRecord(demoOffer);
    this.setData({
      request: formatRequestRecord(result.request || demoRequest),
      offer,
      hasOffer: Boolean(result.offers && result.offers.length),
    });
  },

  async acceptOffer() {
    if (!this.data.hasOffer) {
      wx.showToast({ title: '暂无可接受报价', icon: 'none' });
      return;
    }

    this.setData({ accepting: true });
    const result = await callCloud<{ ok: boolean; orderId?: string; error?: string }>({
      name: 'offer-accept',
      data: { offerId: this.data.offer.id },
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
