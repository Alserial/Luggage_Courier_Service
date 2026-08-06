# MVP Acceptance Checklist

Use this checklist to decide whether the Mini Program MVP is ready for a controlled demo or pilot.

The MVP boundary is low-value, low-frequency, low-risk personal items only. It must not become a daigou, logistics, customs-clearance, or cross-border payment product.

Verification status as of 2026-08-06:

- `[x]` means the behavior is implemented and verified by source review, local automated checks, or the recorded test-environment deployment.
- `[ ]` means it still requires target CloudBase inspection, real-account/device acceptance, or an outstanding implementation.

## Product Boundary

- [x] App copy does not claim customs safety, guaranteed delivery, or full compensation.
- [x] App copy does not describe platform-held merchandise payment.
- [x] Rules page lists allowed low-risk categories.
- [x] Rules page lists prohibited categories.
- [x] Service-fee payment is clearly labeled as service fee only.
- [x] Mock payment is clearly marked as mock/TODO.

## User And Login

- [x] User can open profile page.
- [x] User can run mock WeChat login.
- [x] `users` record is created or updated.
- [x] Verification status is displayed.
- [x] Unverified status does not imply completed real-name verification.

## Publish Trip

- [x] Traveller can open trip creation page.
- [x] Required route fields are validated.
- [x] Departure and arrival dates are validated.
- [x] Arrival date cannot be earlier than departure date.
- [x] Capacity is capped at 5kg.
- [x] Acceptable categories must be selected from positive list.
- [x] Overbroad notes such as "anything is okay" are rejected.
- [x] `trip-create` creates `trips` record.
- [x] `trip-create` creates `audit_logs` record.
- [x] Missing flight number enters manual review instead of implying verified travel.
- [x] `trip-verify` rejects non-admin/non-reviewer callers.
- [x] `trip-verify` updates `verificationStatus` and creates `audit_logs` record.
- [x] Trip list/detail can show the created or demo trip via `trip-list` and `trip-get`.
- [x] Trip owner can edit from detail; saving returns the trip to verification and cancels pending offers.
- [x] Trip owner can delete from detail after destructive confirmation; deletion is soft and audited.
- [x] Trip update/delete rejects non-owners and trips with any linked order.

## Publish Item Request

- [x] Requester can open item request creation page.
- [x] Item name is required.
- [x] Category must be positive-list only.
- [x] Declared value is capped at CNY 2000.
- [x] Estimated weight is capped at 5kg.
- [x] Pickup and delivery cities are required.
- [x] Deadline is required.
- [x] Deadline must be a valid date.
- [x] Risk declaration must be accepted.
- [x] Requester must select 1 to 6 item images; each image is no larger than 5 MB.
- [x] Selected images can be previewed and removed before submission.
- [x] Submit uploads images to CloudBase, shows progress, and prevents duplicate taps.
- [x] Partial upload failure preserves successful file ids for retry.
- [x] `item-request-create` rejects missing photos, more than 6 photos, local paths, and non-`cloud://` ids.
- [x] `item_requests.itemPhotos` contains only CloudBase file ids.
- [x] Request detail renders and previews stored item images.
- [x] Request-create audit log records `itemPhotoCount` without duplicating image content.
- [x] Risk flags are stored for MVP cap/category/photo state.
- [x] `item-request-create` creates `item_requests` record.
- [x] `item-request-create` creates `audit_logs` record.
- [x] `item-request-review` rejects non-admin/non-reviewer callers.
- [x] `item-request-review` updates `reviewStatus` and creates `audit_logs` record.
- [x] Request list/detail can show the created or demo request via `item-request-list` and `item-request-get`.
- [x] Request owner can edit from detail; saving returns the request to review and cancels pending offers.
- [x] Request owner can delete from detail after destructive confirmation; deletion is soft and audited.
- [x] Request update/delete rejects non-owners and requests with any linked order.

## Matching

- [x] Matching page can load with `tripId` or `requestId`.
- [x] `match-search` rejects missing target.
- [x] Match result shows route, date window, category, capacity, score, and reasons.
- [x] Real matching excludes unreviewed requests.
- [x] Real matching excludes inactive trips.
- [x] Real matching and offers exclude trips awaiting verification after creation or edit.
- [x] Real matching excludes incompatible route/date/category/capacity candidates.
- [x] Real matching rejects non-owners for `tripId` or `requestId` search.
- [x] Matching reasons are understandable to both parties.

## Offer And Acceptance

