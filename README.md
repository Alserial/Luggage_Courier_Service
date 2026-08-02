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

## Project Documentation

- `docs/mini-program-development-guide.md`: product, frontend, backend, progress, and implementation roadmap.
- `docs/architecture/data-model.md`: canonical collections, fields, indexes, and access-control boundaries.
- `docs/architecture/cloud-functions-api.md`: implemented cloud-function contracts and remaining deployment TODOs.
- `docs/architecture/evidence-dispute-flow.md`: append-only evidence, handover, dispute, and chat-evidence rules.
- `docs/architecture/in-app-chat.md`: supervised order chat, moderation, realtime delivery, reporting, and transcript evidence.
- `docs/frontend/page-state-map.md`: current page states/actions, including item-photo upload and order chat.
- `docs/setup/cloudbase-setup.md`: environment, collections, indexes, permissions, storage, and deployment notes.
- `docs/mvp-test-guide.md` and `docs/mvp-acceptance-checklist.md`: executable test path and acceptance coverage.

Current feature status:

- Formal WeChat identity login is implemented with `wx.login`, CloudBase `OPENID`, backend user creation/update, and login audit records; no password or OpenID is stored in the Mini Program frontend.
- Request and trip tabs now provide a public marketplace plus "my posts" view. Public results contain only approved/verified, active, non-self records and omit publisher OpenIDs and private offer data.
- Request/trip marketplace results are cached per public/my scope. Tab switching reuses cache; network refresh occurs on first load, successful WeChat login, pull-down refresh, or explicit retry.
- Item-request image selection, preview, removal, CloudBase upload, backend validation, and request-detail gallery are implemented.
- Supervised text-only order chat, message reporting/admin review, and immutable transcript evidence are implemented in the repository; CloudBase collections, indexes, permissions, and functions still require deployment/configuration per the setup guide.
- The pilot order path now uses fail-closed cloud calls, server-authoritative Mock service-fee amounts, transactional/idempotent mutations, real evidence uploads, role/evidence-gated fulfillment transitions, and admin-only dispute adjudication.
