-- ============================================================================
-- schema.sql — the ledger DB `.starciwork/runtime.sqlite` (schema
-- `starci/ledger-db@1`, LEDGER_VERSION=1). This is the EXECUTED source of
-- truth: `engine/ledger-db.mjs` reads and db.exec()s this file inside the
-- v1 create transaction (migrateLedger). Originally extracted verbatim from
-- `kernel/ledger-db.mjs` (const LEDGER_DDL, META_TABLE_DDL,
-- EVENTS_DIGEST_TRIGGER) and cross-checked against `docs/ledger-db.md` §4.
-- The events_digest_chain trigger also lives standalone in triggers.sql for
-- the v1 meta/trigger backfill path — keep them byte-equivalent.
--
-- Business frame (docs/ledger-db.md §1/§2): one SQLite file per Work-root
-- repository owns EVERYTHING a workflow needs to continue, to be audited and to
-- be archived — state snapshots, the hash-chained event log, the job queue,
-- resource fences, budgets, worker↔kernel IPC (contracts out, reports in),
-- owner inbox, process signals and provider loads. Archive = copy one file;
-- inspect = SELECT. `machine.sqlite` (see machine.sql) holds only the
-- cross-ledger arbiter rows.
--
-- Open/create facts (ledger-db.mjs::openDb / migrateLedger), not in the DDL body:
--   PRAGMA auto_vacuum=INCREMENTAL   -- set on open BEFORE the first table; only takes on an empty db
--   PRAGMA foreign_keys=ON           -- FKs below are enforced, incl. ON DELETE CASCADE on leases/budget_reservations
--   PRAGMA synchronous=FULL
--   PRAGMA journal_mode=WAL          -- requested; DELETE fallback recorded in meta.journal_mode (§3)
--   PRAGMA user_version=1            -- set inside the create transaction
--   CREATE FUNCTION starci_sha256    -- registered by openLedger (registerDigestFunction); deterministic,
--                                    -- mirrors digestOf(): sha256(text). Required by events_digest_chain.
--
-- Migration note: a v1 file can predate `meta` and the digest trigger — both were
-- added to the DDL without a version bump. migrateLedger backfills the meta DDL
-- standalone and installs triggers.sql's trigger if absent (engine/ledger-db.mjs
-- migrateLedger).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- meta — the ledger's own IDENTITY and open-mode facts. One row per key, seeded
-- once at create and never rewritten (except journal_mode, kept in step with the
-- mode an open actually achieved). What a row lets the kernel decide:
--   ledger_id     — randomUUID at create; THE identity. Moves with the bytes, so
--                   renaming the repo / junctions / case changes / UNC paths cannot
--                   re-key it (a realpath digest can — that is why the id lives
--                   inside the file, §5). machine.sqlite rows key on this value.
--   schema        — 'starci/ledger-db@1'
--   created_at    — epoch ms of creation
--   journal_mode  — 'wal' | 'delete' as achieved (WAL may be impossible on
--                   network/UNC paths; the fallback is recorded, not hidden)
-- ----------------------------------------------------------------------------
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- ----------------------------------------------------------------------------
-- workflows — one row per workflow this ledger owns. Registration + bound
-- generation + current phase + archive marker. What a row lets the kernel
-- decide: does this ledger own workflow X (createStore refuses `ledger-unmigrated`
-- when a `_local` dir exists without this row), and which generation is the bound
-- one (retention deletes everything below `generation`).
--   generation    — the bound engine generation (DEFAULT 0 = never enrolled)
--   goal_identity — digest of the approved goal the bound generation runs under
--   finished_json — terminal outcome record; a finished workflow with no live
--                   rows is a retirement candidate (hosts/orca/launch.mjs)
--   pin_digest    — sealed runtime pin digest recorded at enrollment
--   archived_at   — set when the workflow's record was exported/archived
-- ----------------------------------------------------------------------------
CREATE TABLE workflows(
  workflow_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  ledger_mode TEXT, source_roots_json TEXT, generation INTEGER NOT NULL DEFAULT 0,
  goal_identity TEXT, phase TEXT, finished_json TEXT, pin_digest TEXT, archived_at INTEGER);