- [x] Traveller can open offer creation from a match.
- [x] Service fee quote must be positive.
- [x] Service fee quote is capped at CNY 500 for MVP.
- [x] Offer copy says the quote is service fee only.
- [x] `offer-create` rejects non-owners of the trip.
- [x] `offer-create` rejects self-offers.
- [x] `offer-create` rejects unapproved requests and inactive trips.
- [x] `offer-create` rejects incompatible route/date/category/capacity candidates.
- [x] `offer-create` creates `offers` record.
- [x] `offer-create` creates `audit_logs` record.
- [x] Request detail can accept pending offer.
- [x] `offer-accept` creates `orders` record in `pending_payment`.
- [x] `offer-accept` updates real offer to `accepted`.
- [x] `offer-accept` creates `audit_logs` record.
- [x] Double-tapping accept creates only one deterministic order.
- [x] `offer-accept` rejects users who do not own the request.
- [x] `offer-accept` rejects requests that are not approved.
- [x] Order list can show requester/traveller related real orders via `order-list`.
- [x] Order detail action buttons use the current order id, not a fixed demo id.

## Mock Payment

- [x] Pending-payment order shows payment action.
- [x] Payment page shows service fee, platform fee, and total.
- [x] Payment amount is loaded from `order-get`; the frontend does not submit an amount.
- [x] Payment page clearly says current payment is mock.
- [x] `payment-confirm-mock` creates `payments` record.
- [x] Payment record uses `provider: "mock"`.
- [x] Payment record uses `paymentStatus: "paid"` and `lockStatus: "locked"`.
- [x] Backend transition to `paid_locked` is implemented or tracked as explicit TODO.
- [x] Payment audit log is implemented or tracked as explicit TODO.
- [x] Retrying the same payment operation creates only one payment/evidence/audit set.

## Handover

- [x] Paid-locked order shows handover action.
- [x] Handover page shows confirmation code.
- [x] User must complete all checklist items before confirming.
- [x] User can navigate to upload handover evidence.
- [x] Handover is blocked until linked `item_photo` evidence exists.
- [x] Handover automatically creates `handover_qr_scan` system evidence.
- [x] `handover-confirm-scan` creates `handover_records` record.
- [x] `handover-confirm-scan` creates `audit_logs` record.
- [x] Transition to `item_handed_to_carrier` is implemented or tracked as explicit TODO.
- [x] Handover code ownership/expiry validation is implemented or tracked as explicit TODO.

## Evidence

- [x] Evidence page supports the four user-uploadable evidence types; system-only types cannot be selected.
- [x] User can choose image/video.
- [x] Images are capped at 5 MB, videos at 20 MB, and no more than 6 files are accepted.
- [x] User cannot submit evidence without files.
- [x] `evidence-create` validates evidence type.
- [x] `evidence-create` rejects non-participants.
- [x] `evidence-create` creates `evidence` record.
- [x] `evidence-create` creates `audit_logs` record.
- [x] CloudBase storage upload completes for all files before `evidence-create` runs.
- [x] `evidence-create` rejects a file id outside `evidence/{orderId}/{operationId}/`.
- [x] Every evidence record stores a canonical `storagePath` or an explicit non-file system marker.
- [x] Evidence records are append-only.

## Order Lifecycle

- [x] Order state labels match canonical `OrderStatus`.
- [x] `order-transition` rejects illegal transitions.
- [x] `order-transition` rejects non-participants.
- [x] Every transition creates `audit_logs` record.
- [x] Transition audit logs can include `evidenceIds` and `operationId`.
- [x] Evidence-gated transitions are implemented or tracked as explicit TODO.
- [x] Active dispute blocks completion.
- [x] Cancel/refund behavior is explicit before launch.
- [x] Either participant can cancel `paid_locked` before handover with a reason; order cancellation, Mock service-fee refund, evidence, and audit commit atomically.
- [x] Traveller alone can advance `item_handed_to_carrier -> in_transit -> arrived -> delivered`.
- [x] Delivery requires `delivery_photo_or_video`; requester alone can confirm `delivered -> completed`.
- [x] Completion automatically creates `mutual_confirmation` evidence.
- [x] Participants cannot transition `disputed` or select `refunded`.

## Dispute

- [x] User can open dispute page from order detail.
- [x] Dispute reason is required.
- [x] Dispute description is required.
- [x] User can add evidence before submitting dispute.
- [x] `dispute-open` creates `disputes` record.
- [x] `dispute-open` creates `audit_logs` record.
- [x] Order transition to `disputed` is implemented or tracked as explicit TODO.
- [x] `dispute-decide` rejects non-admin/non-reviewers and requires reason plus reviewed evidence.
- [x] Final decisions require a second confirmation in the review UI.
- [x] Refund decision applies only to service fee.
- [x] One order cannot have two active disputes.

