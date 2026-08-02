import { callCloud, getCloudFileUrls } from '../../services/cloud';
import { demoOrder } from '../../services/mock';
import { formatMoney } from '../../utils/fees';
import { createOperationId } from '../../utils/operation';
import { formatOrderRecord } from '../../utils/records';
import { getOrderProgress, orderStatusLabels, orderTimeline } from '../../utils/order-state';
import type { OrderStatus } from '../../types/index';

type EvidenceSummary = {
  _id: string;
  evidenceType: string;
  description?: string;
  fileIds?: string[];
  fileCount?: number;
  metadata?: {
    files?: Array<{ fileType?: string }>;
  };
  createdAt?: string;
};

const evidenceLabels: Record<string, string> = {
  item_photo: '物品照片',
  handover_qr_scan: '交接扫码',
  in_app_chat: '站内沟通',
  payment_record: '服务费记录',
  flight_record: '航班记录',
  customs_or_airline_proof: '海关/航空证明',
  delivery_photo_or_video: '送达照片/视频',
  mutual_confirmation: '确认记录',
};

let currentOrderId = '';
const transitionOperationIds: Record<string, string> = {};

function transitionError(error?: string): string {
  const labels: Record<string, string> = {
    permission_denied: '当前账号不能执行这一步',
    illegal_transition: '订单状态已变化，请刷新后重试',
    required_evidence_missing: '请先上传送达照片或视频',
    active_dispute: '订单正在争议处理中，参与方不能继续流转',
    cloud_unavailable: '云服务不可用，操作没有保存',
  };
  return labels[error || ''] || error || '订单操作失败';
}

function modal(options: WechatMiniprogram.ShowModalOption): Promise<WechatMiniprogram.ShowModalSuccessCallbackResult> {
  return new Promise((resolve) => wx.showModal({ ...options, success: resolve }));
}

