# tinkle-7 REPORT — .claude/sqlite/ (workflow-ledger DB design + query catalog)

## Delivered

`.claude/sqlite/` — pure `.sql`/`.yaml`, no `.mjs`:

- `index.yaml` — overview manifest: file map, question→file `domains` routing, `invariantsSummary`, `walAndBusy` notes, and a `notHere` list (what an agent must NOT look for in this DB).
- `schema.sql` — the full ledger DDL extracted verbatim from `ledger-db.mjs` (`LEDGER_DDL` + `META_TABLE_DDL` + `EVENTS_DIGEST_TRIGGER`): 19 tables, 6 indexes, 3 triggers. Per-table comment answers "what decision does this row let the kernel make"; open/create pragmas (WAL/DELETE fallback, auto_vacuum, foreign_keys, synchronous=FULL, user_version=1, registered `starci_sha256` function) documented in the header.
- `machine.sql` — machine.sqlite DDL verbatim (5 tables) + why it's a separate file (two files can't share a transaction; only `ai/*` quota + `machine:*` budgets are cross-ledger, §1/§6) + the sweep's pair-proof rule (meta.ledger_id match, never path).
- `queries/` — 11 domain files, every statement extracted from real kernel code with `source: file::function` citations:
  - `jobs-queue.sql` (claim/settle/effect_unknown lifecycle + provider-loads view)
  - `leases.sql` (repo fences: capacity check, intent-v1 exact-binding, partial workerOnly release)
  - `machine-arbiter.sql` (register/reserve/release/sweep on machine.sqlite)
  - `events-tail.sql` (3 real append shapes incl. the digest-omitting jobs.complete insert)
  - `state-snapshots.sql` (resume reads + full compactSnapshots retention set)
  - `reports.sql` (reports+contracts+checks IPC trio)
  - `inbox-signals.sql` (inbox lifecycle, signals-as-locks, runtime_loads)
  - `budgets.sql`, `workflows-goals.sql`, `inputs.sql`, `verify-retire.sql`, `migration.sql`
- `design.yaml` — the ERD: per-table {purpose, keyFields, fks, invariants, decidesFor}, 19 relationship edges (incl. the cross-file `leases.machine_ref → machine.leases.token` seam), `whySingleTransaction` justifications, `observed` gaps section.

## Verification actually run

- `schema.sql` + `machine.sql` executed against `node:sqlite` `:memory:` → 19 tables / 6 indexes / 3 triggers and 5 tables created cleanly (the trigger needs `starci_sha256` registered — documented).
- Functional check: `events_digest_chain` fills `prev_digest`/`digest` when the writer omits them and links row 2 → row 1 correctly; `leases_match_job` aborts a wrong token with `lease-identity-drift` and accepts the matching one.
- `index.yaml`/`design.yaml` parse with the runtime's own `.dist/core/yaml.mjs::parseYaml`.

## Notable findings recorded (marked OBSERVED/inferred, not invented)

- **`incidents` has no live writer in 1.0.4.** `engine.incident()` (engine.mjs:656) keeps retry budgets in workflow *state* (`state.engine.incidents`); the table only receives ledger-migrate imports and retireWorkflow deletes. Recorded in schema.sql, design.yaml, index.yaml.
- **`ledger.mjs` ≠ this ledger.** It is the Work-tree (YAML `index.yaml` node) API — zero SQL. The name collision is a real agent trap; flagged in design.yaml + index.yaml.
- **`signals.expires_at` is never filtered in SQL** — expiry is evaluated in JS after the read.
- **`meta` + `events_digest_chain` were added to the DDL without a version bump** — `migrateLedger` backfills by probing `sqlite_master`, so `user_version=1` alone can't date a file.
- **jobs.complete's event INSERT deliberately omits digest columns** (`digest DEFAULT ''` + trigger recompute); engine.mjs:515 documents that a hand-rolled digest INSERT would silently vanish under `INSERT OR IGNORE` — captured as a warning in events-tail.sql.
- **kernel.mjs bypasses the store surface** with 3 direct `store.ledger.db.prepare()` calls (report digest, consumed_at, workflow existence) — permitted because all ledger access is kernel-side.

## TODO-missing markers (queries that don't exist — not invented)

- No `pendingJobs(workflowId,generation)` SQL — `engine.pending()` runs `listJobs()` and filters in JS.
- No "unconsumed reports" query (`WHERE consumed_at IS NULL`) — `readReports()` lists all, kernel filters.
- No budget-utilisation list query — `budgets` is only read on the reserve path.

## Coverage check

- DDL: all 19 ledger tables + 6 indexes + 3 triggers verbatim; all 5 machine tables. Column catalog cross-checked against `.dist/schemas/ledger-db.schema.json` `required` lists — exact match.
- Query sources: every `.prepare(` site in `.dist` covered — 19 files (kernel ×16, scripts/ledger-migrate, hosts/orca/launch, plus journal.mjs noted as retired-read-side).
- Not covered by design: `journal.sqlite`'s own DDL (retired schema, documented only as the migration read-side in queries/migration.sql — per §1 it is superseded).

## Gaps / not done

- Query files cite functions, not line numbers, where a statement is generated dynamically (listJobs, readAccessors.events) — the dynamic WHERE clauses are shown with all branches.
- No automated guard that schema.sql stays in sync with ledger-db.mjs; a checker would belong to a checks lane, not this one.
