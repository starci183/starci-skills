# Frontend final proof boundary

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.product-proof` |
| Contract revision | `7.6.0` |
| Operators | `fe/render-capture, fe/visual-fidelity` |
| Search tags | `final quality, UAT, source gates, journey proof, typed return, counterevidence` |
| Dependencies | `fe.audit-loop-v75b, fe.ui-render-review, fe.product-seeding` |

Final proof begins only after the latest-source blind review returns typed `PASS`. It consumes already
validated evidence and never substitutes for a missing capture, review, source gate, or journey run.

Run final gates in this order:

1. quality validates the exact delivered source revision, allowed boundary, lint/type/static gates,
   focused tests, accessibility/interaction evidence, and absence of weakened or skipped checks;
2. UAT consumes that quality receipt and validates the approved actor journey, seeded preconditions,
   Behavior/UX/UI outcome, recovery, persisted result, and exact source/runtime identities.

Quality and UAT are final-only and never mutate product source. Quality PASS returns to UAT; this
record adds no Quality-to-reapply edge beyond the existing typed Quality contract. UAT PASS returns to
completion. Fresh UAT counterevidence may return a single-use typed handoff to the exact frontend
`reapply` resume state; the caller reruns capture/preflight, blind review, Quality, and UAT on the new
source. UAT does not perform that repair. Replayed findings, unchanged progress, boundary drift, or a
non-frontend owner return their exact typed exit instead of a hidden loop.

Completion aggregates final blind PASS, final quality PASS, final UAT PASS, reproducible seed receipt,
source/runtime fingerprints, browser evidence, and audited handoff state. Green static gates cannot
rescue visual FAIL; a beautiful raster cannot rescue broken behavior; a prior PASS cannot certify a
new source revision.
