---
id: fe-senses-hierarchy-index
title: INDEX.md
slug: /fe/senses/hierarchy
sidebar_label: hierarchy
sidebar_position: 0
description: Machine-oriented rules for deliberate reading order and emphasis.
---

# INDEX.md

Version: `1.02`

Vietnamese guide: [vi.md](vi.md) · Human examples: [example.md](example.md)  
Governance: [audit.md](audit.md) · Version history: `changelog.md`

## Objective

Make the first, second, and third things read match the order the task needs. A reader who leaves
after the first two elements MUST still understand the surface's point.

## Load Policy

1. Apply this file first.
2. Read `vi.md` for guided reasoning.
3. Read `example.md` for concrete/UI cases.
4. Do not load `audit.md` or `changelog.md` during ordinary implementation.

## Decision Procedure

1. Write the intended first, second, and third reads before styling.
2. Establish the group before ranking members inside it.
3. Select exactly one lead: what the surface exists for.
4. Carry rank by source position and size; use colour for semantic kind, not importance.
5. Demote competing elements; emphasis added to one element must be removed elsewhere.
6. Keep the same order across source/visual order, breakpoints, loading, empty, partial, and failed states.
7. Fit content by wrapping, reachable truncation, or editing; never lower rank to make text fit.

## Invariants

- One surface has one lead.
- Emphasis is relative and has a fixed budget.
- Visual order equals source order.
- Position and size carry rank before colour.
- Group first; rank only within an established group.
- Importance chooses size; available space does not.
- State changes MUST NOT reorder the surface.
- Use a shallow lead/support/detail hierarchy; avoid indistinguishable extra levels.
- A section heading names the point, not its component or mechanism.

## Review Output

```text
surface purpose: <one sentence>
first: <element and reason>
second: <element and reason>
third: <element and reason>
lead: <exactly one element>
source order equals visual order: yes | no
state parity: loading | empty | partial | error | ready
fit strategy: wrap | reachable-truncate | edit | not-needed
```

If two elements both claim the lead, demote one before implementation.

## Version Rule

Increment accepted module changes by `0.01`; update every module record. Audit remains advisory.
