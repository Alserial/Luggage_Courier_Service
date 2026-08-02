import { callCloud } from '../../services/cloud';
import { demoOrder } from '../../services/mock';
import { formatMoney } from '../../utils/fees';
import { createOperationId } from '../../utils/operation';
import type { MockOrder } from '../../services/mock';

let paymentOperationId = '';

function emptyFee() {
  return {
    serviceFee: '--',
    platformFee: '--',
    total: '--',
  };
}

Page({
  data: {
    orderId: '',
    loading: true,
    submitting: false,
    canPay: false,
    errorText: '',
    fee: emptyFee(),
  },

  onLoad(query) {
    paymentOperationId = '';
    const orderId = String(query.orderId || '');
    this.setData({ orderId });
    if (!orderId) {
      this.setData({ loading: false, errorText: '缺少订单编号' });
      return;
    }
    this.loadOrder();
  },

  async loadOrder() {
    this.setData({ loading: true, errorText: '', canPay: false });
    const result = await callCloud<{
      ok: boolean;
      order?: MockOrder;
      viewerRole?: string;
      error?: string;
      demo?: boolean;
    }>({
      name: 'order-get',
      data: { orderId: this.data.orderId },
      demoFallback: { ok: true, order: demoOrder, viewerRole: 'requester', demo: true },
    });

    if (!result.ok || !result.order) {
      this.setData({
        loading: false,
        errorText: result.error === 'cloud_unavailable' ? '云服务不可用，无法读取真实金额' : '订单加载失败',
      });
      return;
    }

    const feeBreakdown = result.order.feeBreakdown;
    const canPay = result.order.status === 'pending_payment' && result.viewerRole === 'requester';
    this.setData({
      loading: false,
      canPay,
      errorText: canPay ? '' : '当前订单状态或账号角色不允许确认服务费',
      fee: {
        serviceFee: formatMoney(feeBreakdown.serviceFee),
        platformFee: formatMoney(feeBreakdown.platformFee),
        total: formatMoney(feeBreakdown.total),
      },
    });
  },

  async confirmMockPayment() {
    if (!this.data.canPay || this.data.submitting) return;

    paymentOperationId ||= createOperationId('payment_confirm');
    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string; demo?: boolean }>({
      name: 'payment-confirm-mock',
      data: {
        orderId: this.data.orderId,
        operationId: paymentOperationId,
      },
      demoFallback: { ok: true, demo: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '支付占位确认失败', icon: 'none' });
      return;
    }

    paymentOperationId = '';
    wx.showToast({
      title: result.demo ? '演示完成，未保存到云端' : 'Mock 服务费已锁定',
      icon: 'none',
    });
    setTimeout(() => wx.navigateBack(), 700);
  },
});
