import { callCloud } from '../../services/cloud';
import { demoOffer, demoRequest } from '../../services/mock';
import { formatOfferRecord, formatRequestRecord } from '../../utils/records';
import { createOperationId } from '../../utils/operation';

let requestDeleteLocked = false;
let requestDeleteOperationId = '';
let acceptOfferOperationId = '';

function deleteErrorMessage(error: string | undefined): string {
  if (error === 'linked_order_exists') return '该需求已有订单，不能删除，请通过订单流程处理';
  if (error === 'permission_denied') return '你无权删除该需求';
  return '需求删除失败，请稍后重试';
}

function reviewLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待审核',
    manual_review: '人工审核',
    approved: '已通过',
    rejected: '未通过',
  };
  return labels[status] || status;
}

Page({
  data: {
    request: formatRequestRecord(demoRequest),
    offer: formatOfferRecord(demoOffer),
    hasOffer: false,
    isOwner: false,
    loading: true,
    errorText: '',
    accepting: false,
    requestId: '',
    deleting: false,
    statusLabel: '',
  },

  onLoad(query) {
    requestDeleteLocked = false;
    requestDeleteOperationId = '';
    acceptOfferOperationId = '';
    this.setData({ requestId: query.id || demoRequest.id });
  },

  onShow() {
    if (this.data.requestId) this.loadRequest(this.data.requestId);
  },

  async loadRequest(requestId: string) {
    this.setData({ loading: true, errorText: '' });
    const result = await callCloud<{
      ok: boolean;
      request?: Record<string, unknown>;
      offers?: Array<Record<string, unknown>>;
      isOwner?: boolean;
      error?: string;
    }>({
      name: 'item-request-get',
      data: { requestId },
      demoFallback: { ok: false, error: 'cloud_unavailable' },
    });

    if (!result.ok || !result.request) {
      this.setData({
        loading: false,
        hasOffer: false,
        isOwner: false,
        errorText:
          result.error === 'permission_denied'
            ? '该需求尚未公开或你无权查看'
            : result.error === 'request_deleted'
              ? '该需求已删除'
              : '需求详情加载失败，请稍后重试',
      });
      return;
    }

    const offer = result.offers && result.offers.length ? formatOfferRecord(result.offers[0]) : formatOfferRecord(demoOffer);
    const request = formatRequestRecord(result.request);
    this.setData({
      request,
      statusLabel: reviewLabel(request.reviewStatus),
      offer,
      hasOffer: Boolean(result.isOwner && result.offers && result.offers.length),
      isOwner: Boolean(result.isOwner),
      loading: false,
    });
  },

  async acceptOffer() {
    if (!this.data.isOwner) return;
    if (!this.data.hasOffer) {
      wx.showToast({ title: '暂无可接受报价', icon: 'none' });
      return;
    }

    this.setData({ accepting: true });
    acceptOfferOperationId ||= createOperationId('offer_accept');
    const result = await callCloud<{ ok: boolean; orderId?: string; error?: string; demo?: boolean }>({
      name: 'offer-accept',
      data: { offerId: this.data.offer.id, operationId: acceptOfferOperationId },
      demoFallback: { ok: true, orderId: 'demo_order_001', demo: true },
    });
    this.setData({ accepting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '接受报价失败', icon: 'none' });
      return;
    }

    acceptOfferOperationId = '';
    wx.showToast({ title: result.demo ? '演示完成，未保存到云端' : '订单已生成', icon: 'none' });
    setTimeout(() => wx.navigateTo({ url: `/pages/orders/detail?id=${result.orderId || 'demo_order_001'}` }), 600);
  },

  previewItemPhoto(event: WechatMiniprogram.TouchEvent) {
    wx.previewImage({
      current: event.currentTarget.dataset.src,
      urls: this.data.request.itemPhotos,
    });
  },

  goEdit() {
    if (!this.data.isOwner || this.data.accepting || this.data.deleting) return;
    wx.navigateTo({ url: `/pages/requests/create?id=${this.data.request.id}` });
  },

  confirmDelete() {
    if (!this.data.isOwner || requestDeleteLocked || this.data.accepting) return;
    wx.showModal({
      title: '删除这条需求？',
      content: '删除后将从公开大厅和“我的发布”移除，待处理报价会失效；已有订单时不能删除。',
      confirmText: '删除',
      confirmColor: '#a64d3b',
      success: (result) => {
        if (result.confirm) this.deleteRequest();
      },
    });
  },

  async deleteRequest() {
    if (requestDeleteLocked) return;
    requestDeleteLocked = true;
    requestDeleteOperationId ||= `request_delete_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    this.setData({ deleting: true });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'item-request-delete',
      data: { requestId: this.data.request.id, operationId: requestDeleteOperationId },
      demoFallback: { ok: false, error: 'cloud_unavailable' },
    });
    if (!result.ok) {
      requestDeleteLocked = false;
      this.setData({ deleting: false });
      wx.showToast({ title: deleteErrorMessage(result.error), icon: 'none' });
      return;
    }

    getApp<IAppOption>().globalData.dataVersion += 1;
    wx.showToast({ title: '需求已删除', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/requests/index' }), 500);
  },
});
