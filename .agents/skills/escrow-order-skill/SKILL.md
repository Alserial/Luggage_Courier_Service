---
name: escrow-order-skill
description: Use this skill when implementing order state machines, service-fee payment, settlement placeholders, refund flows, and payment-related backend interfaces for the cross-border carrying Mini Program.
---

# Escrow Order Skill

Use this skill for order lifecycle and payment-state logic.

## Important Compliance Boundary

Do not implement real platform-held escrow without confirmed payment-provider and legal setup. Use mock or provider-facing abstractions only.

## Order States

- draft
- pending_review
- approved
- pending_payment
- paid_locked
- item_handed_to_carrier
- in_transit
- arrived
- delivered
- completed
- disputed
- cancelled
- refunded

## Required Transitions

- `approved -> pending_payment`
- `pending_payment -> paid_locked`
- `paid_locked -> item_handed_to_carrier`
- `item_handed_to_carrier -> in_transit`
- `in_transit -> arrived`
- `arrived -> delivered`
- `delivered -> completed`
- any active state -> disputed
- allowed pre-handover states -> cancelled/refunded

## Rules

- All transitions must be auditable.
- Payment callbacks must be verified server-side.
- Settlement must be represented as provider-driven payout or manual admin action until compliance is confirmed.
- Refund rules must be explicit.

## Output

When modifying code, create typed state machines, backend-only payment handlers, and tests for illegal transitions.