-- ----------------------------------------------------------------------------
-- goals — the approved goal document(s), append-only. One row per revision;
-- UNIQUE(workflow_id,revision) makes a revision immutable once written.
-- What a row lets the kernel decide: which goal revision a snapshot/input binds
-- to, and whether a `workflow-amend` produced a new revision (amendment_json set)
-- or a re-render of the same one (UPDATE of markdown only — store.reviseGoalMarkdown).
-- ----------------------------------------------------------------------------
CREATE TABLE goals(
  goal_seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
  revision INTEGER NOT NULL, goal_identity TEXT NOT NULL, markdown TEXT NOT NULL, json TEXT NOT NULL,
  amendment_json TEXT, created_at INTEGER NOT NULL, UNIQUE(workflow_id,revision));

-- ----------------------------------------------------------------------------
-- state_snapshots — the recovery state. checkpoint_id namespaces the write kind:
--   'save:<wf>:<gen>:<digest>'        periodic save (retention keeps only latest)
--   'bind:<wf>:<gen>:<digest>'        durable-binding seed snapshot
--   'transition:<wf>:<gen>:<txId>'    idempotent engine transition (replayed
--                                   transitions are recognised, body or not)
--   'import:<wf>:<gen>'               migrator-written checkpoint
-- What a row lets the kernel decide: where a workflow resumes (latest body),
-- whether a transition already ran (checkpoint_id present), and whether the
-- ledger still reaches the anchor's generation (verifyAnchor).
-- Retention (journal.mjs RETENTION, ported whole): the bound (wf,gen,goal) keeps
-- ONE state body + its transition/bind rows + only the latest save row; retired
-- generations keep nothing. Compacted on every open and every save.
-- OBSERVED: no production INSERT exists — only retention (compactSnapshots) and
-- retireWorkflow mutate this table; tests seed rows directly. The save/bind/
-- transition checkpoint writer (and the writeAnchor caller that pairs with it)
-- is a real hole, not declared-ahead IPC.
-- ----------------------------------------------------------------------------
CREATE TABLE state_snapshots(
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT, checkpoint_id TEXT NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
  goal_identity TEXT NOT NULL, state_json TEXT NOT NULL, events_head TEXT, created_at INTEGER NOT NULL);
CREATE INDEX state_snapshots_lookup ON state_snapshots(workflow_id,generation,goal_identity,snapshot_id);

