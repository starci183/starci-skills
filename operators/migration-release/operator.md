# migration.release

## Job

Apply one frozen source migration plan once to one declared non-production target through the
source-owned runner, and prove by a second invocation that nothing remains pending and the journal
did not move.

## Done when

Done when the `migration-release` and its `migration-release-proof` record the declared migration
set applied once through the source-owned runner with every prior journal row preserved, a second
invocation proving no pending migration and no journal change, and every value the runner resolved
kept out of the receipt, the logs and the proof.

## The plan is frozen before anything runs

A non-null `migration` requirement is the whole of what runs. Its `planRef` is
`request/migration-release.json`; its `sha256` freezes the exact bytes shaped by
`templates/kinds/migration-release-plan.schema.json`. The route input supplies the checkout, and the
backend source application and passing quality input prove the same source commit. The plan names
the exact migration files, a source-owned runner, its configuration, the connection custody reference,
and the migration journal boundary. The runner is written and proved by the backend owner before
this operator consumes it. A missing runner returns to that owner; this operator creates no runner.
A plan whose digest, environment declaration, target, producers or pinned files disagree with what
is on disk is `MIGRATION_PLAN_INVALID`, and nothing runs against it.

## Authority is the environment's release class

This operator is limited to an existing non-production environment and uses that environment's
`release` authorization class. The plan freezes the environment declaration bytes with
`environmentSha256` and matches exactly one `migrationTargets` entry by project, target and
connection reference. Its connection fingerprint and journal schema must match that authority. A
sealed `usernameRef` uses the environment owner's privately prepared full connection commitment;
the executor never resolves or records the username. A seed or runtime grant does not authorize it,
and a request whose `approval` is neither an approval id nor the declaration's reference with the
release class `declared` is `APPROVAL_REQUIRED`.

## The runner is fixed and gated twice

The request gate validates the producer receipts, immutable files and actual checkout head before
effects. `scripts/migration-release-run.mjs <runtime-root> <branch>` runs through the declared shell
grant; its internal gate repeats the authorization and source checks immediately before each apply.
The fixed runner receives only `migration-release-input.schema.json` JSON and returns the closed
`migration-release-runner` kind. It independently compares the expected connection, complete pending
set, journal existence and full-row journal fingerprint immediately before effects. Inspect reads
without creating the journal. Journal initialization requires the plan's explicit permission.

The first apply fills exactly the declared migration set; readback preserves every prior journal row.
A second invocation proves no pending migration and no journal change. Successful stdout is preserved
verbatim inside hashed transcripts only after its closed schema passes; a failed or malformed process
returns output hashes and a failure category. Resolved values and arbitrary process output are never
persisted. Failure or uncertainty is `MIGRATION_FAILED`: it blocks without retrying a partial effect
or running a down migration, and the journal is left exactly as the runner left it.

## Concrete attempt flow

This operator's rows are gated by the shared expected/actual attempt contract in `scripts/attempt-gate.mjs`.

| Observed state | Action | Actual check | Next branch |
| --- | --- | --- | --- |
| journal already has frozen set and none pending | reuse applied state; no apply | second inspect proves identical journal and prior rows | emit no-op proof |
| declared set pending and none journaled | apply exact digest once via source runner | inspect and replay prove journaled set and no-op replay | emit proof |
| plan/runner/object missing or invalid | apply and edit nothing | name artifact and digest mismatch | handoff `backend.generate`; corrected plan is new attempt |
| apply partial/uncertain or transcript lost | never reapply, down-migrate or guess | preserve logs and uncertain effects | block until inspection proves remaining set safe |

## Boundary

Context is read-only apart from the migration the runner applies. The operator applies only the
declared migration set against the frozen source head and the declared target, and writes only
`response/` of its own branch: `migration-release.md`, `data/migration-release.json`, the hashed
`artifacts/migration-1.log` and `artifacts/migration-2.log` transcripts, and `response.json`. It does
not deploy an image, roll out, monitor or roll back; does not create, edit or choose a runner; does
not resolve, log, persist, echo or return a credential value or the sealed username; does not run a
down migration or retry a partial effect; does not touch a production environment; and does not
claim a migrated outcome without the replay that proves it.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/be` | the route input's backend checkout at the frozen source commit, read for the pinned runner, configuration and migration files | yes |
| `@workspaces/device-state` | the connection custody by name; values never appear | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `route` | `workspace.bind`; the source checkout and route authority the plan is pinned to | yes |
| `backend-source-application` | `backend.generate`; the applied migration contract and the source-owned runner it proved | yes |
| `quality-verification` | `quality.verify`; passing verification at the same source commit | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `release` | id | — | The release identity this migration belongs to, as `release:<id>` |
| `target` | id | — | The one non-production target the plan names, and the environment it sits in |
| `approval` | id | — | The release authority: an approval id, or the environment declaration's reference — its path and content hash — when that declaration marks `release` `declared`; never `declared` where the environment is production |
| `migration` | `{planRef, sha256}` | null | The exact source migration plan, pinned by digest; the orchestrator binds it before dispatch, and the operator's own gate refuses a branch that names none |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, the three producer inputs at one source commit, and the resume | `resume` | `request/request.json`, inputs `route`, `backend-source-application` and `quality-verification` | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Bind and inspect the digest-frozen plan, runner files, target and journal, classifying the set already applied, safely pending, missing or invalid, or partial and uncertain before execution | `release`, `target`, `approval`, `migration` | `request/migration-release.json`, the environment's declaration, @workspaces/be at the frozen source head, @tools/git | — | `MIGRATION_PLAN_INVALID`, `APPROVAL_REQUIRED`, `SOURCE_DRIFT` |
| 3 | Run inspect-apply-inspect only for a wholly safe pending set; reuse an already applied set as no-op, hand missing or invalid owner artifacts back, and never reapply a partial or uncertain effect | — | @workspaces/be for the runner and its configuration, @workspaces/device-state for the custody by name, @tools/secrets, @tools/shell for the frozen command | `migration-log`: response/artifacts/migration-1.log and migration-2.log | `MIGRATION_FAILED` |
| 4 | Prove the replay — no pending migration, the journal unchanged, every prior row preserved — and write the proof | — | `response/artifacts/migration-1.log`, `response/artifacts/migration-2.log` | `migration-release-proof` | `MIGRATION_FAILED` |
| 5 | Write the receipt and emit | — | everything above | `migration-release`, `response/response.json` | — |

A resume begins again at validation, keeps the same plan digest, and never re-applies a set the
journal already carries; a resume that adds no authority, plan or source change is `NO_PROGRESS`.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `migration-release` | `response/migration-release.md` | md | yes |
| `migration-release-proof` | `response/data/migration-release.json` | data | yes |
| `migration-log` | `response/artifacts/migration-<n>.log` | artifact | no |

## The best outcome

Print **The best outcome** as the pending, applied or already-applied disposition table in `response/migration-release.md`, backed by `response/data/migration-release.json`; an already-applied set is labeled a proved no-op, and `response/artifacts/migration-<n>.log` is linked only for a row that needs execution detail. A failed or uncertain migration leads with its actual journal state and recovery owner and never suggests blindly reapplying it.

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `APPROVAL_REQUIRED` | terminate |
| `MIGRATION_PLAN_INVALID` | terminate |
| `MIGRATION_FAILED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the migration is applied and the image that depends on it may be released | `release.deploy` |
| the runner or a migration file the plan pins must be repaired by its owner | `backend.generate` |
