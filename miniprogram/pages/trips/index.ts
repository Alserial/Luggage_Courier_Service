import { demoTrip } from '../../services/mock';

Page({
  data: {
    trip: demoTrip,
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/trips/create' });
  },

  goDetail() {
    wx.navigateTo({ url: `/pages/trips/detail?id=${demoTrip.id}` });
  },

  goMatches() {
    wx.navigateTo({ url: `/pages/matches/index?tripId=${demoTrip.id}` });
  },
});
