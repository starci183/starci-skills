# Ledger DB — `.starciwork/runtime.sqlite`

Status: keystone contract. The schema is **data**, not prose: the executed DDL is
`engine/schema.sql` and `engine/evidence.sql` (project ledger), `engine/machine.sql` (host) and
`engine/triggers.sql`, which `engine/ledger-db.mjs` reads at load. This document
explains the decisions and invariants; it does not inline the DDL — when they
disagree, the `.sql` files and the module win.

## 1. Decision

The final storage architecture has exactly two kinds of SQLite database. A
project's ledger holds its complete workflow history; the host DB holds machine
and fleet state. The machine consolidation is a separate migration lane.

```text
<ledger repo>/.starciwork/runtime.sqlite    ← that project's workflows, jobs,
                                              attempts, reports, checks, blobs,
                                              Work DAG, verdicts, events, logs
%LOCALAPPDATA%/StarCi/runtime/machine.sqlite ← host registry, Supervisor,
                                               reconciler, services, throttle,
                                               GC, land, budgets, machine logs
```

Dispatch and op scratch files stage in the OS temp dir outside every repository.
The runtime passes `STARCI_JOB_SCRATCH` to new jobs. `api report --report <file>
[--attach <path>...]` validates the report, stores its JSON in `reports.report_json`,
ingests declared and attached files into the external blob store, writes artifact
and check rows, and removes the scratch directory. Settler re-runs write their
outputs directly to the blob store and `check_runs`.

The bound `.starciwork` tree keeps important product content: Work records,
SRS/SDS, UI specifications and brand. Agent and runtime metadata — attempts,
models, reports, checks, logs, evidence, captures and renders — lives in SQL
plus the blob store, including evidence a product record cites. Existing
`E/**`, `evidence/**`, `assets/**` and `runs/**` execution proof paths are
migration inputs, not new output locations. `.starciwork/kernel-evidence/**` is
retired. See
`modules/schemas/work-layout.yaml` for the Work boundary.

The blob root is `~/.starci/artifacts/`, overridden by `STARCI_ARTIFACT_ROOT`.
Content is write-once at `<root>/<first-two-sha-digits>/<sha256>`, with a
`<sha256>.json` sidecar containing size, media type and creation time. A SHA is
computed from the original bytes, even when stored compressed. `blobs` records
metadata, archive state, `file_uri` (absolute file path) and `http_path`
(`/api/blob/<sha256>`). Both links are available directly in queries; the
harness serves the HTTP path. A blob file is removed only by the GC policy after
its reference count reaches zero and an archive is verified.

The kernel agent's only writer is `scripts/kernel/api.mjs` — the [Kernel] never
opens this file; every state operation is one api verb inside one
`BEGIN IMMEDIATE` transaction that also appends one hash-chained `events` row
(`modules/kernel/api.yaml`). Two boot-path scripts write it too:
`scripts/goal/define-goal.mjs` (workflows/goals/inbox at goal intake) and
`scripts/kernel/start-workflow.mjs` (the kernel `signals` singleton, the
`kernel-*` job row, the inbox claim, the queued→running phase). The
ledger-facing store vocabulary lives in `engine/ledger-db.mjs`.

## 2. Why (recorded so it is not re-argued)

- One transaction commits the audit event + job/lease change.
  `lease-identity-drift`, orphan reservations and unreconciled unsettled jobs
  become **impossible to persist**, not merely detectable: `leases.job_id` →
  `jobs`, and the `leases_match_job` trigger raises on identity drift.
- Structured history is archived from one ledger file; raw outputs require its
  referenced blobs. Inspect structured history with `SELECT`.
- Worktree deletion and process crash keep the record: the ledger lives in the
  owning repository, outside every worker's `owned_paths`. A repo re-clone does
  not keep it: `runtime.sqlite` is untracked.
- The host keeps its ledger registry and machine/fleet state in `machine.sqlite`,
  keyed by each ledger's own `meta.ledger_id`.

## 3. Module — `engine/ledger-db.mjs`

