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
    if (this.data.submitting) return;
    const form = this.data.form as ItemRequestDraft;
    const error = validateItemRequestDraft(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    let itemPhotos: string[];
    try {
      itemPhotos = await this.uploadItemPhotos();
    } catch (uploadError) {
      console.warn('Item photo upload failed', uploadError);
      this.setData({ submitting: false, uploading: false, uploadProgressText: '' });
      wx.showToast({ title: '图片上传失败，请检查网络后重试', icon: 'none' });
      return;
    }

    const submittedForm = { ...form, itemPhotos };
    this.setData({ 'form.itemPhotos': itemPhotos });

    const result = await callCloud<{ ok: boolean; requestId?: string; mock?: boolean; error?: string }>({
      name: 'item-request-create',
      data: { form: submittedForm },
      fallback: { ok: true, mock: true },
    });

    this.setData({ submitting: false });

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
