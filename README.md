# Luggage Courier Service

Cross-border peer-to-peer carrying/helping WeChat Mini Program MVP foundation.

## Scope

This project is scoped as a low-risk matching and transaction-record platform. It is not a universal daigou service, logistics platform, customs-clearance service, or cross-border payment platform.

## Codex Project Setup

Project-level Codex guidance lives in:

- `AGENTS.md`
- `.agents/skills/`
- `docs/setup/codex-skills-install-report.md`
- `docs/architecture/order-state-machine.md`

Only project-specific Codex settings and skills should be committed here. User-level or machine-level Codex configuration should stay outside this repository.

## Compliance Boundary

Do not implement real platform-held escrow, automatic payout, payment custody, or settlement production logic until payment-provider, legal, and operational rules are confirmed.
