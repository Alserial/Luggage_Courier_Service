# MVP Test Guide

This guide is for the first CloudBase-backed MVP test run.

Current test environment:

- Mini Program appid: `wx33ac8ad40bb5bc66`
- CloudBase environment id: `luggage-d1ghv33fy2cb9ef96`
- Database collections: created
- Cloud functions: deployed
- Database collection permissions: recommended as no direct frontend read/write
- Admin user: `users.roleFlags` should include `admin` or `reviewer`
- Real-name verification gate: disabled for this internal test build. Use login, item/trip review, order states, and evidence records as the active controls.

## 1. Pre-Test Checklist

Before starting each test run:

- Run `npm run check:files`.
- Run `npm run check:idempotency`.
- Run `npm run check:mutations`.
- Run `npm run check:workflow`.
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
conversations
messages
message_receipts
message_reports
```

- Confirm these cloud functions are deployed:

```text
auth-login
item-request-create
item-request-review
review-queue-list
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
chat-conversation-get
chat-message-list
chat-message-send
chat-mark-read
chat-message-report
chat-review-queue-list
chat-admin-review
chat-evidence-snapshot
payment-confirm-mock
handover-confirm-scan
evidence-create
order-transition
dispute-open
```

## 2. Admin Bootstrap

1. Open the Mini Program `我的` page.
2. Tap `微信一键登录`.
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
- `audit_logs` contains `action: "user.wechatLogin"`.
- Returning to `需求` or `行程` after login performs one refresh because the identity version changed.
- Admin/reviewer functions no longer return `permission_denied`.
- `users.verificationStatus` may remain `unverified`; this should not block the internal MVP test flow.

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
   - Item photos: select 1 clear image from camera/album
   - Risk declaration: checked
4. Preview the selected image, optionally remove/reselect it, then submit.
5. Confirm the button shows upload/submitting progress and cannot be tapped repeatedly.

Expected database result:

- `item_requests` has a new record.
- `requesterOpenid` matches the current user.
- `reviewStatus` is `pending`.
- `itemPhotos` contains 1 to 6 `cloud://` file ids and no local temporary path.
- Request detail renders the submitted image and supports full-screen preview.
- `audit_logs` has `action: "itemRequest.create"`.
- The create audit record includes `itemPhotoCount` without duplicating image data.

### 3.2 Review Item Request

In the Mini Program:

1. Open `我的`.
2. Tap `刷新微信登录状态` again after admin bootstrap.
3. Tap `审核后台`.
4. Keep the `需求` tab selected.
5. Fill review reason if needed.
6. Tap `通过` on the pending item request.

The page calls cloud function `item-request-review` with an equivalent payload:

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

In the Mini Program:

1. Open `我的`.
2. Tap `审核后台`.
3. Switch to the `行程` tab.
4. Fill review reason if needed.
5. Tap `通过` on the pending trip.

The page calls cloud function `trip-verify` with an equivalent payload:

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
- No item photo.
- More than 6 item photos.
- An image above 5 MB.
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
| `cloud_unavailable` | CloudBase is missing, offline, empty, or the function is undeployed | Confirm `env.ts`, network, environment, and function deployment |
| `permission_denied` on review | Current user lacks `admin` or `reviewer` | Edit `users.roleFlags` |
| Empty match list | Review status, route, date, category, or capacity mismatch | Check fields in `item_requests` and `trips` |
| Cloud function not found | Function not deployed or wrong environment selected | Deploy function to `luggage-d1ghv33fy2cb9ef96` |
| Database write fails | Collection missing or permission/runtime issue | Confirm collection exists and function deployed |
| Demo banner appears | `appConfig.demoMode` was explicitly enabled | Set `demoMode: false` for pilot builds |

## 6. Pass Criteria

The first MVP test pass is successful when:

- Login creates or updates `users`.
- Admin/reviewer can approve item requests and verify trips.
- Real trip/request/order list pages show CloudBase records.
- Matching returns only approved compatible records.
- Offer acceptance creates an order.
- Mock payment advances order to `paid_locked`.
- Handover advances order to `item_handed_to_carrier`.
- Traveller advances through in-transit, arrival, and evidence-gated delivery; requester confirms completion.
- Real evidence uploads and dispute records are created.
- Admin/reviewer can keep, refund Mock service fee, complete, or cancel an active dispute with audited evidence.
- Item request images are uploaded to CloudBase, stored as cloud file ids, and visible on request detail.
- Critical actions create `audit_logs`.

## 7. What Not To Test Yet

These are intentionally not complete in the current MVP:

- Real WeChat Pay or real refund.
- Real settlement or payout.
- Real-name verification.
- Deployed in-app chat end-to-end testing until the new collections, indexes, permissions, functions, and content-security permission are configured; use the test matrix below after deployment.
- Subscription notifications.

## 8. In-App Chat Test Matrix

The page, cloud functions, and admin review path are implemented. Run this section after the collections, indexes, participant-scoped permissions, functions, and content-security configuration in `docs/architecture/in-app-chat.md` are deployed.

### 8.1 Authorization

- Requester and traveller can open the conversation for their accepted order.
- A third user receives `permission_denied` for conversation, list, send, report, and evidence-snapshot calls.
- Admin/reviewer access succeeds only through the authorized moderation path.
- No user can read a different conversation by changing `conversationId` or `orderId`.

### 8.2 Send, Idempotency And Realtime

- Valid text up to 500 characters is stored once with sender from server context and server timestamp.
- Retrying the same `clientMessageId` does not create a duplicate.
- Empty/oversized payloads, unsupported media types, and excessive send rate are rejected.
- The other participant receives visible messages through `watch()` or the polling fallback.
- Leaving and reopening the page does not create duplicate watchers; reconnect preserves pagination order.

### 8.3 Moderation And Reporting

- External contact/payment instructions and prohibited-item negotiation are blocked or held for review according to policy.
- Content security failure does not publish the message as visible.
- A participant can report a message; a third user cannot.
- Admin hide/restore/dismiss actions record admin, reason, action, target ids, and timestamp without physically deleting the message.

### 8.4 Evidence Snapshot

- `chat-evidence-snapshot` creates a CloudBase transcript file and append-only `in_app_chat` evidence.
- Evidence contains `orderId`, uploader/system identity, file id/storage path, visibility, message-id/time range, hash, and timestamp.
- The returned evidence id can be linked to `disputes.evidenceIds`.
- Hiding a message later does not alter an earlier snapshot; a second snapshot creates a new evidence record.

### 8.5 Privacy And UI

- Chat shows the platform-recording/moderation notice and order context.
- Loading, empty, reconnecting, sending, blocked, under-review, error, and read-only states are visible and actionable.
- Frontend never displays raw openids, moderation internals, payment secrets, or admin-only notes.
- Initial chat does not accept image/video messages and directs transaction files to the evidence upload page.
