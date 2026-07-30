# MVP Acceptance Checklist

Use this checklist to decide whether the Mini Program MVP is ready for a controlled demo or pilot.

The MVP boundary is low-value, low-frequency, low-risk personal items only. It must not become a daigou, logistics, customs-clearance, or cross-border payment product.

## Product Boundary

- [ ] App copy does not claim customs safety, guaranteed delivery, or full compensation.
- [ ] App copy does not describe platform-held merchandise payment.
- [ ] Rules page lists allowed low-risk categories.
- [ ] Rules page lists prohibited categories.
- [ ] Service-fee payment is clearly labeled as service fee only.
- [ ] Mock payment is clearly marked as mock/TODO.

## User And Login

- [ ] User can open profile page.
- [ ] User can run mock WeChat login.
- [ ] `users` record is created or updated.
- [ ] Verification status is displayed.
- [ ] Unverified status does not imply completed real-name verification.

## Publish Trip

- [ ] Traveller can open trip creation page.
- [ ] Required route fields are validated.
- [ ] Departure and arrival dates are validated.
- [ ] Arrival date cannot be earlier than departure date.
- [ ] Capacity is capped at 5kg.
- [ ] Acceptable categories must be selected from positive list.
- [ ] Overbroad notes such as "anything is okay" are rejected.
- [ ] `trip-create` creates `trips` record.
- [ ] `trip-create` creates `audit_logs` record.
- [ ] Missing flight number enters manual review instead of implying verified travel.
- [ ] `trip-verify` rejects non-admin/non-reviewer callers.
- [ ] `trip-verify` updates `verificationStatus` and creates `audit_logs` record.
- [ ] Trip list/detail can show the created or demo trip via `trip-list` and `trip-get`.
- [ ] Trip owner can edit from detail; saving returns the trip to verification and cancels pending offers.
- [ ] Trip owner can delete from detail after destructive confirmation; deletion is soft and audited.
- [ ] Trip update/delete rejects non-owners and trips with any linked order.

## Publish Item Request

- [ ] Requester can open item request creation page.
- [ ] Item name is required.
- [ ] Category must be positive-list only.
- [ ] Declared value is capped at CNY 2000.
- [ ] Estimated weight is capped at 5kg.
- [ ] Pickup and delivery cities are required.
- [ ] Deadline is required.
- [ ] Deadline must be a valid date.
- [ ] Risk declaration must be accepted.
- [ ] Requester must select 1 to 6 item images; each image is no larger than 5 MB.
- [ ] Selected images can be previewed and removed before submission.
- [ ] Submit uploads images to CloudBase, shows progress, and prevents duplicate taps.
- [ ] Partial upload failure preserves successful file ids for retry.
- [ ] `item-request-create` rejects missing photos, more than 6 photos, local paths, and non-`cloud://` ids.
- [ ] `item_requests.itemPhotos` contains only CloudBase file ids.
- [ ] Request detail renders and previews stored item images.
- [ ] Request-create audit log records `itemPhotoCount` without duplicating image content.
- [ ] Risk flags are stored for MVP cap/category/photo state.
- [ ] `item-request-create` creates `item_requests` record.
- [ ] `item-request-create` creates `audit_logs` record.
- [ ] `item-request-review` rejects non-admin/non-reviewer callers.
- [ ] `item-request-review` updates `reviewStatus` and creates `audit_logs` record.
- [ ] Request list/detail can show the created or demo request via `item-request-list` and `item-request-get`.
- [ ] Request owner can edit from detail; saving returns the request to review and cancels pending offers.
- [ ] Request owner can delete from detail after destructive confirmation; deletion is soft and audited.
- [ ] Request update/delete rejects non-owners and requests with any linked order.

## Matching

- [ ] Matching page can load with `tripId` or `requestId`.
- [ ] `match-search` rejects missing target.
- [ ] Match result shows route, date window, category, capacity, score, and reasons.
- [ ] Real matching excludes unreviewed requests.
- [ ] Real matching excludes inactive trips.
- [ ] Real matching and offers exclude trips awaiting verification after creation or edit.
- [ ] Real matching excludes incompatible route/date/category/capacity candidates.
- [ ] Real matching rejects non-owners for `tripId` or `requestId` search.
- [ ] Matching reasons are understandable to both parties.

## Offer And Acceptance

- [ ] Traveller can open offer creation from a match.
- [ ] Service fee quote must be positive.
- [ ] Service fee quote is capped at CNY 500 for MVP.
- [ ] Offer copy says the quote is service fee only.
- [ ] `offer-create` rejects non-owners of the trip.
- [ ] `offer-create` rejects self-offers.
- [ ] `offer-create` rejects unapproved requests and inactive trips.
- [ ] `offer-create` rejects incompatible route/date/category/capacity candidates.
- [ ] `offer-create` creates `offers` record.
- [ ] `offer-create` creates `audit_logs` record.
- [ ] Request detail can accept pending offer.
- [ ] `offer-accept` creates `orders` record in `pending_payment`.
- [ ] `offer-accept` updates real offer to `accepted`.
- [ ] `offer-accept` creates `audit_logs` record.
- [ ] `offer-accept` rejects users who do not own the request.
- [ ] `offer-accept` rejects requests that are not approved.
- [ ] Order list can show requester/traveller related real orders via `order-list`.
- [ ] Order detail action buttons use the current order id, not a fixed demo id.

