# Cloud Functions API

This document defines the MVP contract for cloud functions under `cloudfunctions/`.

All functions return an object with `ok: boolean`. Error responses use `ok: false` plus an `error` code string. All identity-sensitive actions must use `cloud.getWXContext()` server-side.

## Common Rules

- Do not trust user identity, role, review status, payment status, settlement status, or dispute decisions from frontend input.
- Critical actions must create `audit_logs` records.
- Payment functions handle service fees only. They must not process merchandise payments.
- Evidence records are append-only.
- Real payment provider callbacks must be verified server-side before changing order status.

## Function Summary

| Function | Purpose | Writes |
|---|---|---|
| `auth-login` | Create/update user login record | `users` |
| `item-request-create` | Create item request for review | `item_requests`, `audit_logs` |
| `trip-create` | Create traveller trip | `trips`, `audit_logs` |
| `match-search` | Return explainable match candidates | none in current MVP |
| `offer-create` | Create service-fee quote | `offers`, `audit_logs` |
| `offer-accept` | Accept offer and create order | `orders`, `offers`, `audit_logs` |
| `order-get` | Read order detail | none |
| `payment-confirm-mock` | Create mock service-fee payment record and lock order | `payments`, `evidence`, `orders`, `audit_logs` |
| `handover-confirm-scan` | Record handover QR scan/mock scan and advance order | `handover_records`, `orders`, `audit_logs` |
| `evidence-create` | Create evidence record | `evidence`, `audit_logs` |
| `order-transition` | Move order through allowed state machine | `orders`, `audit_logs` |
| `dispute-open` | Open dispute and advance order | `disputes`, `orders`, `audit_logs` |

## `auth-login`

Creates a `users` record on first login or updates `lastLoginAt` for returning users.

Request:

```ts
{}
```

Response:

```ts
{
  ok: true;
  userId: string;
  isNew: boolean;
}
```

Writes:

- `users`

Notes:

- Uses `OPENID` and optional `UNIONID` from `cloud.getWXContext()`.
- Initializes `verificationStatus` as `unverified`.
- Does not generate an audit log in the current MVP.

## `item-request-create`

Creates a low-risk item request in `pending` review status.

Request:

```ts
{
  form: {
    itemName: string;
    category: ItemCategory;
    quantity: number;
    declaredValue: number;
    estimatedWeightKg: number;
    estimatedSize?: SizeEstimate;
    purchaseMethod?: "owned_item" | "requester_purchased" | "unknown";
    pickupCity: string;
    pickupCountry?: string;
    pickupAddress?: string;
    deliveryCity: string;
    deliveryCountry?: string;
    deliveryAddress?: string;
    deadline: string;
    itemPhotos?: string[];
    note?: string;
    riskDeclarationAccepted: boolean;
  };
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  requestId: string;
}
```

Error codes:

- `missing_item_name`
- `invalid_category`
- `invalid_quantity`
- `invalid_declared_value`
- `invalid_weight`
- `missing_locations`
- `missing_deadline`
- `invalid_deadline`
- `invalid_item_photos`
- `risk_declaration_required`

Writes:

- `item_requests`
- `audit_logs` with `action: "itemRequest.create"`

Rules:

- `declaredValue` must be `> 0` and `<= 2000`.
- `estimatedWeightKg` must be `> 0` and `<= 5`.
- Category must be in the positive list.
- Creates risk flags for positive-list category, value cap, weight cap, and item-photo state.
- Audit log includes `operationId` when provided.

## `trip-create`

Creates a traveller trip.

Request:

```ts
{
  form: {
    fromCity: string;
    fromCountry?: string;
    fromAirportOrStation?: string;
    toCity: string;
    toCountry?: string;
    toAirportOrStation?: string;
    departureDate: string;
    arrivalDate: string;
    flightNo?: string;
    luggageCapacityKg: number;
    acceptableCategories: ItemCategory[];
    unacceptableCategories?: ItemCategory[];
    handoverPreference?: string;
    note?: string;
  };
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  tripId: string;
}
```

Error codes:

- `missing_route`
- `same_city`
- `missing_dates`
- `invalid_dates`
- `arrival_before_departure`
- `invalid_capacity`
- `missing_categories`
- `invalid_category`
- `overbroad_claim`

