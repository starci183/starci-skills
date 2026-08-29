# Product-state seeding

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.product-seeding` |
| Operators | `product-seed` |
| Search tags | `seed, fixture, state, reproducible, business evidence` |
| Dependencies | `fe.state-modeling` |

## Record

Browser proof is meaningful only when required product states can be reproduced from evidence-backed fixtures or safe setup operations.

Create the smallest deterministic seed for each consequential product state selected by the flow compiler. A meaningful populated render may require run-namespaced records across several related tables or services; that is valid fixture preparation only when it completes before Browser execution, stays inside the declared case namespace, and does not create the business outcome under test. A seed records business evidence, setup action, stable locator, expected state, cleanup or isolation, and a receipt.

Validate account names, emails, identifiers, foreign keys and other fixture values against every physical-store constraint before creating the first external identity. A partial Keycloak-or-database identity caused by a predictable length or schema mismatch is a fixture-preflight failure, not useful product evidence.

Do not mutate shared production-like data, invent privileged accounts, bypass access control, or fake a terminal outcome solely for appearance. Missing safe setup is a blocker, not permission to downgrade proof. Seeds must be repeatable and must not depend on execution order or stale browser storage.