-- ----------------------------------------------------------------------------
-- events — ONE event table for both audit lines (entity_type='workflow') and
-- custody/job events ('job', 'runtime-file', ...). seq is the workflow-wide
-- order. prev_digest/digest form a sha256 chain PER WORKFLOW:
--   digest = sha256(prev_digest ?? '' || event_id || kind || payload_json || created_at)
-- What a row lets the kernel decide: whether a launch/settlement receipt exists
-- (spawned vs never-launched), what the custody receipt of a runtime file was,
-- and — via verifyChain/verifyAnchor — whether the recorded history was tampered
-- with or rolled back. The chain makes deletion/reorder IMPOSSIBLE TO PERSIST
-- silently rather than detectable later (the trigger below recomputes the link
-- on every INSERT regardless of what the writer supplied; a writer cannot omit
-- it — digest defaults to '' so the NOT NULL never trips, then the AFTER INSERT
-- trigger overwrites both digest columns from the workflow's own history).
-- ----------------------------------------------------------------------------
CREATE TABLE events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT,
  prev_digest TEXT, digest TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX events_entity ON events(workflow_id,entity_type,entity_id,seq);
CREATE INDEX events_kind ON events(workflow_id,kind,seq);

-- EVENTS_DIGEST_TRIGGER (ledger-db.mjs:46-51). The table itself enforces the
-- chain because callers legitimately write events directly (jobs.mjs writes job
-- receipts without digest columns). Rationale is verbatim from the module: a
-- caller can omit or get the chain wrong, so the chain is enforced by the table.
CREATE TRIGGER IF NOT EXISTS events_digest_chain AFTER INSERT ON events BEGIN
    UPDATE events SET
      prev_digest=(SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),
      digest=starci_sha256(COALESCE((SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),'')||NEW.event_id||NEW.kind||COALESCE(NEW.payload_json,'')||NEW.created_at)
    WHERE seq=NEW.seq;
  END;

-- ----------------------------------------------------------------------------
-- jobs — the durable job queue; one row per admitted unit of model/operation/
-- judge/check work. Statuses observed in code: 'queued','leased','running',
-- 'effect_unknown','succeeded','failed','cancelled' (settled = the last three).
-- What a row lets the kernel decide: may this worker claim (status+lease_token
-- fence), is a settled result a duplicate (event_id dedupe in jobs.complete),
-- and what must be reconciled after a crash (leased/running/effect_unknown with
-- a dead pid). lease_token is the fencing token: every state transition names
-- it, so a stale worker cannot settle a job it no longer owns.
-- ----------------------------------------------------------------------------
CREATE TABLE jobs(
  job_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT,
  attempt INTEGER NOT NULL, generation INTEGER NOT NULL, kind TEXT NOT NULL, role TEXT, payload_json TEXT,
  status TEXT NOT NULL, priority_json TEXT, lease_token TEXT, worker_id TEXT, deadline INTEGER,
  result_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX jobs_queue ON jobs(status,kind,created_at,job_id);
CREATE INDEX jobs_op ON jobs(workflow_id,op_id,attempt);

-- ----------------------------------------------------------------------------
-- resources — declared capacities for REPO-SCOPED fences only
-- (canonical-writer:*, source-root:*, lane:*, and `maxConcurrentWriters` per §6).
-- ai/* and machine:* capacities live in machine.sqlite, never here.
-- What a row lets the kernel decide: whether a reservation can be admitted —
-- reserveTwoPhase refuses when SUM(live lease units) + needed > capacity.
-- OBSERVED: the production writer is api.mjs reserveOpLeases, which seeds one
-- `path:<normalized owned_path>` row per op write path at capacity 1
-- (OR IGNORE — an operator-declared capacity is never overwritten).
-- machine.setCapacity writes machine.sqlite's own resources table, not this
-- one.
-- ----------------------------------------------------------------------------
CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));

-- ----------------------------------------------------------------------------
-- leases — live resource reservations held by a job. PK (resource_key,job_id):
-- one job holds one lease per resource. machine_ref carries the paired
-- machine.sqlite token for ai/*/machine:* rows so a ledger-only reader still
-- sees what the op holds (§6). expires_at is the TTL that bounds a crashed
-- worker's fence.
-- What a row lets the kernel decide: which capacity is spoken for, whether an
-- operation's reservation is still exactly what it was admitted with
-- (engine.mjs intent-v1 exact-binding check), and what a release must also
-- release on the machine side (machine_ref).
-- writtenBy: reserveTwoPhase inside api.mjs reserveOpLeases — `api dispatch
-- --spawn` takes `path:*` unit leases (fencing token = jobs.lease_token)
-- BEFORE anything launches; a refused reservation is a dispatch-rejected.
-- settle and dispatch-rejected delete the job's rows; expires_at bounds a
-- crashed worker's fence.
-- ----------------------------------------------------------------------------
CREATE TABLE leases(
  resource_key TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL, op_id TEXT, attempt INTEGER NOT NULL, generation INTEGER NOT NULL,
  token TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0), acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, machine_ref TEXT,
  PRIMARY KEY(resource_key,job_id));
CREATE INDEX leases_expiry ON leases(expires_at);

-- lease-identity-drift made impossible to persist (§2): a lease row's
-- (workflow_id,op_id,attempt,generation,token) must equal its job's
-- (workflow_id,op_id,attempt,generation,lease_token). `op_id IS NEW.op_id`
-- (not `=`) so NULL op_ids compare correctly. INSERT and UPDATE both guarded —
-- the abort surfaces to callers as the named failure 'lease-identity-drift'
-- (admission.mjs::isLeaseDrift maps it back to {ok:false}).
CREATE TRIGGER leases_match_job BEFORE INSERT ON leases BEGIN
    SELECT RAISE(ABORT,'lease-identity-drift') WHERE NOT EXISTS(
      SELECT 1 FROM jobs j WHERE j.job_id=NEW.job_id AND j.workflow_id=NEW.workflow_id
        AND j.op_id IS NEW.op_id AND j.attempt=NEW.attempt AND j.generation=NEW.generation
        AND j.lease_token=NEW.token);
  END;
CREATE TRIGGER leases_match_job_update BEFORE UPDATE ON leases BEGIN
    SELECT RAISE(ABORT,'lease-identity-drift') WHERE NOT EXISTS(
      SELECT 1 FROM jobs j WHERE j.job_id=NEW.job_id AND j.workflow_id=NEW.workflow_id
        AND j.op_id IS NEW.op_id AND j.attempt=NEW.attempt AND j.generation=NEW.generation
        AND j.lease_token=NEW.token);
  END;

-- ----------------------------------------------------------------------------
-- budgets / budget_reservations — LEDGER-scoped spend limits (repo budgets).
-- reserved_value counts in-flight holds; used_value counts consumed spend;
-- both CHECK >=0 and admission computes used+reserved+request <= limit_value.
-- What a row lets the kernel decide: whether an op may be admitted under a
-- declared budget, and what returns to the pool on release (reserved back,
-- optionally consumed into used on completion). NOTE: machine budgets
-- (scope_key machine:*) live in machine.sqlite; these are the repo-local ones.
-- OBSERVED: no writer or reader exists in current code — reserveTwoPhase
-- admits on resources + machine needs only. Declared-ahead for the admission
-- layer; empty until it lands.
-- ----------------------------------------------------------------------------
CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL CHECK(limit_value>=0),
  used_value INTEGER NOT NULL DEFAULT 0 CHECK(used_value>=0), reserved_value INTEGER NOT NULL DEFAULT 0 CHECK(reserved_value>=0));
