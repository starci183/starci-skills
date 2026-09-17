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
- Worktree deletion and process crash keep the record: the record is the ledger DB, it lives in the
  Work-owning repository and it is outside every worker allowlist (see §7). A **repo re-clone does not**:
  `.starciwork/runtime.sqlite` is untracked, so a clone starts with no ledger. What survives a clone is the
  tracked anchor of §12, which turns that loss into a refusal (`ledger-missing` / `ledger-behind-anchor`)
  instead of a silent restart at generation 0. Carrying the bytes across machines is `workflow-export` plus a
  backup, never an assumption.
- Cross-ledger resources still need one arbiter. Only `ai/*` quota and machine budgets are cross-ledger,
  so only they stay machine-scoped, in a table small enough to be reconciled by TTL.

## 3. Module and opening

`kernel/ledger-db.mjs` exports:

```js
export const LEDGER_SCHEMA='starci/ledger-db@1';
export const LEDGER_VERSION=1;
export const ledgerFileFor=repoRoot=>path.join(repoRoot,'.starciwork','runtime.sqlite');
export const machineFileFor=(env=process.env)=>path.join(runtimeRootFor(env),'machine.sqlite');

/** Read-write. Migrates schema, enables FK, synchronous=FULL, journal_mode=WAL. */
export function openLedger({file,now=Date.now,busyTimeoutMs=15000,machine});
/** Read-only, no migration, what an operator inspection and the candidate bridge use. */
export function inspectLedger({file});
/** Read-write machine arbiter. Same options. */
export function openMachine({file,now=Date.now,busyTimeoutMs=15000});
/** The ledger's own identity, from its `meta` row. Never derived from a path. */
export function ledgerIdOf(handle);
```

Both handles expose `{db, transaction(fn), now, file, path, close()}` exactly as `openJournal` does today, so
callers of `journal.transaction`/`journal.db` port by renaming. `transaction` is `BEGIN IMMEDIATE … COMMIT`
with rollback on throw; nested calls are refused (throw), never silently flattened.

`journal_mode=WAL` is the default for both handles: the kernel writes while ten workers read their contracts
through `starci op-contract`, and under DELETE every reader blocks the writer for the length of its read.
`busy_timeout` is 15s to survive a checkpoint under that load. WAL cannot be set on some network and UNC
paths; when `PRAGMA journal_mode=WAL` does not report `wal`, the handle falls back to DELETE, records
`meta.journal_mode`, and `inspectLedger` reports it. WAL makes the ledger three files (`-wal`, `-shm`), so
every copy — archive, `workflow-export`, backup, the supervisor's snapshot — runs
`PRAGMA wal_checkpoint(TRUNCATE)` inside the same handle first and copies `runtime.sqlite` alone. §7's scope
refusal already covers `runtime.sqlite*`, which is why it is written with the glob.

## 4. Schema — ledger DB

```sql
PRAGMA user_version=1; PRAGMA auto_vacuum=INCREMENTAL;

-- the ledger's own identity and open-mode facts. Seeded once, on create, and never rewritten.
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
--   ledger_id     randomUUID() at create. THE identity: it moves with the bytes, so renaming the repo,
--                 a junction, a case change or a UNC path cannot re-key a ledger (a realpath digest can).
--   schema        'starci/ledger-db@1'   created_at  epoch ms   journal_mode  'wal' | 'delete'

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
-- owner-named external inputs, frozen at goal time (today: copies under the WORKTREE's `.starciwork/_local/inputs/<wf>/`,
-- which die with the worktree — restart test 2026-09-17 lost `1-be-architecture-business-handoff.md` and
-- `1-architecture-partition.md` this way). The bytes are the record; an op binds them by `sha256`, never by path.
CREATE TABLE inputs(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), key TEXT NOT NULL,      -- '<index>-<basename>' as today
  goal_revision INTEGER NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, media_type TEXT,
  origin TEXT NOT NULL,           -- the owner's original absolute path or URL, for provenance only
  bytes BLOB NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,key));
-- input ref inside goal/state/contracts: `ledger://inputs/<workflow_id>/<key>#sha256=<hex>`. The candidate bridge
-- and root binding resolve that scheme from the ledger (materialising to `os.tmpdir()/starci/inputs/<wf>/<key>` when a
-- worker needs a file, digest-checked on read); a `.starciwork/_local/inputs/...` ref in a 1.0.4 state is
-- `ledger-unmigrated`. The migrator imports the directory when it still exists and otherwise records the loss.
-- what the ledger imported, so a second migrate is a no-op and an audit can see provenance
CREATE TABLE migrations(source TEXT PRIMARY KEY, kind TEXT NOT NULL, rows_json TEXT NOT NULL, at INTEGER NOT NULL);
```

## 5. Schema — machine DB (`machine.sqlite`)

```sql
PRAGMA user_version=1;
CREATE TABLE ledgers(ledger_id TEXT PRIMARY KEY, file TEXT NOT NULL, registered_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);
--   ledger_id is the ledger's `meta.ledger_id`; `file` is only the last known path, refreshed on every
--   register, and used to reopen the ledger read-only for the sweep. A moved ledger keeps its rows.
CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));   -- ai/<provider>[/<tier>]
CREATE TABLE leases(
  resource_key TEXT NOT NULL, token TEXT NOT NULL, ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
  workflow_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0),
  acquired_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(resource_key,token));
