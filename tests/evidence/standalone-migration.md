# Standalone migration operation and frozen producer — 2026-09-04

The Nivo Setup UAT continuation prepared account, entity-shaped seed and rollback data, then
observed that the selected persistence boundary did not support the required UAT markers. The
bounded outcome needed a source migration, but both stack-model and mutations transport enums
only represented application endpoints or background execution. migrationRefs already existed;
there was no truthful standalone migration operation. A worker or public API would have changed
the outcome merely to satisfy the schema.

The existing migration concept was narrower than this outcome (UPDATE question 3), so its operation
representation now includes migration. It uses the same ownership, critique, writer, store,
transaction, idempotency, conformance and replay boundaries; it is not a general command grant.
The shared conditional operation shape is in stack-model.schema.json.$defs.migrationOperation.

Independent inspection of backend-source-apply/validate.mjs found that its old consistency checks
compared the receipt only with its own mutations output, not the architecture producer. A coherent
rewrite of both could evade that comparison. Migration requests now pin the exact stack-model bytes
and validate the completed producer and critique before source writes. Results compare every core
operation field to that producer. Nonmigration historical receipts retain their existing semantics;
the broader legacy producer-freeze gap is not claimed fixed by this bounded change.

Regressions cover accepted standalone architecture, backend apply/dry plans, prewrite fingerprint
and writer ceilings, coherent output tampering, changed producer bytes, missing producer or critique,
missing migration conformance/replay, and a real CLI subprocess consuming an imported producer.
Imported bundles retain request/response bytes, while the complete critique is validated at the
verified original producer rather than pretending it was copied with those directories.

These are observations from one operational case and its independent gate review, not two invented
operational incidents. No new knowledge rule is introduced. Source operation acceptance does not
authorize shared database DDL; the release owner must supply its own bounded apply path and approval.
