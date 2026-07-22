export type EntityId = string;
export type CloudDate = Date | string;
export type Currency = 'CNY';

export type OrderStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'pending_payment'
  | 'paid_locked'
  | 'item_handed_to_carrier'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'refunded';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'manual_review';
export type RiskLevel = 'low' | 'medium' | 'high';

export type ItemCategory =
  | 'clothing'
  | 'books'
  | 'stationery'
  | 'small_gifts'
  | 'phone_accessories'
  | 'daily_items';

export type EvidenceType =
  | 'item_photo'
  | 'handover_qr_scan'
  | 'in_app_chat'
  | 'payment_record'
  | 'flight_record'
  | 'customs_or_airline_proof'
  | 'delivery_photo_or_video'
  | 'mutual_confirmation';

export type EvidenceVisibility = 'both_parties' | 'requester_only' | 'traveller_only' | 'admin_only';
export type TripStatus = 'draft' | 'active' | 'paused' | 'expired' | 'cancelled';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
export type PaymentProvider = 'mock' | 'wechat_pay' | 'provider_todo';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type PaymentLockStatus = 'none' | 'locked' | 'released';
export type RefundStatus = 'none' | 'requested' | 'approved' | 'refunded' | 'rejected';
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'cancelled';
export type DisputeDecisionAction = 'none' | 'refund' | 'complete' | 'cancel_order' | 'keep_in_dispute';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type UserRoleFlag = 'requester' | 'traveller' | 'admin' | 'reviewer';
export type ActorRole = 'user' | 'traveller' | 'requester' | 'admin' | 'system';
export type ConversationStatus = 'active' | 'read_only' | 'closed';
export type MessageType = 'text' | 'system';
export type MessageModerationStatus = 'visible' | 'under_review' | 'blocked' | 'admin_hidden';
export type AuditTargetType =
  | 'user'
  | 'item_request'
  | 'trip'
  | 'offer'
  | 'order'
  | 'payment'
  | 'evidence'
  | 'conversation'
  | 'message'
  | 'message_report'
  | 'handover_record'
  | 'dispute';

export interface CityLocation {
  country?: string;
  city: string;
  airportOrStation?: string;
  addressText?: string;
  geoPoint?: {
    latitude: number;
    longitude: number;
  };
}

export interface SizeEstimate {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  note?: string;
}

export interface FeeBreakdown {
  serviceFee: number;
  platformFee: number;
  total: number;
  currency: Currency;
}

export interface TaxRule {
  defaultPayer: 'requester' | 'traveller' | 'shared' | 'manual_review';
  note: string;
}

export interface CancellationRule {
  beforeHandover: 'eligible_refund' | 'manual_review' | 'non_refundable';
  afterHandover: 'requires_agreement_or_dispute' | 'manual_review' | 'non_refundable';
}

export interface TripDraft {
  fromCity: string;
  toCity: string;
  departureDate: string;
  arrivalDate: string;
  flightNo: string;
  luggageCapacityKg: number;
  acceptableCategories: ItemCategory[];
  note: string;
}

