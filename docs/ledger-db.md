# Ledger DB — `.starciwork/runtime.sqlite` (runtime 1.0.4)

Status: keystone contract. Every workstream of 1.0.4 implements against this file; a change to it is a
change to every workstream, so it is edited by the lead only.

## 1. Decision

One SQLite file per shared ledger owns everything a workflow needs to continue, to be audited and to be
archived:

```
<ledger repo>/.starciwork/runtime.sqlite          ← THE record (state, events, jobs, leases, goals, reports,
                                                     contracts, checks, inbox, signals, loads, budgets)
%LOCALAPPDATA%/StarCi/runtime/machine.sqlite      ← machine arbiter ONLY: `ai/*` provider quota and machine
                                                     budgets, which span ledgers. Nothing else lives here.
```

`.starciwork/_local/workflows/<id>/` is **no longer written or read by the kernel**. It is an import source
for `ledger-migrate` and an optional export target for `workflow-export`. A kernel that finds a `_local`
workflow directory with no matching `workflows` row fails closed with `ledger-unmigrated`; it never reads
the files as authority.

The global `journal.sqlite` (schema `starci/operational-journal@1`) is retired. Its rows are imported into
the ledger DB by `ledger-migrate`; after import the file is left in place, read-only, for audit.

## 2. Why (recorded so it is not re-argued)

- One transaction commits state snapshot + audit event + job/lease change. `lease-identity-drift`,
  `orphan-writer-reservation` and `unreconciled-pending` become **impossible to persist**, not merely
  detectable: `leases.job_id` → `jobs`, `jobs.generation` must equal the snapshot generation it was written
  with (trigger), and the continuation boundary becomes a read of one consistent file.
- Archive = copy one file. Inspect = `SELECT`. `workflow-ops`, `workflow-tail`, `workflow-status` are views.
- Worktree deletion, repo re-clone and process crash all keep the record: the record is the ledger DB, and
  the ledger DB is in the Work-owning repository, outside every worker allowlist (see §7).
- Cross-ledger resources still need one arbiter. Only `ai/*` quota and machine budgets are cross-ledger,
  so only they stay machine-scoped, in a table small enough to be reconciled by TTL.

## 3. Module and opening

`kernel/ledger-db.mjs` exports:

```js
export const LEDGER_SCHEMA='starci/ledger-db@1';
export const LEDGER_VERSION=1;
export const ledgerFileFor=repoRoot=>path.join(repoRoot,'.starciwork','runtime.sqlite');
export const machineFileFor=(env=process.env)=>path.join(runtimeRootFor(env),'machine.sqlite');

/** Read-write. Migrates schema, enables FK, synchronous=FULL, journal_mode=DELETE (WAL is opt-in as today). */
export function openLedger({file,now=Date.now,busyTimeoutMs=5000});
/** Read-only, no migration, what an operator inspection and the candidate bridge use. */
export function inspectLedger({file});
/** Read-write machine arbiter. Same options. */
export function openMachine({file,now=Date.now,busyTimeoutMs=5000});
```

Both handles expose `{db, transaction(fn), now, file, path, close()}` exactly as `openJournal` does today, so
callers of `journal.transaction`/`journal.db` port by renaming. `transaction` is `BEGIN IMMEDIATE … COMMIT`
with rollback on throw; nested calls are refused (throw), never silently flattened.

## 4. Schema — ledger DB

```sql
PRAGMA user_version=1; PRAGMA auto_vacuum=INCREMENTAL;

-- one row per workflow the ledger owns
CREATE TABLE workflows(
  workflow_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  ledger_mode TEXT, source_roots_json TEXT, generation INTEGER NOT NULL DEFAULT 0,      -- bound generation
  goal_identity TEXT, phase TEXT, finished_json TEXT, pin_digest TEXT, archived_at INTEGER);

-- goal.md / goal.json and every amendment, append-only
CREATE TABLE goals(
  goal_seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
  revision INTEGER NOT NULL, goal_identity TEXT NOT NULL, markdown TEXT NOT NULL, json TEXT NOT NULL,
  amendment_json TEXT, created_at INTEGER NOT NULL, UNIQUE(workflow_id,revision));

-- the recovery state; same semantics/retention as today's state_snapshots
CREATE TABLE state_snapshots(
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT, checkpoint_id TEXT NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
  goal_identity TEXT NOT NULL, state_json TEXT NOT NULL, events_head TEXT, created_at INTEGER NOT NULL);
