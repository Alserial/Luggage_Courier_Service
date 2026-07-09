import { demoTrip } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatTripRecord } from '../../utils/records';

Page({
  data: {
    trips: [formatTripRecord(demoTrip)],
    hasTrips: true,
  },

  onShow() {
    this.loadTrips();
  },

  async loadTrips() {
    const result = await callCloud<{ ok: boolean; trips?: Array<Record<string, unknown>> }>({
      name: 'trip-list',
      data: { limit: 20 },
      fallback: { ok: true, trips: [demoTrip] },
    });
    const trips = (result.trips || [demoTrip]).map((item) => formatTripRecord(item));
    this.setData({ trips, hasTrips: trips.length > 0 });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/trips/create' });
  },

  goDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id || demoTrip.id;
    wx.navigateTo({ url: `/pages/trips/detail?id=${id}` });
  },

  goMatches(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id || this.data.trips[0]?.id || demoTrip.id;
    wx.navigateTo({ url: `/pages/matches/index?tripId=${id}` });
  },
});
