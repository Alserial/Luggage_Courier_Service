import { callCloud } from '../../services/cloud';
import { createOperationId } from '../../utils/operation';

type EvidenceSummary = {
  _id: string;
  evidenceType: string;
};

let handoverOperationId = '';

Page({
  data: {
    orderId: '',
    handoverCode: '',
    itemPhotoEvidenceIds: [] as string[],
    evidenceLoading: true,
    evidenceError: '',
    submitting: false,
    checks: [
      { label: '双方已核对物品名称、数量和包装', done: false },
      { label: '已拍摄物品外观和交接现场', done: false },
      { label: '已确认税费、异常和争议规则', done: false },
    ],
  },

  onLoad(query) {
    handoverOperationId = '';
    const orderId = String(query.orderId || '');
    this.setData({
      orderId,
      handoverCode: `HANDOVER-${String(orderId).slice(-6).toUpperCase()}`,
    });
  },

  onShow() {
    if (this.data.orderId) this.loadEvidence();
  },

  async loadEvidence() {
    this.setData({ evidenceLoading: true, evidenceError: '' });
    const result = await callCloud<{
      ok: boolean;
      evidence?: EvidenceSummary[];
      error?: string;
    }>({
      name: 'order-get',
      data: { orderId: this.data.orderId },
      demoFallback: { ok: true, evidence: [] },
    });
    if (!result.ok) {
      this.setData({
        evidenceLoading: false,
        itemPhotoEvidenceIds: [],
        evidenceError: '交接照片读取失败，请稍后重试',
      });
      return;
    }
    const itemPhotoEvidenceIds = (result.evidence || [])
      .filter((item) => item.evidenceType === 'item_photo')
      .map((item) => item._id);
    this.setData({
      evidenceLoading: false,
      itemPhotoEvidenceIds,
      evidenceError: itemPhotoEvidenceIds.length ? '' : '交接前必须先上传一条物品照片证据',
    });
  },

  toggleCheck(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ [`checks[${index}].done`]: !this.data.checks[index].done });
  },

  goEvidence() {
    wx.navigateTo({ url: `/pages/evidence/upload?orderId=${this.data.orderId}&type=item_photo` });
  },

  async confirmHandover() {
    if (this.data.checks.some((item) => !item.done)) {
      wx.showToast({ title: '请先完成交接检查项', icon: 'none' });
      return;
    }
    if (!this.data.itemPhotoEvidenceIds.length) {
      wx.showToast({ title: '请先上传交接物品照片', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;

    handoverOperationId ||= createOperationId('handover_confirm');
    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string; demo?: boolean }>({
      name: 'handover-confirm-scan',
      data: {
        orderId: this.data.orderId,
        handoverCode: this.data.handoverCode,
        evidenceIds: this.data.itemPhotoEvidenceIds,
        operationId: handoverOperationId,
      },
      demoFallback: { ok: true, demo: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '确认失败', icon: 'none' });
      return;
    }

    handoverOperationId = '';
    wx.showToast({
      title: result.demo ? '演示完成，未保存到云端' : '交接已确认',
      icon: 'none',
    });
    setTimeout(() => wx.navigateBack(), 700);
  },
});
