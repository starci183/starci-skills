-- ============================================================================
-- schema.sql — the ledger DB `.starciwork/runtime.sqlite` (schema
-- `starci/ledger-db@1`, LEDGER_VERSION=1). This is the EXECUTED source of
-- truth: `engine/ledger-db.mjs` reads and db.exec()s this file inside the
-- v1 create transaction (migrateLedger); cross-checked against
-- `docs/ledger-db.md` §4. The events_digest_chain trigger also lives
-- standalone in triggers.sql for the meta/trigger backfill path — keep them
-- byte-equivalent.
--
-- Business frame (docs/ledger-db.md §1/§2): one SQLite file per Work-root
-- repository owns EVERYTHING a workflow needs to continue, to be audited and to
-- be archived — the hash-chained event log, the job queue, resource fences,
-- worker↔kernel IPC (contracts out, reports in),
-- owner inbox and process signals. Archive = copy one file;
-- inspect = SELECT. `machine.sqlite` (see machine.sql) holds only the
-- cross-ledger arbiter rows.
--
-- Open/create facts (ledger-db.mjs::openDb / migrateLedger), not in the DDL body:
--   PRAGMA auto_vacuum=INCREMENTAL   -- set on a new (empty) file only, BEFORE the first table
--   PRAGMA foreign_keys=ON           -- FKs below are enforced, incl. ON DELETE CASCADE on leases/budget_reservations
--   PRAGMA synchronous=NORMAL         -- plus busy_timeout>=15000, temp_store=MEMORY, cache_size, wal_autocheckpoint (ledger-db.mjs LEDGER_PRAGMAS)
--   PRAGMA journal_mode=WAL          -- requested; DELETE fallback recorded in meta.journal_mode (§3)
--   PRAGMA user_version=1            -- set inside the create transaction
--   CREATE FUNCTION starci_sha256    -- registered by openLedger (registerDigestFunction); deterministic,
--                                    -- sha256(text). Required by events_digest_chain.
--
-- Backfill note: a v1 file can predate `meta` and the digest trigger.
-- migrateLedger backfills the meta DDL standalone and installs triggers.sql's
-- trigger if absent (engine/ledger-db.mjs migrateLedger). A table added after v1
-- carries the IF NOT EXISTS guard; migrateLedger runs that one statement
-- on a ledger that lacks it (ADDITIVE_TABLES).
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
-- decide: does this ledger own workflow X, and which generation is the bound
-- one.
--   generation    — the bound engine generation (DEFAULT 0 = never enrolled)
--   goal_identity — digest of the approved goal the bound generation runs under
--   finished_json — terminal outcome record
--   pin_digest    — sealed runtime pin digest recorded at enrollment
--   archived_at   — set when the workflow's record was exported/archived
--   display_name  — the human name (`<Product> · <what it does>`, Vietnamese): set at define-goal and by
--                   api rename; a label only — workflow_id stays the key, title the goal slug
-- ----------------------------------------------------------------------------
CREATE TABLE workflows(
  workflow_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  ledger_mode TEXT, source_roots_json TEXT, generation INTEGER NOT NULL DEFAULT 0,
  goal_identity TEXT, phase TEXT, finished_json TEXT, pin_digest TEXT, archived_at INTEGER, display_name TEXT);

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
-- state_snapshots — reserved: no runtime writer or reader. Kept so the table
-- shape of existing ledgers never changes.
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
-- (spawned vs never-launched) and what the workflow's history was. The trigger
-- below computes the link on every INSERT regardless of what the writer
-- supplied: digest defaults to '' so the NOT NULL never trips, then the AFTER
-- INSERT trigger overwrites both digest columns from the workflow's own history.
-- ----------------------------------------------------------------------------
CREATE TABLE events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT,
  prev_digest TEXT, digest TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX events_entity ON events(workflow_id,entity_type,entity_id,seq);
