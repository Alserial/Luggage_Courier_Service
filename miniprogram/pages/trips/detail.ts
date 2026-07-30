import { demoTrip } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatTripRecord } from '../../utils/records';

let tripDeleteLocked = false;
let tripDeleteOperationId = '';

function deleteErrorMessage(error: string | undefined): string {
  if (error === 'linked_order_exists') return '该行程已有订单，不能删除，请通过订单流程处理';
  if (error === 'permission_denied') return '你无权删除该行程';
  return '行程删除失败，请稍后重试';
}

function verificationLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待核验',
    manual_review: '人工核验',
    approved: '已核验',
    rejected: '未通过',
  };
  return labels[status] || status;
}

Page({
  data: {
    trip: formatTripRecord(demoTrip),
    isOwner: false,
    loading: true,
    errorText: '',
    tripId: '',
    deleting: false,
    statusLabel: '',
  },

  onLoad(query) {
    tripDeleteLocked = false;
    tripDeleteOperationId = '';
    this.setData({ tripId: query.id || demoTrip.id });
  },

  onShow() {
    if (this.data.tripId) this.loadTrip(this.data.tripId);
  },

  async loadTrip(tripId: string) {
    this.setData({ loading: true, errorText: '' });
    const result = await callCloud<{ ok: boolean; trip?: Record<string, unknown>; isOwner?: boolean; error?: string }>({
      name: 'trip-get',
      data: { tripId },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });

    if (!result.ok || !result.trip) {
      this.setData({
        loading: false,
        isOwner: false,
        errorText:
          result.error === 'permission_denied'
            ? '该行程尚未公开或你无权查看'
            : result.error === 'trip_deleted'
              ? '该行程已删除'
              : '行程详情加载失败，请稍后重试',
      });
      return;
    }

    const trip = formatTripRecord(result.trip);
    this.setData({
      trip,
      statusLabel: verificationLabel(trip.verificationStatus),
      isOwner: Boolean(result.isOwner),
      loading: false,
    });
  },

  goMatches() {
    if (!this.data.isOwner) return;
    if (this.data.trip.verificationStatus !== 'approved') {
      wx.showToast({ title: '行程核验通过后才能查看匹配', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/matches/index?tripId=${this.data.trip.id}` });
  },

  goEdit() {
    if (!this.data.isOwner || this.data.deleting) return;
    wx.navigateTo({ url: `/pages/trips/create?id=${this.data.trip.id}` });
  },

  confirmDelete() {
    if (!this.data.isOwner || tripDeleteLocked) return;
    wx.showModal({
      title: '删除这条行程？',
      content: '删除后将从公开大厅和“我的发布”移除，待处理报价会失效；已有订单时不能删除。',
      confirmText: '删除',
      confirmColor: '#a64d3b',
      success: (result) => {
        if (result.confirm) this.deleteTrip();
      },
    });
  },

  async deleteTrip() {
    if (tripDeleteLocked) return;
    tripDeleteLocked = true;
    tripDeleteOperationId ||= `trip_delete_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    this.setData({ deleting: true });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'trip-delete',
      data: { tripId: this.data.trip.id, operationId: tripDeleteOperationId },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });
    if (!result.ok) {
      tripDeleteLocked = false;
      this.setData({ deleting: false });
      wx.showToast({ title: deleteErrorMessage(result.error), icon: 'none' });
      return;
    }

    getApp<IAppOption>().globalData.dataVersion += 1;
    wx.showToast({ title: '行程已删除', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/trips/index' }), 500);
  },
});
