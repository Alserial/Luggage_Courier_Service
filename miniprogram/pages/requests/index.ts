import { callCloud } from '../../services/cloud';
import { formatRequestRecord } from '../../utils/records';

type RequestScope = 'market' | 'mine';
type RequestView = ReturnType<typeof formatRequestRecord>;

function getDataVersion(): number {
  return getApp<IAppOption>().globalData.dataVersion;
}

let requestLoadSequence = 0;

Page({
  data: {
    scope: 'market' as RequestScope,
    requests: [] as RequestView[],
    requestCache: {
      market: [] as RequestView[],
      mine: [] as RequestView[],
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
    hasRequests: false,
    loading: false,
    errorText: '',
  },

  onShow() {
    const authVersion = getDataVersion();
    const scope = this.data.scope as RequestScope;
    if (this.data.cacheAuthVersion !== authVersion) {
      this.setData({
        requestCache: { market: [], mine: [] },
        loadedScopes: { market: false, mine: false },
        scopeErrors: { market: '', mine: '' },
        cacheAuthVersion: authVersion,
        requests: [],
        hasRequests: false,
      });
      this.loadRequests(true);
      return;
    }

    if (!this.data.loadedScopes[scope]) this.loadRequests();
  },

  async onPullDownRefresh() {
    try {
      await this.loadRequests(true);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadRequests(force = false) {
    const scope = this.data.scope as RequestScope;
    const authVersion = getDataVersion();
    if (!force && this.data.cacheAuthVersion === authVersion && this.data.loadedScopes[scope]) {
      const requests = this.data.requestCache[scope];
      this.setData({ requests, hasRequests: requests.length > 0, errorText: '' });
      return;
    }

    const sequence = ++requestLoadSequence;
    this.setData({ loading: true, errorText: '' });
    const result = await callCloud<{ ok: boolean; requests?: Array<Record<string, unknown>>; error?: string }>({
      name: 'item-request-list',
      data: { limit: 20, scope },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });

    if (authVersion !== getDataVersion()) return;

    if (!result.ok) {
      if (sequence !== requestLoadSequence || scope !== this.data.scope) return;
      const errorText = result.error === 'login_required' ? '请先完成微信登录' : '需求列表加载失败，请稍后重试';
      this.setData({
        requests: [],
        hasRequests: false,
        loading: false,
        errorText,
        [`loadedScopes.${scope}`]: true,
        [`scopeErrors.${scope}`]: errorText,
        cacheAuthVersion: authVersion,
      });
      return;
    }

    const requests = (result.requests || []).map((item) => formatRequestRecord(item));
    const cacheUpdate = {
      [`requestCache.${scope}`]: requests,
      [`loadedScopes.${scope}`]: true,
      [`scopeErrors.${scope}`]: '',
      cacheAuthVersion: authVersion,
    };
    if (sequence === requestLoadSequence && scope === this.data.scope) {
      this.setData({ ...cacheUpdate, requests, hasRequests: requests.length > 0, loading: false });
    } else {
      this.setData(cacheUpdate);
    }
  },

  switchScope(event: WechatMiniprogram.TouchEvent) {
    const scope = event.currentTarget.dataset.scope;
    if ((scope !== 'market' && scope !== 'mine') || scope === this.data.scope) return;
    const typedScope = scope as RequestScope;
    const cacheValid = this.data.cacheAuthVersion === getDataVersion() && this.data.loadedScopes[typedScope];
    const requests = cacheValid ? this.data.requestCache[typedScope] : [];
    const errorText = cacheValid ? this.data.scopeErrors[typedScope] : '';
    this.setData({ scope: typedScope, requests, hasRequests: requests.length > 0, errorText });
    if (!cacheValid) this.loadRequests();
  },

  retryLoad() {
    this.loadRequests(true);
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/requests/create' });
  },

  goDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/requests/detail?id=${id}` });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/rules/index' });
  },
});