CREATE INDEX state_snapshots_lookup ON state_snapshots(workflow_id,generation,goal_identity,snapshot_id);

-- ONE event table. Audit lines (today's events.jsonl, entity_type='workflow') and custody events
-- (today's journal events) share it. seq is the workflow-wide order; a hash chain makes deletion visible.
CREATE TABLE events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT,
  prev_digest TEXT, digest TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX events_entity ON events(workflow_id,entity_type,entity_id,seq);
CREATE INDEX events_kind ON events(workflow_id,kind,seq);
-- digest = sha256(prev_digest ?? '' + event_id + kind + payload_json + created_at). prev_digest = digest of
-- the previous row of the same workflow (NULL for the first). Verified by `ledger-verify`.

CREATE TABLE jobs(   -- unchanged from operational-journal@1
  job_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT,
  attempt INTEGER NOT NULL, generation INTEGER NOT NULL, kind TEXT NOT NULL, role TEXT, payload_json TEXT,
  status TEXT NOT NULL, priority_json TEXT, lease_token TEXT, worker_id TEXT, deadline INTEGER,
  result_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX jobs_queue ON jobs(status,kind,created_at,job_id);
CREATE INDEX jobs_op ON jobs(workflow_id,op_id,attempt);

CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));
CREATE TABLE leases(  -- repo-scoped fences: canonical-writer:*, source-root:*, lane:*  (NOT ai/*)
  resource_key TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL, op_id TEXT, attempt INTEGER NOT NULL, generation INTEGER NOT NULL,
  token TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0), acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, machine_ref TEXT,   -- token of the paired machine reservation, if any
  PRIMARY KEY(resource_key,job_id));
CREATE INDEX leases_expiry ON leases(expires_at);
-- invariant (trigger `leases_match_job`): a lease row's (workflow_id,op_id,attempt,generation,token) must
-- equal its job's (workflow_id,op_id,attempt,generation,lease_token). INSERT/UPDATE violating it is refused.

CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL CHECK(limit_value>=0),
  used_value INTEGER NOT NULL DEFAULT 0 CHECK(used_value>=0), reserved_value INTEGER NOT NULL DEFAULT 0 CHECK(reserved_value>=0));
CREATE TABLE budget_reservations(scope_key TEXT NOT NULL REFERENCES budgets(scope_key), job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  units INTEGER NOT NULL CHECK(units>0), PRIMARY KEY(scope_key,job_id));
CREATE TABLE incidents(incident_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, op_id TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  model_calls INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0,
  last_progress TEXT, status TEXT NOT NULL, updated_at INTEGER NOT NULL);

-- worker → kernel: today's reports/<dispatch>.json. Written by `starci report` (CLI), read by kernel.
CREATE TABLE reports(
  report_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
  dispatch_id TEXT NOT NULL, op_id TEXT, attempt INTEGER, generation INTEGER, outcome TEXT NOT NULL,
  report_json TEXT NOT NULL, from_terminal TEXT, consumed_at INTEGER, created_at INTEGER NOT NULL,
  UNIQUE(workflow_id,dispatch_id));
-- kernel → worker: today's contracts/<op>.md and the orca-dispatch-ctx_*.md. Read by `starci op-contract`.
CREATE TABLE contracts(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
  dispatch_id TEXT, markdown TEXT NOT NULL, context_json TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY(workflow_id,op_id,attempt));
-- today's checks/<op>.json
CREATE TABLE checks(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
  checks_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,op_id,attempt));
-- today's inbox/*: owner answers, amendments, late inputs. Append-only; kernel marks applied/rejected.
CREATE TABLE inbox(
  inbox_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
  kind TEXT NOT NULL, key TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  disposition_json TEXT, created_at INTEGER NOT NULL, applied_at INTEGER);
-- today's kernel.lock / supervisor.lock / stop.flag / inputs.lock / launch.json / final-report.json
CREATE TABLE signals(
  scope TEXT NOT NULL,          -- workflow_id, or '*' for ledger-wide (supervisor)
  key TEXT NOT NULL,            -- 'kernel-lock' | 'supervisor-lock' | 'stop' | 'inputs-lock' | 'launch' | 'final-report'
  holder_pid INTEGER, token TEXT, value_json TEXT, at INTEGER NOT NULL, expires_at INTEGER,
  PRIMARY KEY(scope,key));
-- today's runtime-loads.json / runtimes.json (supervisor's provider load view)
CREATE TABLE runtime_loads(runtime TEXT PRIMARY KEY, loads_json TEXT NOT NULL, at INTEGER NOT NULL);
-- what the ledger imported, so a second migrate is a no-op and an audit can see provenance
CREATE TABLE migrations(source TEXT PRIMARY KEY, kind TEXT NOT NULL, rows_json TEXT NOT NULL, at INTEGER NOT NULL);
```

## 5. Schema — machine DB (`machine.sqlite`)

```sql
PRAGMA user_version=1;
CREATE TABLE ledgers(ledger_id TEXT PRIMARY KEY, file TEXT NOT NULL, registered_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);
CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));   -- ai/<provider>[/<tier>]
CREATE TABLE leases(
  resource_key TEXT NOT NULL, token TEXT NOT NULL, ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
  workflow_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0),
  acquired_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(resource_key,token));
CREATE INDEX machine_leases_expiry ON leases(expires_at);
CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL, used_value INTEGER NOT NULL DEFAULT 0, reserved_value INTEGER NOT NULL DEFAULT 0);
CREATE TABLE budget_reservations(scope_key TEXT NOT NULL, ledger_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL, PRIMARY KEY(scope_key,ledger_id,job_id));
```

`ledger_id` = sha256 of the realpath of the ledger file, 16 hex. A ledger registers itself on `openLedger`.

## 6. Two-phase reservation (admission)

`reserveOperation` today acquires every resource of an op in one journal transaction. Under 1.0.4:

```
ledger.transaction(db => {
  insert job (status leased) + repo-scoped leases            -- fails → whole tx rolls back, nothing held
  for each ai/* or machine budget need:
      token = machine.reserve({resourceKey, ledgerId, workflowId, jobId, units, ttl})   -- its own tiny tx
      if !token.ok → throw  → ledger tx rolls back; machine.release(all tokens taken so far)
      set leases.machine_ref = token on the paired ledger lease row (resource_key 'ai/...' is recorded in
      the ledger too, units mirrored, so a ledger-only reader still sees what the op holds)
})
```

Release is the mirror: ledger tx deletes lease rows and settles the job, then `machine.release(machine_ref)`
for each. A crash between the two leaves a machine row with no ledger row: `machine.sweep()` (supervisor
tick) deletes machine leases whose `expires_at` passed OR whose `(ledger_id, job_id)` no longer holds a lease
in the registered ledger file (opened read-only via `inspectLedger`). TTL default = today's lease TTL.

Capacity for `ai/*` is read from the machine DB; capacity for repo fences from the ledger DB. `maxConcurrentWriters`
(w2) is a ledger `resources` row.

## 7. Custody boundary

The ledger file sits in `<ledger repo>/.starciwork/`. It is **never** inside an operation allowlist: the
allowlist compiler (`scope.mjs`/`sync.mjs`) refuses any op whose write scope covers `.starciwork/runtime.sqlite*`
with `scope-covers-ledger`. The candidate bridge excludes `.starciwork/**` from candidate observation as it
excludes the continuation projection today. Tampering with the file is therefore an act outside every worker's
contract; the hash chain on `events` and `events_head` on each snapshot make a deletion or rewrite visible at
the continuation boundary (`ledger-verify` runs there, fails closed with `ledger-chain-broken`).

## 8. Store API (`kernel/store.mjs`) — surface kept, backing replaced

`createStore({repoRoot,id})` keeps its exported surface so callers do not churn; the backing changes:

| method | 1.0.3 | 1.0.4 |
|---|---|---|
| `appendEvent(e)` | append line to events.jsonl (+journal receipt) | `INSERT INTO events` (entity_type `workflow`, hash-chained). Returns row with `seq`. |
| `readEvents({since})` | read jsonl + segments | `SELECT … WHERE seq>?` |
| `rotateEvents(gen)` | rename to events.g<n>.jsonl | no-op that records `events-generation-closed` event; generations are a column |
| `saveState` / `loadState` / `transition` / `bindJournal` | dual write | ledger only; `project()` is removed. `bindJournal(ledger,…)` accepts the ledger handle (same shape). |
| `reportPath(d)` / `readReports()` | file paths | `writeReport({dispatchId,…})` / `readReports()` from `reports`; `reportPath` **removed** (grep all callers). |
| `contractPath(op)` | file path | `writeContract({opId,attempt,dispatchId,markdown,context})` / `readContract(opId,attempt)`; `contractPath` **removed**. |
| `checksPath(op)` | file path | `writeChecks({opId,attempt,checks})` / `readChecks(opId,attempt)`. |
| `paths.inbox` | dir | `inbox.push({kind,key,payload})` / `inbox.pending()` / `inbox.settle(id,status,disposition)` |
| `paths.state/events/goal…` | files | **removed**. Anything that needs the goal reads `goal()` → `{markdown,json,revision,identity}`. |
| new | | `signal.set(scope,key,{pid,token,value,ttl})` / `signal.get` / `signal.clear` (kernel.lock, stop.flag, …) |
| new | | `exportTo(dir)` — writes today's file layout for humans (`workflow-export`). |

`listWorkflows(repoRoot)` reads `workflows`. `workflowsRoot` is kept only for the migrator and exporter.

`state.engine.journalFile` becomes `state.engine.ledgerFile`; `predatesEngineSchema` and continuation treat a
state carrying `journalFile` but no `ledgerFile` as `ledger-unmigrated` (fail closed → run `ledger-migrate`).

## 9. Worker IPC

Workers are shell processes in a worktree; they get and give data through the CLI, never through files under
`.starciwork`:

- `starci op-contract --workflow <id> --op <op> [--attempt N] [--dispatch <id>]` → prints the contract markdown
  (and `--json` prints `{markdown,context}`). The dispatch prompt tells the worker to run it.
- `starci report --run … --dispatch … --outcome … --summary …` (existing verb) → `INSERT INTO reports`. Unchanged
  flags; `--from` terminal identity is verified as today.
- Dispatch context (`orca-dispatch-ctx_*.md`) is written to `os.tmpdir()/starci/<dispatch>.md` only when the host
  adapter needs a file on disk; it is a copy of `contracts.context_json`, never the record.

## 10. Migration (`starci ledger-migrate --repo <ledger root> [--journal-file <old>] [--dry-run]`)

For each `_local/workflows/<id>/`: create `workflows` row; import `goal.md`+`goal.json` → `goals` rev 1;
`events.g*.jsonl` then `events.jsonl` → `events` (entity_type `workflow`, digest chain computed on import, the
original `seq` kept in `payload_json._seq`); `state.json` → `state_snapshots` checkpoint `import:<id>:<gen>`;
`reports/*` → `reports`; `contracts/*` → `contracts`; `checks/*` → `checks`; `inbox/*` → `inbox`; locks → nothing
(a lock of a dead process is not migrated). From the old journal, for each workflow id: `jobs`, `leases`,
`events`, `state_snapshots` (kept as older checkpoints), `incidents`, `budgets*`. `ai/*` leases go to the machine
DB. Every source directory/file is recorded in `migrations`; a second run skips recorded sources. Nothing is
deleted; `--archive true` moves `_local/workflows/<id>` to `_local/workflows-archive/<id>.migrated`.

Refuses (fail closed, nothing written) when: a kernel lock for the workflow is held by a live pid; the old
journal holds an unsettled job for the workflow whose `state.json` generation is ahead of the job (that is a
reconcile job for the kernel, not the migrator).

## 11. Verification bar for 1.0.4

- Full suite green (baseline 2166 pass / 0 fail / 6 skip) plus the new specs below.
- `tests/ledger-db.spec.mjs`: schema, trigger `leases_match_job` refuses drift, hash chain verify/break,
  nested transaction refused, two-phase reserve rollback releases machine tokens, sweep of orphan machine rows.
- `tests/ledger-migrate.spec.mjs`: fixture `_local` dir + old journal → ledger; idempotent; refuses live lock.
- `tests/workflow-restart.spec.mjs`: goal → approve → run 2 ops → kill kernel mid-op → delete worktree → recreate
  worktree → resume: done ops stay done, in-flight op reconciles via `settleStoppedOperation`, no `_local`
  writes happened (assert the directory is absent).
- `grep -rn "_local" kernel/ cli/ bin/ hosts/` returns only `ledger-migrate`, `workflow-export`, docs.
- Pin sealed as `1.0.4`; the three live workflows migrated and resumed at their checkpoints.
