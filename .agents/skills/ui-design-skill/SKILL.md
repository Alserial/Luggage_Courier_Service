---
name: ui-design-skill
description: Use this skill when implementing, redesigning, reviewing, or polishing UI for the cross-border carrying WeChat Mini Program, especially TDesign Mini Program pages and components for item requests, trip publishing, route matching, order states, evidence records, disputes, service-fee payment placeholders, mobile forms, empty states, status tags, list cards, or visual quality cleanup. It adapts baseline UI polish to this project's low-risk MVP boundary and trust-focused transaction flows.
---

# UI Design Skill

Use this skill to make the Mini Program feel trustworthy, calm, mobile-native, and well finished.

## Core Workflow

1. Read the target page, component, style files, and nearby patterns before editing.
2. Prefer existing project conventions and TDesign Mini Program components.
3. Pair this skill with the relevant domain skill when the UI touches item requests, trips, matching, orders, escrow, evidence, or disputes.
4. Keep the product boundary visible: limited low-risk matching and transaction records, not daigou, logistics, customs clearance, or cross-border payments.
5. Finish by checking mobile layout, loading/error/empty states, critical action evidence, and compliance-sensitive copy.

## Product Tone

- Make screens feel clear, restrained, and service-oriented.
- Avoid luxury shopping, express logistics, guaranteed delivery, customs safety, or full-compensation language.
- Use copy that sets expectations: review, confirmation, records, evidence, limited support, and user responsibility.
- Keep primary actions obvious without making risky actions feel frictionless.
- Prefer useful detail over decorative hero sections.

## Visual Baseline

- Use a consistent spacing rhythm in `rpx`; prefer 16, 24, 32, and 48 `rpx` gaps.
- Keep page backgrounds quiet and neutral; use white or very light surface blocks for content groups.
- Avoid purple gradients, multicolor gradients, glow effects, decorative blobs, and heavy shadows.
- Use one primary accent per view, plus semantic colors for status and risk.
- Use cards only for repeated list items or clearly framed tools; do not nest cards inside cards.
- Keep border radius modest, generally 8 to 16 `rpx` unless TDesign sets it.
- Make headings short and scannable; use body text for explanations.
- Do not use negative letter spacing or viewport-scaled font sizes.
- Clamp or wrap long item names, addresses, and flight numbers so text never overlaps controls.
- Use tabular number styling where the stack supports it for prices, weights, dates, and counters.

## TDesign Mini Program

- Prefer TDesign Mini Program components for forms, buttons, tags, tabs, uploaders, dialogs, toasts, steps, cells, and empty states.
- Verify the project's installed TDesign component names before introducing new tags.
- Use icon buttons only when the icon meaning is familiar; otherwise pair icon and text.
- Use destructive confirmation dialogs for cancel, refund, dispute escalation, delete, and irreversible submission actions.
- Use skeletons or structured loading placeholders for lists and detail screens.
- Show validation errors next to the field or action that caused them.
- Respect safe-area bottom spacing for sticky action bars.

## Information Architecture

- Put the current state, next required action, and risk/review status near the top of detail pages.
- Put secondary history, audit records, and supporting evidence lower on the page but keep them easy to find.
- Show one primary action per screen area; demote secondary actions to outline, text, or overflow patterns.
- Prefer segmented controls or tabs for switching between demand, trip, match, evidence, and order views.
- Make empty states specific and actionable: tell the user what can be done next without over-explaining the product.

## Page Patterns

- Home: show publish demand, publish trip, active orders, and pending actions. Avoid marketing-style hero layouts.
- Item request form: group category, value, weight, pickup, delivery, deadline, photos, and risk declaration into clear sections.
- Trip publish form: group route, date, flight number, capacity, acceptable categories, and verification evidence.
- Matching list: emphasize route/date fit, item category, estimated weight, declared value band, review state, and quote action.
- Order detail: show state tag, next action, parties, route, item summary, evidence timeline, payment record placeholder, and dispute entry.
- Evidence page: show required evidence types as checklist/timeline items with upload state and audit metadata.
- Dispute page: separate issue summary, evidence submission, platform review status, and final decision record.

## State Tags

Use stable labels and semantic colors for order states:

- `draft`: neutral, "草稿"
- `pending_review`: warning, "待审核"
- `approved`: success, "已通过"
- `pending_payment`: warning, "待支付"
- `paid_locked`: primary, "已锁定"
- `item_handed_to_carrier`: primary, "已交接"
- `in_transit`: primary, "运输中"
- `arrived`: primary, "已到达"
- `delivered`: success, "已送达"
- `completed`: success, "已完成"
- `disputed`: danger, "争议中"
- `cancelled`: neutral, "已取消"
- `refunded`: neutral, "已退款"

Do not invent extra order states in UI. If an intermediate display state is needed, derive it from evidence or action availability while preserving the canonical state.

## Evidence UI

Represent required evidence types consistently:

- `item_photo`: "物品照片"
- `handover_qr_scan`: "交接扫码"
- `in_app_chat`: "站内沟通"
- `payment_record`: "服务费记录"
- `flight_record`: "行程凭证"
- `customs_or_airline_proof`: "海关/航司说明"
- `delivery_photo_or_video`: "送达照片/视频"
- `mutual_confirmation`: "双方确认"

For each evidence item, show type, status, time, actor, and related order state when available. Critical user actions should create or request an evidence record rather than being only visual state changes.

## Mobile Forms

- Use pickers, steppers, uploaders, switches, checkboxes, and segmented controls instead of loose text fields when values are structured.
- Use positive-list category selection; unknown or higher-risk categories should route to review, not look selectable by default.
- Put helper text under fields that affect review, risk, value cap, or allowed categories.
- Keep required field indicators visible but not noisy.
- Disable submit while saving, show progress, then show result feedback.
- Never place secrets, payment decisions, login decisions, review decisions, settlement decisions, or dispute decisions in frontend-only logic.

## Risk And Payment Copy

- Say "服务费记录", "支付占位", or "待接入合规支付服务" for payment placeholders.
- Do not imply the platform holds merchandise payments.
- Do not promise customs clearance, guaranteed delivery, or full platform compensation.
- Use "需审核", "可能被拒绝", "请保留凭证", and "以平台记录为准" where appropriate.

## Final Checks

- Confirm layout works on narrow WeChat mobile widths.
- Confirm fixed action bars leave safe-area space.
- Confirm long Chinese and English text does not overlap or overflow.
- Confirm every list, form, and detail page has loading, empty, error, and submitted states when relevant.
- Confirm UI copy preserves the MVP boundary and required order/evidence model.
- Run the project's available validation or build command after code changes when feasible.
