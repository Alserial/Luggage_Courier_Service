---
name: item-request-skill
description: Use this skill when implementing or modifying item request publishing flows for the cross-border carrying Mini Program, including item category review, declared value, weight, pickup, delivery, deadline, and risk declaration.
---

# Item Request Skill

Use this skill for B-side item demand publishing.

## Required Fields

- itemName
- category
- quantity
- declaredValue
- estimatedWeightKg
- estimatedSize
- purchaseMethod
- pickupLocation
- deliveryLocation
- deadline
- itemPhotos
- riskDeclarationAccepted

## Positive List Principle

MVP should only allow clearly low-risk categories. Unknown categories should go to manual review.

## Prohibited By Default

- prescription medicine
- tobacco, vape, alcohol
- food, fresh goods, meat, seeds, plants, animal products
- luxury goods above the MVP value cap
- cash, stored-value cards, financial instruments
- weapons, controlled goods, chemicals
- counterfeit goods
- items requiring customs permits

## Output

When modifying code, create validation, review status, upload flow, and category whitelist logic.
