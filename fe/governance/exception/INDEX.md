---
id: fe-governance-exception-index
title: INDEX.md
slug: /fe/governance/exception
sidebar_label: exception
sidebar_position: 0
description: Machine-oriented rules for named, local, evidence-backed design exceptions.
---

# INDEX.md

Version: `1.02`

Vietnamese guide: [vi.md](vi.md) · Human examples: [example.md](example.md)  
Governance: [audit.md](audit.md) · Version history: `changelog.md`

## Objective

Keep a justified exception local. A special case MUST NOT silently widen a reusable rule for every
ordinary screen.

## Load Policy

1. Apply this file when a screen cannot satisfy a reusable design rule without losing a real relationship.
2. Read `vi.md` to test whether the case is truly exceptional.
3. Read `example.md` for concrete/UI cases.
4. Do not load `audit.md` or `changelog.md` during ordinary implementation.

## Admission Test

An exception is valid only when all fields are present:

```text
name: <specific composition or relationship>
scope: <single flow, surface, or product context>
generic rule: <rule that remains unchanged>
evidence: <relationship the generic shape cannot express>
local decision: <minimal difference>
non-transfer rule: <why other screens receive no permission>
exit condition: <when the exception can be removed or reconsidered>
```

Missing any field means the request is not yet an exception; keep the generic rule unchanged.

## Invariants

- Every exception is named.
- Scope is explicit and narrow.
- The generic rule remains closed.
- Only the seam/choice supported by evidence may differ.
- Copying an exception to another screen is forbidden; re-evaluate and name separately.
- Product vocabulary is translated at its boundary; infrastructure names do not redefine UI language.
- An exception record carries an exit condition and a review owner.

## Decision Procedure

1. Try the generic rule without redesigning the relationship.
2. If it works, reject the exception.
3. If it fails, describe the relationship it cannot express.
4. Name and scope the minimal local difference.
5. State what remains generic and what other screens are explicitly not allowed to copy.
6. Record removal/review conditions.

## Version Rule

Increment accepted module changes by `0.01`; update every module record. Audit remains advisory.