CREATE INDEX events_kind ON events(workflow_id,kind,seq);
-- events_workflow_seq: the digest chain's "newest event of this workflow before NEW.seq" (the trigger below, run
-- twice per INSERT, and eventsHead) is one index probe instead of sorting the workflow's whole history under the
-- write lock (2026-09-27 throughput work: ~0.3 ms per probe at 2.8k events, growing with the workflow). Added
-- after v1 (ADDITIVE_INDEXES).
CREATE INDEX IF NOT EXISTS events_workflow_seq ON events(workflow_id, seq);

-- events_digest_chain: the table owns the chain, so a writer that omits or
-- miscomputes the digest columns still leaves a correct link.
CREATE TRIGGER IF NOT EXISTS events_digest_chain AFTER INSERT ON events BEGIN
    UPDATE events SET
      prev_digest=(SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),
      digest=starci_sha256(COALESCE((SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),'')||NEW.event_id||NEW.kind||COALESCE(NEW.payload_json,'')||NEW.created_at)
    WHERE seq=NEW.seq;
  END;

-- ----------------------------------------------------------------------------
-- jobs — the durable job queue; one row per admitted unit of model/operation/
-- judge/check work. The status vocabulary is engine/ledger-db.mjs JOB_STATUSES.
-- What a row lets the kernel decide: may this worker claim (status+lease_token
-- fence) and what must be reconciled after a crash (leased/running/effect_unknown with
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
-- Writer: api.mjs reserveOpLeases seeds one `path:<normalized owned_path>` row
-- per op write path at capacity 1 (OR IGNORE — an operator-declared capacity is
-- never overwritten).
-- ----------------------------------------------------------------------------
CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));

-- ----------------------------------------------------------------------------
-- leases — live resource reservations held by a job. PK (resource_key,job_id):
-- one job holds one lease per resource. machine_ref is reserved (always NULL:
-- no machine-side reservation is taken). expires_at is the TTL that bounds a
-- crashed worker's fence.
-- What a row lets the kernel decide: which capacity is spoken for, and whether
-- an operation's reservation is still exactly what it was admitted with.
-- writtenBy: reserveTwoPhase inside api.mjs reserveOpLeases — `api dispatch` takes `path:*` unit leases (fencing token = jobs.lease_token)
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
-- the abort throws 'lease-identity-drift' out of the writing statement.
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
-- budgets / budget_reservations — reserved: no runtime writer or reader. Kept so
-- the table shape of existing ledgers never changes.
-- ----------------------------------------------------------------------------
CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL CHECK(limit_value>=0),
  used_value INTEGER NOT NULL DEFAULT 0 CHECK(used_value>=0), reserved_value INTEGER NOT NULL DEFAULT 0 CHECK(reserved_value>=0));
CREATE TABLE budget_reservations(scope_key TEXT NOT NULL REFERENCES budgets(scope_key), job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  units INTEGER NOT NULL CHECK(units>0), PRIMARY KEY(scope_key,job_id));

-- ----------------------------------------------------------------------------
-- incidents — the fingerprinted escalation record. writtenBy:
-- scripts/kernel/api.mjs — the `incident` verb (cmdIncident) and the
-- dispatch-rejected path (rejectDispatch files a typed infra-provider incident
-- on attestation failures).
-- ----------------------------------------------------------------------------
CREATE TABLE incidents(incident_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  model_calls INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0,
  last_progress TEXT, status TEXT NOT NULL, updated_at INTEGER NOT NULL);

