import { cloudEnvId } from './config/env';

App<IAppOption>({
  globalData: {
    cloudReady: false,
    userProfile: null,
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: cloudEnvId,
        traceUser: true,
      });
      this.globalData.cloudReady = true;
    }
  },
});