Writes:

- `trips`
- `audit_logs` with `action: "trip.create"`

Rules:

- `luggageCapacityKg` must be `> 0` and `<= 5`.
- `acceptableCategories` must be non-empty and positive-list only.
- Notes must not claim broad carrying ability such as "anything is okay".
- `verificationStatus` is `pending` when a flight number is supplied, otherwise `manual_review`.
- Audit log includes `operationId` when provided.

## `match-search`

Returns explainable match candidates.

Request:

```ts
{
  tripId?: string;
  requestId?: string;
}
```

Success response:

```ts
{
  ok: true;
  matches: Array<{
    id: string;
    tripId: string;
    requestId: string;
    route: string;
    dateWindow: string;
    categoryLabel: string;
    capacityKg: number;
    score: number;
    reasons: string[];
  }>;
}
```

Error codes:

- `missing_search_target`
- `trip_not_found`
- `request_not_found`
- `permission_denied`
- `trip_not_active`
- `request_not_approved`

Writes:

- none in current MVP

Rules:

- Matching must stay explainable.
- Real matching excludes unreviewed requests, inactive trips, incompatible routes, incompatible dates, incompatible categories, and insufficient capacity.
- Travellers may search from their own `tripId`; requesters may search from their own `requestId`.
- Demo ids beginning with `demo_` still return a demo candidate for local frontend fallback.

## `offer-create`

Creates a quote from traveller to requester.

Request:

```ts
{
  form: {
    requestId: string;
    tripId: string;
    serviceFeeQuote: number;
    message?: string;
    conditions?: string;
  };
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  offerId: string;
}
```

Error codes:

- `missing_refs`
- `invalid_fee`
- `fee_too_high_for_mvp`
- `request_not_found`
- `trip_not_found`
- `self_offer_not_allowed`
- `permission_denied`
- `request_not_approved`
- `trip_not_active`
- `category_not_accepted`
- `capacity_not_enough`
- `route_not_compatible`
- `date_not_compatible`

Writes:

- `offers`
- `audit_logs` with `action: "offer.create"`

Rules:

- `serviceFeeQuote` must be `> 0` and `<= 500`.
- Current offer expiry is 48 hours.
- Caller must be the owner of the trip.
- Caller cannot quote on their own item request.
- Request must be approved and trip must be active.
- Route, date, category, and capacity must be compatible.
- Audit log includes `operationId` when provided.

## `offer-accept`

Accepts an offer and creates an order in `pending_payment`.

Request:

```ts
{
  offerId: string;
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  orderId: string;
}
```

Error codes:

- `missing_offer_id`
- `offer_not_found`
- `offer_not_pending`
- `request_not_found`
- `permission_denied`
- `request_not_approved`

Writes:

- `orders`
- `offers` status update to `accepted` for real offers
- `audit_logs` with `action: "offer.accept"`

Rules:

- Creates service-fee `feeBreakdown`.
- Does not create or hold merchandise payment.
- Demo fallback exists for `demo_offer_001`.
- Real offers can only be accepted by the request owner.
- Real requests must be `approved`.

## `order-get`

Reads order detail.

Request:

```ts
{
  orderId: string;
}
```

Success response:

```ts
{
  ok: true;
  order: object;
}
```

Error codes:

- `missing_order_id`
- `order_not_found`
- `permission_denied`

Writes:

- none

Notes:

- Returns a demo response for `demo_order_001`.
- Real orders can only be read by requester or traveller.

## `payment-confirm-mock`

Creates a mock service-fee payment record.

Request:

```ts
{
  orderId: string;
  amount: number;
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  paymentId: string;
  evidenceId: string;
  lockStatus: "locked";
  currentStatus: "pending_payment";
  nextStatus: "paid_locked";
}
```

Error codes:

- `missing_params`
- `invalid_amount`
- `order_not_found`
- `permission_denied`
- `illegal_transition`
- `amount_mismatch`

Writes:

- `payments`
- `evidence` with `evidenceType: "payment_record"`
- `orders.status: "paid_locked"`
- `audit_logs` with `action: "payment.mockConfirm"`
- `audit_logs` with `action: "order.transition"`

Rules:

