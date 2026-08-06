# Data Model

This document defines the MVP CloudBase data model for the cross-border carrying Mini Program.

The platform remains a limited matching and transaction-record product. It does not custody merchandise payments, does not promise customs clearance, and does not provide full delivery compensation.

## Design Rules

- Store all payment, review, settlement, login, and dispute decisions in backend/cloud functions.
- Keep frontend code as display, form capture, and cloud-function invocation only.
- Use positive-list item categories and manual review for uncertain cases.
- Keep every critical user action auditable through `audit_logs`.
- Treat evidence as append-only. Do not overwrite evidence records.
- Keep service-fee payment provider integration behind backend interfaces. Real provider fields stay TODO until confirmed.

## Shared Enums

### ItemCategory

- `clothing`
- `books`
- `stationery`
- `small_gifts`
- `phone_accessories`
- `daily_items`

### ReviewStatus

- `pending`: waiting for platform or backend review.
- `approved`: allowed to proceed.
- `rejected`: not allowed.
- `manual_review`: needs human review before matching or ordering.

`item_requests.reviewStatus` and `trips.verificationStatus` are review fields. They are not the same as `orders.status`.

### OrderStatus

- `draft`
- `pending_review`
- `approved`
- `pending_payment`
- `paid_locked`
- `item_handed_to_carrier`
- `in_transit`
- `arrived`
- `delivered`
- `completed`
- `disputed`
- `cancelled`
- `refunded`

See `docs/architecture/order-state-machine.md` for transition rules.

### EvidenceType

- `item_photo`
- `handover_qr_scan`
- `in_app_chat`
- `payment_record`
- `flight_record`
- `customs_or_airline_proof`
- `delivery_photo_or_video`
- `mutual_confirmation`

### Chat Statuses

- Conversation: `active`, `read_only`, `closed`
- Message moderation: `visible`, `under_review`, `blocked`, `admin_hidden`
- Message type in the first release: `text`, `system`

See `docs/architecture/in-app-chat.md` for the complete chat contract.

## Collections

### `users`

Stores WeChat login identity, profile display data, verification status, and trust counters.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `openid` | string | yes | Unique WeChat openid |
| `unionid` | string | no | Empty string when unavailable |
| `nickname` | string | no | Display only |
| `avatarUrl` | string | no | Display only |
| `phoneMasked` | string | no | Never store raw phone in frontend |
| `roleFlags` | string[] | yes | `requester`, `traveller`, `admin`, `reviewer` |
| `verificationStatus` | ReviewStatus-like string | yes | `unverified`, `pending`, `verified`, `rejected` |
| `ratingAvg` | number | yes | Trust display |
| `completedOrders` | number | yes | Trust display |
| `disputeCount` | number | yes | Risk signal |
| `riskLevel` | string | yes | `low`, `medium`, `high` |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |
| `lastLoginAt` | Date | yes | Server time |

Indexes:

- unique or equivalent lookup index on `openid`
- `verificationStatus`
- `riskLevel`

### `item_requests`

Stores requester demand for low-risk personal items.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `requesterOpenid` | string | yes | Creator |
| `itemName` | string | yes | User-facing name |
| `category` | ItemCategory | yes | Positive-list only |
| `quantity` | number | yes | Personal reasonable quantity |
| `declaredValue` | number | yes | MVP cap: CNY 2000 |
| `currency` | `CNY` | yes | MVP currency |
| `estimatedWeightKg` | number | yes | MVP cap: 5kg |
| `estimatedSize` | object | yes | Optional dimensions and note |
| `purchaseMethod` | string | yes | `owned_item`, `requester_purchased`, `unknown` |
| `pickupLocation` | CityLocation | yes | City required |
| `deliveryLocation` | CityLocation | yes | City required |
| `deadline` | Date/string | yes | Must be after compatible trip arrival |
| `itemPhotos` | string[] | yes | Cloud file ids |
| `riskFlags` | string[] | yes | Review/matching display |
| `reviewStatus` | ReviewStatus | yes | Defaults to `pending` |
| `reviewReason` | string | yes | Empty until review decision |
| `riskDeclarationAccepted` | boolean | yes | Must be true to submit |
| `isDeleted` | boolean | no | Soft-delete marker; deleted requests are excluded from lists, matching, offers, and review |
| `deletedAt` | Date | no | Server time of owner soft deletion |
| `note` | string | no | Packaging, receipt, handover preference |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

