import { callCloud } from '../../services/cloud';
import { demoOrder } from '../../services/mock';

const reasons = ['物品损坏或数量不符', '未按约定交接', '航班/海关异常', '费用或税费争议', '其他'];

Page({
  data: {
    orderId: demoOrder.id,
    reasons,
    reasonIndex: 0,
    selectedReason: reasons[0],
    description: '',
    submitting: false,
  },

  onLoad(query) {
    this.setData({ orderId: query.orderId || demoOrder.id });
  },

  onReasonChange(event: WechatMiniprogram.PickerChange) {
    const reasonIndex = Number(event.detail.value);
    this.setData({ reasonIndex, selectedReason: reasons[reasonIndex] });
  },

  onDescriptionInput(event: WechatMiniprogram.Input) {
    this.setData({ description: event.detail.value });
  },

  goEvidence() {
    wx.navigateTo({ url: `/pages/evidence/upload?orderId=${this.data.orderId}` });
  },

  async openDispute() {
    if (!this.data.description.trim()) {
      wx.showToast({ title: '请填写争议说明', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'dispute-open',
      data: {
        orderId: this.data.orderId,
        reason: this.data.selectedReason,
        description: this.data.description,
      },
      fallback: { ok: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '提交失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '争议已提交', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
