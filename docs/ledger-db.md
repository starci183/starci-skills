# Ledger DB — `.starciwork/runtime.sqlite`

Status: keystone contract. The schema is **data**, not prose: the DDL lives in
`engine/schema.sql` (ledger) and `engine/machine.sql` (machine arbiter),
extracted verbatim from the `LEDGER_DDL`/`META_TABLE_DDL`/`EVENTS_DIGEST_TRIGGER`
constants of `engine/ledger-db.mjs`. This document explains the decisions and
invariants; it does not inline the DDL — when they disagree, the `.sql` files
and the module win.

## 1. Decision

One SQLite file per ledger-owning repository holds everything a workflow needs
to continue, to be audited and to be archived:

```text
<ledger repo>/.starciwork/runtime.sqlite    ← THE record: workflows, goals, jobs,
                                              leases, budgets, reports, contracts,
                                              inbox, signals, events, state snapshots
<runtime root>/machine.sqlite               ← machine arbiter ONLY: ai/* provider
                                              quota and machine budgets, which span
                                              ledgers. Nothing else lives here.
```

`.starciwork/_local/` is not a runtime-state location: dispatch artifacts are
delivered then removed (or written to the OS temp dir), never parked there.

The only writer is `scripts/kernel/api.mjs`. The kernel agent never opens this
file; every state operation is one api verb inside one `BEGIN IMMEDIATE`
transaction that also appends one hash-chained `events` row
(`modules/kernel/api.yaml`).

## 2. Why (recorded so it is not re-argued)

- One transaction commits state snapshot + audit event + job/lease change.
  `lease-identity-drift`, orphan reservations and unreconciled pending jobs
  become **impossible to persist**, not merely detectable: `leases.job_id` →
  `jobs`, and the `leases_match_job` trigger raises on identity drift.
- Archive = copy one file. Inspect = `SELECT`.
- Worktree deletion and process crash keep the record: the ledger lives in the
  owning repository, outside every worker's `owned_paths`. A repo re-clone does
  not keep it — `runtime.sqlite` is untracked — so the tracked anchor (§5)
  turns that loss into a refusal (`ledger-missing` / `ledger-behind-anchor`)
  instead of a silent restart.
- Cross-ledger resources still need one arbiter. Only `ai/*` quota and machine
  budgets are cross-ledger, so only they live in `machine.sqlite`.

## 3. Module — `engine/ledger-db.mjs`

```js
export const LEDGER_SCHEMA='starci/ledger-db@1';
export const LEDGER_VERSION=1;
export const ledgerFileFor=repoRoot=>path.join(repoRoot,'.starciwork','runtime.sqlite');
export const machineFileFor=(env=process.env)=>path.join(runtimeRootFor(env),'machine.sqlite');

export function openLedger({file,now,busyTimeoutMs,machine}); // read-write; migrates, FK on, synchronous=FULL, WAL
export function inspectLedger({file});                        // read-only, no migration — operator inspection
export function openMachine({file,now,busyTimeoutMs});
export function ledgerIdOf(handle);                           // identity from the meta row, never the path
export function verifyChain(db,{workflowId});                 // walk the events hash chain
```

Open facts (applied by `openLedger`, outside the DDL body): `auto_vacuum`,
`foreign_keys=ON`, `synchronous=FULL`, `journal_mode=WAL` (with the achieved
mode recorded in `meta`), `user_version=1`, and the `starci_sha256` function
the digest trigger needs. `meta.ledger_id` is a UUID minted at create — it
moves with the bytes, so renaming the repo cannot re-key the ledger.

## 4. What the tables are for

Full DDL: `engine/schema.sql`. Orientation only:

| Table(s) | Role | Writers (via api.mjs) |
| --- | --- | --- |
| `meta` | Ledger identity + open-mode facts; seeded once | create/migrate |
| `workflows` | One row per workflow: registration, bound generation, phase | `retire` |
| `goals`, `inbox` | Approved goal revisions; the queue kernels claim from | `define-goal`, `retire` |
| `jobs` | The queue itself — one row per op attempt, `pending→running→done/failed/blocked` | `enqueue`, `dispatch`, `settle` |
| `leases`, `budget_reservations` | Capacity fences taken atomically at dispatch, released at settle | `dispatch`, `settle` |
| `contracts`, `reports` | The dispatch packet out; the verdict report in (`UNIQUE(workflow_id, dispatch_id)`) | `dispatch`, `settle` |
| `incidents` | Fingerprinted escalations — same {kind, op} is one incident | `incident` |
| `events` | Hash-chained audit log — every write appends exactly one row | every write verb |
| `state_snapshots` | Continuation snapshots; compacted by retention | plan/settle flow |
| `signals` | Kernel liveness singleton — one kernel per workflow, enforced in data | `start-workflow`, `retire` |

`machine.sqlite` (`engine/machine.sql`) holds `ai/*` provider quota and machine
budgets only, reconciled by TTL.

## 5. Identity fence and anchor

A job's durable identity is `{workflow_id, op_id, attempt, generation}` +
`lease_token`. A command that cannot bind the complete identity refuses rather
than partial-matches; the `leases_match_job` trigger aborts drift at the
database level.

The ledger file is untracked and its hash chain is self-consistent — so the
chain proves nothing about *which* history is agreed. `.starciwork/ledger-anchor.json`
(`starci/ledger-anchor@1`) is the small **tracked** counter-record: per
workflow, `{generation, checkpointId, eventsHead, seq}`. It is written
atomically right after the ledger transaction that commits a checkpoint; a
ledger restored behind its anchor refuses `ledger-behind-anchor`, a tracked
anchor with no ledger refuses `ledger-missing`, and a `ledgerId` mismatch is
`ledger-identity-mismatch`. The anchor is committed with the repo it describes
— it holds heads, never state, and can be regenerated from a healthy ledger.

## 6. Refusal discipline

Every api write names its refusal strings (`modules/kernel/api.yaml`):
`unknown-workflow`, `already-queued`, `empty-paths`, `not-pending`,
`contested-lease`, `path-collision`, `spawn-failed`, `report-invalid`,
`out-of-scope-files`, `stale-settlement`, `jobs-unsettled`, `verify-open`,
`plan-divergence` (via `incident`). A refusal is a typed fact for the driver
loop — never an exception to route around, never a silent loss.
