# Execute E2E Test

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@e2e-testing` | `fe.e2e-testing` | qdrant | prove the connected journey boundary and cleanup |
| `@seed` | `fe.product-seeding` | qdrant | materialize reproducible states safely |
| `@state` | `fe.state-modeling` | qdrant | bind assertions to evidenced business state ownership |
| `@source-fe` | `knowledge/references/starci-academy-fe.json` | file | inspect the smallest relevant FE harness and transport precedent |
| `@source-be` | `knowledge/references/starci-academy-be.json` | file | inspect the smallest relevant BE harness, persistence, and auth precedent |

## Steps

1. Run `validate-input.mjs`; stop before services, credentials, or data are touched on failure.
2. Verify FE and BE workspace routes, heads, manifests, immutable references, Qdrant virtual roots, seed hash, and isolated environment.
3. Start only manifest-owned dependencies required by the scenario. Never point at production or shared mutable data.
4. For each selected journey transition: set up through the declared seed operation, act through the public boundary, assert the user/business-visible result and persistence, then reset.
5. Capture sanitized service logs, request/response metadata, persistence evidence, scenario counts, and cleanup receipts. Status alone is not the outcome assertion.
6. Stop on stale service state, skipped scenarios, hidden retries, data leakage, or incomplete reset.
7. Run `validate-output.mjs`; never emit incomplete connected proof.

Do not repair source here. Return typed repair or blocked evidence to the graph.
