---
id: fe-layouts-l12-audit
title: L12 — Audit
description: Checks that Gate 1 produces inspectable block briefs and waits for a decision.
---

# L12 — Audit

Version: `1.00`

Audit a run with these checks:

1. Validate each candidate against `#/$defs/LayoutCandidate` and every set against
   `#/$defs/LayoutCandidateSet`.
2. Assert candidate count is three or four and ids are stable.
3. Assert each `plan` has exactly `business`, `main`, `extends`.
4. Compare every reuse `contract` and `css` with the frontend registry.
5. Reject any new/modified item without a full brief or proposed CSS label.
6. Reject any conditional/on-demand/unused item without `activationOrReason`.
7. Reject a Gate 2 record when its layout hash has no founder acceptance event.
8. Assert every accepted `extends` edge either has an approved dependent surface or remains queued.

Known debt: JSON Schema verifies shape but cannot prove a class string is byte-equal to the live
TypeScript registry; the runner must perform that source comparison.
