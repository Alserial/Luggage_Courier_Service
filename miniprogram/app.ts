import { cloudEnvId, isCloudBaseConfigured } from './config/env';

App<IAppOption>({
  globalData: {
    cloudReady: false,
    userProfile: null,
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
});
