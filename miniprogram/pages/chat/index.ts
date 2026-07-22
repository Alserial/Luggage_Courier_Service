import { callCloud } from '../../services/cloud';
import { demoOrder } from '../../services/mock';
import { formatOrderRecord } from '../../utils/records';

type ChatMessage = {
  id: string;
  conversationId: string;
  orderId: string;
  senderRole: 'requester' | 'traveller' | 'system' | 'admin';
  isMine: boolean;
  messageType: 'text' | 'system';
  content: string;
  moderationStatus: 'visible' | 'under_review' | 'blocked' | 'admin_hidden';
  moderationReason: string;
  orderStatusAtSend: string;
  createdAt: string;
};

type DisplayMessage = ChatMessage & {
  senderLabel: string;
  timeText: string;
  moderationLabel: string;
  canReport: boolean;
};

type MessageCursor = {
  createdAt: string;
  messageId: string;
};

type RealtimeWatcher = {
  close: () => Promise<unknown> | void;
};

let messageWatcher: RealtimeWatcher | null = null;
let pollingTimer: number | null = null;

const senderLabels: Record<ChatMessage['senderRole'], string> = {
  requester: '需求方',
  traveller: '携带方',
  system: '平台记录',
  admin: '平台审核',
};

const moderationLabels: Record<ChatMessage['moderationStatus'], string> = {
  visible: '',
  under_review: '内容待审核，对方暂不可见',
  blocked: '内容未发送，请调整后重试',
  admin_hidden: '内容已由平台隐藏',
};

