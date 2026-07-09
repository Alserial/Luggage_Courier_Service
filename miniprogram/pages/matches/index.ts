import { callCloud } from '../../services/cloud';
import { buildDemoMatchCandidate } from '../../utils/matching';
import type { MatchCandidate } from '../../types/index';

Page({
  data: {
    matches: [buildDemoMatchCandidate()],
    hasMatches: true,
  },

  onLoad(query) {
    this.loadMatches(query.tripId, query.requestId);
  },

  async loadMatches(tripId?: string, requestId?: string) {
    const demo = buildDemoMatchCandidate();
    const result = await callCloud<{ ok: boolean; matches?: MatchCandidate[]; error?: string }>({
      name: 'match-search',
      data: { tripId, requestId },
      fallback: { ok: true, matches: [demo] },
    });

    const matches = result.matches || [demo];
    this.setData({ matches, hasMatches: matches.length > 0 });
  },

  goOffer(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const match = this.data.matches[index] || buildDemoMatchCandidate();
    wx.navigateTo({ url: `/pages/offers/create?requestId=${match.requestId}&tripId=${match.tripId}` });
  },
});
