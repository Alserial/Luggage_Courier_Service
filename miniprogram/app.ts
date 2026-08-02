import { appConfig, cloudEnvId, isCloudBaseConfigured } from './config/env';

App<IAppOption>({
  globalData: {
    cloudReady: false,
    userProfile: null,
    authVersion: 0,
    dataVersion: 0,
  },

  onLaunch() {
    if (wx.cloud && isCloudBaseConfigured()) {
      wx.cloud.init({
        env: cloudEnvId,
        traceUser: true,
      });
      this.globalData.cloudReady = true;
    }
  },

  onShow() {
    if (appConfig.demoMode) {
      wx.setTabBarBadge({ index: 0, text: '演示' });
    }
  },
});
