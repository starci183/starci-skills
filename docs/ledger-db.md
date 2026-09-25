# Ledger DB — `.starciwork/runtime.sqlite`

Status: keystone contract. The schema is **data**, not prose: the executed DDL is
`engine/schema.sql` (ledger), `engine/machine.sql` (machine registry) and
`engine/triggers.sql`, which `engine/ledger-db.mjs` reads at load. This document
explains the decisions and invariants; it does not inline the DDL — when they
disagree, the `.sql` files and the module win.

## 1. Decision

One SQLite file per ledger-owning repository holds everything a workflow needs
to continue, to be audited and to be archived:

```text
<ledger repo>/.starciwork/runtime.sqlite    ← THE record: workflows, goals, jobs,
                                              leases, reports, contracts, checks,
                                              inbox, signals, incidents, events
<runtime root>/machine.sqlite               ← the host's registry of ledgers
                                              (`ledgers`). Nothing else is live here.
```

Dispatch artifacts stage in the OS temp dir and are removed once delivered.

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
- Archive = copy one file. Inspect = `SELECT`.
- Worktree deletion and process crash keep the record: the ledger lives in the
  owning repository, outside every worker's `owned_paths`. A repo re-clone does
  not keep it: `runtime.sqlite` is untracked.
- The host keeps one registry of its ledgers in `machine.sqlite`, keyed by each
  ledger's own `meta.ledger_id`.

## 3. Module — `engine/ledger-db.mjs`

```js
export const LEDGER_SCHEMA='starci/ledger-db@1';
export const LEDGER_VERSION=1;
export const ledgerFileFor=repoRoot=>...;   // <repo>/.starciwork/runtime.sqlite; refuses the runtime root
export const machineFileFor=(env=process.env)=>...;  // <runtime state root>/machine.sqlite; STARCI_TEST_MACHINE_FILE first; a temp registry inside node --test
export const runtimeRootFor=(env=process.env)=>...;  // <runtime state root>: connectors, uat-slots, watchdog logs

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
`openLedger` is the read-write path: it migrates, turns foreign keys on, sets
`synchronous=FULL` and opens WAL. Opening an established ledger writes nothing:
the schema steps and the `meta.journal_mode` record run only when the file needs
them, so a read-only verb never takes or waits on the write lock.

Open facts (applied by `openLedger`, outside the DDL body): `auto_vacuum` (new file only),
`foreign_keys=ON`, `synchronous=FULL`, `journal_mode=WAL` (with the achieved
mode recorded in `meta`), `user_version=1`, and the `starci_sha256` function
the digest trigger needs. `meta.ledger_id` is a UUID minted at create — it
moves with the bytes, so renaming the repo cannot re-key the ledger.

## 4. What the tables are for

Full DDL: `engine/schema.sql`. Orientation only:

| Table(s) | Role | Writers |
| --- | --- | --- |
| `meta` | Ledger identity + open-mode facts; seeded once | `engine/ledger-db.mjs` create/migrate; `journal_mode` when an open achieves a different mode |
| `workflows` | One row per workflow: registration, bound generation, phase | `ensureWorkflow` (engine), `define-goal` (phase `queued`), `start-workflow` (phase `running`), `api finish` (phase `finished`) |
| `goals` | Approved goal revisions, append-only per `(workflow_id, revision)` | `define-goal` INSERT; `api plan` UPDATEs `json.derivedPlan` |
| `inbox` | The queue kernels claim from: pending → claimed/done | `define-goal` INSERT; `start-workflow` claims (`status='claimed'`); `api finish` closes |
| `jobs` | The queue itself — one row per op attempt or kernel seat | `api enqueue`/`route`/`dispatch`/`settle`; `start-workflow` kernel row; engine `enqueueJob` (supervisor) / `reserveTwoPhase` |
| `events` | Hash-chained audit log (the `events_digest_chain` trigger computes each link) | `ledger.appendEvent` inside every write verb's transaction; a duplicate `event_id` throws |
| `incidents` | Fingerprinted escalations | `api incident`; `dispatch` rejection path files `infra-provider` incidents |
| `signals` | Kernel liveness singleton — one kernel per workflow, enforced in data | `start-workflow` (`scope='kernel', key=<workflow_id>` reserve→confirm→release) |
| `contracts` | Op IPC, kernel → worker — see §4a | `api dispatch` (`fileContract`, INSERT OR REPLACE before `jobs`→`running`); read by `api op-contract` |
| `reports` | Op IPC, worker → kernel — see §4a | `api report` (INSERT OR REPLACE, `consumed_at` reset NULL); `consumed_at` stamped by `api consume-report` and by `settle` |
| `checks` | Kernel's re-run results per op attempt — see §4a | `api check` (INSERT OR REPLACE) |
| `resources` (ledger), `leases` | Repo-scoped capacity fences | `api dispatch` → `reserveOpLeases` seeds `path:*` capacity-1 resources and takes leases via `reserveTwoPhase`; `api settle`/dispatch-reject release them |
| `state_snapshots`, `budgets`, `budget_reservations`, `inputs` | Reserved | none — kept so the table shape of existing ledgers never changes |

`machine.sqlite` (`engine/machine.sql`): `ledgers` is the host registry
(`registerLedger` at every admission; read by `scripts/agent/balance.mjs`); its
other tables are reserved.

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
  read as its answer.
- **`checks`** — the kernel's re-run results for the same
  `(workflow_id, op_id, attempt)` key (`api check --checks <json> |
  --checks-file <path>`). Filed between `consume-report` and `settle`, which
  then releases the leases and closes the worker.

## 5. Identity fence

A job's durable identity is `{workflow_id, op_id, attempt, generation}` +
`lease_token`. A command that cannot bind the complete identity refuses rather
than partial-matches; the `leases_match_job` trigger aborts drift at the
database level.

Retention: rows are never deleted when a workflow finishes (`api finish` sets
`phase='finished'`); `runtime.sqlite` grows with its history.

## 6. Refusal discipline

`modules/kernel/api.yaml` names every api write's refusal strings under that
verb's `refuses:` key, and `scripts/checks/check-api-surface.mjs` holds the two
in step. A refusal is a typed fact for the driver loop — never an exception to
route around, never a silent loss.