const errorLabels: Record<string, string> = {
  missing_params: '消息参数不完整',
  conversation_not_found: '订单会话不存在',
  order_not_found: '订单不存在',
  permission_denied: '你无权访问该订单沟通',
  conversation_read_only: '当前订单沟通已只读',
  invalid_message_type: '当前仅支持文字消息',
  invalid_message_length: '请输入 1–500 字内容',
  rate_limited: '发送过于频繁，请稍后再试',
  content_under_review: '内容需要审核',
  content_blocked: '内容未通过安全检查',
  cloud_unavailable: '连接失败，请检查网络后重试',
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function toDisplayMessage(message: ChatMessage): DisplayMessage {
  return {
    ...message,
    senderLabel: message.isMine ? '我' : senderLabels[message.senderRole],
    timeText: formatTime(message.createdAt),
    moderationLabel: moderationLabels[message.moderationStatus],
    canReport: !message.isMine && message.messageType !== 'system' && message.moderationStatus === 'visible',
  };
}

function mergeMessages(current: DisplayMessage[], incoming: DisplayMessage[]): DisplayMessage[] {
  const map = new Map<string, DisplayMessage>();
  [...current, ...incoming].forEach((message) => map.set(message.id, message));
  return Array.from(map.values()).sort((left, right) => (
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  ));
}

function createClientMessageId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

Page({
  data: {
    orderId: demoOrder.id,
    conversationId: '',
    callerRole: 'requester',
    conversationStatus: 'active',
    order: formatOrderRecord(demoOrder),
    messages: [] as DisplayMessage[],
    composer: '',
    charactersLeft: 500,
    loading: true,
    loadingMore: false,
    sending: false,
    creatingSnapshot: false,
    errorText: '',
    nextCursor: null as MessageCursor | null,
    hasMore: false,
    realtimeLabel: '连接中',
    scrollIntoView: '',
  },

  onLoad(query) {
    this.initialize(query.orderId || demoOrder.id);
  },

  onShow() {
    if (this.data.conversationId && !this.data.loading) this.startRealtime();
  },

  onHide() {
    this.stopRealtime();
  },

  onUnload() {
    this.stopRealtime();
  },

  async initialize(orderId: string) {
    this.setData({ orderId, loading: true, errorText: '' });
    const [conversationResult, orderResult] = await Promise.all([
      callCloud<{
        ok: boolean;
        error?: string;
        conversation?: { id: string; status: string; callerRole: string };
      }>({
        name: 'chat-conversation-get',
        data: { orderId },
        fallback: { ok: false, error: 'cloud_unavailable' },
      }),
      callCloud<{ ok: boolean; order?: Record<string, unknown> }>({
        name: 'order-get',
        data: { orderId },
        fallback: { ok: true, order: demoOrder as unknown as Record<string, unknown> },
      }),
    ]);

    if (!conversationResult.ok || !conversationResult.conversation) {
      this.setData({
        loading: false,
        errorText: errorLabels[conversationResult.error || ''] || '会话加载失败',
      });
      return;
    }

    this.setData({
      conversationId: conversationResult.conversation.id,
      callerRole: conversationResult.conversation.callerRole,
      conversationStatus: conversationResult.conversation.status,
      order: formatOrderRecord(orderResult.order || (demoOrder as unknown as Record<string, unknown>)),
    });
    await this.loadMessages(true);
    this.startRealtime();
  },

  retryLoad() {
    this.initialize(this.data.orderId);
  },

  async loadMessages(refresh = false, silent = false) {
    if (!this.data.conversationId) return;
    if (!silent) this.setData(refresh ? { loading: true } : { loadingMore: true });
    const result = await callCloud<{
      ok: boolean;
      error?: string;
      messages?: ChatMessage[];
      nextCursor?: MessageCursor | null;
    }>({
      name: 'chat-message-list',
      data: {
        conversationId: this.data.conversationId,
        cursor: refresh ? undefined : this.data.nextCursor || undefined,
        limit: 30,
      },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });

    if (!result.ok) {
      if (!silent) {
        this.setData({
          loading: false,
          loadingMore: false,
          errorText: errorLabels[result.error || ''] || '消息加载失败',
        });
      }
      return;
    }

    const incoming = (result.messages || []).map(toDisplayMessage);
    const messages = refresh
      ? mergeMessages(this.data.messages.filter((message) => message.moderationStatus !== 'visible'), incoming)
      : mergeMessages(incoming, this.data.messages);
    const lastMessage = messages[messages.length - 1];
    this.setData({
      messages,
      nextCursor: result.nextCursor || null,
      hasMore: Boolean(result.nextCursor),
      loading: false,
      loadingMore: false,
      errorText: '',
      scrollIntoView: lastMessage ? `message-${lastMessage.id}` : '',
    });
    if (lastMessage) this.markRead(lastMessage.id);
  },

  loadMore() {
    if (!this.data.loadingMore && this.data.hasMore) this.loadMessages(false);
  },

  onComposerInput(event: WechatMiniprogram.Input) {
    const composer = String(event.detail.value || '').slice(0, 500);
    this.setData({ composer, charactersLeft: 500 - composer.length });
  },

  async sendMessage() {
    const content = this.data.composer.trim();
    if (!content) {
      wx.showToast({ title: '请输入消息内容', icon: 'none' });
      return;
    }
    if (this.data.conversationStatus !== 'active') {
      wx.showToast({ title: '当前订单沟通已只读', icon: 'none' });
      return;
    }
    if (this.data.sending) return;

    this.setData({ sending: true });
    const result = await callCloud<{
      ok: boolean;
      error?: string;
      moderationStatus?: ChatMessage['moderationStatus'];
      message?: ChatMessage;
    }>({
      name: 'chat-message-send',
      data: {
        conversationId: this.data.conversationId,
        clientMessageId: createClientMessageId(),
        messageType: 'text',
        content,
      },
      fallback: { ok: false, error: 'cloud_unavailable' },
    });
    this.setData({ sending: false });

    if (!result.ok || !result.message) {
      if (result.error === 'conversation_read_only') this.setData({ conversationStatus: 'read_only' });
      wx.showToast({ title: errorLabels[result.error || ''] || '发送失败', icon: 'none' });
      return;
    }

    const message = toDisplayMessage(result.message);
    const messages = mergeMessages(this.data.messages, [message]);
    this.setData({
      messages,
      composer: '',
      charactersLeft: 500,
      scrollIntoView: `message-${message.id}`,
    });
    if (result.moderationStatus === 'blocked') {
      wx.showToast({ title: '内容未通过安全检查', icon: 'none' });
    } else if (result.moderationStatus === 'under_review') {
      wx.showToast({ title: '内容待审核，对方暂不可见', icon: 'none' });
    }
  },

  reportMessage(event: WechatMiniprogram.TouchEvent) {
    const messageId = String(event.currentTarget.dataset.id || '');
    const message = this.data.messages.find((item) => item.id === messageId);
    if (!message || !message.canReport) return;
    const labels = ['引导站外联系', '引导站外支付', '违规物品', '骚扰威胁', '疑似欺诈', '垃圾信息'];
    const reasons = ['external_contact', 'external_payment', 'prohibited_item', 'harassment', 'fraud', 'spam'];
    wx.showActionSheet({
      itemList: labels,
      success: async (selection) => {
        const result = await callCloud<{ ok: boolean; error?: string }>({
          name: 'chat-message-report',
          data: {
            messageId,
            reason: reasons[selection.tapIndex],
            operationId: `report_${Date.now()}`,
          },
          fallback: { ok: false, error: 'cloud_unavailable' },
        });
        wx.showToast({
          title: result.ok ? '已提交平台审核' : (errorLabels[result.error || ''] || '举报失败'),
          icon: result.ok ? 'success' : 'none',
        });
      },
    });
  },

  createEvidenceSnapshot() {
    if (!this.data.messages.some((message) => message.moderationStatus === 'visible')) {
      wx.showToast({ title: '暂无可归档的沟通记录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '生成沟通凭证',
      content: '将当前可见沟通记录生成不可修改的站内沟通证据。生成后不会覆盖旧凭证。',
      confirmText: '生成凭证',
      success: async (modal) => {
        if (!modal.confirm || this.data.creatingSnapshot) return;
        this.setData({ creatingSnapshot: true });
        const result = await callCloud<{ ok: boolean; error?: string }>({
          name: 'chat-evidence-snapshot',
          data: { orderId: this.data.orderId, operationId: `snapshot_${Date.now()}` },
          fallback: { ok: false, error: 'cloud_unavailable' },
        });
        this.setData({ creatingSnapshot: false });
        wx.showToast({
          title: result.ok ? '沟通凭证已保存' : (errorLabels[result.error || ''] || '凭证生成失败'),
          icon: result.ok ? 'success' : 'none',
        });
      },
    });
  },

  async markRead(lastReadMessageId: string) {
    await callCloud<{ ok: boolean }>({
      name: 'chat-mark-read',
      data: { conversationId: this.data.conversationId, lastReadMessageId },
      fallback: { ok: false },
    });
  },

  startRealtime() {
    this.stopRealtime();
    if (this.data.conversationId === 'demo_conversation_001') {
      this.setData({ realtimeLabel: '演示模式' });
      return;
    }
    if (!wx.cloud) {
      this.startPolling();
      return;
    }

    try {
      const db = wx.cloud.database();
      messageWatcher = db.collection('messages')
        .where({ conversationId: this.data.conversationId, moderationStatus: 'visible' })
        .orderBy('createdAt', 'asc')
        .limit(50)
        .watch({
          onChange: () => {
            this.setData({ realtimeLabel: '实时连接' });
            this.loadMessages(true, true);
          },
          onError: () => {
            messageWatcher = null;
            this.startPolling();
          },
        }) as unknown as RealtimeWatcher;
      this.setData({ realtimeLabel: '实时连接' });
    } catch (error) {
      console.warn('Chat watch unavailable, using polling', error);
      this.startPolling();
    }
  },

  startPolling() {
    if (pollingTimer !== null) return;
    this.setData({ realtimeLabel: '自动刷新' });
    pollingTimer = setInterval(() => this.loadMessages(true, true), 4000) as unknown as number;
  },

  stopRealtime() {
    if (messageWatcher) {
      Promise.resolve(messageWatcher.close()).catch(() => undefined);
      messageWatcher = null;
    }
    if (pollingTimer !== null) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  },
});
