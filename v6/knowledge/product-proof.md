# Product proof and repair classification

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.product-proof` |
| Operations | `product-proof` |
| Search tags | `browser proof, accessibility, gates, responsive, repair, boundary drift` |
| Dependencies | `fe.layout-composition, fe.product-seeding` |

## Record

Proof verifies the approved journey in connected product source, not a detached mockup.

Aggregate four already validated layers: reproducible seed receipts, focused unit evidence, connected E2E evidence, and real-user browser UI evidence. Verify their hashes, coverage, source boundary and approved direction agree. Product Proof never substitutes for or reruns a missing test operation.

Classify failure before changing code:

- `in-boundary-repair`: code, accessibility, wiring, or rendering is wrong while approved structure and ownership remain valid; return to implementation directly.
- `boundary-drift`: the correction changes layout direction, block responsibility, responsive transformation, persistent behavior, or source boundary; return to the existing layout approval checkpoint.
- `blocked`: environment, missing evidence, unsafe seeding, or unresolved Grammar gap prevents a valid verdict.
- `proof-pass`: all required scenarios and gates pass with traceable evidence.

There is no new creative approval after proof. Boundary drift reuses layout approval; business changes reuse flow approval.