Item-photo rules:

- `itemPhotos` is required and contains 1 to 6 CloudBase `cloud://` file ids.
- The Mini Program accepts images only, limits each selected image to 5 MB, uploads before request creation, and submits only cloud file ids to the backend.
- `item-request-create` validates the count and file-id format again server-side.
- Request creation records `itemPhotoCount` in the audit log without copying image content into the log.

Indexes:

- `requesterOpenid`, `createdAt`
- `reviewStatus`, `category`
- `pickupLocation.city`, `deliveryLocation.city`, `deadline`

### `trips`

Stores traveller routes and carrying capacity.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `travellerOpenid` | string | yes | Creator |
| `fromCountry` | string | no | Empty in early MVP |
| `fromCity` | string | yes | Departure city |
| `fromAirportOrStation` | string | no | Airport/station text |
| `toCountry` | string | no | Empty in early MVP |
| `toCity` | string | yes | Arrival city |
| `toAirportOrStation` | string | no | Airport/station text |
| `departureTime` | Date/string | yes | Date in current MVP |
| `arrivalTime` | Date/string | yes | Date in current MVP |
| `flightNo` | string | no | Optional before order confirmation |
| `luggageCapacityKg` | number | yes | MVP cap: 5kg |
| `acceptableCategories` | ItemCategory[] | yes | Positive-list categories |
| `unacceptableCategories` | ItemCategory[] | yes | Explicit exclusions |
| `handoverPreference` | string | no | Handover text |
| `note` | string | no | Must not claim "anything is okay" |
| `status` | string | yes | `draft`, `active`, `paused`, `expired`, `cancelled` |
| `verificationStatus` | ReviewStatus | yes | Flight evidence status |
| `verificationEvidenceIds` | string[] | yes | Linked evidence ids |
| `deletedAt` | Date | no | Server time when `status` becomes `cancelled` through owner deletion |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

Indexes:

- `travellerOpenid`, `createdAt`
- `status`, `departureTime`
- `fromCity`, `toCity`, `arrivalTime`
- `acceptableCategories`

### `offers`

Stores traveller quote terms before order creation.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `requestId` | string | yes | `item_requests._id` |
| `tripId` | string | yes | `trips._id` |
| `travellerOpenid` | string | yes | Quote creator |
| `serviceFeeQuote` | number | yes | MVP cap currently CNY 500 |
| `currency` | `CNY` | yes | MVP currency |
| `message` | string | no | User message |
| `conditions` | string | no | Handover/delivery conditions |
| `status` | string | yes | `pending`, `accepted`, `rejected`, `expired`, `cancelled` |
| `expiresAt` | Date | yes | Current MVP: 48h |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

Indexes:

- `requestId`, `status`
- `tripId`, `status`
- `travellerOpenid`, `createdAt`
- `expiresAt`

### `orders`

Stores the transaction record and lifecycle after an offer is accepted.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `requestId` | string | yes | `item_requests._id` |
| `offerId` | string | yes | `offers._id` |
| `tripId` | string | yes | `trips._id` |
| `travellerOpenid` | string | yes | Carrying user |
| `requesterOpenid` | string | yes | Requesting user |
| `status` | OrderStatus | yes | Explicit state machine |
| `feeBreakdown` | object | yes | Service fee, platform fee, total, currency |
| `paymentId` | string | no | Current service-fee payment record |
| `activeDisputeId` | string/null | no | Only active dispute; cleared after final decision |
| `statusBeforeDispute` | OrderStatus/null | no | State captured when dispute opens |
| `cancellationReason` | string | no | Required reason when a participant cancels |
| `cancelledAt` | Date | no | Server time when cancellation succeeds |
| `taxRule` | object | yes | Default payer and note |
| `cancellationRule` | object | yes | Before/after handover handling |
| `evidenceRequired` | EvidenceType[] | yes | Required proof checklist |
| `currentRiskLevel` | string | yes | `low`, `medium`, `high` |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

