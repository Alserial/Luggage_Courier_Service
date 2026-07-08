---
name: trip-publish-skill
description: Use this skill when implementing or modifying traveler trip publishing flows for the cross-border carrying Mini Program, including departure city, arrival city, flight number, luggage capacity, acceptable item categories, and trip verification.
---

# Trip Publish Skill

Use this skill for A-side traveler journey publishing.

## Required Fields

- fromCountry
- fromCity
- fromAirportOrStation
- toCountry
- toCity
- toAirportOrStation
- departureTime
- arrivalTime
- flightNo
- luggageCapacityKg
- acceptableCategories
- unacceptableCategories
- handoverPreference
- note

## Rules

- Do not allow travelers to declare that they can carry anything.
- Require explicit route, date, and capacity.
- Treat flight number and ticket evidence as optional in early MVP but required before order confirmation.
- Do not expose sensitive identity documents in frontend logs.

## Output

When modifying code, create clear data models, validation functions, and UI forms for trip publishing.
