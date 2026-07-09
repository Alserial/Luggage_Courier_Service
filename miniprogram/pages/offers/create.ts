import { callCloud } from '../../services/cloud';
import { demoRequest, demoTrip } from '../../services/mock';
import type { OfferDraft } from '../../types/index';
import { validateOfferAmount } from '../../utils/matching';

Page({
  data: {
    request: demoRequest,
    trip: demoTrip,
    submitting: false,
    form: {
      requestId: demoRequest.id,
      tripId: demoTrip.id,
      serviceFeeQuote: 120,
      message: '',
      conditions: '',
    } as OfferDraft,
  },

  onLoad(query) {
    this.setData({
      'form.requestId': query.requestId || demoRequest.id,
      'form.tripId': query.tripId || demoTrip.id,
    });
  },

  onInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  onNumberInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: Number(event.detail.value) });
  },

  async submitOffer() {
    const form = this.data.form as OfferDraft;
    const error = validateOfferAmount(form.serviceFeeQuote);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; offerId?: string; error?: string }>({
      name: 'offer-create',
      data: { form },
      fallback: { ok: true, offerId: 'demo_offer_001' },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '报价失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '报价已提交', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
