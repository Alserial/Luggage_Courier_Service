# Frontend Page State Map

This document maps Mini Program pages to displayed data, visible actions, and cloud functions.

Frontend pages should display state and collect input. Backend/cloud functions must make login, review, payment, settlement, order transition, and dispute decisions.

## Global UI Rules

- Use canonical order states from `OrderStatus`.
- Do not invent display-only order states that look like backend states.
- Show service-fee payment as service-fee only.
- Keep risk, review, and evidence prompts visible near critical actions.
- Use error messages next to the relevant action when possible.

## Page Map

### `pages/home/index`

Purpose:

- Entry screen for publishing trips and item requests.
- Shows MVP boundary and pending profile/rules reminder.

Displayed data:

- Static MVP rules from page data.
- Navigation entry labels.

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Publish trip | always visible | none, navigates to `pages/trips/create` |
| Publish request | always visible | none, navigates to `pages/requests/create` |
| View profile | always visible | none, switches to `pages/profile/index` |

### `pages/profile/index`

Purpose:

- Show user identity and verification status.
- Trigger mock login.

Displayed data:

- nickname
- verification status
- rule link

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| WeChat login mock | when not logged in or for refresh | `auth-login` |
| View rules | always visible | none, navigates to `pages/rules/index` |

### `pages/rules/index`

Purpose:

- Show platform/product boundary and category rules.

Displayed data:

- Allowed low-risk scope.
- Prohibited categories.
- Payment/customs boundary copy.

Actions:

- No critical backend action.

### `pages/trips/index`

Purpose:

- Show traveller's trip list/summary.

Displayed data:

- trip route
- departure date
- capacity
- trip display status

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Open trip detail | trip exists | none, navigates to detail |
| Publish trip | always visible | none, navigates to create |
| View matches | trip exists | `match-search` on matches page |

### `pages/trips/create`

Purpose:

- Capture traveller trip draft.

Displayed/input data:

- from/to city
- departure/arrival date
- flight number
- luggage capacity
- acceptable categories
- note

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Submit trip | local validation passes | `trip-create` |

Local validation:

- route required
- departure/arrival dates required
- capacity `> 0` and `<= 5`
- at least one acceptable category
- note must not claim broad "anything can be carried"

### `pages/trips/detail`

Purpose:

- Show trip detail and acceptable categories.

Displayed data:

- route
- departure/arrival dates
- flight number
- capacity
- acceptable categories

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| View matching requests | trip active | `match-search` on matches page |

### `pages/requests/index`

Purpose:

- Show requester's item requests.

Displayed data:

- item name
- route
- category
- review status

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Open request detail | request exists | none, navigates to detail |
| Publish request | always visible | none, navigates to create |
| View category rules | always visible | none |

### `pages/requests/create`

Purpose:

- Capture low-risk item request.

Displayed/input data:

- item name
- category
- quantity
- declared value
- estimated weight
- pickup/delivery city
- deadline
- note
- risk declaration

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Submit request | local validation passes | `item-request-create` |

Local validation:

- category must be positive-list
- value `> 0` and `<= 2000`
- weight `> 0` and `<= 5`
- risk declaration accepted

### `pages/requests/detail`

Purpose:

- Show request details, risk tags, and offer summary.

Displayed data:

- item name
- route
- category
- declared value
- estimated weight
- deadline
- risk flags
- offer quote

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Accept offer | offer status `pending`, request approved | `offer-accept` |

After success:

- Navigate to order detail or show order-created success in future implementation.

### `pages/matches/index`

Purpose:

- Show explainable match candidates.

Displayed data:

- route
- date window
- category
- capacity
- score
- match reasons

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Load matches | on page load with `tripId` or `requestId` | `match-search` |
| Create offer | match selected | none, navigates to `pages/offers/create` |

### `pages/offers/create`

Purpose:

- Traveller submits service-fee quote.

Displayed/input data:

- request summary
- route
- category and weight
- service fee quote
- message
- conditions

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Submit quote | fee `> 0` and `<= 500` | `offer-create` |

Copy boundary:

- Quote is for carrying service fee only.
- It does not include item purchase price.
- It does not guarantee customs clearance.

### `pages/orders/index`

Purpose:

- Show order list and MVP state machine reference.

Displayed data:

- item name
- route
- status label
- fee total
- status list

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Open order detail | order exists | `order-get` on detail page |

### `pages/orders/detail`

Purpose:

- Central order state, fee, evidence, payment, handover, and dispute entry.

Displayed data:

- item name
- route
- order status
- progress timeline
- fee breakdown
- tax rule
- next actions

Actions:

| Action | Visible when | Cloud function |
|---|---|---|
| Mock payment | `order.status === "pending_payment"` | navigates to payment page, then `payment-confirm-mock` |
| Handover confirmation | `order.status === "paid_locked"` | navigates to handover page, then `handover-confirm-scan` |
| Upload evidence | all active states | `evidence-create` on evidence page |
| Open dispute | all active states | `dispute-open` on dispute page |

Future state-gated actions:

- Move to `in_transit`
- Mark arrived
- Mark delivered
- Mutual confirmation
- Complete order

### `pages/payment/index`

Purpose:

- Confirm mock service-fee payment.

Displayed data:

- service fee
- platform fee
- total
- payment boundary warning

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Confirm mock payment | order in `pending_payment` | `payment-confirm-mock` |

Future backend behavior:

- Create payment record.
- Create payment audit log.
- Transition order to `paid_locked`.
- Create `payment_record` evidence.

### `pages/handover/index`

Purpose:

- Confirm handover with checklist and QR/mock code.

Displayed data:

- handover code
- order id
- checklist items

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Upload handover evidence | always visible | `evidence-create` with `handover_qr_scan` |
| Confirm handover | all checklist items complete | `handover-confirm-scan` |

Future backend behavior:

- Verify code ownership and expiry.
- Require evidence ids.
- Transition order to `item_handed_to_carrier`.

### `pages/evidence/upload`

Purpose:

- Capture evidence type, description, and media selection.

Displayed/input data:

- order id
- evidence type
- description
- selected local files

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Choose media | always visible | WeChat media picker |
| Save evidence | at least one selected file | `evidence-create` |

Future backend behavior:

- Upload to CloudBase storage first.
- Pass `fileIds`, not only `fileCount`.

### `pages/disputes/detail`

Purpose:

- Open dispute and link evidence.

Displayed/input data:

- dispute reason
- description
- evidence link entry

Actions:

| Action | Condition | Cloud function |
|---|---|---|
| Add evidence | always visible before submit | `evidence-create` on evidence page |
| Submit dispute | reason and description present | `dispute-open` |

Future backend behavior:

- Include evidence ids.
- Verify caller is participant.
- Transition order to `disputed`.

## State To Action Matrix

| Order state | Primary action | Secondary actions |
|---|---|---|
| `pending_review` | wait for review | upload/request evidence |
| `approved` | proceed to payment | cancel, dispute |
| `pending_payment` | pay service fee | cancel, dispute |
| `paid_locked` | confirm handover | upload evidence, dispute |
| `item_handed_to_carrier` | mark in transit | upload evidence, dispute |
| `in_transit` | mark arrived | upload evidence, dispute |
| `arrived` | confirm delivery | upload evidence, dispute |
| `delivered` | mutual confirmation | upload evidence, dispute |
| `completed` | view records | no normal dispute entry unless admin policy allows |
| `disputed` | wait/admin review | upload evidence |
| `cancelled` | view records | no normal actions |
| `refunded` | view records | no normal actions |

## Current Gaps

- List pages currently use demo data.
- Order detail has only payment, handover, evidence, and dispute actions.
- Evidence upload uses `fileCount` fallback instead of cloud file ids.
- Payment page does not transition order after mock payment yet.
- Dispute page does not pass evidence ids yet.
