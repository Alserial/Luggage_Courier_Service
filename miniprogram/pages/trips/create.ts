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
    const form = this.data.form as TripDraft;
    const error = validateTripDraft(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    await callCloud({
      name: 'trip-create',
      data: { form },
      fallback: { ok: true, mock: true },
    });

    wx.showToast({ title: '行程已提交', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/trips/index' }), 600);
  },
});