```js
export const LEDGER_SCHEMA='starci/ledger-db@1';
export const LEDGER_VERSION=1;
export const ledgerFileFor=repoRoot=>...;   // <repo>/.starciwork/runtime.sqlite; refuses the runtime root
export const machineFileFor=(env=process.env)=>...;  // <runtime state root>/machine.sqlite; STARCI_TEST_MACHINE_FILE first; a temp registry inside node --test
export const runtimeRootFor=(env=process.env)=>...;  // <runtime state root>: connectors, uat-slots, host state

export function openLedger({file,now=Date.now,busyTimeoutMs=15000,journalMode='WAL',machine=null});
export function inspectLedger({file});      // read-only, no migration — operator inspection
export function openMachine({file,now=Date.now,busyTimeoutMs=15000,journalMode='WAL',env,tempDirs});  // the live registry refuses temp-dir ledgers
export function pruneRegistry(machine,{dryRun});  // drop rows whose ledger is missing or under the OS temp dir
export function ledgerIdOf(handle);         // identity from the meta row, never the path
export function reserveTwoPhase(ledger,machine,{job,leases,ttlMs,canonicalOf});  // admission: job leased + repo leases, one transaction
export function releaseTwoPhase(ledger,machine,{jobId,status,result});           // drop the job's leases, settle its fencing fields
```

`ledgerFileFor` refuses a repository root that is itself the StarCi runtime
(`ledger-root-is-runtime`) — a project routes through `.workspaces` instead.
`openLedger` is the read-write path: it migrates, turns foreign keys on, opens
WAL and applies `LEDGER_PRAGMAS` (below). Opening an established ledger writes nothing:
the schema steps and the `meta.journal_mode` record run only when the file needs
them, so a read-only verb never takes or waits on the write lock.

