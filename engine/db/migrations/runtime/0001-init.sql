-- ############################################################################################################
-- runtime.sqlite (one per project) - this file is the single schema step of the database.
-- Tables: meta/schema_migrations - identity and migration journal; ui_states/ui_state_map - display vocabulary;
-- blob_ref_columns - blob-referencing columns; workflow_transitions/job_transitions - legal state changes;
-- blobs - content-store index; workflows/lifecycle_changes/goals/goal_inputs/workflow_purges - workflow and goal;
-- work_graph_versions/work_units/unit_edges - work graph; jobs/op_attempts/contracts/resources/leases/
-- api_requests - tries, dispatches, fencing, idempotency; reports/check_runs/settle_tails/product_lands/
-- job_artifacts/attempt_transcript_snapshots/report_attachments/artifact_proofs/work_citations/
-- interface_audits/llm_usage - outcomes and evidence; inbox/decision_items/decisions/conditions/incidents/
-- foundations/foundation_declarations/path_transfers/record_changes/signals - coordination; events/logs/
-- log_cursors - append-only journal and typed logs; v_* - durable read views.
-- ############################################################################################################

-- ---------------------------------------------------------------------------------------------------------
-- A0. Identity, version, vocabulary
-- ---------------------------------------------------------------------------------------------------------
-- meta: ledger_id (UUID, key of machine.ledgers), schema='starci/runtime@1', created_at, journal_mode, product,
-- repo_root, blob_root, runtime_rev, sqlite_version.
CREATE TABLE IF NOT EXISTS meta(
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL) STRICT;

-- schema_migrations: 0001-init writes the first row; each later step: backup VACUUM INTO + integrity_check first,
-- foreign_key_check + quick_check before COMMIT. Code refuses to WRITE when user_version > CODE_VERSION.
CREATE TABLE IF NOT EXISTS schema_migrations(
  version       INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,                -- '0001-init'
  runtime_rev   TEXT,
  sql_sha256    TEXT    NOT NULL,                -- digest of the migration file that ran
  backup_path   TEXT, backup_sha256 TEXT,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  status        TEXT NOT NULL CHECK(status IN ('running','done','failed'))) STRICT;

-- ui_states: the ONLY set of display states.
CREATE TABLE IF NOT EXISTS ui_states(
  ui    TEXT PRIMARY KEY CHECK(ui IN ('bad','warn','running','waiting','ok','done','unknown')),
  rank  INTEGER NOT NULL) STRICT;                -- sort order: bad first
INSERT OR IGNORE INTO ui_states VALUES
  ('bad',0),('warn',1),('running',2),('waiting',3),('ok',4),('done',5),('unknown',6);

-- ui_state_map: static mapping of native state -> ui. Time-based rules (overdue, SLA) live in views/functions and
-- may only RAISE the level (waiting->warn->bad), never lower it.
CREATE TABLE IF NOT EXISTS ui_state_map(
  entity TEXT NOT NULL, native TEXT NOT NULL,
  ui     TEXT NOT NULL REFERENCES ui_states(ui),
  PRIMARY KEY(entity,native)) STRICT;
INSERT OR IGNORE INTO ui_state_map VALUES
  ('workflow','awaiting-approval','waiting'),('workflow','queued','waiting'),('workflow','running','running'),
  ('workflow','paused','waiting'),('workflow','stopped','done'),('workflow','finished','done'),('workflow','archived','done'),
  ('unit','planned','waiting'),('unit','queued','waiting'),('unit','deciding','waiting'),('unit','running','running'),
  ('unit','reported','running'),('unit','failed','bad'),('unit','done','done'),('unit','dropped','done'),
  ('job','queued','waiting'),('job','ready','waiting'),('job','leased','running'),('job','running','running'),
  ('job','answering','waiting'),('job','reported','running'),('job','deciding','waiting'),('job','awaiting_owner','waiting'),
  ('job','effect_unknown','bad'),('job','succeeded','done'),('job','failed','bad'),('job','cancelled','done'),
  ('attempt','routed','waiting'),('attempt','in-flight','running'),('attempt','pass','done'),('attempt','partial','warn'),
  ('attempt','fail','bad'),('attempt','blocked','bad'),('attempt','worker-dead','bad'),('attempt','effect-unknown','bad'),
  ('attempt','requeued','done'),('attempt','cancelled','done'),('attempt','dropped','done'),
  ('check','pass','ok'),('check','fail','bad'),('check','error','bad'),('check','unavailable','warn'),('check','skipped','waiting'),
  ('decision','open','waiting'),('decision','claimed','running'),('decision','escalated','warn'),('decision','expired','warn'),
  ('decision','resolved','done'),('decision','superseded','done'),
  ('incident','open','bad'),('incident','resolved','done'),('incident','superseded','done'),
  ('condition','True','ok'),('condition','False','bad'),('condition','Unknown','waiting'),
  ('settle-tail','queued','waiting'),('settle-tail','running','running'),('settle-tail','done','done'),('settle-tail','failed','bad'),
  ('product-land','queued','waiting'),('product-land','landed','done'),('product-land','failed','bad'),('product-land','conflict','bad'),
  ('product-land','red','bad'),('product-land','busy','warn'),('product-land','main-moving','warn');

-- blob_ref_columns: the ONLY list of blob-referencing columns (GC mark reads this table; a spec diffs every
-- *_sha / sha256 column against sqlite_master so no new column is missed).
CREATE TABLE IF NOT EXISTS blob_ref_columns(
  table_name TEXT NOT NULL, column_name TEXT NOT NULL, PRIMARY KEY(table_name,column_name)) STRICT;
INSERT OR IGNORE INTO blob_ref_columns VALUES
  ('goal_inputs','sha256'),('op_attempts','prompt_sha'),('op_attempts','transcript_sha'),('op_attempts','session_sha'),
  ('attempt_transcript_snapshots','sha256'),
  ('check_runs','stdout_sha'),('check_runs','stderr_sha'),('check_runs','output_sha'),('job_artifacts','sha256'),
  ('work_citations','sha256'),('product_lands','output_sha'),('events','payload_sha');

-- Valid state-transition tables (data, not code). Triggers in A2/A3/A4 refuse any pair not listed here.
CREATE TABLE IF NOT EXISTS workflow_transitions(
  from_phase TEXT NOT NULL, to_phase TEXT NOT NULL, PRIMARY KEY(from_phase,to_phase)) STRICT;
INSERT OR IGNORE INTO workflow_transitions VALUES
  ('awaiting-approval','queued'),('awaiting-approval','stopped'),
  ('queued','running'),('queued','stopped'),
  ('running','paused'),('running','stopped'),('running','finished'),
  ('paused','running'),('paused','stopped'),
  ('stopped','queued'),                          -- only the owner verb `starci kernel lifecycle --resume`; a controller NEVER does this (MB-08)
  ('stopped','archived'),('finished','archived');
CREATE TABLE IF NOT EXISTS job_transitions(
  from_status TEXT NOT NULL, to_status TEXT NOT NULL, PRIMARY KEY(from_status,to_status)) STRICT;
INSERT OR IGNORE INTO job_transitions VALUES
  ('queued','ready'),('queued','cancelled'),
  ('ready','queued'),('ready','leased'),('ready','cancelled'),
  ('leased','running'),('leased','ready'),('leased','cancelled'),        -- leased->ready: dispatch refused before the op accepts the contract (H13: spends no try)
  ('leased','failed'),                                                   -- leased->failed: settling a dispatch that died mid-launch after terminal/attempt were created
  ('running','answering'),('answering','running'),
  ('running','reported'),('answering','reported'),
  ('running','effect_unknown'),('running','ready'),('running','failed'),('running','cancelled'),   -- running->ready: requeue after worker death
  ('effect_unknown','running'),('effect_unknown','ready'),('effect_unknown','failed'),
  ('reported','deciding'),('reported','succeeded'),('reported','failed'),   -- reported NEVER -> cancelled (H9: archive does not drop reported work)
  ('deciding','succeeded'),('deciding','failed'),('deciding','cancelled'),
  ('reported','awaiting_owner'),('deciding','awaiting_owner');              -- an op may end with a question: waiting on the owner, not a failure (awaiting_owner is terminal, like failed)

-- ---------------------------------------------------------------------------------------------------------
-- A1. Blob - index of the content store (content is NOT in SQLite)
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blobs(
  sha256      TEXT PRIMARY KEY CHECK(length(sha256)=64),
  bytes       INTEGER NOT NULL CHECK(bytes>=0),
  media_type  TEXT    NOT NULL,                  -- image/png, video/webm, application/json, text/plain, text/x-diff ...
  encoding    TEXT CHECK(encoding IS NULL OR encoding='gzip'),   -- sha256 is always of the ORIGINAL bytes
  redaction   TEXT CHECK(redaction IS NULL OR redaction IN ('v1','binary')),   -- 'v1' = text passed through secret filter v1
                                                 -- (transcript, log); 'binary' = binary that cannot be filtered; NULL = not needed
  file_uri    TEXT    NOT NULL,                  -- absolute path, e.g. <blob_root>/ab/ab12...
  http_path   TEXT GENERATED ALWAYS AS ('/api/blob/' || sha256) VIRTUAL,  -- served by the harness; cannot drift
  created_at  INTEGER NOT NULL,                  -- GC never touches a blob younger than 24 hours (put-before-insert grace)
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),  -- 1 once a Work record cites it: never swept
  archived_at INTEGER,                            -- already inside a verified zip in the archive store
  archive_ref TEXT) STRICT;                       -- '<zip path>!<entry>'

-- ---------------------------------------------------------------------------------------------------------
-- A2. Workflow and goal
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflows(
  workflow_id         TEXT PRIMARY KEY,          -- wf-<slug>-<base36 time>
  trace_id            TEXT NOT NULL UNIQUE CHECK(length(trace_id)=32),   -- W3C trace id, minted at creation, kept across revisions
  title               TEXT,
  display_name        TEXT,                      -- '<Product> - <what>' (Vietnamese)
  phase               TEXT NOT NULL CHECK(phase IN ('awaiting-approval','queued','running','paused','stopped','finished','archived')),
  phase_reason        TEXT,                      -- reason for the latest phase change (detail in lifecycle_changes)
  ledger_mode         TEXT,
  source_roots_json   TEXT CHECK(source_roots_json IS NULL OR json_valid(source_roots_json)),
  generation          INTEGER NOT NULL DEFAULT 0,          -- spec: bumped when the goal/graph changes
  observed_generation INTEGER NOT NULL DEFAULT 0,          -- status: the generation the Kernel has fully processed (K8s)
  goal_identity       TEXT,
  pin_digest          TEXT,
  allowed_parallel    INTEGER,
  finished_json       TEXT CHECK(finished_json IS NULL OR json_valid(finished_json)),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  finished_at         INTEGER,
  archived_at         INTEGER) STRICT;