-- ----------------------------------------------------------------------------
-- reports — worker → kernel direction of the op IPC.
-- Written by `starci report`, consumed by the kernel; UNIQUE(workflow_id,
-- dispatch_id) + upsert makes one dispatch idempotent. consumed_at marks the
-- report the kernel already integrated — a paused op's own report is consumed
-- so it is never read as its answer.
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
-- contracts — kernel → worker direction of the op IPC.
-- Workers read it via `starci op-contract`; PK
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
-- checks — the kernel's re-run check results per op attempt.
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
-- signals — small keyed process facts (lock fencing, stop requests, launch
-- reservations). scope = workflow_id, or '*' ledger-wide (supervisor).
-- holder_pid+token+expires_at fence a lock the way lease_token fences a job;
-- expiry is evaluated in JS after the row is read, not in a SELECT. What a row lets the kernel decide: is a kernel alive for
-- this workflow (kernel-lock holder_pid live + unexpired), was a stop requested
-- ('stop'), and which dispatch/terminal a launch reserved ('launch').
-- Writer: scripts/kernel/start-workflow.mjs keys the kernel singleton as
-- scope='kernel', key=<workflow_id>.
-- ----------------------------------------------------------------------------
CREATE TABLE signals(
  scope TEXT NOT NULL, key TEXT NOT NULL,
  holder_pid INTEGER, token TEXT, value_json TEXT, at INTEGER NOT NULL, expires_at INTEGER,
  PRIMARY KEY(scope,key));

-- ----------------------------------------------------------------------------
-- inputs — reserved: no runtime writer or reader. Kept so the table shape of
-- existing ledgers never changes.
-- ----------------------------------------------------------------------------
CREATE TABLE inputs(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), key TEXT NOT NULL,      -- '<index>-<basename>'
  goal_revision INTEGER NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, media_type TEXT,
  origin TEXT NOT NULL,           -- the owner's original absolute path or URL, for provenance only
  bytes BLOB NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,key));


-- ----------------------------------------------------------------------------
-- work_graph_versions — a workflow's work graph (modules/schemas/work-graph.schema.yaml
-- starci/work-graph@1), one immutable row per version. Added after v1: migrateLedger
-- creates it on an existing ledger from this statement (ADDITIVE_TABLES), so the
-- shape of every other table never changes. What a row lets the kernel decide:
-- which slices and nodes exist, which ones owe rework (colors_json), and who
-- changed the graph, when and why.
--   version     — 0 is the drawing scope.define (or a backfill) records; each
--                 revision is the next integer, never a rewrite
--   event       — draw | revise | cut | backfill ($defs.event)
--   diff_json   — {added, removed, changed, edgesAdded, edgesRemoved, red}
--   colors_json — {nodeId: gray|yellow|green|red} after the colour rule
-- writtenBy: scripts/work/work-graph.mjs propose and
-- scripts/work/backfill-work-graph.mjs --apply (scripts/work/work-graph-store.mjs).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_graph_versions(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), version INTEGER NOT NULL CHECK(version>=0),
  event TEXT NOT NULL, graph_json TEXT NOT NULL, diff_json TEXT NOT NULL, colors_json TEXT NOT NULL,
  reason TEXT NOT NULL, author_op TEXT NOT NULL, author_job TEXT, digest TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(workflow_id,version));

-- ----------------------------------------------------------------------------
-- job_artifacts — every output a job produced, kept as proof: one row per file,
-- linked to exactly the job that produced it. Paths only, never bytes. Added
-- after v1: migrateLedger creates it on an existing ledger from this statement
-- (ADDITIVE_TABLES). What a row lets the runtime decide: what a job proved and
-- where its bytes are, whether they still match (sha256), and which paths
-- housekeeping must never remove (scripts/lib/artifact-hold.mjs).
--   kind        — engine/ledger-db.mjs JOB_ARTIFACT_KINDS
--   path        — relative to the ledger's repository, '/'-separated; a file the
--                 job named outside <repo>/.starciwork is copied into the job's
--                 kernel dir first and `origin` keeps where it came from
--   label       — the XBase#state@viewport, viewport or patch state it shows
--   head_sha / landed_sha / base_sha — a patch row's range: the report head,
--                 the sha that reached the branch, and the base the diff starts at
--   subkind     — what produced the file (engine/ledger-db.mjs JOB_ARTIFACT_SUBKINDS:
--                 draw-render, asset-gen, app-capture, uat-video, playwright-trace,
--                 critique, ...), derived at index time from the op id, the path
--                 conventions and the ui record manifests
--                 (scripts/kernel/artifact-subkind.mjs); NULL when not derivable.
--                 Added after v1: migrateLedger adds it to an existing ledger
--                 (ADDITIVE_COLUMNS); scripts/work/backfill-artifact-subkind.mjs
--                 derives it for rows indexed before it existed.
-- writtenBy: scripts/kernel/job-artifacts.mjs indexJobArtifacts (api settle, and
-- scripts/work/backfill-job-artifacts.mjs --apply).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_artifacts(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), job_id TEXT NOT NULL, op_id TEXT, attempt INTEGER,
  cut TEXT, kind TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, mime TEXT,
  label TEXT, origin TEXT, head_sha TEXT, landed_sha TEXT, base_sha TEXT, created_at INTEGER NOT NULL, subkind TEXT,
  PRIMARY KEY(workflow_id,job_id,path));

