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
| `payment-confirm-mock` | Create mock service-fee payment record | `payments` |
| `handover-confirm-scan` | Record handover QR scan/mock scan | `handover_records`, `audit_logs` |
| `evidence-create` | Create evidence record | `evidence`, `audit_logs` |
| `order-transition` | Move order through allowed state machine | `orders`, `audit_logs` |
| `dispute-open` | Open dispute | `disputes`, `audit_logs` |

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
    pickupCity: string;
    deliveryCity: string;
    deadline: string;
    note?: string;
    riskDeclarationAccepted: boolean;
  };
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
- `risk_declaration_required`

Writes:

- `item_requests`
- `audit_logs` with `action: "itemRequest.create"`

Rules:

- `declaredValue` must be `> 0` and `<= 2000`.
- `estimatedWeightKg` must be `> 0` and `<= 5`.
- Category must be in the positive list.

## `trip-create`

Creates a traveller trip.

Request:

```ts
{
  form: {
    fromCity: string;
    toCity: string;
    departureDate: string;
    arrivalDate: string;
    flightNo?: string;
    luggageCapacityKg: number;
    acceptableCategories: ItemCategory[];
    note?: string;
  };
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

Writes:

- none in current MVP

Rules:

- Matching must stay explainable.
- Future implementation should exclude unreviewed, rejected, or high-risk requests.

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

Writes:

- `offers`
- `audit_logs` with `action: "offer.create"`

Rules:

- `serviceFeeQuote` must be `> 0` and `<= 500`.
- Current offer expiry is 48 hours.

## `offer-accept`

Accepts an offer and creates an order in `pending_payment`.

Request:

```ts
{
  offerId: string;
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

Writes:

- `orders`
- `offers` status update to `accepted` for real offers
- `audit_logs` with `action: "offer.accept"`

Rules:

- Creates service-fee `feeBreakdown`.
- Does not create or hold merchandise payment.
- Demo fallback exists for `demo_offer_001`.

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

Writes:

- none

Notes:

- Returns a demo response for `demo_order_001`.
- Future implementation should verify the caller is an order participant or admin before returning a real order.

## `payment-confirm-mock`

Creates a mock service-fee payment record.

Request:

```ts
{
  orderId: string;
  amount: number;
}
```

Success response:

```ts
{
  ok: true;
  paymentId: string;
  lockStatus: "locked";
}
```

Error codes:

- `missing_params`

Writes:

- `payments`

Rules:

- Provider is `mock`.
- Payment status is created as `paid`.
- Lock status is created as `locked`.
- Does not process merchandise payments.

TODO:

- Add provider callback verification before real payment.
- Add audit log for payment creation.
- Couple successful payment to `orders.status: "paid_locked"` through an audited backend transition.

## `handover-confirm-scan`

Creates a handover confirmation record from QR scan or mock scan.

Request:

```ts
{
  orderId: string;
  handoverCode: string;
}
```

Success response:

```ts
{
  ok: true;
  handoverRecordId: string;
}
```

Error codes:

- `missing_params`

Writes:

- `handover_records`
- `audit_logs` with `action: "handover.confirmScan"`

TODO:

- Verify handover code ownership and expiry.
- Link handover confirmation to required evidence and order transition.

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
- `invalid_evidence_type`
- `missing_files`

Writes:

- `evidence`
- `audit_logs` with `action: "evidence.create"`

Rules:

- `evidenceType` must be in the required evidence type list.
- At least one file id or mock file count is required.
- Evidence must not be overwritten.

## `order-transition`

Moves an order through the explicit state machine.

Request:

```ts
{
  orderId: string;
  nextStatus: OrderStatus;
  reason?: string;
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

TODO:

- Add actor role checks.
- Require evidence ids for evidence-gated transitions.
- Add idempotency via `operationId`.

## `dispute-open`

Opens a dispute for an order.

Request:

```ts
{
  orderId: string;
  reason: string;
  description: string;
}
```

Success response:

```ts
{
  ok: true;
  disputeId: string;
}
```

Error codes:

- `missing_order_id`
- `missing_reason`
- `missing_description`

Writes:

- `disputes`
- `audit_logs` with `action: "dispute.open"`

TODO:

- Verify caller is an order participant.
- Link uploaded evidence ids.
- Add admin decision function.
- Move order to `disputed` through audited transition.
