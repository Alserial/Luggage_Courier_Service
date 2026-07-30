import { callCloud } from '../../services/cloud';
import { formatTripRecord } from '../../utils/records';

type TripScope = 'market' | 'mine';
type TripView = ReturnType<typeof formatTripRecord>;

function getDataVersion(): number {
  return getApp<IAppOption>().globalData.dataVersion;
}

let tripLoadSequence = 0;

Page({
  data: {
    scope: 'market' as TripScope,
    trips: [] as TripView[],
    tripCache: {
      market: [] as TripView[],
      mine: [] as TripView[],
    },
    loadedScopes: {
      market: false,
      mine: false,
    },
    scopeErrors: {
      market: '',
      mine: '',
    },
    cacheAuthVersion: -1,
    hasTrips: false,
    loading: false,
    errorText: '',
  },

  onShow() {
    const authVersion = getDataVersion();
    const scope = this.data.scope as TripScope;
    if (this.data.cacheAuthVersion !== authVersion) {
      this.setData({
        tripCache: { market: [], mine: [] },
        loadedScopes: { market: false, mine: false },
        scopeErrors: { market: '', mine: '' },
        cacheAuthVersion: authVersion,
        trips: [],
        hasTrips: false,
      });
      this.loadTrips(true);
      return;
    }

    if (!this.data.loadedScopes[scope]) this.loadTrips();
  },

  async onPullDownRefresh() {
    try {
      await this.loadTrips(true);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadTrips(force = false) {
    const scope = this.data.scope as TripScope;
    const authVersion = getDataVersion();
    if (!force && this.data.cacheAuthVersion === authVersion && this.data.loadedScopes[scope]) {
      const trips = this.data.tripCache[scope];
      this.setData({ trips, hasTrips: trips.length > 0, errorText: '' });
      return;
    }

    const sequence = ++tripLoadSequence;
    this.setData({ loading: true, errorText: '' });
    const result = await callCloud<{ ok: boolean; trips?: Array<Record<string, unknown>>; error?: string }>({
      name: 'trip-list',
      data: { limit: 20, scope },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });

    if (authVersion !== getDataVersion()) return;

    if (!result.ok) {
      if (sequence !== tripLoadSequence || scope !== this.data.scope) return;
      const errorText = result.error === 'login_required' ? '请先完成微信登录' : '行程列表加载失败，请稍后重试';
      this.setData({
        trips: [],
        hasTrips: false,
        loading: false,
        errorText,
        [`loadedScopes.${scope}`]: true,
        [`scopeErrors.${scope}`]: errorText,
        cacheAuthVersion: authVersion,
      });
      return;
    }

    const trips = (result.trips || []).map((item) => formatTripRecord(item));
    const cacheUpdate = {
      [`tripCache.${scope}`]: trips,
      [`loadedScopes.${scope}`]: true,
      [`scopeErrors.${scope}`]: '',
      cacheAuthVersion: authVersion,
    };
    if (sequence === tripLoadSequence && scope === this.data.scope) {
      this.setData({ ...cacheUpdate, trips, hasTrips: trips.length > 0, loading: false });
    } else {
      this.setData(cacheUpdate);
    }
  },

  switchScope(event: WechatMiniprogram.TouchEvent) {
    const scope = event.currentTarget.dataset.scope;
    if ((scope !== 'market' && scope !== 'mine') || scope === this.data.scope) return;
    const typedScope = scope as TripScope;
    const cacheValid = this.data.cacheAuthVersion === getDataVersion() && this.data.loadedScopes[typedScope];
    const trips = cacheValid ? this.data.tripCache[typedScope] : [];
    const errorText = cacheValid ? this.data.scopeErrors[typedScope] : '';
    this.setData({ scope: typedScope, trips, hasTrips: trips.length > 0, errorText });
    if (!cacheValid) this.loadTrips();
  },

  retryLoad() {
    this.loadTrips(true);
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/trips/create' });
  },

  goDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/trips/detail?id=${id}` });
  },

  goMatches(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id || this.data.trips[0]?.id;
    if (!id) {
      wx.showToast({ title: '请先发布并选择自己的行程', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/matches/index?tripId=${id}` });
  },
});
