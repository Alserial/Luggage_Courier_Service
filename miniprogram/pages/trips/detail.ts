import { demoTrip } from '../../services/mock';

Page({
  data: {
    trip: demoTrip,
  },

  goMatches() {
    wx.navigateTo({ url: `/pages/matches/index?tripId=${demoTrip.id}` });
  },
});
