interface IAppOption {
  globalData: {
    cloudReady: boolean;
    userProfile: import('../miniprogram/types/index').UserProfile | null;
    authVersion: number;
    dataVersion: number;
  };
}
