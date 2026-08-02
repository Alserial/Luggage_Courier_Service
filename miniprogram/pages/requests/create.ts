import { allowedCategories } from '../../utils/categories';
import { validateItemRequestDraft } from '../../utils/validation';
import type { ItemCategory, ItemRequestDraft } from '../../types/index';
import { callCloud, uploadCloudFile } from '../../services/cloud';

const maxPhotoCount = 6;
const maxPhotoSizeBytes = 5 * 1024 * 1024;

type SelectedPhoto = {
  tempFilePath: string;
  size: number;
  fileId: string;
};

const emptyForm: ItemRequestDraft = {
  itemName: '',
  category: '',
  quantity: 1,
  declaredValue: 0,
  estimatedWeightKg: 0,
  pickupCity: '',
  deliveryCity: '',
  deadline: '',
  itemPhotos: [],
  note: '',
  riskDeclarationAccepted: false,
};

let requestSubmissionLocked = false;
let requestSubmissionCompleted = false;
let requestOperationId = '';

function createOperationId(): string {
  return `request_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function dateValue(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function cityValue(location: unknown): string {
  if (!location || typeof location !== 'object' || !('city' in location)) return '';
  return String((location as { city?: unknown }).city || '');
}

function mutationErrorMessage(error: string | undefined, fallback: string): string {
  if (error === 'linked_order_exists') return '该需求已有订单，不能修改，请通过订单流程处理';
  if (error === 'permission_denied') return '你无权修改该需求';
  if (error === 'request_not_editable') return '当前需求状态不允许修改';
  return fallback;
}

function getFileExtension(path: string): string {
  const match = path.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : 'jpg';
}

function createCloudPath(path: string, index: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `item-requests/${Date.now()}-${index}-${random}.${getFileExtension(path)}`;
}

Page({
  data: {
    categories: allowedCategories,
    form: { ...emptyForm },
    selectedPhotos: [] as SelectedPhoto[],
    maxPhotoCount,
    uploading: false,
    uploadProgressText: '',
    submitting: false,
    isEdit: false,
    requestId: '',
    loadingRecord: false,
    loadErrorText: '',
  },

  onLoad(query) {
    requestSubmissionLocked = false;
    requestSubmissionCompleted = false;
    requestOperationId = '';
    const requestId = query.id || '';
    if (!requestId) return;
    this.setData({ isEdit: true, requestId });
    wx.setNavigationBarTitle({ title: '编辑需求' });
    this.loadRequestForEdit(requestId);
  },

  onShow() {
    if (!requestSubmissionCompleted) return;
    requestSubmissionLocked = false;
    requestSubmissionCompleted = false;
    requestOperationId = '';
    this.setData({
      form: { ...emptyForm },
      selectedPhotos: [],
      uploading: false,
      uploadProgressText: '',
      submitting: false,
    });
  },

  async loadRequestForEdit(requestId: string) {
    this.setData({ loadingRecord: true, loadErrorText: '' });
    const result = await callCloud<{
      ok: boolean;
      request?: Record<string, unknown>;
      isOwner?: boolean;
      error?: string;
    }>({
      name: 'item-request-get',
      data: { requestId },
      demoFallback: { ok: false, error: 'cloud_unavailable' },
    });
    if (!result.ok || !result.request || !result.isOwner) {
      this.setData({
        loadingRecord: false,
        loadErrorText: result.error === 'permission_denied' ? '你无权编辑该需求' : '需求信息加载失败，请稍后重试',
      });
      return;
    }

    const category = allowedCategories.some((item) => item.value === result.request?.category)
      ? (result.request.category as ItemCategory)
      : '';
    const itemPhotos = Array.isArray(result.request.itemPhotos) ? result.request.itemPhotos.map(String) : [];
    const selectedPhotos = itemPhotos.map((fileId) => ({
      tempFilePath: fileId,
      size: 0,
      fileId,
    }));
    const form: ItemRequestDraft = {
      itemName: String(result.request.itemName || ''),
      category,
      quantity: Number(result.request.quantity || 1),
      declaredValue: Number(result.request.declaredValue || 0),
      estimatedWeightKg: Number(result.request.estimatedWeightKg || 0),
      pickupCity: cityValue(result.request.pickupLocation),
      deliveryCity: cityValue(result.request.deliveryLocation),
      deadline: dateValue(result.request.deadline),
      itemPhotos,
      note: String(result.request.note || ''),
      riskDeclarationAccepted: Boolean(result.request.riskDeclarationAccepted),
    };
    this.setData({ form, selectedPhotos, loadingRecord: false });
  },

  onInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
    if (!requestSubmissionLocked) requestOperationId = '';
  },

  onNumberInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: Number(event.detail.value) });
    if (!requestSubmissionLocked) requestOperationId = '';
  },

  onDateChange(event: WechatMiniprogram.PickerChange) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
    if (!requestSubmissionLocked) requestOperationId = '';
  },

  selectCategory(event: WechatMiniprogram.TouchEvent) {
    this.setData({ 'form.category': event.currentTarget.dataset.value as ItemCategory });
    if (!requestSubmissionLocked) requestOperationId = '';
  },

  toggleRiskDeclaration() {
    this.setData({ 'form.riskDeclarationAccepted': !this.data.form.riskDeclarationAccepted });
    if (!requestSubmissionLocked) requestOperationId = '';
  },

  chooseItemPhotos() {
    if (this.data.submitting) return;
    const remaining = maxPhotoCount - this.data.selectedPhotos.length;
    if (remaining <= 0) {
      wx.showToast({ title: `最多上传 ${maxPhotoCount} 张图片`, icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (result) => {
        const validPhotos = result.tempFiles
          .filter((file) => file.size <= maxPhotoSizeBytes)
          .map((file) => ({ tempFilePath: file.tempFilePath, size: file.size, fileId: '' }));
        const oversizedCount = result.tempFiles.length - validPhotos.length;
        const selectedPhotos = [...this.data.selectedPhotos, ...validPhotos];
        this.setData({
          selectedPhotos,
          'form.itemPhotos': selectedPhotos.map((photo) => photo.fileId || photo.tempFilePath),
        });
        if (!requestSubmissionLocked) requestOperationId = '';
        if (oversizedCount) {
          wx.showToast({ title: `${oversizedCount} 张图片超过 5MB，未添加`, icon: 'none' });
        }
      },
    });
  },

  previewItemPhoto(event: WechatMiniprogram.TouchEvent) {
    const current = event.currentTarget.dataset.src;
    wx.previewImage({
      current,
      urls: this.data.selectedPhotos.map((photo) => photo.tempFilePath),
    });
  },

  removeItemPhoto(event: WechatMiniprogram.TouchEvent) {
    if (this.data.submitting) return;
    const index = Number(event.currentTarget.dataset.index);
    const selectedPhotos = this.data.selectedPhotos.filter((_, photoIndex) => photoIndex !== index);
    this.setData({
      selectedPhotos,
      'form.itemPhotos': selectedPhotos.map((photo) => photo.fileId || photo.tempFilePath),
    });
    if (!requestSubmissionLocked) requestOperationId = '';
  },

  async uploadItemPhotos(): Promise<string[]> {
    const photos = this.data.selectedPhotos as SelectedPhoto[];
    const fileIds = photos.map((photo) => photo.fileId);
    const pendingPhotos = photos
      .map((photo, index) => ({ photo, index }))
      .filter(({ photo }) => !photo.fileId);

    let completed = photos.length - pendingPhotos.length;
    this.setData({ uploading: true, uploadProgressText: `正在上传 ${completed}/${photos.length}` });

    const uploadResults = await Promise.allSettled(
      pendingPhotos.map(async ({ photo, index }) => {
        const fileId = await uploadCloudFile(createCloudPath(photo.tempFilePath, index), photo.tempFilePath);
        completed += 1;
        this.setData({ uploadProgressText: `正在上传 ${completed}/${photos.length}` });
        return { index, fileId };
      }),
    );

    uploadResults.forEach((result) => {
      if (result.status === 'fulfilled') fileIds[result.value.index] = result.value.fileId;
    });

    const selectedPhotos = photos.map((photo, index) => ({ ...photo, fileId: fileIds[index] }));
    this.setData({
      selectedPhotos,
      'form.itemPhotos': selectedPhotos.map((photo) => photo.fileId || photo.tempFilePath),
      uploading: false,
      uploadProgressText: '',
    });
    if (uploadResults.some((result) => result.status === 'rejected')) throw new Error('photo_upload_failed');
    return fileIds;
  },

  async submit() {
    if (requestSubmissionLocked) return;
    const form = this.data.form as ItemRequestDraft;
    const error = validateItemRequestDraft(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    requestSubmissionLocked = true;
    requestOperationId ||= createOperationId();
    this.setData({ submitting: true });
    let itemPhotos: string[];
    try {
      itemPhotos = await this.uploadItemPhotos();
    } catch (uploadError) {
      console.warn('Item photo upload failed', uploadError);
      requestSubmissionLocked = false;
      this.setData({ submitting: false, uploading: false, uploadProgressText: '' });
      wx.showToast({ title: '图片上传失败，请检查网络后重试', icon: 'none' });
      return;
    }

    const submittedForm = { ...form, itemPhotos };
    this.setData({ 'form.itemPhotos': itemPhotos });

    const isEdit = Boolean(this.data.isEdit);
    const result = await callCloud<{ ok: boolean; requestId?: string; mock?: boolean; error?: string }>({
      name: isEdit ? 'item-request-update' : 'item-request-create',
      data: { requestId: this.data.requestId, form: submittedForm, operationId: requestOperationId },
      demoFallback: isEdit ? { ok: false, error: 'cloud_unavailable' } : { ok: true, mock: true },
    });

    if (!result.ok) {
      requestSubmissionLocked = false;
      this.setData({ submitting: false });
      wx.showToast({
        title: mutationErrorMessage(result.error, isEdit ? '需求修改失败' : '需求提交失败'),
        icon: 'none',
      });
      return;
    }

    requestSubmissionCompleted = true;
    getApp<IAppOption>().globalData.dataVersion += 1;
    wx.showToast({
      title: result.mock ? '演示完成，未保存到云端' : isEdit ? '需求已更新，等待重新审核' : '已提交审核',
      icon: result.mock ? 'none' : 'success',
    });
    const url = result.requestId ? `/pages/requests/detail?id=${result.requestId}` : '/pages/requests/index';
    setTimeout(() => {
      const handleNavigationFailure = () => {
        requestSubmissionLocked = false;
        requestSubmissionCompleted = false;
        this.setData({ submitting: false });
        wx.showToast({ title: isEdit ? '需求已更新，请返回详情查看' : '需求已创建，请从需求列表查看', icon: 'none' });
      };
      if (isEdit) {
        wx.navigateBack({ delta: 1, fail: handleNavigationFailure });
      } else if (result.requestId) {
        wx.navigateTo({ url, fail: handleNavigationFailure });
      } else {
        wx.switchTab({ url, fail: handleNavigationFailure });
      }
    }, 600);
  },
});
