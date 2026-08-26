# `fe/ux-ui-resolve` input

This operator owns one UX/UI feedback lifecycle boundary. In `plan`, it converts exact failed UAT evidence into an approved repair contract. In `close`, it closes only those exact requests whose repaired variants passed a later UAT run.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| root state | Product-UAT state machine | Select `ready` for planning or `verify` for proof-backed closure. |
| `payload.provided` | Prior UAT state | Freeze the UAT report, request identities, phase, and any prior resolution and repair receipts. |
| `payload.loads.upstream` | Session runtime | Resolve only the exact UAT report, prior resolution, and repair receipts required by the phase. |
| `payload.loads.knowledge` | Runtime resolver | Bind the narrow product-proof, UI-review, request-lifecycle, and state-accessibility laws. |
| `payload.loads.exactTargets` | Runtime resolver | Bind each request path, current hash, status, and read-write access. |
| `payload.session` | Current task | Hold input, output, repair draft, and evidence until the parent skill reaches a terminal. |

No raw source tree is an input. Source inspection and mutation belong to the downstream repair skill named by the emitted handoff.
