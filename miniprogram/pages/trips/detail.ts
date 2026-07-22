import { demoTrip } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatTripRecord } from '../../utils/records';

Page({
  data: {
    trip: formatTripRecord(demoTrip),
    isOwner: false,
    loading: true,
    errorText: '',
  },

  onLoad(query) {
    this.loadTrip(query.id || demoTrip.id);
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
        errorText: result.error === 'permission_denied' ? '该行程尚未公开或你无权查看' : '行程详情加载失败，请稍后重试',
      });
      return;
    }

    this.setData({ trip: formatTripRecord(result.trip), isOwner: Boolean(result.isOwner), loading: false });
  },

  goMatches() {
    if (!this.data.isOwner) return;
    wx.navigateTo({ url: `/pages/matches/index?tripId=${this.data.trip.id}` });
  },
});