CREATE TABLE budget_reservations(scope_key TEXT NOT NULL REFERENCES budgets(scope_key), job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  units INTEGER NOT NULL CHECK(units>0), PRIMARY KEY(scope_key,job_id));

-- ----------------------------------------------------------------------------
-- incidents — the fingerprinted escalation record. writtenBy:
-- scripts/kernel/api.mjs — the `incident` verb (cmdIncident) and the
-- dispatch-rejected path (rejectDispatch files a typed infra-provider incident
-- on attestation failures). Per-retry counters still live in workflow state,
-- not here; retireWorkflow drops the rows. (An earlier OBSERVED note recorded
-- "no current kernel code writes this table" — true before api.mjs existed,
-- corrected now.)
-- ----------------------------------------------------------------------------
CREATE TABLE incidents(incident_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  model_calls INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0,
  last_progress TEXT, status TEXT NOT NULL, updated_at INTEGER NOT NULL);

-- ----------------------------------------------------------------------------
-- reports — worker → kernel direction of the op IPC (was reports/<dispatch>.json).
-- Written by `starci report`, consumed by the kernel; UNIQUE(workflow_id,
-- dispatch_id) + upsert makes one dispatch idempotent. consumed_at marks the
-- report the kernel already integrated — a paused op's own report is consumed
-- so it is never read as its answer (owner.mjs).
-- What a row lets the kernel decide: the operation's typed outcome
-- (done|partial|failed|ask|blocked) and whether it was already consumed.
-- writtenBy: `api report` (cmdReport — INSERT OR REPLACE, consumed_at reset
-- NULL on a re-file; dispatch_id is the worker's handle, falling back to the
-- job id). consumed_at is stamped by `api consume-report` and again by
-- `settle` when it integrates the verdict (the durable signal is spent once).
-- ----------------------------------------------------------------------------
CREATE TABLE reports(
  report_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
  dispatch_id TEXT NOT NULL, op_id TEXT, attempt INTEGER, generation INTEGER, outcome TEXT NOT NULL,
  report_json TEXT NOT NULL, from_terminal TEXT, consumed_at INTEGER, created_at INTEGER NOT NULL,
  UNIQUE(workflow_id,dispatch_id));

-- ----------------------------------------------------------------------------
-- contracts — kernel → worker direction of the op IPC (was contracts/<op>.md +
-- orca-dispatch-ctx_*.md). Workers read it via `starci op-contract`; PK
-- (workflow_id,op_id,attempt) makes an attempt's contract exactly one row.
-- What a row lets the kernel decide: what an operation was actually asked to do
-- — the contract is the dispatch authority, never the terminal prompt.
-- writtenBy: `api dispatch` (fileContract — INSERT OR REPLACE of the rendered
-- prompt + packet markdown, written BEFORE jobs flips to 'running' on both the
-- terminal and the managed-worker path; dispatch_id is the worker's handle).
-- The worker reads it back with `api op-contract`.
-- ----------------------------------------------------------------------------
CREATE TABLE contracts(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
  dispatch_id TEXT, markdown TEXT NOT NULL, context_json TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY(workflow_id,op_id,attempt));

-- ----------------------------------------------------------------------------
-- checks — the kernel's re-run check results per op attempt (was checks/<op>.json).
-- Same keying as contracts: one row per (workflow_id,op_id,attempt).
-- What a row lets the kernel decide: what independent verification an accepted
-- slice passed — written by the operation that re-ran the checks, read on
-- continuation/review.
-- writtenBy: `api check` (cmdCheck — INSERT OR REPLACE of the kernel's re-run
-- results for the attempt, filed between consume-report and settle).
-- ----------------------------------------------------------------------------
CREATE TABLE checks(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
  checks_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,op_id,attempt));

