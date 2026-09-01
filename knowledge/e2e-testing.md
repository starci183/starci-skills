# End-to-end testing

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.e2e-testing` |
| Contract revision | `7.6.0` |
| Operators | `test/e2e` |
| Search tags | `e2e test, frontend backend contract, database, authentication, seeded journey, api boundary` |
| Dependencies | `fe.product-seeding, fe.state-modeling` |

## Record

End-to-end proof exercises the connected application boundary with real routing, serialization,
authentication policy, persistence behavior, and reversible test data. For frontend delivery it is
quality evidence after blind UI PASS and before product UAT; it does not create a visible E2E stage,
repair loop, or second test-only business flow.

Resolve FE and BE source references separately. Their immutable source is precedent for harness and boundary shape, not authority for current product behavior. Commands, services, ports, routes, and setup/reset procedures come from verified workspace manifests and environment receipts.

Each required journey transition must identify its setup, action, observable result, persistence or API evidence, and reset. A green response code alone is insufficient when the journey promises a state change. Shared or production data, hidden credentials, incomplete cleanup, stale services, skipped scenarios, and partial page coverage stop the chain.