Indexes:

- `requesterOpenid`, `status`, `updatedAt`
- `travellerOpenid`, `status`, `updatedAt`
- `requestId`
- `tripId`

### `conversations`

Stores one supervised chat conversation per accepted order.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | Conversation id |
| `orderId` | string | yes | Unique order reference |
| `participantOpenids` | string[] | yes | Requester and traveller |
| `status` | string | yes | `active`, `read_only`, `closed` |
| `lastMessageId` | string | no | Latest visible message |
| `lastMessagePreview` | string | no | Short non-sensitive preview |
| `lastMessageAt` | Date | no | Server time |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

Indexes:

- unique `orderId`
- `participantOpenids`, `lastMessageAt`

### `messages`

Stores append-only text/system messages. User messages cannot be edited, recalled, overwritten, or physically deleted.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | Message id |
| `conversationId` | string | yes | Conversation reference |
| `orderId` | string | yes | Related order |
| `participantOpenids` | string[] | yes | Denormalized for scoped reads |
| `senderOpenid` | string | yes | From server context |
| `senderRole` | string | yes | requester/traveller/system/admin |
| `messageType` | string | yes | MVP: `text` or `system` |
| `content` | string | yes | User text max 500 characters |
| `moderationStatus` | string | yes | visible/review/blocked/admin hidden |
| `moderationReason` | string | no | Stable user-safe reason code |
| `clientMessageId` | string | yes | Send idempotency key |
| `orderStatusAtSend` | OrderStatus | yes | Server-observed order state |
| `createdAt` | Date | yes | Server time |

Indexes:

- unique `conversationId`, `clientMessageId`
- `conversationId`, `createdAt`
- `orderId`, `createdAt`
- `moderationStatus`, `createdAt`

### `message_receipts` / `message_reports`

- `message_receipts` stores participant read cursors without mutating messages; use a unique index on `conversationId`, `readerOpenid`.
- `message_reports` stores reported message, reporter, reason, status, admin decision, and timestamps; index by `status`, `createdAt`, and by `messageId`, `reporterOpenid`, `status`.
- Full field definitions and lifecycle rules are in `docs/architecture/in-app-chat.md`.

### `payments`

Stores service-fee payment records only. It must not store or imply merchandise payment custody.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `orderId` | string | yes | `orders._id` |
| `provider` | string | yes | `mock`, `wechat_pay`, `provider_todo` |
| `providerPaymentId` | string | yes | Mock/provider id |
| `providerRefundId` | string | no | Mock/provider refund id |
| `amount` | number | yes | Service-fee total |
| `currency` | `CNY` | yes | MVP currency |
| `paymentStatus` | string | yes | `pending`, `paid`, `failed`, `cancelled` |
| `lockStatus` | string | yes | `none`, `locked`, `released`; Mock refund returns it to `none` |
| `refundStatus` | string | yes | `none`, `requested`, `approved`, `refunded`, `rejected` |
| `createdByOpenid` | string | yes | Payer |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

Indexes:

- `orderId`
- `provider`, `providerPaymentId`
- `paymentStatus`, `lockStatus`, `refundStatus`

### `evidence`

Stores append-only proof records.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `orderId` | string | yes | `orders._id` |
| `uploaderOpenid` | string | yes | Uploader |
| `evidenceType` | EvidenceType | yes | Positive-list only |
| `fileIds` | string[] | yes | Cloud file ids |
| `storagePath` | string | yes | `fileIds[0]` for uploads or explicit `system://...` marker |
| `fileCount` | number | yes | Uploaded attachment count; system evidence may use zero |
| `description` | string | no | User note |
| `visibility` | string | yes | `both_parties`, `requester_only`, `traveller_only`, `admin_only` |
| `metadata` | object | yes | Source and file type/size metadata or system linkage |
| `operationId` | string | no | Idempotency/correlation id |
| `createdAt` | Date | yes | Server time |

Indexes:

- `orderId`, `createdAt`
- `uploaderOpenid`, `createdAt`
- `evidenceType`

### `handover_records`

