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

The continuation also found no image-free migration apply branch in release.deploy, although that
operator already owned the migration effect and its shell grant. The bound backend had neither a
standalone migration command nor a CLI DataSource. The release extension therefore consumes a
source-owned, committed and quality-proved runner; it does not invent an existing CLI, start the
application to trigger schema synchronization, or give product DDL to platform's seed operation.

Independent review identified an authorization counterexample: a caller-selected connection could
match its own fingerprint while borrowing a nonproduction environment's name. The environment now
owns optional nonsecret migration target identities, and the plan pins its exact declaration bytes.
The gate matches the project, target, custody reference and full connection identity there. No
actual environment declaration or approval default was changed during this runtime maintenance.
The owner's database username was also sealed. The declaration therefore supports its custody
reference plus an owner-prepared full connection commitment, without copying that value into a
portable file. The runner protocol still hashes the actual full identity privately. Independent
review reproduced the shared schema engine's oneOf sibling-constraint short circuit; nesting the
exclusive username choice under allOf preserves this branch's closed object checks. That bounded
schema fix does not claim the shared engine itself was repaired.
The executor also keeps the initially validated checkout identity across revalidation, so a changed
producer route cannot make it validate one checkout and then launch the runner from another.
The Nivo owner supplied its existing committed development compose declaration and separately
observed API-to-database mapping; a contradictory unused environment variable was not accepted as
the target merely because it was easy to read.

Other review counterexamples were a quality verdict with only optional failed/skipped gates and a
runner that exited before consuming stdin. The latter was reproduced on Windows as an unhandled
write EOF with a large JSON input. The release gate requires positive required-gate evidence, and
the transport handles stream failure without exposing raw child output or claiming no mutation
after an attempted apply. Protocol proofs distinguish read-only inspection, initial apply, preserved
prior journal rows, and a no-op replay; journal initialization is explicit.

A separate concurrent validation reproduction rejected one of two valid consumers because cycle
tracking used a process-wide Set. Invocation-scoped async tracking preserves recursive cycle
rejection without treating an independent validation as a cycle. This is an enforcement repair,
not a new operational rule or a claim of a second production incident.
