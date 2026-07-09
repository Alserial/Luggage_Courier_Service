# AGENTS.md

## Project Context

This repository is for a WeChat Mini Program MVP for a cross-border peer-to-peer carrying/helping platform. The platform should remain a limited-scope matching and transaction-record platform, not a universal daigou, logistics, customs-clearance, or cross-border payment service.

## Product Boundary

- Keep the MVP narrow: low-value, low-frequency, low-risk items only.
- Use positive-list item approval. Do not allow high-risk categories by default.
- Do not claim customs safety, guaranteed delivery, or full platform compensation.
- Do not implement platform-held merchandise payments.
- Service-fee payment and settlement should use compliant payment providers and remain mock/TODO until confirmed.

## Engineering Rules

- Never put secrets in Mini Program frontend code.
- Payment, login, settlement, review, and dispute decisions must be handled by backend/cloud functions.
- Prefer CloudBase cloud functions for WeChat Mini Program backend integration.
- Prefer TDesign Mini Program for UI unless the project already uses another UI system.
- Keep order state transitions explicit and auditable.
- All critical user actions should generate evidence records.

## Required Order States

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

## Required Evidence Types

- item_photo
- handover_qr_scan
- in_app_chat
- payment_record
- flight_record
- customs_or_airline_proof
- delivery_photo_or_video
- mutual_confirmation

## Before Changing Code

- Check `git status --short`.
- Avoid overwriting user work.
- Create a branch for setup changes when possible.
- Run install and validation commands after changes.
