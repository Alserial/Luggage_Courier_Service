import { callCloud } from '../../services/cloud';
import { demoOffer, demoRequest } from '../../services/mock';
import { formatOfferRecord, formatRequestRecord } from '../../utils/records';

Page({
  data: {
    request: formatRequestRecord(demoRequest),
    offer: formatOfferRecord(demoOffer),
    hasOffer: false,
    isOwner: false,
    loading: true,
    errorText: '',
    accepting: false,
  },

  onLoad(query) {
    this.loadRequest(query.id || demoRequest.id);
  },

  async loadRequest(requestId: string) {
    this.setData({ loading: true, errorText: '' });
    const result = await callCloud<{
      ok: boolean;
      request?: Record<string, unknown>;
      offers?: Array<Record<string, unknown>>;
      isOwner?: boolean;
      error?: string;
    }>({
      name: 'item-request-get',
      data: { requestId },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });

    if (!result.ok || !result.request) {
      this.setData({
        loading: false,
        hasOffer: false,
        isOwner: false,
        errorText: result.error === 'permission_denied' ? '该需求尚未公开或你无权查看' : '需求详情加载失败，请稍后重试',
      });
      return;
    }

    const offer = result.offers && result.offers.length ? formatOfferRecord(result.offers[0]) : formatOfferRecord(demoOffer);
    this.setData({
      request: formatRequestRecord(result.request),
      offer,
      hasOffer: Boolean(result.isOwner && result.offers && result.offers.length),
      isOwner: Boolean(result.isOwner),
      loading: false,
    });
  },

  async acceptOffer() {
    if (!this.data.isOwner) return;
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

  previewItemPhoto(event: WechatMiniprogram.TouchEvent) {
    wx.previewImage({
      current: event.currentTarget.dataset.src,
      urls: this.data.request.itemPhotos,
    });
  },
});
