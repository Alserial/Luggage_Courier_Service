import { callCloud } from '../../services/cloud';
import { buildDemoMatchCandidate } from '../../utils/matching';
import type { MatchCandidate } from '../../types/index';

Page({
  data: {
    matches: [] as MatchCandidate[],
    hasMatches: false,
    loading: true,
    errorText: '',
    tripId: '',
    requestId: '',
  },

  onLoad(query) {
    this.setData({ tripId: query.tripId || '', requestId: query.requestId || '' });
    this.loadMatches(query.tripId, query.requestId);
  },

  async loadMatches(tripId?: string, requestId?: string) {
    this.setData({ loading: true, errorText: '' });
    const demo = buildDemoMatchCandidate();
    const result = await callCloud<{ ok: boolean; matches?: MatchCandidate[]; error?: string }>({
      name: 'match-search',
      data: { tripId, requestId },
      fallback: { ok: true, matches: [demo] },
    });

    if (!result.ok) {
      this.setData({
        matches: [],
        hasMatches: false,
        loading: false,
        errorText: result.error || '匹配结果加载失败，请稍后重试',
      });
      return;
    }

    const matches = result.matches || [];
    this.setData({ matches, hasMatches: matches.length > 0, loading: false });
  },

  retryLoad() {
    this.loadMatches(this.data.tripId, this.data.requestId);
  },

  goOffer(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const match = this.data.matches[index] || buildDemoMatchCandidate();
    wx.navigateTo({ url: `/pages/offers/create?requestId=${match.requestId}&tripId=${match.tripId}` });
  },
});