## Supervised In-App Chat

- [x] Chat is available only after an accepted offer creates an order.
- [x] Conversation is unique per `orderId` and accessible only to requester, traveller, and authorized admin/reviewer roles.
- [x] Initial chat supports text/system messages only; transaction images/videos use evidence upload.
- [x] `chat-message-send` validates participant, conversation state, <= 500 characters, rate limit, idempotency, and content safety server-side.
- [x] Messages use server time and remain append-only; users cannot edit, recall, overwrite, or physically delete them.
- [x] Realtime `watch()` is participant-scoped, closes on page unload, and has a bounded polling fallback.
- [x] Loading, empty, reconnecting, sending, blocked, under-review, error, and read-only states are visible.
- [x] A participant can report a message; a third party cannot.
- [x] Admin review records admin, reason, action, target ids, and timestamp without deleting the source message.
- [x] `chat-evidence-snapshot` creates immutable `in_app_chat` evidence with order, uploader/system identity, storage path/file id, visibility, message range, hash, and timestamp.
- [x] Chat evidence can be linked to `disputes.evidenceIds` and later moderation does not mutate old snapshots.
- [x] Chat UI displays platform storage/moderation notice and never exposes raw openids or admin-only notes.

## CloudBase Setup

- [x] CloudBase environment id is configured.
- [x] Missing config/network/function/response returns `cloud_unavailable` and never displays success.
- [x] Demo mode is default-off, frontend-only, and shows a visible banner when explicitly enabled.
- [x] Repository schema plan/check/apply commands cover all required collections and named indexes without destructive index replacement.
- [x] All 14 required collections exist in `luggage-d1ghv33fy2cb9ef96`.
- [x] Pilot-critical `evidence_order_created` and `disputes_status_updated` indexes are created with the documented field order.
- [x] Remaining named indexes from `scripts/setup-cloudbase.js` are defined and source-verified against cloud-function query patterns (added `messages_conversation_moderation_created`, `orders_requester_updated`, `orders_traveller_updated`, `orders_offer`); creation in CloudBase pending `npm run cloudbase:apply`.
- [x] Direct frontend writes to critical collections are disabled (verified: `miniprogram` performs no `db.collection().add/update/remove`; the only direct `db.collection().where()` is the read-only chat `watch()`). Console permission mode must still be set to 仅管理端可读写 for orders/payments/evidence/disputes/audit_logs.
- [ ] Real CloudBase uploads have produced and verified the `item-requests/`, `evidence/{orderId}/{operationId}/`, and chat snapshot prefixes.
- [x] All 33 cloud functions exist with normal status; `order-transition` and `evidence-create` were redeployed with cloud-side dependency installation on 2026-08-06.
- [x] Cloud function dependencies are installed/deployed.
- [ ] First admin/reviewer user is bootstrapped in `users.roleFlags` (pending live CloudBase write; `scripts/bootstrap-admin.js` and manual console steps in `docs/setup/cloudbase-setup.md` are ready — needs the operator openid and CloudBase write access).

## Frontend Quality

- [x] Home page shows publish trip and publish request entries.
- [x] Main list pages have loading, empty, error, and content states planned.
- [ ] Buttons and text align correctly on mobile.
- [ ] Long Chinese/English strings do not overflow.
- [ ] Fixed or bottom actions respect safe area.
- [x] Risk and payment copy stays inside MVP boundary.

## Validation Commands

Run before every demo build:

```bash
npm run check:files
npm run check:idempotency
npm run check:mutations
npm run check:workflow
npm run typecheck
```

Acceptance requires all commands to pass.

## Demo Path

Minimum happy path:

1. Login mock.
2. Publish trip.
3. Publish item request.
4. Search match.
5. Submit offer.
6. Accept offer.
7. Confirm mock service-fee payment.
8. Confirm handover.
9. Advance in transit and arrival.
10. Upload delivery proof and mark delivered.
11. Confirm completion as the requester.
12. Separately open and adjudicate a dispute with an admin/reviewer.

Minimum risk path:

1. Try prohibited/high-risk item category.
2. Try over-weight item.
3. Try over-value item.
4. Try broad trip note such as "anything is okay".
5. Try illegal order transition.
6. Try dispute without description.
