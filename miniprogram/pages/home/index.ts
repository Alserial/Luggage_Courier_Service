Page({
  data: {
    rules: [
      '只做低值、低频、低风险个人小件',
      '不做代购、物流、清关或商品货款托管',
      '食品、药品、烟酒、动植物、奢侈品默认禁止',
      '交接、支付、异常和争议必须平台内留痕',
    ],
  },

  goCreateTrip() {
    wx.navigateTo({ url: '/pages/trips/create' });
  },

  goCreateRequest() {
    wx.navigateTo({ url: '/pages/requests/create' });
  },

  goOrders() {
    wx.switchTab({ url: '/pages/orders/index' });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/rules/index' });
  },
});