## Mock Payment

- [ ] Pending-payment order shows payment action.
- [ ] Payment page shows service fee, platform fee, and total.
- [ ] Payment page clearly says current payment is mock.
- [ ] `payment-confirm-mock` creates `payments` record.
- [ ] Payment record uses `provider: "mock"`.
- [ ] Payment record uses `paymentStatus: "paid"` and `lockStatus: "locked"`.
- [ ] Backend transition to `paid_locked` is implemented or tracked as explicit TODO.
- [ ] Payment audit log is implemented or tracked as explicit TODO.

## Handover

- [ ] Paid-locked order shows handover action.
- [ ] Handover page shows confirmation code.
- [ ] User must complete all checklist items before confirming.
- [ ] User can navigate to upload handover evidence.
- [ ] `handover-confirm-scan` creates `handover_records` record.
- [ ] `handover-confirm-scan` creates `audit_logs` record.
- [ ] Transition to `item_handed_to_carrier` is implemented or tracked as explicit TODO.
- [ ] Handover code ownership/expiry validation is implemented or tracked as explicit TODO.

## Evidence

- [ ] Evidence page supports all required evidence types.
- [ ] User can choose image/video.
- [ ] User cannot submit evidence without files.
- [ ] `evidence-create` validates evidence type.
- [ ] `evidence-create` rejects non-participants.
- [ ] `evidence-create` creates `evidence` record.
- [ ] `evidence-create` creates `audit_logs` record.
- [ ] CloudBase storage file id upload is implemented or tracked as explicit TODO.
- [ ] Every evidence record stores a canonical `storagePath` or an explicit non-file system marker.
- [ ] Evidence records are append-only.

## Order Lifecycle

- [ ] Order state labels match canonical `OrderStatus`.
- [ ] `order-transition` rejects illegal transitions.
- [ ] `order-transition` rejects non-participants.
- [ ] Every transition creates `audit_logs` record.
- [ ] Transition audit logs can include `evidenceIds` and `operationId`.
- [ ] Evidence-gated transitions are implemented or tracked as explicit TODO.
- [ ] Active dispute blocks completion.
- [ ] Cancel/refund behavior is explicit before launch.

## Dispute

- [ ] User can open dispute page from order detail.
- [ ] Dispute reason is required.
- [ ] Dispute description is required.
- [ ] User can add evidence before submitting dispute.
- [ ] `dispute-open` creates `disputes` record.
- [ ] `dispute-open` creates `audit_logs` record.
- [ ] Order transition to `disputed` is implemented or tracked as explicit TODO.
- [ ] Admin dispute decision function is implemented or tracked as explicit TODO.
- [ ] Refund decision applies only to service fee.

## Supervised In-App Chat

- [ ] Chat is available only after an accepted offer creates an order.
- [ ] Conversation is unique per `orderId` and accessible only to requester, traveller, and authorized admin/reviewer roles.
- [ ] Initial chat supports text/system messages only; transaction images/videos use evidence upload.
- [ ] `chat-message-send` validates participant, conversation state, <= 500 characters, rate limit, idempotency, and content safety server-side.
- [ ] Messages use server time and remain append-only; users cannot edit, recall, overwrite, or physically delete them.
- [ ] Realtime `watch()` is participant-scoped, closes on page unload, and has a bounded polling fallback.
- [ ] Loading, empty, reconnecting, sending, blocked, under-review, error, and read-only states are visible.
- [ ] A participant can report a message; a third party cannot.
- [ ] Admin review records admin, reason, action, target ids, and timestamp without deleting the source message.
- [ ] `chat-evidence-snapshot` creates immutable `in_app_chat` evidence with order, uploader/system identity, storage path/file id, visibility, message range, hash, and timestamp.
- [ ] Chat evidence can be linked to `disputes.evidenceIds` and later moderation does not mutate old snapshots.
- [ ] Chat UI displays platform storage/moderation notice and never exposes raw openids or admin-only notes.

## CloudBase Setup

- [ ] CloudBase environment id is configured.
- [ ] Placeholder env id skips cloud initialization and keeps demo fallback working.
- [ ] All required collections exist.
- [ ] Required indexes are created.
- [ ] Direct frontend writes to critical collections are disabled.
- [ ] Cloud storage folders for `item-requests/`, evidence, and chat transcript snapshots exist as applicable.
- [ ] All cloud functions deploy successfully.
- [ ] Cloud function dependencies are installed/deployed.
- [ ] First admin/reviewer user is bootstrapped in `users.roleFlags`.

## Frontend Quality

- [ ] Home page shows publish trip and publish request entries.
- [ ] Main list pages have loading, empty, error, and content states planned.
- [ ] Buttons and text align correctly on mobile.
- [ ] Long Chinese/English strings do not overflow.
- [ ] Fixed or bottom actions respect safe area.
- [ ] Risk and payment copy stays inside MVP boundary.

## Validation Commands

Run before every demo build:

```bash
npm run check:files
npm run typecheck
```

Acceptance requires both commands to pass.

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
9. Upload evidence.
10. Open dispute or complete order path.

Minimum risk path:

1. Try prohibited/high-risk item category.
2. Try over-weight item.
3. Try over-value item.
4. Try broad trip note such as "anything is okay".
5. Try illegal order transition.
6. Try dispute without description.
