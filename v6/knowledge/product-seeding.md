# Product-state seeding

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.product-seeding` |
| Operations | `product-seed` |
| Search tags | `seed, fixture, state, reproducible, business evidence` |
| Dependencies | `fe.state-modeling` |

## Record

Browser proof is meaningful only when required product states can be reproduced from evidence-backed fixtures or safe setup operations.

Create the smallest deterministic seed for each required page and consequential state: default, loading completion, empty, populated, partial, validation, denied, failure, recovery, and success only when the state model requires them. A seed records business evidence, setup action, stable locator, expected state, cleanup or isolation, and a receipt.

Do not mutate shared production-like data, invent privileged accounts, bypass access control, or fake a terminal outcome solely for appearance. Missing safe setup is a blocker, not permission to downgrade proof. Seeds must be repeatable and must not depend on execution order or stale browser storage.