-- ----------------------------------------------------------------------------
-- inbox — owner → kernel direction: owner answers, amendments, late inputs.
-- Append-only pending rows; the kernel settles each as applied/rejected
-- (status + disposition_json + applied_at). What a row lets the kernel decide:
-- which owner inputs still need integrating into the current generation.
-- ----------------------------------------------------------------------------
CREATE TABLE inbox(
  inbox_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
  kind TEXT NOT NULL, key TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  disposition_json TEXT, created_at INTEGER NOT NULL, applied_at INTEGER);

-- ----------------------------------------------------------------------------
-- signals — small keyed process facts, replacing the old dot-files
-- (kernel.lock / supervisor.lock / stop.flag / inputs.lock / launch.json /
-- final-report.json). scope = workflow_id, or '*' ledger-wide (supervisor).
-- holder_pid+token+expires_at fence a lock the way lease_token fences a job.
-- What a row lets the kernel decide: is a kernel alive for this workflow
-- (kernel-lock holder_pid live + unexpired), was a stop requested ('stop'),
-- and which dispatch/terminal a launch reserved ('launch').
-- OBSERVED: expires_at exists but no reader filters on it in a SELECT — expiry
-- is evaluated in JS after the row is read (continuation.mjs/launch.mjs).
-- writtenBy: scripts/kernel/start-workflow.mjs — the only current writer; it
-- keys the kernel singleton as scope='kernel', key=<workflow_id> (the inverse
-- of the scoping described above) and never writes 'stop'/'launch' keys.
-- ----------------------------------------------------------------------------
CREATE TABLE signals(
  scope TEXT NOT NULL, key TEXT NOT NULL,
  holder_pid INTEGER, token TEXT, value_json TEXT, at INTEGER NOT NULL, expires_at INTEGER,
  PRIMARY KEY(scope,key));

-- ----------------------------------------------------------------------------
-- runtime_loads — the supervisor's provider-load view (was runtime-loads.json /
-- runtimes.json). runtime rows prefixed 'ai/provider:' carry per-provider load
-- JSON; unprefixed rows carry runtime entries (loads.mjs::readRows/writeRuntimes
-- split on the prefix). What a row lets the kernel decide: which provider has
-- headroom for the next admission.
-- OBSERVED: no writer or reader — loads.mjs and the supervisor it served are
-- retired, and live provider load is probed instead (scripts/api/quota +
-- modules/models/runtimes.yaml in api.mjs `route`). Vestigial unless a
-- supervisor returns.
-- ----------------------------------------------------------------------------
CREATE TABLE runtime_loads(runtime TEXT PRIMARY KEY, loads_json TEXT NOT NULL, at INTEGER NOT NULL);

-- ----------------------------------------------------------------------------
-- inputs — owner-named external inputs frozen at goal time as BYTES. Replaced
-- worktree-copied files under `.starciwork/_local/inputs/<wf>/` that died with
-- the worktree (restart test 2026-09-17 lost real inputs this way). The bytes
-- are the record; an op binds them by sha256 through the ref scheme
-- `ledger://inputs/<workflow_id>/<key>#sha256=<hex>` — never by path. origin is
-- provenance only. readInput refuses `input-digest-mismatch` on tampered bytes.
-- OBSERVED: the handle writer exists (openLedger().inputs.put) but no script
-- calls it — the goal-time freeze is declared-ahead, caller missing.
-- ----------------------------------------------------------------------------
CREATE TABLE inputs(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), key TEXT NOT NULL,      -- '<index>-<basename>' as today
  goal_revision INTEGER NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, media_type TEXT,
  origin TEXT NOT NULL,           -- the owner's original absolute path or URL, for provenance only
  bytes BLOB NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,key));

-- ----------------------------------------------------------------------------
-- migrations — provenance of everything ledger-migrate imported or reported:
-- one row per source ('<dir>', '<journal>#<wf>', '<journal>#shared',
-- '<inputsDir>', '<dir>#anchor', '<_local family>'). What a row lets the kernel
-- decide: whether a second migrate run is a no-op (source already recorded) and
-- which `_local` families were reported `deleted-not-imported` (§13).
-- OBSERVED: vestigial — the only writer was scripts/ledger/ledger-migrate.mjs,
-- retired with the journal reader it served; the table stays as the import
-- provenance it already holds.
-- ----------------------------------------------------------------------------
CREATE TABLE migrations(source TEXT PRIMARY KEY, kind TEXT NOT NULL, rows_json TEXT NOT NULL, at INTEGER NOT NULL);
