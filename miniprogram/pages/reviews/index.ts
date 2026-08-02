import { callCloud, getCloudFileUrls } from '../../services/cloud';
import { formatRequestRecord, formatTripRecord } from '../../utils/records';
import { createOperationId } from '../../utils/operation';

type ReviewTab = 'requests' | 'trips' | 'messages' | 'disputes';
type ReviewDecision = 'approved' | 'rejected' | 'manual_review';

type ReviewItem = ReturnType<typeof formatRequestRecord>;
type ReviewTrip = ReturnType<typeof formatTripRecord>;
type MessageReport = {
  id: string;
  orderId: string;
  messageId: string;
  messageContent: string;
  senderRole: string;
  moderationStatus: string;
  reason: string;
  description: string;
  systemGenerated: boolean;
  status: string;
  createdAt: string;
};

type DisputeEvidence = {
  _id: string;
  evidenceType: string;
  description?: string;
  fileIds?: string[];
  metadata?: { files?: Array<{ fileType?: string }> };
};

type DisputeQueueItem = {
  _id: string;
  orderId: string;
  reason: string;
  description: string;
  status: string;
  evidenceIds: string[];
  evidence: DisputeEvidence[];
  order?: {
    status: string;
    feeBreakdown?: { total?: number };
  };
};

const disputeActionLabels: Record<string, string> = {
  refund: 'Mock 服务费退款',
  complete: '完成订单',
  cancel_order: '取消订单',
  keep_in_dispute: '继续调查',
};

const disputeDecisionOperationIds: Record<string, string> = {};

function operationId(targetType: string, targetId: string, decision: string): string {
  return `${targetType}-${targetId}-${decision}-${Date.now()}`;
}

