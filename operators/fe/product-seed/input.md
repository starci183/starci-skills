# Product Seed input

Product Seed receives implemented source plus the business-state contract that must be observable in proof. Its job is to make those states reproducible, not to design additional states.

The input validates against `input.schema.json` and enters only at `seed.materialize / ready` with `source-written`.

Each required state names:

- the page or Product Block that owns it;
- its `business` or `derived-block` provenance;
- the evidence reference that makes it true;
- the deterministic fixture, route, account, clock or service condition needed to observe it;
- whether it is sensitive.

Sensitive state includes money, access, entitlement, data loss, legal consequence and terminal outcome. Missing evidence for a sensitive state is unknown and blocking; it may not be replaced with plausible sample truth.

Seed writes must be isolated from production data, repeatable from a clean local state and removable through a declared reset operation.
