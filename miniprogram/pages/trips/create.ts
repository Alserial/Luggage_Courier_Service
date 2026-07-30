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

let tripSubmissionLocked = false;
let tripSubmissionCompleted = false;
let tripOperationId = '';

function createOperationId(): string {
  return `trip_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function dateValue(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mutationErrorMessage(error: string | undefined, fallback: string): string {
  if (error === 'linked_order_exists') return '该行程已有订单，不能修改，请通过订单流程处理';
  if (error === 'permission_denied') return '你无权修改该行程';
  if (error === 'trip_not_editable') return '当前行程状态不允许修改';
  return fallback;
}

Page({
  data: {
    categories: allowedCategories,
    selectedCategoryMap: {} as Record<string, boolean>,
    form: { ...emptyForm },
    submitting: false,
    isEdit: false,
    tripId: '',
    loadingRecord: false,
    loadErrorText: '',
  },

  onLoad(query) {
    tripSubmissionLocked = false;
    tripSubmissionCompleted = false;
    tripOperationId = '';
    const tripId = query.id || '';
    if (!tripId) return;
    this.setData({ isEdit: true, tripId });
    wx.setNavigationBarTitle({ title: '编辑行程' });
    this.loadTripForEdit(tripId);
  },

  onShow() {
    if (!tripSubmissionCompleted) return;
    tripSubmissionLocked = false;
    tripSubmissionCompleted = false;
    tripOperationId = '';
    this.setData({
      form: { ...emptyForm },
      selectedCategoryMap: {},
      submitting: false,
    });
  },

  async loadTripForEdit(tripId: string) {
    this.setData({ loadingRecord: true, loadErrorText: '' });
    const result = await callCloud<{ ok: boolean; trip?: Record<string, unknown>; isOwner?: boolean; error?: string }>({
      name: 'trip-get',
      data: { tripId },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });
    if (!result.ok || !result.trip || !result.isOwner) {
      this.setData({
        loadingRecord: false,
        loadErrorText: result.error === 'permission_denied' ? '你无权编辑该行程' : '行程信息加载失败，请稍后重试',
      });
      return;
    }

    const acceptableCategories = Array.isArray(result.trip.acceptableCategories)
      ? result.trip.acceptableCategories.filter((item): item is ItemCategory =>
          allowedCategories.some((category) => category.value === item),
        )
      : [];
    const form: TripDraft = {
      fromCity: String(result.trip.fromCity || ''),
      toCity: String(result.trip.toCity || ''),
      departureDate: dateValue(result.trip.departureTime || result.trip.departureDate),
      arrivalDate: dateValue(result.trip.arrivalTime || result.trip.arrivalDate),
      flightNo: String(result.trip.flightNo || ''),
      luggageCapacityKg: Number(result.trip.luggageCapacityKg || 0),
      acceptableCategories,
      note: String(result.trip.note || ''),
    };
    this.setData({
      form,
      selectedCategoryMap: acceptableCategories.reduce((map, item) => {
        map[item] = true;
        return map;
      }, {} as Record<string, boolean>),
      loadingRecord: false,
    });
  },

  onInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
    if (!tripSubmissionLocked) tripOperationId = '';
  },

  onNumberInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: Number(event.detail.value) });
    if (!tripSubmissionLocked) tripOperationId = '';
  },

  onDateChange(event: WechatMiniprogram.PickerChange) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
    if (!tripSubmissionLocked) tripOperationId = '';
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
    if (!tripSubmissionLocked) tripOperationId = '';
  },

  async submit() {
    if (tripSubmissionLocked) return;
    const form = this.data.form as TripDraft;
    const error = validateTripDraft(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    tripSubmissionLocked = true;
    tripOperationId ||= createOperationId();
    this.setData({ submitting: true });
    const isEdit = Boolean(this.data.isEdit);
    const result = await callCloud<{ ok: boolean; tripId?: string; mock?: boolean; error?: string }>({
      name: isEdit ? 'trip-update' : 'trip-create',
      data: { tripId: this.data.tripId, form, operationId: tripOperationId },
      fallback: isEdit ? { ok: false, error: 'cloud_unavailable' } : { ok: true, mock: true },
    });

    if (!result.ok) {
      tripSubmissionLocked = false;
      this.setData({ submitting: false });
      wx.showToast({
        title: mutationErrorMessage(result.error, isEdit ? '行程修改失败' : '行程提交失败'),
        icon: 'none',
      });
      return;
    }

    tripSubmissionCompleted = true;
    getApp<IAppOption>().globalData.dataVersion += 1;
    wx.showToast({ title: isEdit ? '行程已更新，等待重新核验' : '行程已提交', icon: 'success' });
    const url = result.tripId ? `/pages/trips/detail?id=${result.tripId}` : '/pages/trips/index';
    setTimeout(() => {
      const handleNavigationFailure = () => {
        tripSubmissionLocked = false;
        tripSubmissionCompleted = false;
        this.setData({ submitting: false });
        wx.showToast({ title: isEdit ? '行程已更新，请返回详情查看' : '行程已创建，请从行程列表查看', icon: 'none' });
      };
      if (isEdit) {
        wx.navigateBack({ delta: 1, fail: handleNavigationFailure });
      } else if (result.tripId) {
        wx.navigateTo({ url, fail: handleNavigationFailure });
      } else {
        wx.switchTab({ url, fail: handleNavigationFailure });
      }
    }, 600);
  },
});
