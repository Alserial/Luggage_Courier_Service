# CloudBase Setup

This document describes how to prepare the WeChat CloudBase environment for the MVP.

The MVP uses CloudBase for cloud functions, database collections, cloud storage, and server-side decision logic. Do not put secrets, payment decisions, review decisions, settlement decisions, or dispute decisions in Mini Program frontend code.

## Environment

| Item | Value |
|---|---|
| Mini Program appid | `wx33ac8ad40bb5bc66` |
| Mini Program root | `miniprogram/` |
| Cloud function root | `cloudfunctions/` |
| CloudBase environment id | `luggage-d1ghv33fy2cb9ef96` |
| Runtime | Node.js cloud functions using `wx-server-sdk` |

Recommended setup:

1. Open the project in WeChat Developer Tools.
2. Confirm `project.config.json` points to `miniprogram/` and `cloudfunctions/`.
3. Create or select a CloudBase environment.
4. Bind the environment to the Mini Program project.
5. Deploy cloud functions in the order listed below.
6. Create the database collections and indexes.
7. Configure restrictive collection permissions.
8. Create cloud storage folders for item-request images and evidence files.

The current `miniprogram/config/env.ts` contains the configured environment id shown above. Normal builds use `demoMode: false`; missing configuration, network failure, empty response, or an undeployed function returns `cloud_unavailable` and never simulates success. Demo data is frontend-only and requires explicitly setting `demoMode: true`, which displays a visible banner.

## Deploy Order

Deploy lower-level functions first, then order workflow functions.

1. `auth-login`
2. `item-request-create`
3. `item-request-update`
4. `item-request-delete`
5. `item-request-review`
6. `review-queue-list`
7. `item-request-list`
8. `item-request-get`
9. `trip-create`
10. `trip-update`
11. `trip-delete`
12. `trip-verify`
13. `trip-list`
14. `trip-get`
15. `match-search`
16. `offer-create`
17. `offer-accept`
18. `order-list`
19. `order-get`
20. `chat-conversation-get`
21. `chat-message-list`
22. `chat-message-send` (deploy with `config.json` OpenAPI permission)
23. `chat-mark-read`
24. `chat-message-report`
25. `chat-review-queue-list`
26. `chat-admin-review`
27. `chat-evidence-snapshot`
28. `payment-confirm-mock`
29. `handover-confirm-scan`
30. `evidence-create`
31. `order-transition`
32. `dispute-open`
33. `dispute-decide`

Each cloud function has its own `package.json`. In WeChat Developer Tools, upload and deploy each function folder under `cloudfunctions/`.
All functions pin `wx-server-sdk` to `4.0.2`; choose “upload and deploy: cloud install dependencies” so transaction support is installed consistently.

After deploying `chat-message-send`, confirm its `security.msgSecCheck` permission is accepted in the target environment. The implementation withholds content as `under_review` when the platform content-security call is unavailable.

## Database Collections

Create these collections before using the real CloudBase backend:

- `users`
- `item_requests`
- `trips`
- `offers`
- `orders`
- `payments`
- `evidence`
- `handover_records`
- `disputes`
- `audit_logs`
- `conversations`
- `messages`
- `message_receipts`
- `message_reports`

The field-level schema is defined in `docs/architecture/data-model.md`.

## First Admin Setup

Review functions use `users.roleFlags` for access control.

Bootstrap steps:

1. Log in once from the Mini Program profile page so `auth-login` creates a `users` record.
2. In CloudBase database console, find the record whose `openid` matches the operator.
3. Add `admin` or `reviewer` to `roleFlags`.
4. Log in again, then open `我的` -> `审核后台`.
5. Use the review page to call `item-request-review` and `trip-verify`.

Do not add admin openids to frontend code. Admin/reviewer decisions must remain backend-only and audited.

## Index Plan

Create indexes according to the query patterns below. CloudBase index UI names can be chosen by the operator; keep the field order stable.

### `users`

- `openid`
- `verificationStatus`
- `riskLevel`

### `item_requests`

- `requesterOpenid`, `createdAt`
- `reviewStatus`, `category`
- `reviewStatus`, `createdAt`
- `pickupLocation.city`, `deliveryLocation.city`, `deadline`

### `trips`

- `travellerOpenid`, `createdAt`
- `verificationStatus`, `createdAt`
- `status`, `departureTime`
- `fromCity`, `toCity`, `arrivalTime`
- `acceptableCategories`

### `offers`

- `requestId`, `status`
- `tripId`, `status`
- `travellerOpenid`, `createdAt`
- `expiresAt`

### `orders`

- `requesterOpenid`, `status`, `updatedAt`
- `travellerOpenid`, `status`, `updatedAt`
- `requestId`
- `tripId`

### `payments`

- `orderId`
- `provider`, `providerPaymentId`
- `paymentStatus`, `lockStatus`, `refundStatus`

### Chat indexes

- `conversations`: unique `orderId`; `participantOpenids`, `lastMessageAt`
- `messages`: unique `conversationId`, `clientMessageId`; `conversationId`, `createdAt`; `orderId`, `createdAt`; `moderationStatus`, `createdAt`; `conversationId`, `senderOpenid`, `createdAt`
- `message_receipts`: unique `conversationId`, `readerOpenid`
- `message_reports`: `status`, `createdAt`; `messageId`, `reporterOpenid`, `status`; `orderId`, `createdAt`

### `evidence`