Open facts (applied by `openLedger`, outside the DDL body): `auto_vacuum` (new file only),
`foreign_keys=ON`, `journal_mode=WAL` (with the achieved mode recorded in `meta`),
`user_version=1`, the `starci_sha256` function the digest trigger needs, and
`LEDGER_PRAGMAS` (2026-09-27 throughput work, every read-write open): `busy_timeout`
>= 15000, `synchronous=NORMAL` (in WAL a commit appends without an fsync; a
checkpoint syncs - a process crash loses nothing, a power cut may lose the newest
commits), `temp_store=MEMORY`, `cache_size` 16 MiB, `wal_autocheckpoint` 8000 pages
(the typed-log writer's own connection checkpoints at 1000, so the copy-back runs
after a log flush, off a kernel's transaction) and `journal_size_limit` 64 MiB.
Every write transaction starts with `beginImmediate`: the lock is retried without
sleeping for `LEDGER_SPIN_MS` (20 ms) before SQLite's busy handler takes over,
because on Windows each busy-handler sleep is a 15.6 ms timer tick (30 writers:
p95 170 ms -> 0.6 ms on a bare table). Readers outside the engine open with
`openLedgerReader` (read-only, the same busy_timeout; a bare
`new DatabaseSync(file,{readOnly:true})` has busy_timeout 0).
`scripts/checks/ledger-throughput.mjs` is the load test (30 writer processes,
ledger transactions + log bursts, p50/p95/p99 and SQLITE_BUSY per scenario). `meta.ledger_id` is a UUID minted at create — it
moves with the bytes, so renaming the repo cannot re-key the ledger.

## 4. What the tables are for

Full DDL: `engine/schema.sql` and `engine/evidence.sql`. Orientation only:

| Table(s) | Role | Writers |
| --- | --- | --- |
| `meta` | Ledger identity + open-mode facts; seeded once | `engine/ledger-db.mjs` create/migrate; `journal_mode` when an open achieves a different mode |
| `workflows` | One row per workflow: registration, bound generation, phase | `ensureWorkflow` (engine), `define-goal` (phase `queued`), `start-workflow` (phase `running`), `api finish` (phase `finished`) |
| `op_attempts` | One row per op attempt, with agent/provider/model/pool/effort, terminal and worktree identity, route through release timestamps, op `report_outcome` separate from verified `verdict`, `settled_by`, failure class and reported token/cost values | Route, dispatch, report, settle and release transitions |
| `unit_edges` | Materialized work DAG edge (`after`, `seam` or `dependsOn`) with source | Work graph writers; read by workflow board |
| `goals` | Approved goal revisions, append-only per `(workflow_id, revision)` | `define-goal` INSERT; `api plan` UPDATEs `json.derivedPlan` |
| `inbox` | The queue kernels claim from: pending → claimed/done | `define-goal` INSERT; `start-workflow` claims (`status='claimed'`); `api finish` closes |
| `jobs` | The queue itself — one row per op attempt or kernel seat | `api enqueue`/`route`/`dispatch`/`settle`; `start-workflow` kernel row; engine `enqueueJob` (supervisor) / `reserveTwoPhase` |
| `events` | Hash-chained audit log (the `events_digest_chain` trigger computes each link) | `ledger.appendEvent` inside every write verb's transaction; a duplicate `event_id` throws |
| `incidents` | Fingerprinted escalations | `api incident`; `dispatch` rejection path files `infra-provider` incidents |
| `signals` | Kernel liveness singleton — one kernel per workflow, enforced in data | `start-workflow` (`scope='kernel', key=<workflow_id>` reserve→confirm→release) |
| `contracts` | Op IPC, kernel → worker — see §4a | `api dispatch` (`fileContract`, INSERT OR REPLACE before `jobs`→`running`); read by `api op-contract` |
| `reports` | Op IPC, worker → kernel; `report_json` is the only report copy — see §4a | `api report` (INSERT OR REPLACE, `consumed_at` reset NULL); `consumed_at` stamped by `api consume-report` and by `settle` |
| `check_runs` | One row per declared or re-run check of a job attempt: name, phase, runner, command, cwd, exit/status, timestamps, small summary and SHA references to raw stdout, stderr and parsed JSON output | `api report`, `api check`, settler; migrated from `checks.checks_json` |
| `resources` (ledger), `leases` | Repo-scoped capacity fences | `api dispatch` → `reserveOpLeases` seeds `path:*` capacity-1 resources and takes leases via `reserveTwoPhase`; `api settle`/dispatch-reject release them |
| `work_graph_versions` | A workflow's work graph (`starci/work-graph@1`), one immutable row per version with its diff, colours, reason and author op/job; created on an existing ledger by `migrateLedger` (additive) | `scripts/work/work-graph.mjs propose`, `scripts/work/backfill-work-graph.mjs --apply` |
| `blobs` | One row per SHA: byte count, media type, optional encoding, `file_uri`, `http_path`, creation and verified archive state. Work proof hashes also have metadata-only rows so artifact foreign keys hold | Artifact and check ingestion; GC only after `blob_refs.refs=0` and an archive exists |
| `job_artifacts_v2` | One row per logical output name and job attempt. New operational output uses `storage=blob` with SHA and no repo path; `storage=work-proof` represents existing Work proof paths during migration. Roles distinguish checks, patches, media, logs and proof; patch revision fields remain | `api report`, settle and backfill; becomes canonical `job_artifacts` after all readers switch |
| `report_attachments` | Links each report to its artifact IDs | `api report` and backfill |
| `artifact_proofs_v2` | Proof claims keyed by artifact ID rather than a filesystem path | Artifact/proof ingestion and backfill; becomes canonical `artifact_proofs` after all readers switch |
| `blob_refs` | View summing references from job artifacts and check-run output SHA columns | GC reads; no writer |
| `v_op_history`, `v_media`, `v_timeline`, `v_workflow_progress` | Read views for attempt history and checks, image/video links by job and attempt, ordered events/logs/attempts, and units done/total with rate and ETA | UI/API read-only handles |
| `logs`, `log_cursors` | The typed log rows (`scripts/kernel/typed-logs.mjs`) and the sync cursors; moved INTO the ledger on 2026-09-27 (owner ruling: one complete RDBMS per product repo) from the retired `<repo>/.starciwork/logs.sqlite`. `logs.workflow_id` references `workflows` (ON DELETE CASCADE); append-only (no UPDATE; a DELETE only while the workflow's `workflow_purges` row is `deleting`); `src` is the idempotent derivation key. Created on an existing ledger by `migrateLedger` (additive; the AUTOINCREMENT starts past the old file's newest seq) | ONLY the process's buffered log writer (`scripts/kernel/log-writer.mjs`: its own connection, batches of <= 200 rows or every 250 ms in one short `BEGIN IMMEDIATE`, never inside a caller's ledger transaction; an SQLite authorizer limits that connection to these tables) - `api log`, settle's sidecar ingest and event derivation, `api logs`, the ui server's `/api/logs`; `scripts/work/migrate-logs-into-ledger.mjs` copies the old file in |
| `workflow_purges` | The one sanctioned delete path of a finished workflow (below): approval, the verified evidence archive (path, sha256, bytes, manifest sha256, events head, counts), state `planned`/`archived`/`deleting`/`purged`; the row is the tombstone | `scripts/work/purge-workflow.mjs --apply` |
| `state_snapshots`, `budgets`, `budget_reservations`, `inputs` | Reserved | none — kept so the table shape of existing ledgers never changes |

