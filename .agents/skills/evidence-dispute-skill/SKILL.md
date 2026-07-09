---
name: evidence-dispute-skill
description: Use this skill when implementing evidence upload, dispute handling, admin review, proof standards, and audit logs for the cross-border carrying Mini Program.
---

# Evidence & Dispute Skill

Use this skill for evidence and dispute workflows.

## Evidence Types

- item_photo
- handover_qr_scan
- in_app_chat
- payment_record
- flight_record
- customs_or_airline_proof
- delivery_photo_or_video
- mutual_confirmation

## Rules

- Keep key communications inside the platform where possible.
- Each evidence record must include uploader, timestamp, orderId, evidenceType, storagePath, and visibility.
- Do not allow users to overwrite evidence. New uploads should create new records.
- Dispute decisions must be logged with adminId, reason, evidence references, and resulting order action.

## Output

When modifying code, create storage models, upload UI, audit logs, and admin review placeholders.
