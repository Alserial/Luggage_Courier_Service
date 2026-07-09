---
name: match-order-skill
description: Use this skill when implementing route matching, quote matching, traveler-demand matching, and ranking logic for the cross-border carrying Mini Program.
---

# Match Order Skill

Use this skill to match traveler trips with item requests.

## Matching Priority

1. Same direction route
2. Compatible date window
3. Low-risk approved item category
4. Available luggage capacity
5. Acceptable handover location
6. Traveler trust score
7. Requester trust score
8. Price compatibility

## Rules

- Do not match unreviewed high-risk items.
- Do not match requests whose delivery deadline is earlier than arrival time.
- Do not hide risk warnings from either party.
- Keep matching explainable.

## Output

When modifying code, prefer deterministic scoring functions with comments and test cases.
