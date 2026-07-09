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
| `note` | string | no | Packaging, receipt, handover preference |
| `createdAt` | Date | yes | Server time |
| `updatedAt` | Date | yes | Server time |

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

### `payments`

Stores service-fee payment records only. It must not store or imply merchandise payment custody.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `_id` | string | yes | CloudBase document id |
| `orderId` | string | yes | `orders._id` |
| `provider` | string | yes | `mock`, `wechat_pay`, `provider_todo` |
| `providerPaymentId` | string | yes | Mock/provider id |
| `amount` | number | yes | Service-fee total |
| `currency` | `CNY` | yes | MVP currency |
| `paymentStatus` | string | yes | `pending`, `paid`, `failed`, `cancelled` |
| `lockStatus` | string | yes | `none`, `locked`, `released` |
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
| `fileCount` | number | yes | Allows mock count before storage integration |
| `description` | string | no | User note |
| `visibility` | string | yes | `both_parties`, `requester_only`, `traveller_only`, `admin_only` |
| `metadata` | object | yes | Source, device, linked state, etc. |
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
| `actorRole` | string | yes | `user`, `requester`, `traveller`, `admin`, `system` |
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
- Create/update actions for `item_requests`, `trips`, `offers`, `orders`, `payments`, `evidence`, `handover_records`, `disputes`, and `audit_logs` should go through cloud functions.
- Users may read their own related records: requester, traveller, uploader, dispute opener, or order participant.
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
- `disputes`: `dispute-open`
- `audit_logs`: create/request/trip/offer/order/evidence/dispute/handover actions

## Required Follow-Ups

- Add CloudBase collection initialization and index setup scripts.
- Normalize `reviewStatus` and `verificationStatus` defaults in cloud functions.
- Add `operationId` and `evidenceIds` to critical audit records.
- Add admin review functions for item requests, trip verification, and dispute decisions.
- Add provider-facing payment callback functions before any real payment launch.
- Add read models or join helpers for list/detail pages so frontend does not duplicate derived fields.
