Page({
  mockLogin() {
    wx.showToast({ title: '登录接口待接入', icon: 'none' });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/rules/index' });
  },
});