export interface TripRecord {
  _id: EntityId;
  travellerOpenid: string;
  fromCountry: string;
  fromCity: string;
  fromAirportOrStation: string;
  toCountry: string;
  toCity: string;
  toAirportOrStation: string;
  departureTime: CloudDate;
  arrivalTime: CloudDate;
  flightNo: string;
  luggageCapacityKg: number;
  acceptableCategories: ItemCategory[];
  unacceptableCategories: ItemCategory[];
  handoverPreference: string;
  note: string;
  status: TripStatus;
  verificationStatus: ReviewStatus;
  verificationEvidenceIds: EntityId[];
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface ItemRequestDraft {
  itemName: string;
  category: ItemCategory | '';
  quantity: number;
  declaredValue: number;
  estimatedWeightKg: number;
  pickupCity: string;
  deliveryCity: string;
  deadline: string;
  itemPhotos: string[];
  note: string;
  riskDeclarationAccepted: boolean;
}

export interface ItemRequestRecord {
  _id: EntityId;
  requesterOpenid: string;
  itemName: string;
  category: ItemCategory;
  quantity: number;
  declaredValue: number;
  currency: Currency;
  estimatedWeightKg: number;
  estimatedSize: SizeEstimate;
  purchaseMethod: 'owned_item' | 'requester_purchased' | 'unknown';
  pickupLocation: CityLocation;
  deliveryLocation: CityLocation;
  deadline: CloudDate;
  itemPhotos: EntityId[];
  riskFlags: string[];
  reviewStatus: ReviewStatus;
  reviewReason: string;
  riskDeclarationAccepted: boolean;
  note: string;
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface MatchCandidate {
  id: string;
  tripId: string;
  requestId: string;
  route: string;
  dateWindow: string;
  categoryLabel: string;
  capacityKg: number;
  score: number;
  reasons: string[];
}

export interface MatchRecord extends MatchCandidate {
  riskLevel: RiskLevel;
  generatedAt: CloudDate;
}

export interface OfferDraft {
  requestId: string;
  tripId: string;
  serviceFeeQuote: number;
  message: string;
  conditions: string;
}

export interface OfferRecord {
  _id: EntityId;
  requestId: EntityId;
  tripId: EntityId;
  travellerOpenid: string;
  serviceFeeQuote: number;
  currency: Currency;
  message: string;
  conditions: string;
  status: OfferStatus;
  expiresAt: CloudDate;
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface OrderRecord {
  _id: EntityId;
  requestId: EntityId;
  offerId: EntityId;
  tripId: EntityId;
  travellerOpenid: string;
  requesterOpenid: string;
  status: OrderStatus;
  feeBreakdown: FeeBreakdown;
  taxRule: TaxRule;
  cancellationRule: CancellationRule;
  evidenceRequired: EvidenceType[];
  currentRiskLevel: RiskLevel;
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface EvidenceRecord {
  _id: EntityId;
  orderId: EntityId;
  uploaderOpenid: string;
  evidenceType: EvidenceType;
  fileIds: string[];
  storagePath: string;
  fileCount: number;
  description: string;
  visibility: EvidenceVisibility;
  metadata: Record<string, unknown>;
  createdAt: CloudDate;
}

export interface ConversationRecord {
  _id: EntityId;
  orderId: EntityId;
  participantOpenids: string[];
  status: ConversationStatus;
  lastMessageId: EntityId | '';
  lastMessagePreview: string;
  lastMessageAt: CloudDate | null;
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface MessageRecord {
  _id: EntityId;
  conversationId: EntityId;
  orderId: EntityId;
  participantOpenids: string[];
  senderOpenid: string;
  senderRole: 'requester' | 'traveller' | 'system' | 'admin';
  messageType: MessageType;
  content: string;
  moderationStatus: MessageModerationStatus;
  moderationReason: string;
  clientMessageId: string;
  orderStatusAtSend: OrderStatus;
  createdAt: CloudDate;
}

export interface MessageReceiptRecord {
  _id: EntityId;
  conversationId: EntityId;
  orderId: EntityId;
  readerOpenid: string;
  lastReadMessageId: EntityId | '';
  lastReadAt: CloudDate;
  updatedAt: CloudDate;
}

export interface MessageReportRecord {
  _id: EntityId;
  orderId: EntityId;
  conversationId: EntityId;
  messageId: EntityId;
  reporterOpenid: string;
  reason: string;
  description: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  decision: Record<string, unknown> | null;
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface PaymentRecord {
  _id: EntityId;
  orderId: EntityId;
  provider: PaymentProvider;
  providerPaymentId: string;
  amount: number;
  currency: Currency;
  paymentStatus: PaymentStatus;
  lockStatus: PaymentLockStatus;
  refundStatus: RefundStatus;
  createdByOpenid: string;
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface HandoverRecord {
  _id: EntityId;
  orderId: EntityId;
  handoverCode: string;
  confirmedByOpenid: string;
  confirmationType: 'qr_scan_mock' | 'qr_scan' | 'manual_admin';
  metadata: Record<string, unknown>;
  createdAt: CloudDate;
}

export interface DisputeDecision {
  adminOpenid: string;
  action: DisputeDecisionAction;
  reason: string;
  evidenceIds: EntityId[];
  decidedAt: CloudDate;
}

export interface DisputeRecord {
  _id: EntityId;
  orderId: EntityId;
  openedByOpenid: string;
  reason: string;
  description: string;
  evidenceIds: EntityId[];
  status: DisputeStatus;
  decision: DisputeDecision | null;
  createdAt: CloudDate;
  updatedAt: CloudDate;
}

export interface AuditLogRecord {
  _id: EntityId;
  actorOpenid: string;
  actorRole: ActorRole;
  targetType: AuditTargetType;
  targetId: EntityId;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason?: string;
  evidenceIds?: EntityId[];
  operationId?: string;
  createdAt: CloudDate;
}

export interface UserProfile {
  nickname: string;
  verificationStatus: VerificationStatus;
  avatarUrl?: string;
  phoneMasked?: string;
}

export interface UserRecord extends UserProfile {
  _id: EntityId;
  openid: string;
  unionid: string;
  roleFlags: UserRoleFlag[];
  ratingAvg: number;
  completedOrders: number;
  disputeCount: number;
  riskLevel: RiskLevel;
  createdAt: CloudDate;
  updatedAt: CloudDate;
  lastLoginAt: CloudDate;
}
