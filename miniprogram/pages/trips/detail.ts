import { demoTrip } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatTripRecord } from '../../utils/records';

Page({
  data: {
    trip: formatTripRecord(demoTrip),
  },

  onLoad(query) {
    this.loadTrip(query.id || demoTrip.id);
  },

  async loadTrip(tripId: string) {
    const result = await callCloud<{ ok: boolean; trip?: Record<string, unknown> }>({
      name: 'trip-get',
      data: { tripId },
      fallback: { ok: true, trip: demoTrip },
    });
    this.setData({ trip: formatTripRecord(result.trip || demoTrip) });
  },

  goMatches() {
    wx.navigateTo({ url: `/pages/matches/index?tripId=${this.data.trip.id}` });
  },
});