`machine.sqlite` (`engine/machine.sql`): `ledgers` is the host registry
(`registerLedger` at every admission; read by `scripts/agent/balance.mjs`). The
final host schema also owns Supervisor, reconciler, service, throttle, GC, land,
budget and machine-log tables, plus machine-level blobs. It attaches registered
project ledgers on demand for fleet views. That consolidation is a separate lane;
the project evidence migration does not create another machine-state database.

Its `ledgers` registry is the host's, and a test never writes it. The
`node --test` preload `tests/setup/isolated-registry.mjs` (npm test and the
land gate load it) sets `STARCI_TEST_MACHINE_FILE` to a per-run temp
registry that every spec and every api.mjs a spec spawns inherits; without it,
`machineFileFor` still resolves a temp registry inside any node --test process
tree (`NODE_TEST_CONTEXT`). The live registry (outside the OS temp dir, no
`STARCI_TEST_MACHINE_FILE`) refuses to enrol a ledger under the OS temp dir:
`registerLedger` returns `{registered:false, refused}` and writes nothing, so
repo-scoped admission proceeds.
`node scripts/kernel/prune-registry.mjs [--machine <file>] [--dry-run]` is the
one-shot, idempotent clean-up: it backs the registry up (`<file>.bak-<stamp>`)
and deletes rows whose ledger file is missing or under the OS temp dir, never
an existing ledger outside it and never a row still owning a reserved lease or budget row.

## 4a. Op IPC — contracts out, reports in, checks beside

The dispatch↔worker exchange is durable rows, not files — the ledger is the
only record (`modules/kernel/api.yaml` — the op lifecycle is `enqueue →
route → dispatch → api report → api consume-report → api check →
api settle`).