-- ----------------------------------------------------------------------------
-- artifact_proofs — what one job_artifacts row proves and what it was made
-- against. Added after v1 (ADDITIVE_TABLES).
--   claims_json — {frs[], cases[], shapes[], specs[]}: FR ids, knowledge/ui
--                 proof cases ("ANATOMY-2 case-1"), XBase#state shapes, specs
--   code_sha    — the commit the proof was made at (report head, else HEAD)
--   deps_json   — [{path, kind: code|work, digest}]: every path it depends on,
--                 digested at indexing (scripts/kernel/input-digests.mjs); a
--                 digest that moved since makes the proof stale
-- writtenBy: scripts/kernel/proof-integrity.mjs recordArtifactProofs, called by
-- job-artifacts.mjs indexJobArtifacts; a row is re-baselined only when its
-- artifact's bytes changed.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifact_proofs(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), job_id TEXT NOT NULL, path TEXT NOT NULL,
  claims_json TEXT NOT NULL, code_sha TEXT, deps_json TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(workflow_id,job_id,path));

-- ----------------------------------------------------------------------------
-- workflow_purges — the ONE sanctioned delete path of a finished workflow's
-- record (owner rulings 2026-09-27). Proofs, artifacts and logs are never
-- deleted by housekeeping or any writer; a finished workflow is deleted as a
-- unit only by the owner-approved workflow purge, and only after its evidence
-- is archived and verified. Added after v1 (ADDITIVE_TABLES). The row outlives
-- the purge: it is the tombstone that names where the evidence went.
--   state          — planned | archived | deleting | purged. The logs delete
--                    guard (logs_delete_only_by_purge) opens ONLY while a
--                    workflow's row is 'deleting'; the CHECK refuses 'deleting'
--                    and 'purged' without an owner approval and a verified
--                    archive.
--   approved_by / approval_ref — the owner's approval (who, and the inbox/ask
--                    id or message that carries it)
--   archive_path   — the evidence ZIP on drive D, e.g.
--                    D:/starci-archive/<product>/<workflowId>-<date>.zip:
--                    the workflow's ledger rows (events, jobs, reports,
--                    checks, incidents, contracts, job_artifacts,
--                    artifact_proofs, logs, ... as JSON/NDJSON), every indexed
--                    artifact file (patches, images, videos, traces, reports,
--                    draw rounds) and manifest.json (sha256 of every file and
--                    the events digest-chain head)
--   archive_sha256 / archive_bytes / manifest_sha256 — the archive as written
--   events_head    — the workflow's events digest-chain head at archive time
--   counts_json    — rows per table archived (and deleted)
--   verified_at    — the archive was re-opened and every file's sha256 matched
--                    its manifest; no delete is allowed before it
-- writtenBy: scripts/work/purge-workflow.mjs (dry run by default; --apply
-- needs --approved-by and --approval-ref).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_purges(
  workflow_id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('planned','archived','deleting','purged')),
  approved_by TEXT, approval_ref TEXT, archive_path TEXT, archive_sha256 TEXT, archive_bytes INTEGER,
  manifest_sha256 TEXT, events_head TEXT, counts_json TEXT, created_at INTEGER NOT NULL, archived_at INTEGER,
  verified_at INTEGER, purged_at INTEGER,
  CHECK(state IN ('planned','archived') OR (approved_by IS NOT NULL AND approval_ref IS NOT NULL AND archive_path IS NOT NULL
    AND archive_sha256 IS NOT NULL AND verified_at IS NOT NULL)));

