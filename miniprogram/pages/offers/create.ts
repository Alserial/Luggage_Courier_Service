import { callCloud } from '../../services/cloud';
import { demoRequest, demoTrip } from '../../services/mock';
import type { OfferDraft } from '../../types/index';
import { validateOfferAmount } from '../../utils/matching';
import { createOperationId } from '../../utils/operation';

let offerOperationId = '';

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
    offerOperationId = '';
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
    offerOperationId ||= createOperationId('offer_create');
    const result = await callCloud<{ ok: boolean; offerId?: string; error?: string; demo?: boolean }>({
      name: 'offer-create',
      data: { form, operationId: offerOperationId },
      demoFallback: { ok: true, offerId: 'demo_offer_001', demo: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '报价失败', icon: 'none' });
      return;
    }

    offerOperationId = '';
    wx.showToast({ title: result.demo ? '演示完成，未保存到云端' : '报价已提交', icon: 'none' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
