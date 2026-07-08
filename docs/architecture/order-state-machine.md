# Order State Machine

This document records the first project-level order lifecycle for the cross-border carrying Mini Program MVP.

## Compliance Boundary

The MVP must not implement real platform-held escrow, automatic payout, or platform custody of merchandise payments until payment-provider, legal, and settlement rules are confirmed. Payment-related code should stay behind backend interfaces, mocks, provider abstractions, and explicit TODO notes.

## States

- `draft`: Request or trip order is being prepared.
- `pending_review`: Item, route, price, or risk information is waiting for review.
- `approved`: The order is allowed to proceed.
- `pending_payment`: Service-fee payment is waiting for user action.
- `paid_locked`: Service fee is confirmed by provider callback or mock confirmation.
- `item_handed_to_carrier`: Handover has been confirmed through QR scan or equivalent evidence.
- `in_transit`: Carrier has started the trip with the item.
- `arrived`: Carrier has arrived at the destination city or handover point.
- `delivered`: Receiver has received the item, pending final confirmation.
- `completed`: Both sides or the platform have completed the order.
- `disputed`: A dispute is active and admin review is required.
- `cancelled`: Order was cancelled before completion.
- `refunded`: Eligible service-fee refund has been recorded.

## Core Transitions

- `approved -> pending_payment`
- `pending_payment -> paid_locked`
- `paid_locked -> item_handed_to_carrier`
- `item_handed_to_carrier -> in_transit`
- `in_transit -> arrived`
- `arrived -> delivered`
- `delivered -> completed`
- any active state -> `disputed`
- allowed pre-handover states -> `cancelled`
- eligible cancelled or disputed states -> `refunded`

## Audit Requirements

Every transition should record:

- orderId
- previousState
- nextState
- actorId
- actorRole
- timestamp
- reason
- evidenceIds
- requestId or operationId

## Required Evidence

- `item_photo`
- `handover_qr_scan`
- `in_app_chat`
- `payment_record`
- `flight_record`
- `customs_or_airline_proof`
- `delivery_photo_or_video`
- `mutual_confirmation`
