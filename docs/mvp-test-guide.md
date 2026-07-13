# MVP Test Guide

This guide is for the first CloudBase-backed MVP test run.

Current test environment:

- Mini Program appid: `wx33ac8ad40bb5bc66`
- CloudBase environment id: `luggage-d1ghv33fy2cb9ef96`
- Database collections: created
- Cloud functions: deployed
- Database collection permissions: recommended as no direct frontend read/write
- Admin user: `users.roleFlags` should include `admin` or `reviewer`

## 1. Pre-Test Checklist

Before starting each test run:

- Run `npm run check:files`.
- Run `npm run typecheck`.
- Recompile the Mini Program in WeChat Developer Tools.
- Confirm `miniprogram/config/env.ts` uses `luggage-d1ghv33fy2cb9ef96`.
- Confirm all required collections exist:

```text
users
item_requests
trips
offers
orders
payments
evidence
handover_records
disputes
audit_logs
```

- Confirm these cloud functions are deployed:

```text
auth-login
item-request-create
item-request-review
item-request-list
item-request-get
trip-create
trip-verify
trip-list
trip-get
match-search
offer-create
offer-accept
order-list
order-get
payment-confirm-mock
handover-confirm-scan
evidence-create
order-transition
dispute-open
```

## 2. Admin Bootstrap

1. Open the Mini Program `我的` page.
2. Tap `微信登录 Mock`.
3. Confirm a record appears in `users`.
4. Edit that record:

```json
{
  "roleFlags": ["admin", "reviewer"]
}
```

Expected result:

- The profile page shows logged-in state.
- `users.lastLoginAt` updates after repeated login.
- Admin/reviewer functions no longer return `permission_denied`.

## 3. Happy Path Test

### 3.1 Publish Item Request

In the Mini Program:

1. Open `需求`.
2. Tap `发布需求`.
3. Fill a low-risk item:
   - Item name: `普通外套`
   - Category: `普通服饰鞋帽`
   - Quantity: `1`
   - Declared value: `480`
   - Weight: `1.2`
   - Pickup city: `上海`
   - Delivery city: `墨尔本`
   - Deadline: later than the trip arrival date
   - Risk declaration: checked
4. Submit.

Expected database result:

- `item_requests` has a new record.
- `requesterOpenid` matches the current user.
- `reviewStatus` is `pending`.
- `audit_logs` has `action: "itemRequest.create"`.

### 3.2 Review Item Request

Call cloud function `item-request-review` with:

```json
{
  "requestId": "PASTE_ITEM_REQUEST_ID",
  "decision": "approved",
  "reviewReason": "低风险小件，符合 MVP 测试范围"
}
```

Expected result:

- Function returns `ok: true`.
- `item_requests.reviewStatus` becomes `approved`.
- `audit_logs` has `action: "itemRequest.review"`.

### 3.3 Publish Trip

In the Mini Program:

1. Open `行程`.
2. Tap `发布行程`.
3. Fill a compatible trip:
   - From city: `上海`
   - To city: `墨尔本`
   - Departure date: before arrival date
   - Arrival date: before item request deadline
   - Flight number: any test flight number
   - Capacity: `3`
   - Acceptable category: include `普通服饰鞋帽`
4. Submit.

Expected database result:

- `trips` has a new record.
- `travellerOpenid` matches the current user.
- `status` is `active`.
- `verificationStatus` is `pending` if flight number exists.
- `audit_logs` has `action: "trip.create"`.

### 3.4 Verify Trip

Call cloud function `trip-verify` with:

```json
{
  "tripId": "PASTE_TRIP_ID",
  "decision": "approved",
  "reviewReason": "行程信息可用于 MVP 测试",
  "verificationEvidenceIds": []
}
```

Expected result:

- Function returns `ok: true`.
- `trips.verificationStatus` becomes `approved`.
- `audit_logs` has `action: "trip.verify"`.

### 3.5 Search Match

In the Mini Program:

1. Open `行程`.
2. Open the trip detail.
3. Tap `查看匹配需求`.

Expected result:

- Matching page shows the approved request.
- Match includes route, date window, category, capacity, score, and reasons.

If no match appears, check:

- `item_requests.reviewStatus` is `approved`.
- Trip `status` is `active`.
- Route cities match exactly.
- Request deadline is later than or equal to trip arrival date.
- Request category is in trip acceptable categories.
- Trip capacity is greater than or equal to item weight.

### 3.6 Create Offer

In the Mini Program:

1. From match result, tap `去报价`.
2. Enter service fee, for example `120`.
3. Submit.

Expected database result:

- `offers` has a new record.
- `status` is `pending`.
- `serviceFeeQuote` is within CNY 500.
- `audit_logs` has `action: "offer.create"`.

### 3.7 Accept Offer And Create Order

In the Mini Program:

1. Open the request detail.
2. Confirm the pending offer appears.
3. Tap `接受报价并生成订单`.

Expected database result:

- `orders` has a new record.
- `status` is `pending_payment`.
- `offers.status` becomes `accepted`.
- `orders.feeBreakdown` contains service fee, platform fee, and total.
- `audit_logs` has `action: "offer.accept"`.

### 3.8 Mock Payment

In the Mini Program:

1. Open the order detail.
2. Tap mock payment action.
3. Confirm mock payment.

Expected database result:

- `payments` has a new record.
- `provider` is `mock`.
- `paymentStatus` is `paid`.
- `lockStatus` is `locked`.
- `orders.status` becomes `paid_locked`.
- `evidence` has `evidenceType: "payment_record"`.
- `audit_logs` has `payment.mockConfirm` and `order.transition`.

### 3.9 Handover

In the Mini Program:

1. Open order detail.
2. Tap handover action.
3. Use the displayed or expected mock handover code.
4. Confirm handover.

Expected database result:

- `handover_records` has a new record.
- `orders.status` becomes `item_handed_to_carrier`.
- `audit_logs` has `handover.confirmScan` and `order.transition`.

### 3.10 Evidence And Dispute

In the Mini Program:

1. Open order detail.
2. Tap `上传证据`.
3. Submit a mock evidence file count or selected media if available.
4. Return to order detail.
5. Tap `发起争议`.
6. Fill reason and description.
7. Submit.

Expected database result:

- `evidence` has a new record.
- `disputes` has a new record.
- `orders.status` becomes `disputed`.
- `audit_logs` has `evidence.create`, `dispute.open`, and `order.transition`.

## 4. Negative Tests

Run these after the happy path.

### 4.1 Review Permission

Remove `admin` and `reviewer` from `users.roleFlags`, then call `item-request-review`.

Expected result:

```json
{
  "ok": false,
  "error": "permission_denied"
}
```

Restore:

```json
["admin", "reviewer"]
```

### 4.2 Invalid Item Request

Try to publish:

- Declared value above `2000`.
- Weight above `5`.
- Missing risk declaration.

Expected result:

- Frontend blocks submission or cloud function returns an error.
- No valid `item_requests` record should be created.

### 4.3 Invalid Trip

Try to publish:

- Same from/to city.
- Arrival date earlier than departure date.
- No acceptable category.
- Note containing broad text such as `什么都可以`.

Expected result:

- Frontend blocks submission or cloud function returns an error.
- No valid `trips` record should be created.

### 4.4 Match Exclusion

Set request review status back to `pending` or route mismatch the trip.

Expected result:

- `match-search` does not return that request.

### 4.5 Offer Boundary

Try to submit service fee above `500`.

Expected result:

- Cloud function returns `fee_too_high_for_mvp`.
- No valid `offers` record should be created.

## 5. Common Errors

| Symptom | Likely cause | Fix |
|---|---|---|
| `cloud_not_ready` | `cloudEnvId` not configured or app not recompiled | Confirm `env.ts`, then recompile |
| `permission_denied` on review | Current user lacks `admin` or `reviewer` | Edit `users.roleFlags` |
| Empty match list | Review status, route, date, category, or capacity mismatch | Check fields in `item_requests` and `trips` |
| Cloud function not found | Function not deployed or wrong environment selected | Deploy function to `luggage-d1ghv33fy2cb9ef96` |
| Database write fails | Collection missing or permission/runtime issue | Confirm collection exists and function deployed |
| Demo data still appears | Cloud function call failed and frontend used fallback | Check console logs and cloud function logs |

## 6. Pass Criteria

The first MVP test pass is successful when:

- Login creates or updates `users`.
- Admin/reviewer can approve item requests and verify trips.
- Real trip/request/order list pages show CloudBase records.
- Matching returns only approved compatible records.
- Offer acceptance creates an order.
- Mock payment advances order to `paid_locked`.
- Handover advances order to `item_handed_to_carrier`.
- Evidence and dispute records are created.
- Critical actions create `audit_logs`.

## 7. What Not To Test Yet

These are intentionally not complete in the current MVP:

- Real WeChat Pay or real refund.
- Real settlement or payout.
- Real-name verification.
- Real cloud storage file id upload for every evidence path.
- Admin dispute decision.
- In-app chat.
- Subscription notifications.