Page({
  data: {
    activeTab: 'requests' as ReviewTab,
    requests: [] as ReviewItem[],
    trips: [] as ReviewTrip[],
    messageReports: [] as MessageReport[],
    disputes: [] as DisputeQueueItem[],
    hasRequests: false,
    hasTrips: false,
    hasMessageReports: false,
    hasDisputes: false,
    reviewReason: '',
    loading: false,
    submittingId: '',
    errorText: '',
  },

  onShow() {
    this.loadQueue();
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = String(event.currentTarget.dataset.tab || 'requests') as ReviewTab;
    this.setData({ activeTab: tab });
  },

  onReasonInput(event: WechatMiniprogram.Input) {
    this.setData({ reviewReason: String(event.detail.value || '') });
  },

  async loadQueue() {
    this.setData({ loading: true, errorText: '' });
    const [result, chatResult] = await Promise.all([
      callCloud<{
        ok: boolean;
        requests?: Array<Record<string, unknown>>;
        trips?: Array<Record<string, unknown>>;
        disputes?: DisputeQueueItem[];
        error?: string;
      }>({
        name: 'review-queue-list',
        data: { limit: 30 },
        demoFallback: { ok: false, error: 'cloud_not_ready' },
      }),
      callCloud<{ ok: boolean; reports?: MessageReport[]; error?: string }>({
        name: 'chat-review-queue-list',
        data: { limit: 30 },
        demoFallback: { ok: false, error: 'cloud_not_ready' },
      }),
    ]);
    this.setData({ loading: false });

    if (!result.ok && !chatResult.ok) {
      const errorText = result.error === 'permission_denied' || chatResult.error === 'permission_denied'
        ? '当前账号没有审核权限'
        : '审核队列暂不可用';
      this.setData({
        errorText,
        requests: [],
        trips: [],
        messageReports: [],
        disputes: [],
        hasRequests: false,
        hasTrips: false,
        hasMessageReports: false,
        hasDisputes: false,
      });
      wx.showToast({ title: errorText, icon: 'none' });
      return;
    }

    const requests = (result.requests || []).map((item) => formatRequestRecord(item));
    const trips = (result.trips || []).map((item) => formatTripRecord(item));
    const messageReports = chatResult.reports || [];
    const disputes = result.disputes || [];
    this.setData({
      requests,
      trips,
      messageReports,
      disputes,
      hasRequests: requests.length > 0,
      hasTrips: trips.length > 0,
      hasMessageReports: messageReports.length > 0,
      hasDisputes: disputes.length > 0,
    });
  },

  async reviewRequest(event: WechatMiniprogram.TouchEvent) {
    const requestId = String(event.currentTarget.dataset.id || '');
    const decision = String(event.currentTarget.dataset.decision || '') as ReviewDecision;
    await this.submitReview({
      targetType: 'request',
      targetId: requestId,
      decision,
      functionName: 'item-request-review',
      idField: 'requestId',
    });
  },

  async verifyTrip(event: WechatMiniprogram.TouchEvent) {
    const tripId = String(event.currentTarget.dataset.id || '');
    const decision = String(event.currentTarget.dataset.decision || '') as ReviewDecision;
    await this.submitReview({
      targetType: 'trip',
      targetId: tripId,
      decision,
      functionName: 'trip-verify',
      idField: 'tripId',
    });
  },

  async reviewMessage(event: WechatMiniprogram.TouchEvent) {
    const reportId = String(event.currentTarget.dataset.id || '');
    const action = String(event.currentTarget.dataset.action || '') as 'hide' | 'restore' | 'dismiss';
    const reason = this.data.reviewReason.trim();
    if (!reportId || !action) return;
    if (!reason) {
      wx.showToast({ title: '处理消息举报必须填写原因', icon: 'none' });
      return;
    }

    this.setData({ submittingId: reportId });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'chat-admin-review',
      data: {
        reportId,
        action,
        reason,
        operationId: operationId('message-report', reportId, action),
      },
      demoFallback: { ok: false, error: 'cloud_not_ready' },
    });
    this.setData({ submittingId: '' });
    if (!result.ok) {
      wx.showToast({ title: result.error || '处理失败', icon: 'none' });
      return;
    }
    const successLabel = action === 'hide' ? '消息已隐藏' : action === 'restore' ? '消息已通过并显示' : '举报已驳回';
    wx.showToast({ title: successLabel, icon: 'success' });
    this.setData({ reviewReason: '' });
    await this.loadQueue();
  },

  async submitReview(options: {
    targetType: 'request' | 'trip';
    targetId: string;
    decision: ReviewDecision;
    functionName: string;
    idField: 'requestId' | 'tripId';
  }) {
    const reviewReason = this.data.reviewReason.trim();
    if (!options.targetId) return;
    if (options.decision !== 'approved' && !reviewReason) {
      wx.showToast({ title: '拒绝或转人工需填写原因', icon: 'none' });
      return;
    }

    this.setData({ submittingId: options.targetId });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: options.functionName,
      data: {
        [options.idField]: options.targetId,
        decision: options.decision,
        reviewReason: reviewReason || '内测审核通过',
        verificationEvidenceIds: [],
        operationId: operationId(options.targetType, options.targetId, options.decision),
      },
      demoFallback: { ok: false, error: 'cloud_not_ready' },
    });
    this.setData({ submittingId: '' });

    if (!result.ok) {
      wx.showToast({ title: result.error || '审核失败', icon: 'none' });
      return;
    }

    wx.showToast({ title: '已提交审核', icon: 'success' });
    this.setData({ reviewReason: '' });
    await this.loadQueue();
  },

  async previewDisputeEvidence(event: WechatMiniprogram.TouchEvent) {
    const disputeId = String(event.currentTarget.dataset.disputeId || '');
    const evidenceId = String(event.currentTarget.dataset.evidenceId || '');
    const dispute = this.data.disputes.find((item) => item._id === disputeId);
    const evidence = dispute?.evidence.find((item) => item._id === evidenceId);
    if (!evidence || !evidence.fileIds || !evidence.fileIds.length) {
      wx.showToast({ title: '这是系统记录，没有附件', icon: 'none' });
      return;
    }
    try {
      const urls = await getCloudFileUrls(evidence.fileIds);
      if (!urls.length) throw new Error('no_preview_url');
      const files = evidence.metadata?.files || [];
      wx.previewMedia({
        current: 0,
        sources: urls.map((url, index) => ({
          url,
          type: files[index]?.fileType === 'video' ? 'video' : 'image',
        })),
      });
    } catch (error) {
      wx.showToast({ title: '证据附件暂时无法预览', icon: 'none' });
    }
  },

  async decideDispute(event: WechatMiniprogram.TouchEvent) {
    const disputeId = String(event.currentTarget.dataset.id || '');
    const action = String(event.currentTarget.dataset.action || '');
    const reason = this.data.reviewReason.trim();
    const dispute = this.data.disputes.find((item) => item._id === disputeId);
    if (!dispute || !disputeActionLabels[action]) return;
    if (!reason) {
      wx.showToast({ title: '争议裁决必须填写理由', icon: 'none' });
      return;
    }
    const evidenceIdsReviewed = dispute.evidence.map((item) => item._id);
    if (!evidenceIdsReviewed.length) {
      wx.showToast({ title: '该争议没有可审查证据', icon: 'none' });
      return;
    }
    const confirmation = await new Promise<WechatMiniprogram.ShowModalSuccessCallbackResult>((resolve) =>
      wx.showModal({
        title: `确认${disputeActionLabels[action]}？`,
        content: `将依据 ${evidenceIdsReviewed.length} 条证据处理订单。理由：${reason}`,
        confirmText: '确认裁决',
        confirmColor: action === 'refund' || action === 'cancel_order' ? '#a64d3b' : '#5f6e54',
        success: resolve,
      }),
    );
    if (!confirmation.confirm) return;

    const operationKey = `${disputeId}:${action}`;
    disputeDecisionOperationIds[operationKey] ||= createOperationId('dispute_decide');
    this.setData({ submittingId: disputeId });
    const result = await callCloud<{ ok: boolean; error?: string }>({
      name: 'dispute-decide',
      data: {
        disputeId,
        action,
        reason,
        evidenceIdsReviewed,
        operationId: disputeDecisionOperationIds[operationKey],
      },
      demoFallback: { ok: false, error: 'cloud_unavailable' },
    });
    this.setData({ submittingId: '' });
    if (!result.ok) {
      wx.showToast({ title: result.error || '争议裁决失败', icon: 'none' });
      return;
    }
    delete disputeDecisionOperationIds[operationKey];
    this.setData({ reviewReason: '' });
    wx.showToast({ title: '争议裁决已记录', icon: 'success' });
    await this.loadQueue();
  },

  goRequestDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/requests/detail?id=${id}` });
  },

  goTripDetail(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/trips/detail?id=${id}` });
  },

  goOrderChat(event: WechatMiniprogram.TouchEvent) {
    const orderId = event.currentTarget.dataset.orderId;
    wx.navigateTo({ url: `/pages/chat/index?orderId=${orderId}` });
  },
});
