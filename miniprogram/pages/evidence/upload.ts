import { callCloud } from '../../services/cloud';
import { demoOrder } from '../../services/mock';

const evidenceTypes = [
  { value: 'item_photo', label: '物品照片' },
  { value: 'handover_qr_scan', label: '交接扫码' },
  { value: 'payment_record', label: '支付记录' },
  { value: 'flight_record', label: '航班记录' },
  { value: 'customs_or_airline_proof', label: '海关/航空公司证明' },
  { value: 'delivery_photo_or_video', label: '交付照片/视频' },
  { value: 'mutual_confirmation', label: '双方确认' },
];

Page({
  data: {
    orderId: demoOrder.id,
    evidenceTypes,
    selectedIndex: 0,
    selectedTypeLabel: evidenceTypes[0].label,
    description: '',
    files: [] as Array<{ tempFilePath: string; type: string; sizeText: string }>,
    submitting: false,
  },

  onLoad(query) {
    const selectedIndex = evidenceTypes.findIndex((item) => item.value === query.type);
    this.setData({
      orderId: query.orderId || demoOrder.id,
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
        this.setData({
          files: result.tempFiles.map((file) => ({
            tempFilePath: file.tempFilePath,
            type: file.fileType || 'file',
            sizeText: `${Math.ceil(file.size / 1024)}KB`,
          })),
        });
      },
    });
  },

  async submitEvidence() {
    if (!this.data.files.length) {
      wx.showToast({ title: '请先选择证据文件', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'evidence-create',
      data: {
        orderId: this.data.orderId,
        evidenceType: evidenceTypes[this.data.selectedIndex].value,
        description: this.data.description,
        fileCount: this.data.files.length,
      },
      fallback: { ok: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '保存失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '证据已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
