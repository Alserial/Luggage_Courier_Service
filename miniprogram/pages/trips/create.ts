import { allowedCategories } from '../../utils/categories';
import { validateTripDraft } from '../../utils/validation';
import type { ItemCategory, TripDraft } from '../../types/index';
import { callCloud } from '../../services/cloud';

const emptyForm: TripDraft = {
  fromCity: '',
  toCity: '',
  departureDate: '',
  arrivalDate: '',
  flightNo: '',
  luggageCapacityKg: 0,
  acceptableCategories: [],
  note: '',
};

Page({
  data: {
    categories: allowedCategories,
    selectedCategoryMap: {} as Record<string, boolean>,
    form: { ...emptyForm },
    submitting: false,
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

  toggleCategory(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as ItemCategory;
    const selected = new Set(this.data.form.acceptableCategories);
    if (selected.has(value)) {
      selected.delete(value);
    } else {
      selected.add(value);
    }
    const acceptableCategories = Array.from(selected);
    this.setData({
      'form.acceptableCategories': acceptableCategories,
      selectedCategoryMap: acceptableCategories.reduce((map, item) => {
        map[item] = true;
        return map;
      }, {} as Record<string, boolean>),
    });
  },

  async submit() {
    if (this.data.submitting) return;
    const form = this.data.form as TripDraft;
    const error = validateTripDraft(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; tripId?: string; mock?: boolean; error?: string }>({
      name: 'trip-create',
      data: { form },
      fallback: { ok: true, mock: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '行程提交失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '行程已提交', icon: 'success' });
    const url = result.tripId ? `/pages/trips/detail?id=${result.tripId}` : '/pages/trips/index';
    setTimeout(() => {
      if (result.tripId) {
        wx.navigateTo({ url });
      } else {
        wx.switchTab({ url });
      }
    }, 600);
  },
});