- Provider is `mock`.
- Payment status is created as `paid`.
- Lock status is created as `locked`.
- Does not process merchandise payments.
- Caller must be the requester.
- Payment amount must match `orders.feeBreakdown.total`.

Remaining TODO:

- Add provider callback verification before real payment.
- Add idempotent duplicate-payment handling with `operationId` or provider payment id.

## `handover-confirm-scan`

Creates a handover confirmation record from QR scan or mock scan.

Request:

```ts
{
  orderId: string;
  handoverCode: string;
  evidenceIds?: string[];
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  handoverRecordId: string;
  currentStatus: "paid_locked";
  nextStatus: "item_handed_to_carrier";
}
```

Error codes:

- `missing_params`
- `invalid_evidence_ids`
- `order_not_found`
- `permission_denied`
- `illegal_transition`
- `invalid_handover_code`

Writes:

- `handover_records`
- `audit_logs` with `action: "handover.confirmScan"`
- `orders.status: "item_handed_to_carrier"`
- `audit_logs` with `action: "order.transition"`

Rules:

- Caller must be requester or traveller.
- Order must be `paid_locked`.
- MVP mock code must match `HANDOVER-{last 6 chars of orderId}`.

Remaining TODO:

- Add expiring server-generated handover codes.
- Require evidence ids before transition when policy is tightened.

## `evidence-create`

Creates an append-only evidence record.

Request:

```ts
{
  orderId: string;
  evidenceType: EvidenceType;
  description?: string;
  fileIds?: string[];
  fileCount?: number;
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  evidenceId: string;
}
```

Error codes:

- `missing_order_id`
- `invalid_file_ids`
- `invalid_file_count`
- `invalid_evidence_type`
- `missing_files`
- `order_not_found`
- `permission_denied`

Writes:

- `evidence`
- `audit_logs` with `action: "evidence.create"`

Rules:

- `evidenceType` must be in the required evidence type list.
- At least one file id or mock file count is required.
- Evidence must not be overwritten.
- Caller must be requester or traveller on the order.

## `order-transition`

Moves an order through the explicit state machine.

Request:

```ts
{
  orderId: string;
  nextStatus: OrderStatus;
  reason?: string;
  evidenceIds?: string[];
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
}
```

Error codes:

- `missing_params`
- `invalid_evidence_ids`
- `order_not_found`
- `permission_denied`
- `illegal_transition`

Writes:

- `orders`
- `audit_logs` with `action: "order.transition"`

Allowed transitions:

- `approved -> pending_payment | cancelled | disputed`
- `pending_payment -> paid_locked | cancelled | disputed`
- `paid_locked -> item_handed_to_carrier | cancelled | refunded | disputed`
- `item_handed_to_carrier -> in_transit | disputed`
- `in_transit -> arrived | disputed`
- `arrived -> delivered | disputed`
- `delivered -> completed | disputed`
- `disputed -> refunded | completed | cancelled`

Rules:

- Caller must be requester or traveller on the order.
- Audit log includes `evidenceIds` and `operationId` when provided.

Remaining TODO:

- Require evidence ids for stricter evidence-gated transitions.
- Add idempotency via `operationId`.

## `dispute-open`

Opens a dispute for an order.

Request:

```ts
{
  orderId: string;
  reason: string;
  description: string;
  evidenceIds?: string[];
  operationId?: string;
}
```

Success response:

```ts
{
  ok: true;
  disputeId: string;
  currentStatus: OrderStatus;
  nextStatus: "disputed";
}
```

Error codes:

- `missing_order_id`
- `missing_reason`
- `missing_description`
- `invalid_evidence_ids`
- `order_not_found`
- `permission_denied`
- `order_already_disputed`
- `terminal_order_state`

Writes:

- `disputes`
- `audit_logs` with `action: "dispute.open"`
- `orders.status: "disputed"`
- `audit_logs` with `action: "order.transition"`

Rules:

- Caller must be requester or traveller.
- Terminal states `completed`, `cancelled`, and `refunded` cannot open a normal user dispute.
- Uploaded evidence ids may be linked at open time.

Remaining TODO:

- Add admin decision function.
- Prevent duplicate open disputes with a database uniqueness/idempotency pattern.
