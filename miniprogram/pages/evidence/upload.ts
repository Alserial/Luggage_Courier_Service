import { callCloud, uploadCloudFile } from '../../services/cloud';
import { createOperationId } from '../../utils/operation';

const evidenceTypes = [
  { value: 'item_photo', label: '物品照片' },
  { value: 'flight_record', label: '航班记录' },
  { value: 'customs_or_airline_proof', label: '海关/航空公司证明' },
  { value: 'delivery_photo_or_video', label: '交付照片/视频' },
];

type UploadFile = {
  tempFilePath: string;
  fileType: 'image' | 'video';
  sizeBytes: number;
  sizeText: string;
  fileId?: string;
  uploadStatus: string;
};

let evidenceOperationId = '';

function fileExtension(path: string, fileType: 'image' | 'video'): string {
  const clean = path.split('?')[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : fileType === 'video' ? 'mp4' : 'jpg';
}

function sizeText(sizeBytes: number): string {
  return sizeBytes >= 1024 * 1024
    ? `${(sizeBytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.ceil(sizeBytes / 1024)}KB`;
}

Page({
  data: {
    orderId: '',
    evidenceTypes,
    selectedIndex: 0,
    selectedTypeLabel: evidenceTypes[0].label,
    description: '',
    files: [] as UploadFile[],
    submitting: false,
    progressText: '',
  },

  onLoad(query) {
    evidenceOperationId = '';
    const selectedIndex = evidenceTypes.findIndex((item) => item.value === query.type);
    this.setData({
      orderId: String(query.orderId || ''),
      selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
      selectedTypeLabel: evidenceTypes[selectedIndex >= 0 ? selectedIndex : 0].label,
    });
  },

  onTypeChange(event: WechatMiniprogram.PickerChange) {
    const selectedIndex = Number(event.detail.value);
    this.setData({
      selectedIndex,
      selectedTypeLabel: evidenceTypes[selectedIndex].label,
    });
  },

  onDescriptionInput(event: WechatMiniprogram.Input) {
    this.setData({ description: event.detail.value });
  },

  chooseMedia() {
    wx.chooseMedia({
      count: 6,
      mediaType: ['image', 'video'],
      sourceType: ['album', 'camera'],
      success: (result) => {
        const files = result.tempFiles.map((file) => {
          const fileType = file.fileType === 'video' ? 'video' : 'image';
          return {
            tempFilePath: file.tempFilePath,
            fileType,
            sizeBytes: file.size,
            sizeText: sizeText(file.size),
            uploadStatus: '待上传',
          } as UploadFile;
        });
        const oversized = files.find((file) =>
          file.fileType === 'video' ? file.sizeBytes > 20 * 1024 * 1024 : file.sizeBytes > 5 * 1024 * 1024,
        );
        if (oversized) {
          wx.showToast({
            title: oversized.fileType === 'video' ? '视频不能超过 20MB' : '图片不能超过 5MB',
            icon: 'none',
          });
          return;
        }
        evidenceOperationId = '';
        this.setData({ files, progressText: '' });
      },
    });
  },

  async uploadAllFiles(): Promise<UploadFile[]> {
    evidenceOperationId ||= createOperationId('evidence_create');
    const snapshot = this.data.files as UploadFile[];
    return Promise.all(
      snapshot.map(async (file, index) => {
        if (file.fileId) return file;
        this.setData({
          [`files[${index}].uploadStatus`]: '上传中',
          progressText: `正在上传 ${index + 1}/${snapshot.length}`,
        });
        const extension = fileExtension(file.tempFilePath, file.fileType);
        const cloudPath = `evidence/${this.data.orderId}/${evidenceOperationId}/${index}.${extension}`;
        const fileId = await uploadCloudFile(cloudPath, file.tempFilePath);
        this.setData({
          [`files[${index}].fileId`]: fileId,
          [`files[${index}].uploadStatus`]: '已上传',
        });
        return { ...file, fileId, uploadStatus: '已上传' };
      }),
    );
  },

  async submitEvidence() {
    if (!this.data.orderId) {
      wx.showToast({ title: '缺少订单编号', icon: 'none' });
      return;
    }
    if (!this.data.files.length) {
      wx.showToast({ title: '请先选择证据文件', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;

    this.setData({ submitting: true, progressText: '准备上传证据' });
    let uploadedFiles: UploadFile[];
    try {
      uploadedFiles = await this.uploadAllFiles();
    } catch (error) {
      this.setData({ submitting: false, progressText: '部分文件上传失败，可直接重试' });
      wx.showToast({ title: '文件上传失败，尚未创建证据', icon: 'none' });
      return;
    }

    this.setData({ progressText: '正在保存证据记录' });
    const result = await callCloud<{ ok: boolean; evidenceId?: string; error?: string; demo?: boolean }>({
      name: 'evidence-create',
      data: {
        orderId: this.data.orderId,
        evidenceType: evidenceTypes[this.data.selectedIndex].value,
        description: this.data.description,
        fileIds: uploadedFiles.map((file) => file.fileId || ''),
        fileMetadata: uploadedFiles.map((file) => ({
          fileType: file.fileType,
          sizeBytes: file.sizeBytes,
        })),
        operationId: evidenceOperationId,
      },
      demoFallback: { ok: true, evidenceId: 'demo_evidence', demo: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      this.setData({ progressText: '证据记录保存失败，可直接重试' });
      wx.showToast({ title: result.error || '保存失败', icon: 'none' });
      return;
    }

    evidenceOperationId = '';
    this.setData({ progressText: '' });
    wx.showToast({
      title: result.demo ? '演示完成，未保存到云端' : '证据已保存',
      icon: 'none',
    });
    setTimeout(() => wx.navigateBack(), 700);
  },
});
