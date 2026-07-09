import { demoRequest } from '../../services/mock';
import { callCloud } from '../../services/cloud';
import { formatRequestRecord } from '../../utils/records';

Page({
  data: {
    requests: [formatRequestRecord(demoRequest)],
    hasRequests: true,
  },

  onShow() {
    this.loadRequests();
  },

  async loadRequests() {
    const result = await callCloud<{ ok: boolean; requests?: Array<Record<string, unknown>> }>({
      name: 'item-request-list',
      data: { limit: 20 },
      fallback: { ok: true, requests: [demoRequest] },
    });
    const requests = (result.requests || [demoRequest]).map((item) => formatRequestRecord(item));
    this.setData({ requests, hasRequests: requests.length > 0 });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/requests/create' });
  },

  goDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id || demoRequest.id;
    wx.navigateTo({ url: `/pages/requests/detail?id=${id}` });
  },

  goRules() {
    wx.navigateTo({ url: '/pages/rules/index' });
  },
});
