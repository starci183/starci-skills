# `be/coding-scope-freeze` input

Freeze the exact backend target set for either a newly approved architecture boundary or an already approved repair. Delivery enters as `architecture.boundary.review / approved`; repair enters as `be.coding-scope / ready` and additionally supplies its prerequisite receipt. Both paths remain metadata-and-hash-only.

Receive one validated repair-prerequisite receipt, approved boundary, approval, business freshness receipt and baseline commit. The runtime may read repository metadata and calculate hashes only for declared targets. `repositoryContext` and `contentVisible` are always `false`; no file body enters model context.

## JSON architecture

| Section | Owner | Purpose |
| --- | --- | --- |
| `payload.provided` | prerequisite machine state | Immutable receipt and authority refs. |
| `payload.loads` | runtime | Exact session authority and hash-only source metadata. |
| `payload.session` | session runtime | Ephemeral input, output and scratch slots. |