CREATE INDEX machine_leases_expiry ON leases(expires_at);
CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL, used_value INTEGER NOT NULL DEFAULT 0, reserved_value INTEGER NOT NULL DEFAULT 0);
CREATE TABLE budget_reservations(scope_key TEXT NOT NULL, ledger_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL, PRIMARY KEY(scope_key,ledger_id,job_id));
```

`ledger_id` is the ledger's `meta.ledger_id` (a UUID minted at create, stored **inside** the ledger). It is
never derived from a path: a path-derived id re-keys the same ledger whenever the checkout is renamed, reached
through a junction, spelled with different case or opened over UNC — and every machine lease taken under the
old key becomes an orphan that only TTL clears. `openLedger({file,machine})` registers `{ledger_id,file}` and
refreshes `file` and `seen_at`; when a registered `file` no longer opens, or opens with a different
`meta.ledger_id`, the sweep treats every lease of that `ledger_id` as unbacked and releases it.

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
in the registered ledger (reopened read-only via `inspectLedger` at `ledgers.file`, and accepted only when its
`meta.ledger_id` matches — a path that now holds a different ledger proves the old one moved, never that its
leases are live). TTL default = today's lease TTL. This seam is the one place where 1.0.4 detects drift rather
than making it unrepresentable: two files cannot share one transaction. It is bounded deliberately — only
`ai/*` and machine budgets cross it, both TTL'd, both swept every supervisor tick, and a stale machine row
costs a delayed admission, never a wrong one.

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
| new | | `inputs.put({key,goalRevision,bytes,origin,mediaType})` → `{ref,sha256}` / `inputs.get(key)` → `{bytes,sha256,…}` / `inputs.list()` / `inputs.materialise(key,dir)` (digest-checked file copy for a worker) |
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
- `tests/ledger-anchor.spec.mjs`: the anchor is written at every checkpoint; a ledger restored behind its
  anchor refuses with `ledger-behind-anchor`; a missing ledger with a tracked anchor refuses with
  `ledger-missing`; an anchor with no ledger row and no events is the legitimate first boot.
- Identity and mode: a ledger moved to another path keeps its `meta.ledger_id` and its machine leases; a
  path rebuilt with a fresh ledger does not inherit them; a handle that cannot take WAL falls back to DELETE,
  records it in `meta`, and still passes the suite.
- Pin sealed as `1.0.4`; the three live workflows migrated and resumed at their checkpoints.

## 12. Anchor — the tracked head (`.starciwork/ledger-anchor.json`)

The ledger file is untracked and the hash chain is self-consistent: anyone able to write the file can
recompute the whole chain, so the chain proves nothing about *which* history is the agreed one. The anchor is
the small, tracked, human-readable counter-record.

```json
{"schema":"starci/ledger-anchor@1","ledgerId":"<uuid>","updatedAt":0,
 "workflows":{"<workflow_id>":{"generation":7,"checkpointId":"…","eventsHead":"<digest>","seq":412,"at":0}}}
```

- Written inside the same store call that commits a checkpoint (§8 `saveState`): ledger transaction commits,
  then the anchor file is replaced atomically (write temp + rename). A crash between the two leaves the anchor
  one checkpoint behind, which is the safe direction — the ledger being **ahead** of its anchor is normal and
  never refuses.
- Verified at the continuation boundary and by `ledger-verify`, per workflow: the anchor's `eventsHead` must
  exist in `events` with that `seq`, and `state_snapshots` must hold a checkpoint at or after the anchor's
  `generation`. A ledger that lacks the anchored head is a restored, rolled-back or rewritten file → fail
  closed `ledger-behind-anchor`. A tracked anchor with no ledger file at all → `ledger-missing`, whose named
  recovery is restoring a backup or `ledger-migrate`, never a fresh start.
- `ledgerId` mismatch between anchor and `meta` → `ledger-identity-mismatch`: a different ledger was dropped
  into a checkout that already carried a history.
- The anchor is committed with the Work it describes, so a re-clone carries it. It is deliberately not the
  record: it holds heads, never state, and it can be regenerated from a healthy ledger
  (`starci ledger-anchor --write`).
- The sealed runtime pin records the anchor digest of each live workflow, so a pin and a checkout that
  disagree are caught at seal time rather than mid-run.

## 13. The rest of `_local` — what becomes a row, and what was never a record

§1 retired `_local/workflows`. A live root holds more than that, and the families are not alike. Measured on
`nivo-backend/.starciwork/_local` (2.1 GB total):

| family | size | verdict |
|---|---|---|
| `workflows/<id>/` | 47 MB | already rows (§4, §10) |
| `plans/<id>/{PLAN.md,goal,approval,run,index.yaml}` | 183 KB | **new `plans` table** |
| `history/` | 210 KB | **new `history` table** |
| `runtime/orca-dispatch-ctx_*.md` | 80 KB | not a record: §9 puts it in `os.tmpdir()`. Deleted, never imported |
| `drafts/` (html, png, `dist/`) | 62 MB | **not a record**: product artifacts. They belong in the repository |
| `workflow-archive/`, `workflows-archive/`, `workflow-retirement/` | 2 GB | retired bodies and backup manifests: rows migrate, bytes do not |

The rule this table applies, so the next family is decided the same way: **the ledger holds what a kernel
continues from and what an audit must read.** Bytes that are neither do not become records by being moved into
one. A 1.5 GB retirement backup inside `runtime.sqlite` would make every copy of the record carry a copy of
its own backup, and `archive = copy one file` (§2) would stop being true.

```sql
-- Plan v2 state: today's `_local/plans/<id>/`, written by workflows/lifecycle.mjs. Append-only per revision,
-- so an approval can always be read against the exact plan text it approved.
CREATE TABLE plans(
  plan_seq INTEGER PRIMARY KEY AUTOINCREMENT, plan_id TEXT NOT NULL, revision INTEGER NOT NULL,
  workflow_id TEXT REFERENCES workflows(workflow_id),   -- null until a plan becomes a workflow
  phase TEXT NOT NULL, markdown TEXT NOT NULL, index_json TEXT, goal_json TEXT, approval_json TEXT,
  run_json TEXT, work_root TEXT, created_at INTEGER NOT NULL, UNIQUE(plan_id,revision));

-- today's `_local/history/`: what a migration or a rename did, kept because an audit reads it
CREATE TABLE history(
  history_id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, subject TEXT, payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL);
CREATE INDEX history_subject ON history(kind,subject,history_id);
```

`ledger-migrate` imports `plans/` and `history/`, records every archive and retirement directory it found in
`migrations` with its size and its verdict (`archived-bytes-not-imported`), refuses to swallow `drafts/`, and
names each one in its result so the owner places them deliberately. Only once a root reports `ok:true` and
`ledger-verify` passes is `_local` removed: `--archive true` moves it to `_local.migrated` first, and the
owner deletes that when the anchor and the ledger agree.

`workflows/storage.mjs`'s `stateRoot(workRoot)` and `workflows/lifecycle.mjs`'s plan writers are the last
`_local` writers outside the migrator; they move onto `store.plans.*`. After that the grep bar of §11 covers
`workflows/` too, and a Work root that still has a `_local` directory is a root that has not been migrated.