- **`contracts`** — kernel → worker. `api dispatch` writes one row per
  `(workflow_id, op_id, attempt)` — the rendered prompt plus the packet JSON
  (`fileContract`, INSERT OR REPLACE) inside the same transaction that flips
  the job to `running`, on both the terminal and the managed-worker path.
  `dispatch_id` is the worker's handle (terminal handle or managed Dispatch
  id). **The contract is the dispatch authority, never the terminal prompt** —
  the prompt only delivers it. The worker reads it back with `api op-contract`
  (`--job`, or `--workflow` + `--op` + optional `--attempt`; latest attempt by
  default). `context_json.inputs` (`starci/input-digests@1`,
  `{digests:[{path, digest, kind}]}`) records the digest of every Source-law
  input the op binds (`kind: source`, judged as admitted: a later edit is
  advisory `sourceDrift`) and of every product record it reads (`kind: work`,
  re-baselined at settle), which `api survey`/`api status` compare to report
  `staleInput`
  ([source staleness](source-staleness.md#settled-jobs-and-changed-runtime-inputs));
  it lives inside the existing JSON column, so the table's DDL is unchanged
  and a row without it reports nothing.
- **`reports`** — worker → kernel. The worker files `api report` with an
  outcome from `done|partial|failed|ask|blocked`; `UNIQUE(workflow_id,
  dispatch_id)` + `INSERT OR REPLACE` makes a re-filed report idempotent and
  resets `consumed_at` to NULL. `dispatch_id` is the worker's handle, falling
  back to the job id when none was bound. `consumed_at` is stamped by
  `api consume-report` (which appends a `report-consumed` event) and again by
  `settle` when it integrates the verdict — the durable worker→kernel signal
  is spent exactly once; a paused op's own report is consumed so it is never
  read as its answer. The JSON column is the only report copy; neither scratch
  nor `.starciwork/kernel-evidence` retains a `report.json`.
- **`check_runs`** — one row per declared or re-run check, including runner,
  phase, command, status, timing and a small `summary_json`. `stdout_sha`,
  `stderr_sha` and `output_sha` point to blobs containing raw output. A check
  that did not produce one of those outputs leaves its SHA null. `api check`
  re-runs are recorded here before settlement.
- **`job_artifacts_v2` and `report_attachments`** — an artifact has a logical
  `name` unique within the attempt, a role and a storage class. `blob` means
  `repo_path` is null and the bytes are in the external store. `work-proof`
  represents an existing `repo_path` to Work proof during migration; its
  hash still has a metadata row in `blobs` for the foreign key. New execution
  proof uses blobs even when a product record cites it. Attachment
  links use artifact IDs, and `artifact_proofs_v2` keys claims by artifact ID.
  The old path-based tables remain only during verified migration.

## 5. Identity fence

A job's durable identity is `{workflow_id, op_id, attempt, generation}` +
`lease_token`. A command that cannot bind the complete identity refuses rather
than partial-matches; the `leases_match_job` trigger aborts drift at the
database level.

Retention: rows are never deleted when a workflow finishes (`api finish` sets
`phase='finished'`); `runtime.sqlite` grows with its history. Proofs,
artifacts and logs are never deleted by housekeeping or any writer. The one
exception (owner rulings 2026-09-27) is the owner-approved **workflow purge**,
`scripts/work/purge-workflow.mjs`, which deletes a FINISHED workflow as a unit:

1. refused unless the workflow is `finished`, none of its jobs is
   dispatchable or fenced, and `--approved-by` / `--approval-ref` name the
   owner's approval;
2. the evidence is archived first, as a ZIP on drive D
   (`D:/starci-archive/<product>/<workflowId>-<date>.zip`): every ledger row of
   the workflow as NDJSON (`ledger/<table>.ndjson`: events, jobs, reports,
   check_runs, incidents, contracts, goals, inbox, job_artifacts,
   artifact_proofs, report_attachments, logs, work_graph_versions, leases,
   signals, the workflows row), referenced blobs and cited Work proof files,
   and `manifest.json` (sha256 and bytes of every entry, the row counts, the
   events digest-chain head);
3. the archive is re-opened from disk and every entry inflated and checked
   (CRC, sha256 against the manifest) BEFORE anything is deleted; the path,
   sha256, bytes, manifest sha256 and events head are recorded in
   `workflow_purges` (state `archived`, `verified_at`);
4. only then the row goes to `deleting` - the table CHECK refuses that state
   without the approval and a verified archive, and the `logs` delete guard
   (`logs_delete_only_by_purge`) opens for that workflow only while it holds -
   and the workflow's rows are deleted table by table in short batches, the
   `workflows` row last; state `purged`. Cited Work proof files remain in the
   product tree because other records may still refer to them. Blob files are
   removed only by a separate refcount sweep after verified archive custody.

The 2026-09-28 evidence migration is distinct from a workflow purge. It backs
up each ledger before schema migration, ingests each existing
`.starciwork/kernel-evidence/**` file into `blobs`, `job_artifacts_v2` and
`check_runs` as applicable, verifies hash/size/row counts and report JSON
identity, then writes and verifies a ZIP at `D:/starci-archive`. Only after
that verification may the old folder leave product git. Once all readers use
the new tables, the v1 artifact/proof/check tables are retired, the v2
artifact/proof tables take their canonical names, and a verified ledger archive
precedes dropping the retired tables. No legacy path read fallback remains.

## 6. Refusal discipline

`modules/kernel/api.yaml` names every api write's refusal strings under that
verb's `refuses:` key, and `scripts/checks/check-api-surface.mjs` holds the two
in step. A refusal is a typed fact for the driver loop — never an exception to
route around, never a silent loss.
