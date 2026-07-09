import { demoOrder } from '../../services/mock';
import { callCloud } from '../../services/cloud';

Page({
  data: {
    orderId: demoOrder.id,
    handoverCode: 'HANDOVER-001',
    submitting: false,
    checks: [
      { label: '双方已核对物品名称、数量和包装', done: false },
      { label: '已拍摄物品外观和交接现场', done: false },
      { label: '已确认税费、异常和争议规则', done: false },
    ],
  },

  onLoad(query) {
    const orderId = query.orderId || demoOrder.id;
    this.setData({
      orderId,
      handoverCode: `HANDOVER-${String(orderId).slice(-6).toUpperCase()}`,
    });
  },

  toggleCheck(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ [`checks[${index}].done`]: !this.data.checks[index].done });
  },

  goEvidence() {
    wx.navigateTo({ url: `/pages/evidence/upload?orderId=${this.data.orderId}&type=handover_qr_scan` });
  },

  async confirmHandover() {
    if (this.data.checks.some((item) => !item.done)) {
      wx.showToast({ title: '请先完成交接检查项', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'handover-confirm-scan',
      data: {
        orderId: this.data.orderId,
        handoverCode: this.data.handoverCode,
      },
      fallback: { ok: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '确认失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '交接已确认', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
