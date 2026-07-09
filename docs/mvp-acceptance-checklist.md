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
- [ ] Capacity is capped at 5kg.
- [ ] Acceptable categories must be selected from positive list.
- [ ] Overbroad notes such as "anything is okay" are rejected.
- [ ] `trip-create` creates `trips` record.
- [ ] `trip-create` creates `audit_logs` record.
- [ ] Trip list/detail can show the created or demo trip.

## Publish Item Request

- [ ] Requester can open item request creation page.
- [ ] Item name is required.
- [ ] Category must be positive-list only.
- [ ] Declared value is capped at CNY 2000.
- [ ] Estimated weight is capped at 5kg.
- [ ] Pickup and delivery cities are required.
- [ ] Deadline is required.
- [ ] Risk declaration must be accepted.
- [ ] `item-request-create` creates `item_requests` record.
- [ ] `item-request-create` creates `audit_logs` record.
- [ ] Request list/detail can show the created or demo request.

## Matching

- [ ] Matching page can load with `tripId` or `requestId`.
- [ ] `match-search` rejects missing target.
- [ ] Match result shows route, date window, category, capacity, score, and reasons.
- [ ] Matching excludes unreviewed or high-risk requests in real implementation.
- [ ] Matching reasons are understandable to both parties.

## Offer And Acceptance

- [ ] Traveller can open offer creation from a match.
- [ ] Service fee quote must be positive.
- [ ] Service fee quote is capped at CNY 500 for MVP.
- [ ] Offer copy says the quote is service fee only.
- [ ] `offer-create` creates `offers` record.
- [ ] `offer-create` creates `audit_logs` record.
- [ ] Request detail can accept pending offer.
- [ ] `offer-accept` creates `orders` record in `pending_payment`.
- [ ] `offer-accept` updates real offer to `accepted`.
- [ ] `offer-accept` creates `audit_logs` record.
- [ ] `offer-accept` rejects users who do not own the request.
- [ ] `offer-accept` rejects requests that are not approved.

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

## CloudBase Setup

- [ ] CloudBase environment id is configured.
- [ ] All required collections exist.
- [ ] Required indexes are created.
- [ ] Direct frontend writes to critical collections are disabled.
- [ ] Cloud storage folders for evidence exist.
- [ ] All cloud functions deploy successfully.
- [ ] Cloud function dependencies are installed/deployed.

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