-- lifecycle_changes: phase-change history, append-only (MB-08, G10). Sole writer: the `starci kernel lifecycle` verb
-- (define-goal, start, pause, stop, resume, finish, archive) - same transaction as UPDATE workflows.phase.
CREATE TABLE IF NOT EXISTS lifecycle_changes(
  change_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  from_phase  TEXT, to_phase TEXT NOT NULL,
  by          TEXT NOT NULL,                     -- owner | kernel:<wf> | supervisor
  reason      TEXT NOT NULL,
  at          INTEGER NOT NULL) STRICT;
CREATE TRIGGER IF NOT EXISTS lifecycle_changes_append_only BEFORE UPDATE ON lifecycle_changes BEGIN
    SELECT RAISE(ABORT,'lifecycle_changes are append-only');
  END;
-- Phase may only change per workflow_transitions AND a matching lifecycle_changes row must be written just before, in the same transaction.
CREATE TRIGGER IF NOT EXISTS workflows_phase_guard BEFORE UPDATE OF phase ON workflows
  WHEN NEW.phase <> OLD.phase BEGIN
    SELECT RAISE(ABORT,'workflow-transition-refused')
      WHERE NOT EXISTS(SELECT 1 FROM workflow_transitions t WHERE t.from_phase=OLD.phase AND t.to_phase=NEW.phase);
    SELECT RAISE(ABORT,'workflow-transition-unrecorded')
      WHERE NOT EXISTS(SELECT 1 FROM lifecycle_changes c WHERE c.workflow_id=NEW.workflow_id
                         AND c.from_phase IS OLD.phase AND c.to_phase=NEW.phase
                         AND c.change_id=(SELECT max(change_id) FROM lifecycle_changes WHERE workflow_id=NEW.workflow_id));
  END;

CREATE TABLE IF NOT EXISTS goals(
  goal_seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id    TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  revision       INTEGER NOT NULL,
  goal_identity  TEXT NOT NULL,
  markdown       TEXT NOT NULL,                  -- goal text the owner approved (relaunch source)
  json           TEXT NOT NULL CHECK(json_valid(json)),   -- derived op chain
  amendment_json TEXT CHECK(amendment_json IS NULL OR json_valid(amendment_json)),
  approved_by    TEXT, approval_ref TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE(workflow_id,revision)) STRICT;

CREATE TABLE IF NOT EXISTS goal_inputs(
  workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  key           TEXT NOT NULL,                   -- '<index>-<basename>'
  goal_revision INTEGER NOT NULL,
  sha256        TEXT NOT NULL REFERENCES blobs(sha256),
  origin        TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY(workflow_id,key)) STRICT;

-- workflow_purges: tombstone of the single delete path (no FK: survives the purge).
CREATE TABLE IF NOT EXISTS workflow_purges(
  workflow_id     TEXT PRIMARY KEY,
  state           TEXT NOT NULL CHECK(state IN ('planned','archived','deleting','purged')),
  approved_by     TEXT, approval_ref TEXT,
  archive_path    TEXT, archive_sha256 TEXT, archive_bytes INTEGER, manifest_sha256 TEXT,
  events_head     TEXT,
  counts_json     TEXT CHECK(counts_json IS NULL OR json_valid(counts_json)),
  created_at      INTEGER NOT NULL, archived_at INTEGER, verified_at INTEGER, purged_at INTEGER,
  CHECK(state IN ('planned','archived') OR (approved_by IS NOT NULL AND approval_ref IS NOT NULL
        AND archive_path IS NOT NULL AND archive_sha256 IS NOT NULL AND verified_at IS NOT NULL))) STRICT;

-- ---------------------------------------------------------------------------------------------------------
-- A3. Graph: units (steps) and edges
-- Vocabulary: unit = logical step; job = one try with concrete input (try_no); attempt = one dispatch (op_attempts).
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_graph_versions(
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  version     INTEGER NOT NULL CHECK(version>=0),
  event       TEXT NOT NULL CHECK(event IN ('draw','revise','cut','edit')),
  graph_json  TEXT NOT NULL CHECK(json_valid(graph_json)),
  diff_json   TEXT NOT NULL CHECK(json_valid(diff_json)),
  colors_json TEXT NOT NULL CHECK(json_valid(colors_json)),
  reason      TEXT NOT NULL, author_op TEXT NOT NULL, author_job TEXT, digest TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY(workflow_id,version)) STRICT;

CREATE TABLE IF NOT EXISTS work_units(
  workflow_id    TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  unit_id        TEXT NOT NULL,                  -- = job_id of the first job in the family
  op_id          TEXT NOT NULL,
  subject_key    TEXT NOT NULL,                  -- work identity, normalized: '<cut_id>#<ordinal>' or digest(records + owned_paths)
  goal_revision  INTEGER NOT NULL,
  title          TEXT,
  cut_id         TEXT, cut_ordinal INTEGER, cut_total INTEGER,
  repository     TEXT,
  state          TEXT NOT NULL CHECK(state IN ('planned','queued','running','reported','deciding','done','failed','dropped')),
  current_job_id TEXT,
  tries          INTEGER NOT NULL DEFAULT 0,     -- number of jobs in the family
  dispatches     INTEGER NOT NULL DEFAULT 0,     -- cumulative dispatch count
  try_budget     INTEGER NOT NULL DEFAULT 5 CHECK(try_budget>=1),   -- H3: exceeding it makes INSERT jobs refuse
  budget_raised_by  TEXT,                        -- who raised the budget (owner | supervisor) ...
  budget_raised_ref TEXT,                        -- ... and why (di_id / incident_id); required when try_budget > default
  reopen_reason  TEXT, reopened_by TEXT, reopened_at INTEGER,   -- H5: the only way to rerun a done unit
  created_at     INTEGER NOT NULL, updated_at INTEGER NOT NULL, done_at INTEGER,
  PRIMARY KEY(workflow_id,unit_id),
  UNIQUE(workflow_id,op_id,subject_key,goal_revision),            -- H3/H5: cannot "create a new unit" for the same work
  CHECK(try_budget<=5 OR (budget_raised_by IS NOT NULL AND budget_raised_ref IS NOT NULL))) STRICT;
CREATE INDEX IF NOT EXISTS ix_units_state ON work_units(workflow_id,state);
CREATE INDEX IF NOT EXISTS ix_units_op    ON work_units(workflow_id,op_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_units_cut ON work_units(workflow_id,cut_id,cut_ordinal,goal_revision) WHERE cut_id IS NOT NULL;
-- A done unit leaves 'done' only via a reopen with a fresh reason (reopened_at changes) - no shortcut.
CREATE TRIGGER IF NOT EXISTS work_units_done_guard BEFORE UPDATE OF state ON work_units
  WHEN OLD.state='done' AND NEW.state<>'done' BEGIN
    SELECT RAISE(ABORT,'unit-already-passed: reopen needs reopen_reason, reopened_by and a new reopened_at')
      WHERE NEW.reopen_reason IS NULL OR NEW.reopened_by IS NULL OR NEW.reopened_at IS NULL OR NEW.reopened_at IS OLD.reopened_at;
  END;

CREATE TABLE IF NOT EXISTS unit_edges(
  workflow_id TEXT NOT NULL,
  from_unit   TEXT NOT NULL,
  to_unit     TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK(kind IN ('after','seam','dependsOn','peer-wait')),
  source      TEXT NOT NULL CHECK(source IN ('plan','graph','kernel-graph-edit','peer-wait','seam')),
  created_at  INTEGER NOT NULL,
  PRIMARY KEY(workflow_id,from_unit,to_unit,kind),
  FOREIGN KEY(workflow_id,from_unit) REFERENCES work_units(workflow_id,unit_id) ON DELETE CASCADE,
  FOREIGN KEY(workflow_id,to_unit)   REFERENCES work_units(workflow_id,unit_id) ON DELETE CASCADE) STRICT;
CREATE INDEX IF NOT EXISTS ix_unit_edges_to ON unit_edges(workflow_id,to_unit);

-- ---------------------------------------------------------------------------------------------------------
-- A4. Job (try), attempt (dispatch), contract, lease, idempotency
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs(
  job_id        TEXT PRIMARY KEY,                -- op-<op>-<token10> | kernel-<wf>
  workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  unit_id       TEXT,                            -- NULL for kernel jobs
  op_id         TEXT,
  try_no        INTEGER NOT NULL CHECK(try_no>=1),     -- which try OF THE UNIT
  retry_of      TEXT REFERENCES jobs(job_id),          -- previous job in the family (a retry may change shape)
  resume_of     TEXT REFERENCES jobs(job_id),
  retry_class   TEXT CHECK(retry_class IS NULL OR retry_class IN ('business','infra','resume','follow-up')),
  generation    INTEGER NOT NULL,
  kind          TEXT NOT NULL CHECK(kind IN ('op','kernel')),
  role          TEXT,
  status        TEXT NOT NULL CHECK(status IN ('queued','ready','leased','running','answering','reported','deciding',
                                               'effect_unknown','awaiting_owner','succeeded','failed','cancelled')),
  priority_json TEXT CHECK(priority_json IS NULL OR json_valid(priority_json)),
  lease_token   TEXT,
  worker_id     TEXT,
  deadline      INTEGER,
  payload_json  TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),   -- input ONLY: records, owned_paths, params, goal_binding, cut, after
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  FOREIGN KEY(workflow_id,unit_id) REFERENCES work_units(workflow_id,unit_id)) STRICT;
CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status,kind,created_at,job_id);
CREATE INDEX IF NOT EXISTS jobs_op    ON jobs(workflow_id,op_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_unit_try ON jobs(workflow_id,unit_id,try_no) WHERE unit_id IS NOT NULL;

-- Enqueue gate (H3, H4, H5, H9): every op job needs a unit; unit not done; budget left; valid lineage; workflow accepts work.
CREATE TRIGGER IF NOT EXISTS jobs_enqueue_guard BEFORE INSERT ON jobs WHEN NEW.kind='op' BEGIN
    SELECT RAISE(ABORT,'workflow-not-accepting-work')
      WHERE (SELECT phase FROM workflows WHERE workflow_id=NEW.workflow_id) NOT IN ('queued','running');
    SELECT RAISE(ABORT,'unit-required') WHERE NEW.unit_id IS NULL;
    SELECT RAISE(ABORT,'unit-already-passed')
      WHERE EXISTS(SELECT 1 FROM work_units u WHERE u.workflow_id=NEW.workflow_id AND u.unit_id=NEW.unit_id AND u.state='done');
    -- A try that ended awaiting_owner asked a question and did not fail: it spends no try of the budget.
    SELECT RAISE(ABORT,'unit-try-budget-exhausted')
      WHERE NEW.try_no - (SELECT count(*) FROM jobs w WHERE w.workflow_id=NEW.workflow_id AND w.unit_id=NEW.unit_id AND w.status='awaiting_owner')
            > (SELECT try_budget FROM work_units u WHERE u.workflow_id=NEW.workflow_id AND u.unit_id=NEW.unit_id);
    -- H5: the try after a reopen follows a PASSED try, so it has no retry_of/resume_of; it is admitted only as the
    -- next try of a unit reopenUnit just moved out of 'done' (reopened_at set, state no longer done).
    SELECT RAISE(ABORT,'first-try-must-be-1-without-lineage')
      WHERE NEW.retry_of IS NULL AND NEW.resume_of IS NULL AND NEW.try_no<>1
        AND NOT EXISTS(SELECT 1 FROM work_units u WHERE u.workflow_id=NEW.workflow_id AND u.unit_id=NEW.unit_id
                         AND u.reopened_at IS NOT NULL AND u.state<>'done' AND NEW.try_no=u.tries+1);
    SELECT RAISE(ABORT,'retry-lineage-invalid: retry_of must be a FAILED or awaiting_owner job of the same unit with try_no-1')
      WHERE NEW.retry_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jobs p WHERE p.job_id=NEW.retry_of
              AND p.workflow_id=NEW.workflow_id AND p.unit_id=NEW.unit_id AND p.status IN ('failed','awaiting_owner') AND p.try_no=NEW.try_no-1);
    SELECT RAISE(ABORT,'resume-lineage-invalid: resume_of must be a failed/cancelled job of the same unit')
      WHERE NEW.resume_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jobs p WHERE p.job_id=NEW.resume_of
              AND p.workflow_id=NEW.workflow_id AND p.unit_id=NEW.unit_id AND p.status IN ('failed','awaiting_owner','cancelled'));
  END;
