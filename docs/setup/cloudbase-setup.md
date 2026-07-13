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
8. Create cloud storage folders for evidence files.

The Mini Program keeps `miniprogram/config/env.ts` as a placeholder until the real environment is confirmed. While `cloudEnvId` is `replace-with-cloudbase-env-id`, the frontend intentionally skips `wx.cloud.init()` and uses demo/fallback data.

## Deploy Order

Deploy lower-level functions first, then order workflow functions.

1. `auth-login`
2. `item-request-create`
3. `item-request-review`
4. `item-request-list`
5. `item-request-get`
6. `trip-create`
7. `trip-verify`
8. `trip-list`
9. `trip-get`
10. `match-search`
11. `offer-create`
12. `offer-accept`
13. `order-list`
14. `order-get`
15. `payment-confirm-mock`
16. `handover-confirm-scan`
17. `evidence-create`
18. `order-transition`
19. `dispute-open`

Each cloud function has its own `package.json`. In WeChat Developer Tools, upload and deploy each function folder under `cloudfunctions/`.

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

The field-level schema is defined in `docs/architecture/data-model.md`.

## First Admin Setup

Review functions use `users.roleFlags` for access control.

Bootstrap steps:

1. Log in once from the Mini Program profile page so `auth-login` creates a `users` record.
2. In CloudBase database console, find the record whose `openid` matches the operator.
3. Add `admin` or `reviewer` to `roleFlags`.
4. Use that account to call `item-request-review` and `trip-verify`.

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
- `pickupLocation.city`, `deliveryLocation.city`, `deadline`

### `trips`

- `travellerOpenid`, `createdAt`
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

For the initial MVP, prefer disabling direct frontend writes to all critical collections. Use cloud functions for create/update operations.

## Cloud Storage

Create these logical folders in CloudBase storage:

- `evidence/item-photo/`
- `evidence/handover/`
- `evidence/flight-record/`
- `evidence/customs-airline-proof/`
- `evidence/delivery/`
- `evidence/dispute/`

Rules:

- Store file ids in `evidence.fileIds`.
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

## Validation

Before deployment:

```bash
npm run check:files
npm run typecheck
```

After CloudBase deployment:

1. Run `auth-login` from the Mini Program profile page.
2. Create an item request and confirm `item_requests` plus `audit_logs` records.
3. Review the item request with `item-request-review` and confirm `reviewStatus: "approved"`.
4. Create a trip and confirm `trips` plus `audit_logs` records.
5. Verify the trip with `trip-verify`.
6. Confirm trip/request/order list pages load real records instead of demo fallback.
7. Run `match-search` and confirm only approved compatible requests appear.
8. Create an offer and accept it into an order.
9. Run mock payment and confirm `payments`.
10. Upload or mock evidence and confirm `evidence`.
11. Open a dispute and confirm `disputes` plus `audit_logs`.

## Known TODOs

- Add scripted collection/index initialization.
- Add CloudBase permission JSON exports once the target environment is confirmed.
- Add payment provider callback function before enabling real payment.
- Add admin UI or CloudBase CMS views for item requests, trips, and disputes.
- Add a storage upload wrapper so frontend stores file ids consistently.