-- ----------------------------------------------------------------------------
-- logs — the typed log rows (scripts/kernel/typed-logs.mjs), moved INTO the
-- ledger on 2026-09-27 (owner ruling: one complete RDBMS per product repo, so a
-- finished workflow is deleted - and archived - as a unit). Before, they lived
-- in <repo>/.starciwork/logs.sqlite; scripts/work/migrate-logs-into-ledger.mjs
-- copies that file's rows here (idempotent by src, per-workflow counts
-- verified) and retires it as logs.sqlite.migrated-<date>. Added after v1
-- (ADDITIVE_TABLES / ADDITIVE_INDEXES / ADDITIVE_TRIGGERS); a table created
-- while logs.sqlite still sits beside the ledger starts its AUTOINCREMENT past
-- that file's newest seq, so the copied rows keep their seq.
--   actor     — kernel | op | runtime | check | land
--   level     — info | warn | error
--   kind      — typed-logs.mjs LOG_KINDS; data_json is that kind's shape
--               (<= allocation.logs.dataMaxBytes), refs_json the files it names
--   src       — the idempotent derivation key: ev:<ledger>:<seq>[:i] (derived
--               from an event), jl:<hash> (a job's log.jsonl line), ltm:<job>,
--               legacy:<seq> (a logs.sqlite row that had none), or NULL (a
--               single `api log` row)
-- Every write goes through ONE buffered writer per process
-- (scripts/kernel/log-writer.mjs: its own connection, short BEGIN IMMEDIATE
-- batches of <= 200 rows, never inside a caller's ledger transaction). The ui
-- server writes this table and log_cursors and nothing else (an SQLite
-- authorizer on the writer's connection refuses every other write).
-- Append-only: no UPDATE ever; a DELETE only while the row's workflow is
-- being purged (workflow_purges.state='deleting'). workflow_id references its
-- workflow, ON DELETE CASCADE, so the purge's workflow delete takes its logs.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE, job_id TEXT,
  actor TEXT NOT NULL CHECK(actor IN ('kernel','op','runtime','check','land')), node_id TEXT,
  level TEXT NOT NULL CHECK(level IN ('info','warn','error')), kind TEXT NOT NULL, msg TEXT NOT NULL,
  data_json TEXT, refs_json TEXT, src TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS logs_workflow ON logs(workflow_id, seq);
CREATE INDEX IF NOT EXISTS logs_job ON logs(job_id, seq);
CREATE TRIGGER IF NOT EXISTS logs_append_only_update BEFORE UPDATE ON logs BEGIN
    SELECT RAISE(ABORT,'logs are append-only');
  END;
CREATE TRIGGER IF NOT EXISTS logs_delete_only_by_purge BEFORE DELETE ON logs
  WHEN NOT EXISTS(SELECT 1 FROM workflow_purges p WHERE p.workflow_id=OLD.workflow_id AND p.state='deleting') BEGIN
    SELECT RAISE(ABORT,'logs are append-only: only the owner-approved workflow purge deletes them (workflow_purges state deleting)');
  END;

-- ----------------------------------------------------------------------------
-- log_cursors — how far the typed-log sync has read: events:<ledger key> (the
-- last event seq derived into logs) and jl:<job id> (the byte offset of a
-- job's log.jsonl ingested). Only ever moves forward. Added after v1.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS log_cursors(name TEXT PRIMARY KEY, value INTEGER NOT NULL);