Stores QR scan or equivalent handover confirmation.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `orderId` | string | yes | `orders._id` |
| `handoverCode` | string | yes | QR or mock code |
| `confirmedByOpenid` | string | yes | Scanner/confirming user |
| `confirmationType` | string | yes | `qr_scan_mock`, `qr_scan`, `manual_admin` |
| `metadata` | object | yes | Source and related context |
| `createdAt` | Date | yes | Server time |

Indexes:

- `orderId`, `createdAt`
- `confirmedByOpenid`, `createdAt`

### `disputes`

Stores user-opened disputes and admin decisions.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `orderId` | string | yes | `orders._id` |
| `openedByOpenid` | string | yes | Opening user |
| `reason` | string | yes | Reason code or short text |
| `description` | string | yes | User explanation |
| `evidenceIds` | string[] | yes | Supporting evidence |
| `status` | string | yes | `open`, `under_review`, `resolved`, `cancelled` |
| `decision` | object/null | yes | Admin result, null until decided |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

Decision object fields:

- `adminOpenid`
- `action`: `none`, `refund`, `complete`, `cancel_order`, `keep_in_dispute`
- `reason`
- `evidenceIds`
- `decidedAt`

Indexes:

- `orderId`, `status`
- `openedByOpenid`, `createdAt`
- `status`, `updatedAt`

### `audit_logs`

Stores append-only audit records for critical actions.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `actorOpenid` | string | yes | Acting user, admin, or system id |
| `actorRole` | string | yes | `user`, `requester`, `traveller`, `admin`, `reviewer`, `system` |
| `targetType` | string | yes | Collection/domain target |
| `targetId` | string | yes | Target document id |
| `action` | string | yes | Stable action string |
| `before` | object/null | yes | Previous selected fields |
| `after` | object/null | yes | Next selected fields |
| `reason` | string | no | Required for review/dispute/transition decisions |
| `evidenceIds` | string[] | no | Evidence connected to the action |
| `operationId` | string | no | Idempotency/correlation id |
| `createdAt` | Date | yes | Server time |

Indexes:

- `targetType`, `targetId`, `createdAt`
- `actorOpenid`, `createdAt`
- `action`, `createdAt`
- `operationId`

## Access Control

CloudBase collection permissions should stay restrictive:

- Mini Program frontend should not directly write critical collections.
- Create/update actions for `item_requests`, `trips`, `offers`, `orders`, `payments`, `evidence`, `handover_records`, `disputes`, `messages`, `message_receipts`, `message_reports`, and `audit_logs` should go through cloud functions.
- Users may read their own related records: requester, traveller, uploader, dispute opener, or order participant.
- Planned realtime chat may allow direct read-only `watch()` access to `messages` only after participant-scoped permission rules are deployed and tested. It never permits frontend writes.
- Admin/reviewer reads and decisions must be backend-gated.
- Raw identity, payment provider callbacks, settlement decisions, and dispute decisions must never be trusted from frontend-only code.

## Current Implementation Alignment

Current cloud functions already create these collections:

- `users`: `auth-login`
- `item_requests`: `item-request-create`
- `trips`: `trip-create`
- `offers`: `offer-create`
- `orders`: `offer-accept`
- `payments`: `payment-confirm-mock`
- `evidence`: `evidence-create`
- `handover_records`: `handover-confirm-scan`
- `disputes`: `dispute-open`, `dispute-decide`
- `audit_logs`: create/request/trip/offer/order/evidence/dispute/handover actions

- `conversations`: `chat-conversation-get`
- `messages`: `chat-message-send`, `chat-message-list`, `chat-admin-review`
- `message_receipts`: `chat-mark-read`
- `message_reports`: `chat-message-report`, `chat-review-queue-list`, `chat-admin-review`
- `in_app_chat` evidence/storage: `chat-evidence-snapshot`

## Required Follow-Ups

- Add CloudBase collection initialization and index setup scripts.
- Normalize `reviewStatus` and `verificationStatus` defaults in cloud functions.
- Add provider-facing payment callback functions before any real payment launch.
- Add CloudBase rules/tests that enforce evidence visibility outside cloud functions.
- Deploy and test chat indexes, participant-scoped read permissions, WeChat content-security permission, and retention/privacy policy defined in `docs/architecture/in-app-chat.md`.