- `orderId`, `createdAt`
- `uploaderOpenid`, `createdAt`
- `evidenceType`

### `handover_records`

- `orderId`, `createdAt`
- `confirmedByOpenid`, `createdAt`

### `disputes`

- `orderId`, `status`
- `openedByOpenid`, `createdAt`
- `status`, `updatedAt`

### `audit_logs`

- `targetType`, `targetId`, `createdAt`
- `actorOpenid`, `createdAt`
- `action`, `createdAt`
- `operationId`

## Collection Permissions

Use the most restrictive settings possible for MVP.

Recommended baseline:

| Collection | Frontend read | Frontend write | Backend/cloud function |
|---|---|---|---|
| `users` | Own record only | No direct write | Full |
| `item_requests` | Own or matched records only | No direct write | Full |
| `trips` | Own or matched active records only | No direct write | Full |
| `offers` | Related requester/traveller only | No direct write | Full |
| `orders` | Related requester/traveller only | No direct write | Full |
| `payments` | Related payer/order participant only | No direct write | Full |
| `evidence` | Related order participant, visibility gated | No direct write | Full |
| `handover_records` | Related order participant only | No direct write | Full |
| `disputes` | Related opener/order participant only | No direct write | Full |
| `audit_logs` | Admin/reviewer only for MVP | No direct write | Full |
| `conversations` | Related requester/traveller only | No direct write | Full |
| `messages` | Participant-scoped read for tested `watch()`, otherwise cloud function only | No direct write | Full |
| `message_receipts` | Own receipt only or cloud function only | No direct write | Full |
| `message_reports` | Reporter/admin as policy permits | No direct write | Full |

For the initial MVP, prefer disabling direct frontend writes to all critical collections. Use cloud functions for create/update operations.

## Cloud Storage

Create these logical folders in CloudBase storage:

- `item-requests/`
- `evidence/item-photo/`
- `evidence/handover/`
- `evidence/flight-record/`
- `evidence/customs-airline-proof/`
- `evidence/delivery/`
- `evidence/dispute/`
- `evidence/in-app-chat/` (chat transcript snapshots)

Rules:

- Store request image file ids in `item_requests.itemPhotos`; current request uploads use the `item-requests/` prefix.
- Store file ids in `evidence.fileIds`.
- Store the first CloudBase file id in `evidence.storagePath`; system records use explicit `system://payment/...`, `system://handover/...`, or `system://confirmation/...` paths.
- Do not expose raw temporary upload URLs as durable records.
- Do not allow evidence overwrite. New proof must create a new `evidence` record.
- Keep identity documents and sensitive verification files out of frontend logs.

## Runtime Config

Do not hardcode secrets in Mini Program code.

Allowed frontend config:

- CloudBase environment id when required by WeChat SDK initialization.
- Feature flags for mock flows.
- Display-only constants.

Backend-only config:

- Payment provider credentials.
- Payment callback verification keys.
- Admin/reviewer authorization lists.
- Settlement provider credentials.
- Any third-party identity verification secrets.

Chat backend configuration:

- Configure `chat-message-send` to call the WeChat text content security API server-side; never expose access tokens or moderation credentials to the Mini Program.
- Keep contact-sharing/risk patterns, rate limits, moderator actions, and restricted reasons in backend configuration.
- Enable direct `messages` reads only after participant-scoped rules are verified with both parties, an unrelated user, and an admin. Use cloud-function list polling until then.
- Update the Mini Program privacy disclosure before enabling stored/moderated chat.

## Validation

Before deployment:

```bash
npm run check:files
npm run check:idempotency
npm run check:mutations
npm run check:workflow
npm run typecheck
```

After CloudBase deployment:

1. Tap `微信一键登录` on the Mini Program profile page; confirm `users` and a `user.wechatLogin` audit record are created.
2. Create an item request with a selected image; confirm `item_requests.itemPhotos` contains only `cloud://` ids, request detail renders the image, and the audit record includes `itemPhotoCount`.
3. Open `我的` -> `审核后台`, review the item request, and confirm `reviewStatus: "approved"`.
4. Create a trip and confirm `trips` plus `audit_logs` records.
5. Verify the trip in `审核后台`.
6. With a second WeChat test identity, confirm the `公开大厅` tabs show the first user's approved request and verified active trip, while `我的发布` shows only the second user's records.
7. Confirm public detail responses do not contain requester/traveller OpenIDs, owner-only notes, review reasons, or offers.
8. Confirm trip/request/order list pages load real records and cloud failures show errors rather than simulated success.
9. Run `match-search` and confirm only approved compatible requests appear.
10. Create an offer and accept it into an order.
11. Run Mock service-fee confirmation and confirm one `payments` record plus `payment_record` evidence.
12. Upload real evidence and confirm `fileIds`, file metadata, and canonical `storagePath`.
13. Complete `handover -> in_transit -> arrived -> delivered -> completed` with role and evidence gates.
14. Open a dispute, review it with an admin/reviewer, and confirm final status plus audit logs.
15. Exercise Mock refund and confirm only the service-fee record changes.

## Known TODOs

- Add scripted collection/index initialization.
- Add CloudBase permission JSON exports once the target environment is confirmed.
- Add payment provider callback function before enabling real payment.
- Deploy and validate the supervised chat stack, permissions, moderation, privacy disclosure, report/admin flow, and evidence snapshot according to `docs/architecture/in-app-chat.md`.
- Replace Mock service-fee payment/refund only after a compliant provider and callback verification design is approved.
