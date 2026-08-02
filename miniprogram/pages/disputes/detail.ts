import { callCloud } from '../../services/cloud';
import { createOperationId } from '../../utils/operation';

const reasons = ['物品损坏或数量不符', '未按约定交接', '航班/海关异常', '费用或税费争议', '其他'];

type EvidenceSummary = {
  _id: string;
  evidenceType: string;
  description?: string;
};

const evidenceLabels: Record<string, string> = {
  item_photo: '物品照片',
  handover_qr_scan: '交接扫码',
  in_app_chat: '站内沟通',
  payment_record: '服务费记录',
  flight_record: '航班记录',
  customs_or_airline_proof: '海关/航空证明',
  delivery_photo_or_video: '送达照片/视频',
  mutual_confirmation: '确认记录',
};

let disputeOperationId = '';

Page({
  data: {
    orderId: '',
    reasons,
    reasonIndex: 0,
    selectedReason: reasons[0],
    description: '',
    evidence: [] as Array<EvidenceSummary & { label: string; selected: boolean }>,
    selectedEvidenceIds: [] as string[],
    loadingEvidence: true,
    submitting: false,
  },

  onLoad(query) {
    disputeOperationId = '';
    this.setData({ orderId: String(query.orderId || '') });
  },

  onShow() {
    if (this.data.orderId) this.loadEvidence();
  },

  async loadEvidence() {
    this.setData({ loadingEvidence: true });
    const result = await callCloud<{ ok: boolean; evidence?: EvidenceSummary[]; error?: string }>({
      name: 'order-get',
      data: { orderId: this.data.orderId },
      demoFallback: { ok: true, evidence: [] },
    });
    if (!result.ok) {
      this.setData({ loadingEvidence: false, evidence: [], selectedEvidenceIds: [] });
      wx.showToast({ title: '证据读取失败', icon: 'none' });
      return;
    }
    const selectedEvidenceIds = (result.evidence || []).map((item) => item._id);
    const evidence = (result.evidence || []).map((item) => ({
      ...item,
      label: evidenceLabels[item.evidenceType] || item.evidenceType,
      selected: true,
    }));
    this.setData({ loadingEvidence: false, evidence, selectedEvidenceIds });
  },

  onReasonChange(event: WechatMiniprogram.PickerChange) {
    const reasonIndex = Number(event.detail.value);
    this.setData({ reasonIndex, selectedReason: reasons[reasonIndex] });
  },

  onDescriptionInput(event: WechatMiniprogram.Input) {
    this.setData({ description: event.detail.value });
  },

  toggleEvidence(event: WechatMiniprogram.TouchEvent) {
    const evidenceId = String(event.currentTarget.dataset.id || '');
    const evidence = this.data.evidence.map((item) =>
      item._id === evidenceId ? { ...item, selected: !item.selected } : item,
    );
    this.setData({
      evidence,
      selectedEvidenceIds: evidence.filter((item) => item.selected).map((item) => item._id),
    });
  },

  goEvidence() {
    wx.navigateTo({ url: `/pages/evidence/upload?orderId=${this.data.orderId}` });
  },

  async openDispute() {
    if (!this.data.description.trim()) {
      wx.showToast({ title: '请填写争议说明', icon: 'none' });
      return;
    }
    if (!this.data.selectedEvidenceIds.length) {
      wx.showToast({ title: '至少关联一条订单证据', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;

    disputeOperationId ||= createOperationId('dispute_open');
    this.setData({ submitting: true });
    const result = await callCloud<{ ok: boolean; error?: string; demo?: boolean }>({
      name: 'dispute-open',
      data: {
        orderId: this.data.orderId,
        reason: this.data.selectedReason,
        description: this.data.description,
        evidenceIds: this.data.selectedEvidenceIds,
        operationId: disputeOperationId,
      },
      demoFallback: { ok: true, demo: true },
    });
    this.setData({ submitting: false });

    if (!result.ok) {
      wx.showToast({ title: result.error || '提交失败', icon: 'none' });
      return;
    }

    disputeOperationId = '';
    wx.showToast({
      title: result.demo ? '演示完成，未保存到云端' : '争议已提交',
      icon: 'none',
    });
    setTimeout(() => wx.navigateBack(), 700);
  },
});
