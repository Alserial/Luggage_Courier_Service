import { buildDemoMatchCandidate } from '../../utils/matching';

Page({
  data: {
    match: buildDemoMatchCandidate(),
  },

  goOffer() {
    const match = this.data.match;
    wx.navigateTo({ url: `/pages/offers/create?requestId=${match.requestId}&tripId=${match.tripId}` });
  },
});