Page({
  data: {
    order: formatOrderRecord(demoOrder),
    orderId: '',
    viewerRole: '',
    evidence: [] as Array<EvidenceSummary & { label: string; createdText: string }>,
    statusLabel: orderStatusLabels[demoOrder.status],
    progress: getOrderProgress(demoOrder.status),
    fee: {
      serviceFee: formatMoney(demoOrder.feeBreakdown.serviceFee),
      platformFee: formatMoney(demoOrder.feeBreakdown.platformFee),
      total: formatMoney(demoOrder.feeBreakdown.total),
    },
    timeline: [] as Array<{ value: string; label: string; done: boolean }>,
    loading: true,
    hasOrder: false,
    submitting: false,
    errorText: '',
    nextTitle: '',
    canPay: false,
    canHandover: false,
    canStartTransit: false,
    canArrive: false,
    canDeliver: false,
    needsDeliveryEvidence: false,
    canComplete: false,
    canCancel: false,
    canDispute: false,
  },

  onLoad(query) {
    currentOrderId = String(query.id || '');
    Object.keys(transitionOperationIds).forEach((key) => delete transitionOperationIds[key]);
    this.setData({ orderId: currentOrderId });
  },

  onShow() {
    if (currentOrderId) this.loadOrder(currentOrderId);
    else this.setData({ loading: false, errorText: '缺少订单编号' });
  },

  async loadOrder(orderId: string) {
    this.setData({ loading: true, errorText: '' });
    const result = await callCloud<{
      ok: boolean;
      order?: Record<string, unknown>;
      viewerRole?: 'requester' | 'traveller';
      evidence?: EvidenceSummary[];
      error?: string;
    }>({
      name: 'order-get',
      data: { orderId },
      demoFallback: {
        ok: true,
        order: demoOrder as unknown as Record<string, unknown>,
        viewerRole: 'requester',
        evidence: [],
      },
    });

    if (!result.ok || !result.order || !result.viewerRole) {
      this.setData({
        loading: false,
        hasOrder: false,
        errorText:
          result.error === 'permission_denied'
            ? '你不是该订单的参与方'
            : result.error === 'cloud_unavailable'
              ? '云服务不可用，无法读取真实订单'
              : '订单加载失败',
      });
      return;
    }

    const order = formatOrderRecord(result.order);
    const evidence = (result.evidence || []).map((item) => ({
      ...item,
      label: evidenceLabels[item.evidenceType] || item.evidenceType,
      createdText: item.createdAt ? String(item.createdAt).slice(0, 16).replace('T', ' ') : '',
    }));
    const deliveryEvidenceIds = evidence
      .filter((item) => item.evidenceType === 'delivery_photo_or_video')
      .map((item) => item._id);
    const statusIndex = orderTimeline.indexOf(order.status);
    const viewerRole = result.viewerRole;
    const canPay = order.status === 'pending_payment' && viewerRole === 'requester';
    const canHandover = order.status === 'paid_locked';
    const canStartTransit = order.status === 'item_handed_to_carrier' && viewerRole === 'traveller';
    const canArrive = order.status === 'in_transit' && viewerRole === 'traveller';
    const canDeliver = order.status === 'arrived' && viewerRole === 'traveller' && deliveryEvidenceIds.length > 0;
    const needsDeliveryEvidence =
      order.status === 'arrived' && viewerRole === 'traveller' && deliveryEvidenceIds.length === 0;
    const canComplete = order.status === 'delivered' && viewerRole === 'requester';
    const canCancel = order.status === 'pending_payment';
    const canDispute = !['completed', 'cancelled', 'refunded', 'disputed'].includes(order.status);
    const nextTitle = canPay
      ? '确认 Mock 服务费记录'
      : canHandover
        ? '完成出发地交接确认'
        : canStartTransit
          ? '确认物品已进入在途'
          : canArrive
            ? '确认已抵达目的地'
            : needsDeliveryEvidence
              ? '先上传送达照片或视频'
              : canDeliver
                ? '提交送达确认'
                : canComplete
                  ? '需求方确认收货并完成'
                  : order.status === 'disputed'
                    ? '等待管理员审查争议证据'
                    : '当前无需你推进订单';

    this.setData({
      loading: false,
      hasOrder: true,
      order,
      viewerRole,
      evidence,
      statusLabel: orderStatusLabels[order.status],
      progress: getOrderProgress(order.status),
      fee: {
        serviceFee: formatMoney(order.feeBreakdown.serviceFee),
        platformFee: formatMoney(order.feeBreakdown.platformFee),
        total: formatMoney(order.feeBreakdown.total),
      },
      timeline: orderTimeline.map((status) => ({
        value: status,
        label: orderStatusLabels[status],
        done: statusIndex >= 0 && orderTimeline.indexOf(status) <= statusIndex,
      })),
      nextTitle,
      canPay,
      canHandover,
      canStartTransit,
      canArrive,
      canDeliver,
      needsDeliveryEvidence,
      canComplete,
      canCancel,
      canDispute,
    });
  },

  goPayment() {
    wx.navigateTo({ url: `/pages/payment/index?orderId=${this.data.order.id}` });
  },

  goHandover() {
    wx.navigateTo({ url: `/pages/handover/index?orderId=${this.data.order.id}` });
  },

  goEvidence(event?: WechatMiniprogram.TouchEvent) {
    const type = event ? String(event.currentTarget.dataset.type || '') : '';
    const suffix = type ? `&type=${type}` : '';
    wx.navigateTo({ url: `/pages/evidence/upload?orderId=${this.data.order.id}${suffix}` });
  },

  goChat() {
    wx.navigateTo({ url: `/pages/chat/index?orderId=${this.data.order.id}` });
  },

  goDispute() {
    if (!this.data.canDispute) return;
    wx.navigateTo({ url: `/pages/disputes/detail?orderId=${this.data.order.id}` });
  },

  async previewEvidence(event: WechatMiniprogram.TouchEvent) {
    const evidenceId = String(event.currentTarget.dataset.id || '');
    const evidence = this.data.evidence.find((item) => item._id === evidenceId);
    if (!evidence || !evidence.fileIds || !evidence.fileIds.length) {
      wx.showToast({ title: '这是系统记录，没有附件', icon: 'none' });
      return;
    }
    try {
      const urls = await getCloudFileUrls(evidence.fileIds);
      if (!urls.length) throw new Error('no_preview_url');
      const files = evidence.metadata?.files || [];
      wx.previewMedia({
        current: 0,
        sources: urls.map((url, index) => ({
          url,
          type: files[index]?.fileType === 'video' ? 'video' : 'image',
        })),
      });
    } catch (error) {
      wx.showToast({ title: '证据附件暂时无法预览', icon: 'none' });
    }
  },

  async confirmTransition(event: WechatMiniprogram.TouchEvent) {
    const nextStatus = String(event.currentTarget.dataset.status || '') as OrderStatus;
    const labels: Partial<Record<OrderStatus, string>> = {
      in_transit: '确认物品已经随携带人进入在途？',
      arrived: '确认已经抵达目的地？',
      delivered: '确认物品已经交付，并引用送达证据？',
      completed: '确认已收货并完成订单？完成后会生成确认记录。',
    };
    const result = await modal({
      title: '确认订单状态',
      content: labels[nextStatus] || '确认执行该订单操作？',
      confirmText: '确认',
    });
    if (!result.confirm) return;
    const evidenceIds =
      nextStatus === 'delivered'
        ? this.data.evidence
            .filter((item) => item.evidenceType === 'delivery_photo_or_video')
            .map((item) => item._id)
        : [];
    await this.transitionOrder(nextStatus, evidenceIds, '');
  },

  async cancelOrder() {
    const result = await modal({
      title: '取消待支付订单',
      content: '请输入取消原因。此操作会写入订单审计记录。',
      editable: true,
      placeholderText: '必填：为什么取消订单',
      confirmText: '确认取消',
      confirmColor: '#a64d3b',
    });
    if (!result.confirm) return;
    const reason = String(result.content || '').trim();
    if (!reason) {
      wx.showToast({ title: '取消原因不能为空', icon: 'none' });
      return;
    }
    await this.transitionOrder('cancelled', [], reason);
  },

  async transitionOrder(nextStatus: OrderStatus, evidenceIds: string[], reason: string) {
    if (this.data.submitting) return;
    transitionOperationIds[nextStatus] ||= createOperationId(`order_${nextStatus}`);
    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string; demo?: boolean }>({
      name: 'order-transition',
      data: {
        orderId: this.data.order.id,
        nextStatus,
        evidenceIds,
        reason,
        operationId: transitionOperationIds[nextStatus],
      },
      demoFallback: { ok: true, demo: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: transitionError(result.error), icon: 'none' });
      return;
    }
    delete transitionOperationIds[nextStatus];
    wx.showToast({
      title: result.demo ? '演示完成，未保存到云端' : '订单状态已更新',
      icon: 'none',
    });
    await this.loadOrder(this.data.order.id);
  },
});