-- Job state machine (H9): only pairs in job_transitions; cancelled/succeeded/failed are terminal.
CREATE TRIGGER IF NOT EXISTS jobs_status_guard BEFORE UPDATE OF status ON jobs
  WHEN NEW.status<>OLD.status AND NOT EXISTS(SELECT 1 FROM job_transitions t WHERE t.from_status=OLD.status AND t.to_status=NEW.status) BEGIN
    SELECT RAISE(ABORT,'job-transition-refused');
  END;
-- When a job ends, its leases vanish in the same transaction (H12: no leaked leases).
CREATE TRIGGER IF NOT EXISTS jobs_release_leases AFTER UPDATE OF status ON jobs
  WHEN NEW.status IN ('succeeded','failed','awaiting_owner','cancelled') BEGIN
    DELETE FROM leases WHERE job_id=NEW.job_id;
  END;

-- op_attempts: ONE ROW PER DISPATCH (requeue after worker death -> dispatch_seq+1, same job).
CREATE TABLE IF NOT EXISTS op_attempts(
  attempt_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id       TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id            TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  unit_id           TEXT,
  op_id             TEXT NOT NULL,
  try_no            INTEGER NOT NULL,            -- = jobs.try_no
  dispatch_seq      INTEGER NOT NULL DEFAULT 1 CHECK(dispatch_seq>=1),
  dispatch_id       TEXT NOT NULL,               -- ctx_... ; STARCI_DISPATCH_ID
  -- correlation
  span_id           TEXT NOT NULL CHECK(length(span_id)=16),
  parent_span_id    TEXT,                        -- span of the decision / Kernel turn that dispatched
  -- who ran
  agent             TEXT CHECK(agent IS NULL OR agent IN ('devin','codex','claude')),
  provider          TEXT,
  model             TEXT,                        -- attested model id (gen_ai.response.model)
  request_model     TEXT,                        -- requested model (gen_ai.request.model)
  model_profile     TEXT, pool TEXT, effort TEXT, difficulty TEXT,
  routed_by         TEXT CHECK(routed_by IS NULL OR routed_by IN ('route','config','flag','kernel-override')),
  route_chain_json  TEXT CHECK(route_chain_json IS NULL OR json_valid(route_chain_json)),
  route_rejected_json TEXT CHECK(route_rejected_json IS NULL OR json_valid(route_rejected_json)),
  host              TEXT NOT NULL DEFAULT 'orca',
  run_id TEXT, task_id TEXT, terminal_handle TEXT, worker_pid INTEGER,
  managed           INTEGER NOT NULL DEFAULT 0 CHECK(managed IN (0,1)),
  scratch_dir       TEXT,                        -- STARCI_JOB_SCRATCH
  -- replay (Bazel action key): enough to rebuild the exact try
  runtime_rev       TEXT,                        -- commit .claude
  cli_name          TEXT, cli_version TEXT,      -- devin 2.x, codex 0.x ...
  contract_sha      TEXT,                        -- digest contracts.markdown
  config_sha        TEXT,                        -- digest of the effective config.yaml
  prompt_sha        TEXT REFERENCES blobs(sha256),       -- the real prompt sent to the terminal
  transcript_sha    TEXT REFERENCES blobs(sha256),       -- the WHOLE terminal scrollback at end, redacted;
                                                         -- while running: attempt_transcript_snapshots (every 60 seconds)
  session_sha       TEXT REFERENCES blobs(sha256),       -- the CLI session file (~/.claude/projects/*.jsonl, ~/.codex/sessions/...), redacted
  -- where
  repo_root TEXT, worktree_path TEXT, branch TEXT, wf_branch TEXT,
  base_sha TEXT, head_sha TEXT, integrated_sha TEXT,
  -- when
  routed_at INTEGER, dispatched_at INTEGER, started_at INTEGER, attested_at INTEGER, reported_at INTEGER,
  consumed_at INTEGER, checked_at INTEGER, settled_at INTEGER, released_at INTEGER,
  terminal_closed_at INTEGER, task_closed_at INTEGER, worktree_removed_at INTEGER,
  wall_ms           INTEGER,                     -- dispatch -> settle, monotonic
  -- outcome: the op's word and the verdict are TWO fields
  report_outcome    TEXT CHECK(report_outcome IS NULL OR report_outcome IN ('done','partial','failed','ask','blocked')),
  verdict           TEXT CHECK(verdict IS NULL OR verdict IN ('pass','fail','partial','blocked','dropped','cancelled')),
  settled_by        TEXT CHECK(settled_by IS NULL OR settled_by IN ('settler','kernel','supervisor','reconcile')),
  decision_id       TEXT,
  failure_class     TEXT, effect_state TEXT, next_step TEXT,
  settle_json       TEXT CHECK(settle_json IS NULL OR json_valid(settle_json)),
  end_state         TEXT CHECK(end_state IS NULL OR end_state IN ('settled','worker-dead','requeued','cancelled','effect-unknown')),
  -- summarized cost (detail in llm_usage); NULL when unmeasurable
  tokens_in INTEGER, tokens_out INTEGER, cost_usd REAL,
  usage_source      TEXT CHECK(usage_source IS NULL OR usage_source IN ('cli-transcript','provider-report','unavailable')),
  usage_reason      TEXT,   -- why usage is 'unavailable' (the agent has no usage adapter, or no session file was found)
  -- the owner-facing reason an attempt failed, was blocked, refused or is waiting (starci/why@1, scripts/kernel/why.mjs, docs/why.md), written with the settle
  why_json          TEXT CHECK(why_json IS NULL OR json_valid(why_json)),
  UNIQUE(workflow_id,dispatch_id),
  UNIQUE(job_id,dispatch_seq)) STRICT;
CREATE INDEX IF NOT EXISTS ix_attempts_unit     ON op_attempts(workflow_id,unit_id,attempt_id);
CREATE INDEX IF NOT EXISTS ix_attempts_op       ON op_attempts(workflow_id,op_id);
CREATE INDEX IF NOT EXISTS ix_attempts_time     ON op_attempts(workflow_id,dispatched_at);
CREATE INDEX IF NOT EXISTS ix_attempts_model    ON op_attempts(agent,model,op_id);
CREATE INDEX IF NOT EXISTS ix_attempts_terminal ON op_attempts(terminal_handle);
CREATE INDEX IF NOT EXISTS ix_attempts_open     ON op_attempts(settled_at,end_state);
CREATE INDEX IF NOT EXISTS ix_attempts_head     ON op_attempts(head_sha);
CREATE INDEX IF NOT EXISTS ix_attempts_reported ON op_attempts(reported_at) WHERE settled_at IS NULL;
-- Dispatch gate (H9): an attempt row may only be created when the job just went ready->leased (job_transitions
-- only allows leased from ready) and the workflow is running. A cancelled/archived job cannot be dispatched.
CREATE TRIGGER IF NOT EXISTS op_attempts_dispatch_guard BEFORE INSERT ON op_attempts BEGIN
    SELECT RAISE(ABORT,'dispatch-requires-ready-then-leased')
      WHERE (SELECT status FROM jobs WHERE job_id=NEW.job_id) IS NOT 'leased';
    SELECT RAISE(ABORT,'dispatch-requires-running-workflow')
      WHERE (SELECT phase FROM workflows WHERE workflow_id=NEW.workflow_id) IS NOT 'running';
    SELECT RAISE(ABORT,'dispatch-previous-attempt-open')
      WHERE EXISTS(SELECT 1 FROM op_attempts a WHERE a.job_id=NEW.job_id AND a.end_state IS NULL AND a.settled_at IS NULL);
  END;

-- contracts: kernel -> op. Keyed by attempt_id: a re-dispatch does NOT overwrite the previous contract.
CREATE TABLE IF NOT EXISTS contracts(
  attempt_id   INTEGER PRIMARY KEY REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id       TEXT NOT NULL,
  contract_rev TEXT,                             -- admitted contract version (modules/kernel/contract-changes)
  markdown     TEXT NOT NULL,
  context_json TEXT CHECK(context_json IS NULL OR json_valid(context_json)),
  created_at   INTEGER NOT NULL) STRICT;

-- resources / leases: fencing along the write path. A missing resources row = capacity 1 (not pre-seeded).
CREATE TABLE IF NOT EXISTS resources(
  resource_key TEXT PRIMARY KEY,
  capacity     INTEGER NOT NULL CHECK(capacity>=0),
  declared_by  TEXT, declared_at INTEGER) STRICT;
CREATE TABLE IF NOT EXISTS leases(
  resource_key TEXT NOT NULL,
  job_id       TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  op_id TEXT, try_no INTEGER NOT NULL, generation INTEGER NOT NULL,
  token        TEXT NOT NULL,                    -- = jobs.lease_token
  units        INTEGER NOT NULL CHECK(units>0),
  attempt_id   INTEGER,                          -- owner: the dispatch holding it (NULL between lease and dispatch)
  holder       TEXT,                             -- holding terminal handle / pid - GC can ask "who holds it, still alive"
  acquired_at  INTEGER NOT NULL,
  renewed_at   INTEGER,
  expires_at   INTEGER NOT NULL CHECK(expires_at>acquired_at),   -- mandatory TTL; expiry -> dead-worker flow (H12)
  PRIMARY KEY(resource_key,job_id)) STRICT;
CREATE INDEX IF NOT EXISTS leases_expiry ON leases(expires_at);
CREATE TRIGGER IF NOT EXISTS leases_match_job BEFORE INSERT ON leases BEGIN
    SELECT RAISE(ABORT,'lease-identity-drift') WHERE NOT EXISTS(
      SELECT 1 FROM jobs j WHERE j.job_id=NEW.job_id AND j.workflow_id=NEW.workflow_id AND j.op_id IS NEW.op_id
        AND j.try_no=NEW.try_no AND j.generation=NEW.generation AND j.lease_token=NEW.token);
  END;
CREATE TRIGGER IF NOT EXISTS leases_match_job_update BEFORE UPDATE ON leases BEGIN
    SELECT RAISE(ABORT,'lease-identity-drift') WHERE NOT EXISTS(
      SELECT 1 FROM jobs j WHERE j.job_id=NEW.job_id AND j.workflow_id=NEW.workflow_id AND j.op_id IS NEW.op_id
        AND j.try_no=NEW.try_no AND j.generation=NEW.generation AND j.lease_token=NEW.token);
  END;

-- api_requests: idempotency for every write verb that may be re-invoked (report, settle, decide, enqueue, drop, decisions --resolve).
-- request_id = --request-id or sha(verb + dispatch_id + args). A repeat call returns the old result. The harness does NOT write (UI reads only).
CREATE TABLE IF NOT EXISTS api_requests(
  request_id  TEXT PRIMARY KEY,
  verb        TEXT NOT NULL,
  caller      TEXT,                              -- kernel:<wf> | op:<attempt_id> | settler | reconciler | supervisor | owner-cli
  workflow_id TEXT REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  attempt_id  INTEGER,
  args_sha    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK(status IN ('running','done','failed')),
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  created_at  INTEGER NOT NULL, finished_at INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_api_requests_attempt ON api_requests(attempt_id);

-- ---------------------------------------------------------------------------------------------------------
-- A5. Reports, checks, settle, lands, artifacts, evidence, LLM cost
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports(
  report_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  attempt_id    INTEGER NOT NULL UNIQUE REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  dispatch_id   TEXT NOT NULL,
  job_id        TEXT NOT NULL,
  outcome       TEXT NOT NULL CHECK(outcome IN ('done','partial','failed','ask','blocked')),
  report_json   TEXT NOT NULL CHECK(json_valid(report_json)),     -- starci/op-report@1, the ONLY version
  summary       TEXT GENERATED ALWAYS AS (json_extract(report_json,'$.summary')) VIRTUAL,
  from_terminal TEXT,
  consumed_at   INTEGER,
  created_at    INTEGER NOT NULL,
  UNIQUE(workflow_id,dispatch_id)) STRICT;
-- Reports are immutable (H10): resubmit identical content -> api_requests returns the old result; different content -> refused.
CREATE TRIGGER IF NOT EXISTS reports_immutable BEFORE UPDATE OF report_json, outcome, attempt_id, dispatch_id ON reports BEGIN
    SELECT RAISE(ABORT,'report-already-filed: reports are immutable');
  END;

-- check_runs: each run of one check of one try. run_seq = which rerun of the same check.
CREATE TABLE IF NOT EXISTS check_runs(
  check_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id    TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  attempt_id     INTEGER NOT NULL REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  job_id         TEXT NOT NULL,
  op_id          TEXT NOT NULL,
  span_id        TEXT NOT NULL CHECK(length(span_id)=16),
  parent_span_id TEXT,                           -- = op_attempts.span_id
  name           TEXT NOT NULL,                  -- canon-scan, check-scoped-lint, tsc-app, canon-parity, lint-check ...
  phase          TEXT NOT NULL CHECK(phase IN ('before','after','verify','parity','integrate')),
  runner         TEXT NOT NULL CHECK(runner IN ('op','settler','kernel','parity','integrate')),
  run_seq        INTEGER NOT NULL DEFAULT 1,
  command        TEXT,                           -- never holds secrets
  cwd            TEXT,
  input_digest   TEXT,                           -- base sha + owned paths + tool rev: the reuse key (replaces settle-parity/*.json)
  authority      TEXT NOT NULL CHECK(authority IN ('runtime','declared')),   -- H8: 'runtime' = the canonical command owned
                                                 -- and run by the runtime; 'declared' = self-reported by the op, evidence only, does not count toward the verdict
  exit_code      INTEGER,                        -- the RAW exit code the runner observed (never coerced to 0)
  declared_exit_code INTEGER,                    -- the exit code the op SELF-DECLARED in its report (may differ from exit_code - that is a signal)
  attribution_json TEXT CHECK(attribution_json IS NULL OR json_valid(attribution_json)),  -- structured record of the error portion outside the slice
  status         TEXT NOT NULL CHECK(status IN ('pass','fail','unavailable','error','skipped')),
  started_at     INTEGER, finished_at INTEGER, wall_ms INTEGER,
  stdout_sha     TEXT REFERENCES blobs(sha256),
  stderr_sha     TEXT REFERENCES blobs(sha256),
  output_sha     TEXT REFERENCES blobs(sha256),  -- parsed JSON (canon-scan --json ...)
  summary_json   TEXT CHECK(summary_json IS NULL OR json_valid(summary_json)),
  note           TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE(attempt_id,runner,phase,name,run_seq),
  CHECK(NOT (status='pass' AND exit_code IS NOT NULL AND exit_code<>0)),       -- H8: no "pass" with a raw exit != 0
  CHECK(runner<>'op' OR authority='declared')) STRICT;                         -- an op-run check is always evidence only
CREATE INDEX IF NOT EXISTS ix_checks_name  ON check_runs(workflow_id,name,status);
CREATE INDEX IF NOT EXISTS ix_checks_cache ON check_runs(name,input_digest);

-- settle_tails: the queue of tail work after settle (replaces <ledger dir>/settle-tail/<job>.json).
CREATE TABLE IF NOT EXISTS settle_tails(
  attempt_id  INTEGER PRIMARY KEY REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  state       TEXT NOT NULL CHECK(state IN ('queued','running','done','failed')),
  tries       INTEGER NOT NULL DEFAULT 0,
  due_at      INTEGER, last_error TEXT,
  queued_at   INTEGER NOT NULL, started_at INTEGER, done_at INTEGER) STRICT;

-- product_lands: api product-land (merge wf/<wf> into the product repo main; separate from settle).
CREATE TABLE IF NOT EXISTS product_lands(
  land_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  span_id      TEXT NOT NULL CHECK(length(span_id)=16),
  repo_root    TEXT NOT NULL,
  wf_branch    TEXT NOT NULL,
  main_before  TEXT, merged_sha TEXT,
  result       TEXT NOT NULL CHECK(result IN ('queued','landed','failed','conflict','red','busy','main-moving')),
  reason       TEXT,
  checks_json  TEXT CHECK(checks_json IS NULL OR json_valid(checks_json)),   -- land checks + import scan (summary)
  output_sha   TEXT REFERENCES blobs(sha256),
  pushed       INTEGER NOT NULL DEFAULT 0 CHECK(pushed IN (0,1)),
  started_at   INTEGER NOT NULL, finished_at INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_lands_wf ON product_lands(workflow_id,started_at);

-- job_artifacts: every output file, bytes in the blob store. Kernel artifacts (scan, dispatch-ready) have no attempt.
CREATE TABLE IF NOT EXISTS job_artifacts(
  artifact_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  attempt_id   INTEGER REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  job_id       TEXT,
  op_id        TEXT,
  cut          TEXT,
  role         TEXT NOT NULL CHECK(role IN (
                 'check-output','check-stdout','check-stderr','patch','diff','report-attachment','log',
                 'direction','prompt','render','redline','critique',
                 'capture','dom','screenshot','video','trace','uat-run','metrics','salvage','scan','other')),
  kind         TEXT NOT NULL CHECK(kind IN ('diff','patch','image','video','report','log','trace','file')),
  subkind      TEXT CHECK(subkind IS NULL OR subkind IN ('draw-render','asset-gen','app-capture','e2e-capture','uat-capture',
                 'uat-video','e2e-video','playwright-trace','patch','patch-json','diff','report','log','critique','metrics',
                 'grammar-proposal','asset-request','terminal-transcript','cli-transcript')),
  name         TEXT NOT NULL,                    -- logical name: 'checks/2-canon-scan/output', 'patch.diff', 'rounds/2/desktop-light.png'
  sha256       TEXT NOT NULL REFERENCES blobs(sha256),
  bytes        INTEGER NOT NULL,
  media_type   TEXT NOT NULL,
  label        TEXT,                             -- XBase#state@viewport ...
  scope_ref    TEXT,                             -- id of the Work record the artifact is about
  round        INTEGER,                          -- draw/audit round
  run_id       TEXT,                             -- runId of uat.verify
  origin       TEXT NOT NULL CHECK(origin IN ('op','settler','checker','kernel')),
  base_sha TEXT, head_sha TEXT, integrated_sha TEXT,
  created_at   INTEGER NOT NULL,
  CHECK(attempt_id IS NOT NULL OR origin='kernel')) STRICT;
-- Artifacts are immutable (H10): key (attempt_id, name), bytes keyed by sha; no UPDATE of content/name, no sha overwrite.
CREATE TRIGGER IF NOT EXISTS job_artifacts_immutable BEFORE UPDATE OF sha256, bytes, name, attempt_id, media_type ON job_artifacts BEGIN
    SELECT RAISE(ABORT,'artifacts are immutable: file a new name');
  END;

-- attempt_transcript_snapshots: periodic (60 s) redacted scrollback snapshots of a running op terminal.
-- No new row when the scrollback is unchanged (UNIQUE attempt+sha). The final one is op_attempts.transcript_sha.
CREATE TABLE IF NOT EXISTS attempt_transcript_snapshots(
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  attempt_id  INTEGER NOT NULL REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  at          INTEGER NOT NULL,
  lines       INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  sha256      TEXT NOT NULL REFERENCES blobs(sha256),
  UNIQUE(attempt_id,sha256)) STRICT;
CREATE INDEX IF NOT EXISTS ix_transcript_snap ON attempt_transcript_snapshots(attempt_id,at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_artifacts_attempt_name ON job_artifacts(attempt_id,name) WHERE attempt_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_artifacts_kernel_name  ON job_artifacts(workflow_id,name) WHERE attempt_id IS NULL;
CREATE INDEX IF NOT EXISTS ix_artifacts_blob  ON job_artifacts(sha256);
CREATE INDEX IF NOT EXISTS ix_artifacts_role  ON job_artifacts(workflow_id,role);
CREATE INDEX IF NOT EXISTS ix_artifacts_scope ON job_artifacts(scope_ref);

CREATE TABLE IF NOT EXISTS report_attachments(
  report_id   INTEGER NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  artifact_id INTEGER NOT NULL REFERENCES job_artifacts(artifact_id) ON DELETE CASCADE,
  PRIMARY KEY(report_id,artifact_id)) STRICT;

CREATE TABLE IF NOT EXISTS artifact_proofs(
  artifact_id INTEGER PRIMARY KEY REFERENCES job_artifacts(artifact_id) ON DELETE CASCADE,
  claims_json TEXT NOT NULL CHECK(json_valid(claims_json)),   -- {frs[], cases[], shapes[], specs[]}
  code_sha    TEXT,
  deps_json   TEXT NOT NULL CHECK(json_valid(deps_json)),     -- [{path, kind: code|work, digest}]
  created_at  INTEGER NOT NULL) STRICT;

-- work_citations: which artifact/blob a Work (git) record cites - pins the blob, renders the record's images, detects broken citations.
CREATE TABLE IF NOT EXISTS work_citations(
  record_id   TEXT NOT NULL,                     -- uat.<feature>.<flow>, ui.<feature>.<screen>, impl.<...>, brand
  record_path TEXT NOT NULL,                     -- features/<f>/<family>/<name>/evidence.yaml
  field       TEXT NOT NULL,                     -- 'run.screens[0]', 'assets[3]'
  artifact_id INTEGER REFERENCES job_artifacts(artifact_id) ON DELETE RESTRICT,
  sha256      TEXT NOT NULL REFERENCES blobs(sha256) ON DELETE RESTRICT,
  role        TEXT CHECK(role IS NULL OR role IN ('direction','capture','uat-screen','uat-video','uat-result','render','layout-capture')),
  record_rev  TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY(record_id,field)) STRICT;
CREATE INDEX IF NOT EXISTS ix_citations_blob ON work_citations(sha256);
CREATE INDEX IF NOT EXISTS ix_citations_path ON work_citations(record_path);

-- interface_audits: scope + verdict of interface.audit (replaces features/<f>/operations/<name>/index.yaml + E/**).
CREATE TABLE IF NOT EXISTS interface_audits(
  audit_id      TEXT PRIMARY KEY,                -- operation.<feature>.<name>
  workflow_id   TEXT REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  attempt_id    INTEGER REFERENCES op_attempts(attempt_id) ON DELETE SET NULL,
  feature       TEXT NOT NULL,
  scope_json    TEXT NOT NULL CHECK(json_valid(scope_json)),
  verdict       TEXT CHECK(verdict IS NULL OR verdict IN ('pass','fail','partial')),
  findings_json TEXT CHECK(findings_json IS NULL OR json_valid(findings_json)),
  route_to      TEXT CHECK(route_to IS NULL OR route_to IN ('interface.implement','interface.draw')),
  created_at    INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;

-- llm_usage: LLM cost per OTel GenAI semconv - one row per (attempt | Kernel turn) x model.
-- Supervisor and [Worker] cost lives in machine.llm_usage.
CREATE TABLE IF NOT EXISTS llm_usage(
  usage_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id        TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  subject_type       TEXT NOT NULL CHECK(subject_type IN ('attempt','kernel-turn')),
  attempt_id         INTEGER REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,   -- when subject_type='attempt'
  turn_ref           TEXT,                       -- when 'kernel-turn': '<seat>:<n>' or a decision_id
  span_id            TEXT,
  provider           TEXT NOT NULL,              -- gen_ai.provider.name
  request_model      TEXT, response_model TEXT,  -- gen_ai.request.model / gen_ai.response.model
  input_tokens       INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER,
  reasoning_tokens   INTEGER,
  cost_usd           REAL,
  turns              INTEGER, tool_calls INTEGER, tool_errors INTEGER,
  source             TEXT NOT NULL CHECK(source IN ('cli-transcript','provider-report')),
  at                 INTEGER NOT NULL,
  CHECK((subject_type='attempt' AND attempt_id IS NOT NULL) OR (subject_type='kernel-turn' AND turn_ref IS NOT NULL))) STRICT;
CREATE INDEX IF NOT EXISTS ix_usage_attempt ON llm_usage(attempt_id);
CREATE INDEX IF NOT EXISTS ix_usage_wf      ON llm_usage(workflow_id,subject_type,at);

-- ---------------------------------------------------------------------------------------------------------
-- A6. Inbox, decision items, decisions, conditions, incidents, shared foundations, signals
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbox(
  inbox_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id      TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK(kind IN ('goal','goal-revision','peer-message','worker-question','owner-answer','amendment')),
  key              TEXT,
  from_ref         TEXT,                         -- owner | wf-<peer> | attempt:<id>
  attempt_id       INTEGER,                      -- a worker's question: which attempt asked
  payload_json     TEXT NOT NULL CHECK(json_valid(payload_json)),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','applied','rejected','done','superseded')),
  disposition_json TEXT CHECK(disposition_json IS NULL OR json_valid(disposition_json)),
  created_at       INTEGER NOT NULL,
  applied_at       INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_inbox_open ON inbox(workflow_id,kind,status);

CREATE TABLE IF NOT EXISTS decision_items(
  di_id              TEXT PRIMARY KEY,           -- di-<sha8>
  -- MB-07: key = '<kind>:<entity>:<error signature>:<head|rev>' - EVERY part mandatory, no empty part. Signature
  -- changes -> new DI and the old DI superseded (superseded_by), never merged forever into the old DI.
  idempotency_key    TEXT NOT NULL UNIQUE CHECK(idempotency_key NOT LIKE '%::%' AND idempotency_key NOT LIKE '%:'
                                                 AND idempotency_key NOT LIKE ':%' AND length(idempotency_key)>=5),
  key_parts_json     TEXT NOT NULL CHECK(json_valid(key_parts_json) AND json_type(key_parts_json)='object'),
  superseded_by      TEXT REFERENCES decision_items(di_id),
  workflow_id        TEXT REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,              -- settle-nongreen | worker-question | progress-stall | stale-gate | ...
  decider            TEXT NOT NULL CHECK(decider IN ('kernel','supervisor','owner')),
  entity_type        TEXT CHECK(entity_type IS NULL OR entity_type IN ('job','unit','attempt','workflow','lane','service','seat')),
  entity_id          TEXT,
  job_id             TEXT, unit_id TEXT, attempt_id INTEGER,
  summary            TEXT NOT NULL,
  status             TEXT NOT NULL CHECK(status IN ('open','claimed','resolved','escalated','expired','superseded')),
  opened_by          TEXT NOT NULL,
  opened_at          INTEGER NOT NULL,
  due_at             INTEGER,
  escalate_to        TEXT, escalations INTEGER NOT NULL DEFAULT 0,
  claim_by TEXT, claim_at INTEGER, claim_ttl_ms INTEGER,
  resolved_by TEXT, resolved_at INTEGER, resolution_verb TEXT, decision_id TEXT,
  evidence_json      TEXT CHECK(evidence_json IS NULL OR json_valid(evidence_json)),
  options_json       TEXT CHECK(options_json IS NULL OR json_valid(options_json)),
  allowed_verbs_json TEXT CHECK(allowed_verbs_json IS NULL OR json_valid(allowed_verbs_json)),
  payload_json       TEXT NOT NULL CHECK(json_valid(payload_json))) STRICT;
CREATE INDEX IF NOT EXISTS ix_di_open ON decision_items(decider,status,due_at);
CREATE INDEX IF NOT EXISTS ix_di_wf   ON decision_items(workflow_id,status);
CREATE INDEX IF NOT EXISTS ix_di_ent  ON decision_items(entity_type,entity_id);

CREATE TABLE IF NOT EXISTS decisions(
  decision_id    TEXT PRIMARY KEY,
  workflow_id    TEXT REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  span_id        TEXT NOT NULL CHECK(length(span_id)=16),   -- child span of the Kernel turn; dispatched attempts take it as parent
  parent_span_id TEXT,
  decider        TEXT NOT NULL,                  -- 'kernel:<wf>' | 'supervisor' | 'owner'
  di_id          TEXT REFERENCES decision_items(di_id),
  subject_type   TEXT CHECK(subject_type IS NULL OR subject_type IN ('job','unit','attempt','graph','workflow')),
  subject_id     TEXT,
  choice         TEXT NOT NULL,
  rationale      TEXT,
  result_json    TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  decided_at     INTEGER NOT NULL) STRICT;
CREATE INDEX IF NOT EXISTS ix_decisions_wf   ON decisions(workflow_id,decided_at);
CREATE INDEX IF NOT EXISTS ix_decisions_subj ON decisions(subject_type,subject_id);

-- conditions (K8s metav1.Condition): observed status per facet; "why stuck" = the first condition not yet True.
-- A controller writes 'Unknown' on first sight of an entity. Each status change -> a 'condition-changed' event.
CREATE TABLE IF NOT EXISTS conditions(
  workflow_id         TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  entity_type         TEXT NOT NULL CHECK(entity_type IN ('workflow','unit','job','attempt')),
  entity_id           TEXT NOT NULL,
  type                TEXT NOT NULL,             -- Routed, Dispatched, WorkerAlive, Reported, ChecksPassed, Settled, Released, WorktreeClean, GoalObserved
  status              TEXT NOT NULL CHECK(status IN ('True','False','Unknown')),
  reason              TEXT NOT NULL,             -- CamelCase: ProviderCircuitOpen, RamThrottled, NoReportAfterSla, CheckFailed ...
  message             TEXT,
  owner               TEXT CHECK(owner IS NULL OR owner IN ('owner','supervisor','kernel','controller','op')),  -- who must clear it
  observed_generation INTEGER,
  last_transition_at  INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  PRIMARY KEY(entity_type,entity_id,type)) STRICT;
CREATE INDEX IF NOT EXISTS ix_conditions_open ON conditions(workflow_id,status);

-- incidents: kind is an enum (today hundreds of free-form kinds), with owner and deadline (GC can ask "which incident is overdue, who must clear it").
CREATE TABLE IF NOT EXISTS incidents(
  incident_id   TEXT PRIMARY KEY,
  workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  op_id TEXT, job_id TEXT, attempt_id INTEGER,
  kind          TEXT NOT NULL CHECK(kind IN ('infra-provider','config-defect','owner-ask','credential-missing','safety-block',
                                             'runtime-defect','evidence-missing','scope-change','partial-effect','other')),
  detail        TEXT,
  owner         TEXT NOT NULL CHECK(owner IN ('kernel','supervisor','owner')),
  due_at        INTEGER,                          -- overdue -> DI escalation
  attempts      INTEGER NOT NULL DEFAULT 0, model_calls INTEGER NOT NULL DEFAULT 0,
  tokens        INTEGER NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0,
  last_progress TEXT,
  status        TEXT NOT NULL CHECK(status IN ('open','resolved','superseded')),
  resolved_reason TEXT CHECK(resolved_reason IS NULL OR resolved_reason IN ('fixed','answered','workflow-ended','superseded','dropped')),
  created_at    INTEGER NOT NULL, updated_at INTEGER NOT NULL, resolved_at INTEGER,
  CHECK(status='open' OR (resolved_at IS NOT NULL AND resolved_reason IS NOT NULL))) STRICT;
CREATE INDEX IF NOT EXISTS ix_incidents_open ON incidents(status,due_at);
-- When a workflow ends, its incidents close in the same transaction (H12: 405 orphaned incidents).
CREATE TRIGGER IF NOT EXISTS workflows_close_incidents AFTER UPDATE OF phase ON workflows
  WHEN NEW.phase IN ('finished','archived') BEGIN
    UPDATE incidents SET status='resolved', resolved_reason='workflow-ended', resolved_at=NEW.updated_at, updated_at=NEW.updated_at
     WHERE workflow_id=NEW.workflow_id AND status='open';
  END;

CREATE TABLE IF NOT EXISTS foundations(
  name           TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK(kind IN ('brand','grammar','layout-tree','shell','module','contract','other')),
  state          TEXT NOT NULL CHECK(state IN ('unclaimed','claimed','published','retired')),
  owner_workflow TEXT, version TEXT, detail TEXT, work_ref TEXT,
  updated_at     INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS foundation_declarations(
  workflow_id TEXT PRIMARY KEY REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  builds_none INTEGER NOT NULL CHECK(builds_none IN (0,1)), detail TEXT, at INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS path_transfers(
  path          TEXT PRIMARY KEY,
  from_workflow TEXT, to_workflow TEXT, bridge_id TEXT,
  state         TEXT NOT NULL CHECK(state IN ('proposed','applied','reverted')),
  detail_json   TEXT CHECK(detail_json IS NULL OR json_valid(detail_json)), at INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS record_changes(
  change_id   TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  record_id   TEXT NOT NULL, record_path TEXT, reason TEXT, by TEXT, at INTEGER NOT NULL) STRICT;

-- signals: process locks/fences ONLY.
CREATE TABLE IF NOT EXISTS signals(
  scope      TEXT NOT NULL CHECK(scope IN ('kernel','stop','launch','decision-doorbell')),
  key        TEXT NOT NULL,
  workflow_id TEXT REFERENCES workflows(workflow_id) ON DELETE CASCADE,   -- a signal does not outlive its workflow (data #18)
  holder_pid INTEGER, token TEXT,
  value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
  at         INTEGER NOT NULL, expires_at INTEGER,
  PRIMARY KEY(scope,key)) STRICT;

-- ---------------------------------------------------------------------------------------------------------
-- A7. Events and logs (append-only, FTS)
-- ---------------------------------------------------------------------------------------------------------
-- events: the audit journal. prev_digest/digest are computed by the JS writer inside BEGIN IMMEDIATE:
--   digest = sha256(prev_digest || event_id || kind || coalesce(payload_json,'') || created_at)
CREATE TABLE IF NOT EXISTS events(
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL UNIQUE,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  attempt_id   INTEGER,                          -- when the event belongs to a try
  span_id      TEXT,
  kind         TEXT NOT NULL,
  payload_json TEXT CHECK(payload_json IS NULL OR (json_valid(payload_json) AND length(payload_json)<=16384)),
  payload_sha  TEXT REFERENCES blobs(sha256),    -- payload larger than 16 KiB
  prev_digest  TEXT,
  digest       TEXT NOT NULL CHECK(length(digest)=64),
  occurred_at  INTEGER NOT NULL,                  -- when it happened (data #12: split from write time)
  created_at   INTEGER NOT NULL) STRICT;          -- when written (recorded_at)
CREATE INDEX IF NOT EXISTS events_entity       ON events(workflow_id,entity_type,entity_id,seq);
CREATE INDEX IF NOT EXISTS events_kind         ON events(workflow_id,kind,seq);
CREATE INDEX IF NOT EXISTS events_workflow_seq ON events(workflow_id,seq);
CREATE INDEX IF NOT EXISTS events_attempt      ON events(attempt_id,seq);
CREATE TRIGGER IF NOT EXISTS events_append_only BEFORE UPDATE ON events BEGIN
    SELECT RAISE(ABORT,'events are append-only');
  END;
-- H9: an archived workflow accepts no more events (today 1,840 events were written after archive), except purge events.
CREATE TRIGGER IF NOT EXISTS events_refuse_archived BEFORE INSERT ON events
  WHEN (SELECT phase FROM workflows WHERE workflow_id=NEW.workflow_id)='archived' AND NEW.kind NOT LIKE 'purge-%' BEGIN
    SELECT RAISE(ABORT,'workflow-archived: no further writes');
  END;
CREATE TRIGGER IF NOT EXISTS events_delete_only_by_purge BEFORE DELETE ON events
  WHEN NOT EXISTS(SELECT 1 FROM workflow_purges p WHERE p.workflow_id=OLD.workflow_id AND p.state='deleting') BEGIN
    SELECT RAISE(ABORT,'events are append-only: only the owner-approved workflow purge deletes them');
  END;

-- logs: typed logs. Ops write via `starci kernel log` (no more log.jsonl in .starciwork); UI reads only.
-- 'debug' is NOT written to the DB by default (debug lives in the try's raw log blob); per-workflow opt-in keeps 14 days.
CREATE TABLE IF NOT EXISTS logs(
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id      TEXT,
  attempt_id  INTEGER,
  trace_id    TEXT, span_id TEXT,
  actor       TEXT NOT NULL CHECK(actor IN ('kernel','op','runtime','check','land','settler','reconciler')),
  node_id     TEXT,
  level       TEXT NOT NULL CHECK(level IN ('debug','info','warn','error')),
  kind        TEXT NOT NULL,                     -- typed-logs.mjs LOG_KINDS
  msg         TEXT NOT NULL,
  data_json   TEXT CHECK(data_json IS NULL OR json_valid(data_json)),
  refs_json   TEXT CHECK(refs_json IS NULL OR json_valid(refs_json)),
  src         TEXT UNIQUE) STRICT;               -- idempotent derivation key (ev:<seq> ...)
CREATE INDEX IF NOT EXISTS logs_workflow ON logs(workflow_id,seq);
CREATE INDEX IF NOT EXISTS logs_attempt  ON logs(attempt_id,seq);
CREATE INDEX IF NOT EXISTS logs_job      ON logs(job_id,seq);
CREATE INDEX IF NOT EXISTS logs_kind     ON logs(workflow_id,kind,seq);
CREATE TRIGGER IF NOT EXISTS logs_append_only_update BEFORE UPDATE ON logs BEGIN
    SELECT RAISE(ABORT,'logs are append-only');
  END;
CREATE TRIGGER IF NOT EXISTS logs_delete_guard BEFORE DELETE ON logs
  WHEN NOT EXISTS(SELECT 1 FROM workflow_purges p WHERE p.workflow_id=OLD.workflow_id AND p.state='deleting')
   AND NOT (OLD.level='debug' AND OLD.at < CAST(unixepoch('subsec')*1000 AS INTEGER) - 1209600000) BEGIN
    SELECT RAISE(ABORT,'logs are append-only: only the workflow purge (or debug retention > 14 days) deletes them');
  END;

-- logs_fts: FTS5 external-content over msg/kind (data_json not indexed). Search: logs_fts MATCH '"EADDRINUSE"'.
CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(msg, kind, content='logs', content_rowid='seq',
  tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER IF NOT EXISTS logs_fts_insert AFTER INSERT ON logs BEGIN
    INSERT INTO logs_fts(rowid,msg,kind) VALUES (NEW.seq,NEW.msg,NEW.kind);
  END;
CREATE TRIGGER IF NOT EXISTS logs_fts_delete AFTER DELETE ON logs BEGIN
    INSERT INTO logs_fts(logs_fts,rowid,msg,kind) VALUES ('delete',OLD.seq,OLD.msg,OLD.kind);
  END;

CREATE TABLE IF NOT EXISTS log_cursors(name TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT;  -- events:<ledger> -> last derived seq

-- ---------------------------------------------------------------------------------------------------------
-- A8. Query views (durable)
-- ---------------------------------------------------------------------------------------------------------
-- Native state of a try (computed in one place, used for ui).
CREATE VIEW IF NOT EXISTS v_attempt_state AS
SELECT a.attempt_id,
       CASE WHEN a.end_state='worker-dead' THEN 'worker-dead' WHEN a.end_state='effect-unknown' THEN 'effect-unknown'
            WHEN a.end_state='requeued' AND json_extract(a.settle_json,'$.reason')='dispatch-rejected' THEN 'rejected'
            WHEN a.end_state='requeued' THEN 'requeued'
            WHEN (a.verdict='blocked' AND a.report_outcome='ask')
              OR (a.verdict IS NOT NULL AND (SELECT j.status FROM jobs j WHERE j.job_id=a.job_id)='awaiting_owner') THEN 'awaiting-owner'
            WHEN a.verdict IS NOT NULL THEN a.verdict
            WHEN a.dispatched_at IS NULL THEN 'routed' ELSE 'in-flight' END AS native
FROM op_attempts a;

-- Op history: one row per dispatch (UI /api/attempts).
CREATE VIEW IF NOT EXISTS v_op_history AS
SELECT a.attempt_id, a.workflow_id, a.unit_id, a.job_id, a.op_id, a.try_no, a.dispatch_seq, a.dispatch_id, a.span_id,
       a.agent, a.provider, a.model, a.model_profile, a.pool, a.effort, a.cli_version, a.runtime_rev,
       a.terminal_handle, a.worktree_path, a.branch, a.base_sha, a.head_sha, a.integrated_sha,
       a.routed_at, a.dispatched_at, a.reported_at, a.settled_at, a.released_at, a.worktree_removed_at,
       COALESCE(a.wall_ms, a.settled_at - a.dispatched_at) AS cycle_ms,
       a.report_outcome, a.verdict, a.settled_by, a.failure_class, a.end_state, a.why_json,
       a.tokens_in, a.tokens_out, a.cost_usd, a.usage_source,
       a.prompt_sha, a.transcript_sha, a.session_sha,
       s.native AS attempt_state,
       CASE WHEN s.native IN ('awaiting-owner','rejected') THEN s.native ELSE COALESCE(m.ui,'unknown') END AS ui,
       j.status AS job_status, r.report_id, r.summary AS report_summary,
       (SELECT count(*) FROM check_runs c WHERE c.attempt_id=a.attempt_id)                                 AS checks,
       (SELECT count(*) FROM check_runs c WHERE c.attempt_id=a.attempt_id AND c.status IN ('fail','error')) AS checks_red,
       (SELECT count(*) FROM job_artifacts x WHERE x.attempt_id=a.attempt_id)                              AS artifacts
FROM op_attempts a
JOIN v_attempt_state s ON s.attempt_id=a.attempt_id
LEFT JOIN ui_state_map m ON m.entity='attempt' AND m.native=s.native
LEFT JOIN jobs j    ON j.job_id=a.job_id
LEFT JOIN reports r ON r.attempt_id=a.attempt_id;

-- Unit rows with the latest try (UI /units, /graph).
CREATE VIEW IF NOT EXISTS v_units AS
SELECT u.*, COALESCE(m.ui,'unknown') AS ui,
       (SELECT max(attempt_id) FROM op_attempts a WHERE a.workflow_id=u.workflow_id AND a.unit_id=u.unit_id) AS last_attempt_id
FROM work_units u LEFT JOIN ui_state_map m ON m.entity='unit' AND m.native=u.state;

-- Checks with ui.
CREATE VIEW IF NOT EXISTS v_checks AS
SELECT c.*, COALESCE(m.ui,'unknown') AS ui FROM check_runs c LEFT JOIN ui_state_map m ON m.entity='check' AND m.native=c.status;

-- An ENDED workflow (phase archived|finished) surfaces no live leftovers: the predicate of scripts/machine/decisions.mjs listDecisions,
-- applied per leg here (a missing workflow row survives; v_decision_rows keeps an ended workflow's resolved rows as history).
-- Decision items with a time-rule ui: overdue or escalations >= 2 -> bad; under 20% of the window left -> warn.
CREATE VIEW IF NOT EXISTS v_decision_rows AS
SELECT d.*,
       (d.due_at IS NOT NULL AND d.status IN ('open','claimed','escalated') AND d.due_at < CAST(unixepoch('subsec')*1000 AS INTEGER)) AS overdue,
       CASE WHEN d.status IN ('open','claimed','escalated')
                 AND ((d.due_at IS NOT NULL AND d.due_at < CAST(unixepoch('subsec')*1000 AS INTEGER)) OR d.escalations>=2) THEN 'bad'
            WHEN d.status='open' AND d.due_at IS NOT NULL
                 AND (d.due_at - CAST(unixepoch('subsec')*1000 AS INTEGER)) < 0.2*(d.due_at - d.opened_at) THEN 'warn'
            ELSE COALESCE(m.ui,'unknown') END AS ui
FROM decision_items d LEFT JOIN ui_state_map m ON m.entity='decision' AND m.native=d.status
                      LEFT JOIN workflows w ON w.workflow_id=d.workflow_id
WHERE d.status NOT IN ('open','claimed','escalated') OR w.phase IS NULL OR w.phase NOT IN ('archived','finished');

-- Media with link.
CREATE VIEW IF NOT EXISTS v_media AS
SELECT x.artifact_id, x.workflow_id, x.job_id, x.attempt_id, x.op_id, x.role, x.kind, x.subkind,
       x.name, x.label, x.scope_ref, x.round, x.run_id, x.sha256, x.bytes, x.media_type, x.created_at,
       b.http_path, b.file_uri, b.pinned, b.archived_at
FROM job_artifacts x JOIN blobs b ON b.sha256=x.sha256
WHERE x.role IN ('direction','render','redline','capture','dom','screenshot','video','trace','uat-run')
   OR x.media_type LIKE 'image/%' OR x.media_type LIKE 'video/%';

-- Evidence of a Work record.
CREATE VIEW IF NOT EXISTS v_record_evidence AS
SELECT c.record_id, c.record_path, c.field, c.role, c.record_rev, c.sha256,
       b.http_path, b.file_uri, b.media_type, b.bytes,
       x.artifact_id, x.workflow_id, x.attempt_id, x.job_id, x.op_id, x.label, x.run_id, x.created_at AS produced_at
FROM work_citations c JOIN blobs b ON b.sha256=c.sha256 LEFT JOIN job_artifacts x ON x.artifact_id=c.artifact_id;

-- Timeline: event + log + try milestones + check + decision (ordered by at, then seq).
CREATE VIEW IF NOT EXISTS v_timeline AS
SELECT workflow_id, created_at AS at, seq, 'event' AS source, kind, entity_type, entity_id, attempt_id, payload_json AS detail
  FROM events
UNION ALL
SELECT workflow_id, at, seq, 'log', level||':'||kind, actor, node_id, attempt_id, msg FROM logs
UNION ALL
SELECT workflow_id, COALESCE(settled_at, reported_at, started_at, dispatched_at, routed_at), attempt_id, 'attempt',
       COALESCE(verdict, report_outcome, 'active'), 'attempt', CAST(attempt_id AS TEXT), attempt_id,
       json_object('op',op_id,'try',try_no,'seq',dispatch_seq,'agent',agent,'model',model,'verdict',verdict)
  FROM op_attempts WHERE COALESCE(settled_at, reported_at, started_at, dispatched_at, routed_at) IS NOT NULL
UNION ALL
SELECT workflow_id, COALESCE(started_at, created_at), check_id, 'check', name||' '||status, 'check', CAST(check_id AS TEXT),
       attempt_id, command FROM check_runs
UNION ALL
SELECT workflow_id, decided_at, 0, 'decision', choice, subject_type, subject_id, NULL, rationale FROM decisions;

-- Progress per unit.
CREATE VIEW IF NOT EXISTS v_workflow_progress AS
SELECT w.workflow_id, w.display_name, w.phase, w.trace_id, w.allowed_parallel,
       count(u.unit_id)                                  AS units_total,
       coalesce(sum(u.state='done'),0)                   AS units_done,
       coalesce(sum(u.state IN ('running','reported','deciding')),0) AS units_active,
       coalesce(sum(u.state IN ('planned','queued')),0)  AS units_waiting,
       coalesce(sum(u.state='failed'),0)                 AS units_failed,
       coalesce(sum(u.state='dropped'),0)                AS units_dropped,
       CASE WHEN count(u.unit_id)=0 THEN 0.0 ELSE round(1.0*sum(u.state='done')/count(u.unit_id),3) END AS completion_rate,
       coalesce(sum(u.state='done' AND u.done_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 21600000),0) AS done_last_6h,
       max(u.done_at) AS last_unit_at,
       CASE WHEN coalesce(sum(u.state='done' AND u.done_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 21600000),0)=0 THEN NULL
            ELSE CAST(unixepoch('subsec')*1000 AS INTEGER) + CAST(21600000.0 * (count(u.unit_id) - sum(u.state IN ('done','dropped')))
                 / sum(u.state='done' AND u.done_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 21600000) AS INTEGER) END AS eta_at
FROM workflows w LEFT JOIN work_units u ON u.workflow_id=w.workflow_id
GROUP BY w.workflow_id;

-- Model x op performance.
CREATE VIEW IF NOT EXISTS v_model_scorecard AS
SELECT agent, model, op_id, count(*) AS attempts,
       sum(verdict='pass') AS pass, sum(verdict='fail') AS fail, sum(verdict='blocked') AS blocked,
       sum(end_state='worker-dead') AS worker_dead,
       round(1.0*sum(verdict='pass')/NULLIF(sum(verdict IS NOT NULL),0),3) AS pass_rate,
       avg(COALESCE(wall_ms, settled_at - dispatched_at)) AS avg_cycle_ms,
       sum(tokens_in) AS tokens_in, sum(tokens_out) AS tokens_out, sum(cost_usd) AS cost_usd
FROM op_attempts GROUP BY agent, model, op_id;

-- "Why is X stuck": every open blocker, one row each, with who must clear it (UI blockedBy).
CREATE VIEW IF NOT EXISTS v_blocking AS
SELECT e.workflow_id, 'unit' AS entity_type, e.to_unit AS entity_id, 'unit' AS blocker_type, e.from_unit AS blocker_id,
       'UpstreamNotDone' AS reason_code, p.state AS detail, p.updated_at AS since, 'kernel' AS who
  FROM unit_edges e JOIN work_units t ON t.workflow_id=e.workflow_id AND t.unit_id=e.to_unit
                    JOIN work_units p ON p.workflow_id=e.workflow_id AND p.unit_id=e.from_unit
                    LEFT JOIN workflows w ON w.workflow_id=e.workflow_id
 WHERE t.state IN ('planned','queued') AND p.state NOT IN ('done','dropped')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT d.workflow_id, COALESCE(d.entity_type,'workflow'), COALESCE(d.entity_id,d.workflow_id), 'decision', d.di_id,
       'DecisionOpen:'||d.kind, d.summary, d.opened_at, d.decider
  FROM decision_items d LEFT JOIN workflows w ON w.workflow_id=d.workflow_id
 WHERE d.status IN ('open','claimed','escalated')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT c.workflow_id, c.entity_type, c.entity_id, 'condition', c.type, c.reason, c.message, c.last_transition_at, COALESCE(c.owner,'controller')
  FROM conditions c LEFT JOIN workflows w ON w.workflow_id=c.workflow_id
 WHERE c.status<>'True'
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT i.workflow_id, 'job', COALESCE(i.job_id,i.workflow_id), 'incident', i.incident_id, 'IncidentOpen:'||i.kind,
       COALESCE(i.detail,i.last_progress), i.created_at, i.owner
  FROM incidents i LEFT JOIN workflows w ON w.workflow_id=i.workflow_id
 WHERE i.status='open'
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT x.workflow_id, 'attempt', CAST(x.attempt_id AS TEXT), 'question', CAST(x.inbox_id AS TEXT), 'WorkerQuestionPending',
       json_extract(x.payload_json,'$.question'), x.created_at, 'kernel'
  FROM inbox x LEFT JOIN workflows w ON w.workflow_id=x.workflow_id
 WHERE x.kind='worker-question' AND x.status IN ('pending','claimed')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT s.workflow_id, 'attempt', CAST(s.attempt_id AS TEXT), 'settle-tail', CAST(s.attempt_id AS TEXT), 'SettleTailFailed', s.last_error,
       COALESCE(s.started_at,s.queued_at), 'controller'
  FROM settle_tails s LEFT JOIN workflows w ON w.workflow_id=s.workflow_id
 WHERE s.state='failed'
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT l.workflow_id, 'workflow', l.workflow_id, 'product-land', CAST(l.land_id AS TEXT), 'ProductLand:'||l.result, l.reason,
       l.started_at, 'kernel'
  FROM product_lands l LEFT JOIN workflows w ON w.workflow_id=l.workflow_id
 WHERE l.result IN ('failed','conflict','red')
   AND NOT EXISTS(SELECT 1 FROM product_lands k WHERE k.workflow_id=l.workflow_id AND k.land_id>l.land_id AND k.result='landed')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
-- H1: a filed report nobody settled within its SLA (the same rows as v_settle_overdue) blocks its job.
SELECT a.workflow_id, 'attempt', CAST(a.attempt_id AS TEXT), 'settle', CAST(a.attempt_id AS TEXT),
       'SettleOverdue:'||COALESCE(a.report_outcome,'?'), a.job_id, a.reported_at,
       CASE WHEN a.report_outcome='done' THEN 'settler' ELSE 'kernel' END
  FROM op_attempts a LEFT JOIN workflows w ON w.workflow_id=a.workflow_id
 WHERE a.reported_at IS NOT NULL AND a.settled_at IS NULL AND a.end_state IS NULL
   AND (CAST(unixepoch('subsec')*1000 AS INTEGER) - a.reported_at) > CASE WHEN a.report_outcome='done' THEN 180000 ELSE 900000 END
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'));

-- Open work (DIs + jobs holding a lease/running).
CREATE VIEW IF NOT EXISTS v_open_work AS
SELECT 'decision' AS kind, d.workflow_id, d.di_id AS ref, d.summary AS what, d.opened_at AS since, d.due_at
  FROM decision_items d LEFT JOIN workflows w ON w.workflow_id=d.workflow_id
 WHERE d.status IN ('open','claimed','escalated')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT 'job-'||j.status, j.workflow_id, j.job_id, j.op_id, j.updated_at, j.deadline
  FROM jobs j LEFT JOIN workflows w ON w.workflow_id=j.workflow_id
 WHERE j.status IN ('leased','running','answering','effect_unknown')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'));

-- H1: a filed report unsettled past SLA (green <= 3 min for settler; non-green <= 15 min for Kernel, then DI escalation).
-- A job in 'reported'/'deciding' past SLA does NOT count as holding a worker slot (census reads this view to exclude it).
CREATE VIEW IF NOT EXISTS v_settle_overdue AS
SELECT a.workflow_id, a.attempt_id, a.job_id, a.unit_id, a.op_id, a.report_outcome, j.status AS job_status,
       a.reported_at, (CAST(unixepoch('subsec')*1000 AS INTEGER) - a.reported_at) AS waiting_ms,
       CASE WHEN a.report_outcome='done' THEN 'settler' ELSE 'kernel' END AS who,
       CASE WHEN a.report_outcome='done' THEN 180000 ELSE 900000 END AS sla_ms,
       (SELECT di_id FROM decision_items d WHERE d.attempt_id=a.attempt_id AND d.status IN ('open','claimed','escalated')) AS open_di
FROM op_attempts a JOIN jobs j ON j.job_id=a.job_id
WHERE a.reported_at IS NOT NULL AND a.settled_at IS NULL AND a.end_state IS NULL
  AND (CAST(unixepoch('subsec')*1000 AS INTEGER) - a.reported_at) > CASE WHEN a.report_outcome='done' THEN 180000 ELSE 900000 END;

-- Leaks: expired leases (with holder) and overdue open incidents - GC/Resource ctrl scan this view (H12).
CREATE VIEW IF NOT EXISTS v_ledger_leaks AS
SELECT 'lease' AS kind, l.resource_key AS target, l.workflow_id, l.job_id, l.attempt_id, l.holder AS owner, l.expires_at AS due_at
  FROM leases l WHERE l.expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL
SELECT 'incident', i.incident_id, i.workflow_id, i.job_id, i.attempt_id, i.owner, i.due_at
  FROM incidents i WHERE i.status='open' AND i.due_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL
SELECT 'attempt-no-transcript', CAST(a.attempt_id AS TEXT), a.workflow_id, a.job_id, a.attempt_id, a.terminal_handle, a.terminal_closed_at + 120000
  FROM op_attempts a WHERE a.terminal_closed_at IS NOT NULL AND a.transcript_sha IS NULL
   AND a.terminal_closed_at < CAST(unixepoch('subsec')*1000 AS INTEGER) - 120000;   -- SLA TRANSCRIPT_MISSING

-- Search by id across every entity (UI /api/search, key part; the text part uses logs_fts).
CREATE VIEW IF NOT EXISTS v_search_ids AS
SELECT 'workflow' AS kind, workflow_id AS id, workflow_id, COALESCE(display_name,title) AS title FROM workflows
UNION ALL SELECT 'trace', trace_id, workflow_id, COALESCE(display_name,title) FROM workflows
UNION ALL SELECT 'unit', unit_id, workflow_id, COALESCE(title,op_id) FROM work_units
UNION ALL SELECT 'job', job_id, workflow_id, op_id FROM jobs
UNION ALL SELECT 'attempt', CAST(attempt_id AS TEXT), workflow_id, op_id||' #'||try_no||'.'||dispatch_seq FROM op_attempts
UNION ALL SELECT 'dispatch', dispatch_id, workflow_id, op_id FROM op_attempts
UNION ALL SELECT 'span', span_id, workflow_id, op_id FROM op_attempts
UNION ALL SELECT 'terminal', terminal_handle, workflow_id, op_id FROM op_attempts WHERE terminal_handle IS NOT NULL
UNION ALL SELECT 'commit', head_sha, workflow_id, op_id FROM op_attempts WHERE head_sha IS NOT NULL
UNION ALL SELECT 'decision', di_id, workflow_id, summary FROM decision_items
UNION ALL SELECT 'incident', incident_id, workflow_id, kind FROM incidents
UNION ALL SELECT 'artifact', CAST(artifact_id AS TEXT), workflow_id, name FROM job_artifacts
UNION ALL SELECT 'blob', sha256, NULL, media_type FROM blobs;

-- Invalidation marks for SSE /api/live (server compares with previous; ETag also uses PRAGMA data_version).
CREATE VIEW IF NOT EXISTS v_live_marks AS
SELECT 'events' AS topic, COALESCE(max(seq),0) AS mark FROM events
UNION ALL SELECT 'logs', COALESCE(max(seq),0) FROM logs
UNION ALL SELECT 'attempts', COALESCE(max(max(attempt_id), max(COALESCE(settled_at,reported_at,dispatched_at,0))),0) FROM op_attempts
UNION ALL SELECT 'decisions', COALESCE(max(max(opened_at), max(COALESCE(resolved_at,0))),0) FROM decision_items;

-- Blob references in this ledger (convenient lookup; GC uses blob_ref_columns, not this view).
CREATE VIEW IF NOT EXISTS v_blob_refs AS
SELECT b.sha256, b.bytes, b.pinned, b.archived_at, b.created_at,
       (SELECT count(*) FROM job_artifacts x WHERE x.sha256=b.sha256)
     + (SELECT count(*) FROM check_runs c WHERE b.sha256 IN (c.stdout_sha,c.stderr_sha,c.output_sha))
     + (SELECT count(*) FROM op_attempts a WHERE b.sha256 IN (a.prompt_sha,a.transcript_sha,a.session_sha))
     + (SELECT count(*) FROM attempt_transcript_snapshots t WHERE t.sha256=b.sha256)
     + (SELECT count(*) FROM work_citations w WHERE w.sha256=b.sha256)
     + (SELECT count(*) FROM goal_inputs g WHERE g.sha256=b.sha256)
     + (SELECT count(*) FROM product_lands l WHERE l.output_sha=b.sha256)
     + (SELECT count(*) FROM events e WHERE e.payload_sha=b.sha256) AS refs
FROM blobs b;


