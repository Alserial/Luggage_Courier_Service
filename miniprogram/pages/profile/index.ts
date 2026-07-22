import { callCloud } from '../../services/cloud';

function refreshWeChatSession(): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (result) => (result.code ? resolve() : reject(new Error('missing_login_code'))),
      fail: reject,
    });
  });
}

Page({
  data: {
    loggedIn: false,
    userId: '',
    canReview: false,
    loginLoading: false,
    verificationStatus: 'unverified',
    completedOrders: 0,
  },

  async wechatLogin() {
    this.setData({ loginLoading: true });
    try {
      await refreshWeChatSession();
    } catch (error) {
      console.warn('WeChat login session refresh failed', error);
      this.setData({ loginLoading: false });
      wx.showToast({ title: '无法获取微信登录状态', icon: 'none' });
      return;
    }

    const result = await callCloud<{
      ok: boolean;
      userId?: string;
      isNew?: boolean;
      roleFlags?: string[];
      verificationStatus?: string;
      completedOrders?: number;
      error?: string;
    }>({
      name: 'auth-login',
      fallback: { ok: false, error: 'cloud_not_ready' },
    });
    this.setData({ loginLoading: false });

    if (!result.ok || !result.userId) {
      wx.showToast({ title: result.error || '登录失败', icon: 'none' });
      return;
    }

    this.setData({
      loggedIn: true,
      userId: result.userId,
      canReview: Boolean(result.roleFlags?.some((role) => role === 'admin' || role === 'reviewer')),
      verificationStatus: result.verificationStatus || 'unverified',
      completedOrders: Number(result.completedOrders || 0),
    });
    const app = getApp<IAppOption>();
    app.globalData.authVersion += 1;
    wx.showToast({ title: result.isNew ? '微信账号已创建' : '微信登录成功', icon: 'success' });
  },

  goReviews() {
    wx.navigateTo({ url: '/pages/reviews/index' });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/rules/index' });
  },
});
