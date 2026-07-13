import { callCloud } from '../../services/cloud';

Page({
  data: {
    loggedIn: false,
    userId: '',
    loginLoading: false,
  },

  async mockLogin() {
    this.setData({ loginLoading: true });
    const result = await callCloud<{ ok: boolean; userId?: string; isNew?: boolean; error?: string }>({
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
    });
    wx.showToast({ title: result.isNew ? '已创建用户' : '已登录', icon: 'success' });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/rules/index' });
  },
});
