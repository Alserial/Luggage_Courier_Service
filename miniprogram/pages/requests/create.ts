import { allowedCategories } from '../../utils/categories';
import { validateItemRequestDraft } from '../../utils/validation';
import type { ItemCategory, ItemRequestDraft } from '../../types/index';
import { callCloud } from '../../services/cloud';

const emptyForm: ItemRequestDraft = {
  itemName: '',
  category: '',
  quantity: 1,
  declaredValue: 0,
  estimatedWeightKg: 0,
  pickupCity: '',
  deliveryCity: '',
  deadline: '',
  note: '',
  riskDeclarationAccepted: false,
};

Page({
  data: {
    categories: allowedCategories,
    form: { ...emptyForm },
  },

  onInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  onNumberInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: Number(event.detail.value) });
  },

  onDateChange(event: WechatMiniprogram.PickerChange) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  selectCategory(event: WechatMiniprogram.TouchEvent) {
    this.setData({ 'form.category': event.currentTarget.dataset.value as ItemCategory });
  },

  toggleRiskDeclaration() {
    this.setData({ 'form.riskDeclarationAccepted': !this.data.form.riskDeclarationAccepted });
  },

  async submit() {
    const form = this.data.form as ItemRequestDraft;
    const error = validateItemRequestDraft(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const result = await callCloud<{ ok: boolean; requestId?: string; mock?: boolean; error?: string }>({
      name: 'item-request-create',
      data: { form },
      fallback: { ok: true, mock: true },
    });

    if (!result.ok) {
      wx.showToast({ title: result.error || '需求提交失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '已提交审核', icon: 'success' });
    const url = result.requestId ? `/pages/requests/detail?id=${result.requestId}` : '/pages/requests/index';
    setTimeout(() => {
      if (result.requestId) {
        wx.navigateTo({ url });
      } else {
        wx.switchTab({ url });
      }
    }, 600);
  },
});
