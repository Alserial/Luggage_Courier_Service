import { demoRequest } from '../../services/mock';

Page({
  data: {
    request: demoRequest,
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/requests/create' });
  },

  goDetail() {
    wx.navigateTo({ url: `/pages/requests/detail?id=${demoRequest.id}` });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/rules/index' });
  },
});
