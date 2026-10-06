-- ############################################################################################################
-- machine.sqlite (one per machine) - this file is the single schema step of the database.
-- Tables: machine_meta - identity; ui_states/ui_state_map - display
-- vocabulary; blob_ref_columns - blob-referencing columns; ledgers/repositories - registered projects;
-- agents/models - agent and model catalog; blobs/archives/gc_marks - content store and GC; sup_* - Supervisor;
-- process_runs/engine_*/schedules/sla_episodes/invariant_violations - reconciler; services/seats/deliveries/
-- seat_turns/terminals/host_locks/claims/agent_sessions - machine objects; throttle_*/
-- host_samples/provider_*/pool_backoff/quotas/guard_*/host_*/budgets - capacity and spend; gc_*/lanes/land_*/
-- pushes/worktrees/env_servers/uat_slots/connectors/ask_requests - worker operations; machine_logs/
-- metrics_snapshots/notifications - observability; v_* - durable views.
-- ############################################################################################################

-- ---------------------------------------------------------------------------------------------------------
-- B0. Identity, vocabulary, registry, catalog, archive
-- ---------------------------------------------------------------------------------------------------------
-- machine_meta: host_id, schema='starci/machine@1', created_at, blob_root, runtime_rev, sqlite_version, node_version.
CREATE TABLE IF NOT EXISTS machine_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;

CREATE TABLE IF NOT EXISTS ui_states(
  ui TEXT PRIMARY KEY CHECK(ui IN ('bad','warn','running','waiting','ok','done','unknown')),
  rank INTEGER NOT NULL) STRICT;
INSERT OR IGNORE INTO ui_states VALUES
  ('bad',0),('warn',1),('running',2),('waiting',3),('ok',4),('done',5),('unknown',6);
CREATE TABLE IF NOT EXISTS ui_state_map(
  entity TEXT NOT NULL, native TEXT NOT NULL, ui TEXT NOT NULL REFERENCES ui_states(ui), PRIMARY KEY(entity,native)) STRICT;
INSERT OR IGNORE INTO ui_state_map VALUES
  ('service','healthy','ok'),('service','ok','ok'),('service','live','ok'),('service','down','bad'),('service','dead','bad'),
  ('service','quarantined','bad'),('service','stale','bad'),('service','restarting','warn'),('service','booting','running'),
  ('seat','empty','waiting'),('seat','parked','done'),('seat','booting','running'),('seat','live','ok'),('seat','busy','running'),
  ('seat','stale','bad'),('seat','dead','bad'),('seat','replacing','warn'),('seat','quarantined','bad'),('service','degraded','warn'),
  ('engine-action','fenced','warn'),('push','failed','bad'),
  ('sla','running','waiting'),('sla','violated','warn'),('sla','violated-critical','bad'),('sla','cleared','done'),
  ('engine-action','intent','running'),('engine-action','running','running'),('engine-action','done','done'),
  ('engine-action','failed','bad'),('engine-action','unknown','bad'),
  ('land','queued','waiting'),('land','running','running'),('land','passed','done'),('land','failed','bad'),
  ('land','conflict','bad'),('land','refused','bad'),('land','cancelled','done'),
  ('push','pushed','done'),('push','skipped','waiting'),('push','refused','bad'),
  ('lane','open','running'),('lane','landing','running'),('lane','landed','done'),('lane','abandoned','done'),('lane','removed','done'),
  ('provider','healthy','ok'),('provider','recovered','ok'),('provider','striking','warn'),('provider','unavailable','bad'),
  ('throttle','normal','ok'),('throttle','heavy','warn'),('throttle','critical','bad'),
  ('sup-job','queued','waiting'),('sup-job','spawning','running'),('sup-job','running','running'),('sup-job','reported','running'),
  ('sup-job','landing','running'),('sup-job','succeeded','done'),('sup-job','failed','bad'),('sup-job','cancelled','done'),
  ('decision','open','waiting'),('decision','claimed','running'),('decision','escalated','warn'),('decision','expired','warn'),
  ('decision','resolved','done'),('decision','superseded','done'),
  ('owed','open','waiting'),('owed','acked','running'),('owed','closed','done'),
  ('gc-run','running','running'),('gc-run','done','done'),('gc-run','errors','warn'),
  ('env-server','starting','running'),('env-server','ready','ok'),('env-server','failed','bad'),('env-server','stopped','done'),
  ('ask','open','waiting'),('ask','answered','done'),('ask','retired','done'),('ask','expired','warn');

CREATE TABLE IF NOT EXISTS blob_ref_columns(
  table_name TEXT NOT NULL, column_name TEXT NOT NULL, PRIMARY KEY(table_name,column_name)) STRICT;
INSERT OR IGNORE INTO blob_ref_columns VALUES
  ('lanes','report_sha'),('land_runs','stdout_sha'),('land_runs','stderr_sha'),
  ('engine_actions','result_sha'),('engine_actions','stdout_sha'),('engine_actions','stderr_sha'),
  ('metrics_snapshots','data_sha'),('sup_reports','report_sha'),('sup_attempts','prompt_sha'),('sup_attempts','transcript_sha'),
  ('env_servers','log_sha'),('notifications','media_sha'),('agent_sessions','transcript_sha'),('sup_events','payload_sha'),
  ('seat_transcript_snapshots','sha256'),('pushes','stdout_sha'),('pushes','stderr_sha'),('gc_runs','report_sha');

-- ledgers: the ONLY registry of every runtime.sqlite (reconciler, GC, harness read it here; replaces config.yaml supervisor.repos).
CREATE TABLE IF NOT EXISTS ledgers(
  ledger_id      TEXT PRIMARY KEY,               -- = meta.ledger_id inside the file (UUID)
  name           TEXT NOT NULL UNIQUE,           -- 'acme-backend'
  product        TEXT,
  repo_root      TEXT NOT NULL,
  file           TEXT NOT NULL,
  state          TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','idle','retired')),
  schema_version INTEGER,
  registered_at  INTEGER NOT NULL,
  seen_at        INTEGER NOT NULL,               -- most recent time the engine opened it (G16)
  retired_at     INTEGER, retired_reason TEXT,
  CHECK(state<>'retired' OR retired_at IS NOT NULL)) STRICT;

CREATE TABLE IF NOT EXISTS repositories(
  repo_root      TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL CHECK(role IN ('backend','frontend','service','runtime')),
  ledger_id      TEXT REFERENCES ledgers(ledger_id),
  default_branch TEXT, remote TEXT,
  seen_at        INTEGER NOT NULL) STRICT;

-- agents / models: PROJECTION of modules/models/*.yaml (YAML stays the contract), rewritten on each engine boot.
CREATE TABLE IF NOT EXISTS agents(
  agent      TEXT PRIMARY KEY CHECK(agent IN ('devin','codex','claude')),
  provider   TEXT, spawn_card TEXT, cli_name TEXT,
  source_rev TEXT NOT NULL, loaded_at INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS models(
  profile     TEXT PRIMARY KEY,
  agent       TEXT REFERENCES agents(agent),
  model       TEXT, pool TEXT, max_parallel INTEGER, share_pct REAL,
  roles_json  TEXT CHECK(roles_json IS NULL OR json_valid(roles_json)),
  cost_json   TEXT CHECK(cost_json IS NULL OR json_valid(cost_json)),
  source_rev  TEXT NOT NULL, loaded_at INTEGER NOT NULL) STRICT;

CREATE TABLE IF NOT EXISTS blobs(
  sha256 TEXT PRIMARY KEY CHECK(length(sha256)=64), bytes INTEGER NOT NULL CHECK(bytes>=0), media_type TEXT NOT NULL,
  encoding TEXT CHECK(encoding IS NULL OR encoding='gzip'), redaction TEXT CHECK(redaction IS NULL OR redaction IN ('v1','binary')),
  file_uri TEXT NOT NULL, http_path TEXT GENERATED ALWAYS AS ('/api/blob/' || sha256) VIRTUAL,
  created_at INTEGER NOT NULL, pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
  archived_at INTEGER, archive_ref TEXT) STRICT;

-- archives: every verified zip/copy in the starci-archive store (purge, DB backup, blob retention, lane logs).
CREATE TABLE IF NOT EXISTS archives(
  archive_path    TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK(kind IN ('workflow-purge','db-backup','blob-retention','lane-logs','agent-sessions')),
  subject         TEXT,
  bytes           INTEGER NOT NULL, sha256 TEXT NOT NULL, manifest_sha256 TEXT, entries INTEGER,
  integrity       TEXT,                          -- 'ok' from integrity_check (db-backup) / 'sha-verified' (zip)
  created_at      INTEGER NOT NULL, verified_at INTEGER, expires_at INTEGER) STRICT;

-- gc_marks: the set of live sha values; GC marks PER ledger (opens each read-only in turn, reads that ledger's
-- blob_ref_columns) then machine; sweep deletes a file only when: absent from the run's gc_marks, pinned=0 in
-- every DB, archived_at IS NOT NULL, created_at < now-24h. No ATTACH-UNION (10-DB limit).
CREATE TABLE IF NOT EXISTS gc_marks(
  run_id  INTEGER NOT NULL REFERENCES gc_runs(run_id) ON DELETE CASCADE,
  sha256  TEXT NOT NULL,
  source  TEXT NOT NULL,                         -- ledger name | 'machine'
  pinned  INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
  PRIMARY KEY(run_id,sha256,source)) STRICT, WITHOUT ROWID;

-- ---------------------------------------------------------------------------------------------------------
-- B1. Supervisor (own tables prefixed sup_; seats in `seats`, log in `machine_logs`, cost in `llm_usage`)
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sup_jobs(
  job_id       TEXT PRIMARY KEY,
  trace_id     TEXT NOT NULL CHECK(length(trace_id)=32),
  kind         TEXT NOT NULL,                    -- runtime.fix | runtime.review | ...
  role         TEXT NOT NULL CHECK(role IN ('worker','supervisor')),
  cluster      TEXT,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL CHECK(status IN ('queued','spawning','running','reported','landing','succeeded','failed','cancelled')),
  lane         TEXT,
  files_json   TEXT CHECK(files_json IS NULL OR json_valid(files_json)),     -- .claude paths the job may edit
  brief        TEXT,
  payload_json TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),
  created_at   INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;
CREATE INDEX IF NOT EXISTS ix_sup_jobs_status ON sup_jobs(status,created_at);

CREATE TABLE IF NOT EXISTS sup_leases(
  path        TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES sup_jobs(job_id) ON DELETE CASCADE,
  acquired_at INTEGER NOT NULL, expires_at INTEGER NOT NULL) STRICT;

-- sup_attempts: same column groups as op_attempts (who, where, when, outcome, replay) so they do not drift apart.
CREATE TABLE IF NOT EXISTS sup_attempts(
  attempt_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id         TEXT NOT NULL REFERENCES sup_jobs(job_id) ON DELETE CASCADE,
  dispatch_seq   INTEGER NOT NULL DEFAULT 1,
  span_id        TEXT NOT NULL CHECK(length(span_id)=16), parent_span_id TEXT,
  agent          TEXT CHECK(agent IS NULL OR agent IN ('devin','codex','claude')),
  provider TEXT, model TEXT, effort TEXT, terminal_handle TEXT, worker_pid INTEGER,
  runtime_rev TEXT, cli_name TEXT, cli_version TEXT,
  prompt_sha     TEXT REFERENCES blobs(sha256), transcript_sha TEXT REFERENCES blobs(sha256),
  worktree_path TEXT, branch TEXT, base_sha TEXT, head_sha TEXT, landed_sha TEXT,
  spawned_at INTEGER, reported_at INTEGER, acked_at INTEGER, landed_at INTEGER, cancelled_at INTEGER, closed_at INTEGER,
  report_outcome TEXT, verdict TEXT, failure_class TEXT,
  tokens_in INTEGER, tokens_out INTEGER, cost_usd REAL,
  UNIQUE(job_id,dispatch_seq)) STRICT;

CREATE TABLE IF NOT EXISTS sup_reports(
  report_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id   INTEGER NOT NULL UNIQUE REFERENCES sup_attempts(attempt_id) ON DELETE CASCADE,
  job_id       TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  report_json  TEXT NOT NULL CHECK(json_valid(report_json)),
  summary      TEXT GENERATED ALWAYS AS (json_extract(report_json,'$.summary')) VIRTUAL,
  report_sha   TEXT REFERENCES blobs(sha256),    -- <lane>.REPORT.md
  consumed_at  INTEGER, created_at INTEGER NOT NULL) STRICT;

-- sup_events: Supervisor audit journal; digest computed in the JS writer like events.
CREATE TABLE IF NOT EXISTS sup_events(
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL UNIQUE,
  entity_type  TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, span_id TEXT,
  payload_json TEXT CHECK(payload_json IS NULL OR (json_valid(payload_json) AND length(payload_json)<=16384)),
  payload_sha  TEXT REFERENCES blobs(sha256),
  prev_digest  TEXT, digest TEXT NOT NULL CHECK(length(digest)=64), created_at INTEGER NOT NULL) STRICT;
CREATE INDEX IF NOT EXISTS ix_sup_events_kind   ON sup_events(kind,seq);
CREATE INDEX IF NOT EXISTS ix_sup_events_entity ON sup_events(entity_type,entity_id,seq);
CREATE TRIGGER IF NOT EXISTS sup_events_append_only BEFORE UPDATE ON sup_events BEGIN
    SELECT RAISE(ABORT,'sup_events are append-only');
  END;

CREATE TABLE IF NOT EXISTS sup_decision_items(
  di_id           TEXT PRIMARY KEY,
  -- MB-07: '<kind>:<entity>:<error signature>:<head>' - no empty part (a head-less push-refused merged 73 times into an old DI).
  idempotency_key TEXT NOT NULL UNIQUE CHECK(idempotency_key NOT LIKE '%::%' AND idempotency_key NOT LIKE '%:'
                                              AND idempotency_key NOT LIKE ':%' AND length(idempotency_key)>=5),
  key_parts_json  TEXT NOT NULL CHECK(json_valid(key_parts_json) AND json_type(key_parts_json)='object'),
  superseded_by   TEXT REFERENCES sup_decision_items(di_id),
  delivered_at    INTEGER,                       -- MB-02: whether it reached the Supervisor seat yet (detail in deliveries)
  ledger_id       TEXT REFERENCES ledgers(ledger_id),
  workflow_id     TEXT,
  kind            TEXT NOT NULL,                 -- cap-starved | quota-exhausted | runtime-defect | cross-workflow | deadlock | ...
  decider         TEXT NOT NULL CHECK(decider IN ('supervisor','owner')),
  entity_type TEXT, entity_id TEXT,
  summary         TEXT NOT NULL,
  status          TEXT NOT NULL CHECK(status IN ('open','claimed','resolved','escalated','expired','superseded')),
  opened_by       TEXT NOT NULL, opened_at INTEGER NOT NULL, due_at INTEGER,
  escalate_to TEXT, escalations INTEGER NOT NULL DEFAULT 0,
  claim_by TEXT, claim_at INTEGER, claim_ttl_ms INTEGER,
  resolved_by TEXT, resolved_at INTEGER, resolution_verb TEXT, decision_id TEXT,
  evidence_json TEXT CHECK(evidence_json IS NULL OR json_valid(evidence_json)),
  options_json TEXT CHECK(options_json IS NULL OR json_valid(options_json)),
  allowed_verbs_json TEXT CHECK(allowed_verbs_json IS NULL OR json_valid(allowed_verbs_json)),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json))) STRICT;
CREATE INDEX IF NOT EXISTS ix_sup_di_open ON sup_decision_items(status,due_at);

CREATE TABLE IF NOT EXISTS sup_decisions(
  decision_id TEXT PRIMARY KEY, di_id TEXT REFERENCES sup_decision_items(di_id), decider TEXT NOT NULL,
  span_id TEXT NOT NULL CHECK(length(span_id)=16), parent_span_id TEXT,
  ledger_id TEXT, workflow_id TEXT, subject_type TEXT, subject_id TEXT,
  choice TEXT NOT NULL, rationale TEXT, result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  decided_at INTEGER NOT NULL) STRICT;

CREATE TABLE IF NOT EXISTS sup_owed(
  owed_id    TEXT PRIMARY KEY,
  kind       TEXT NOT NULL, subject TEXT NOT NULL, cluster TEXT,
  state      TEXT NOT NULL CHECK(state IN ('open','acked','closed')),
  opened_at  INTEGER NOT NULL, due_at INTEGER, acked_at INTEGER, acked_by TEXT, closed_at INTEGER,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json))) STRICT;
CREATE INDEX IF NOT EXISTS ix_sup_owed_open ON sup_owed(state,due_at);

CREATE TABLE IF NOT EXISTS sup_learning(
  item_id     TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK(kind IN ('lesson','hypothesis','experiment','experiment-result','proposal','owner-feedback','leftover')),
  parent_id   TEXT REFERENCES sup_learning(item_id),
  title       TEXT NOT NULL, state TEXT, source_ref TEXT, lane TEXT, landed_sha TEXT,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json)),
  created_at  INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;

CREATE TABLE IF NOT EXISTS sup_owner_rulings(
  ruling_id TEXT PRIMARY KEY, said_at INTEGER NOT NULL, channel TEXT, verbatim TEXT NOT NULL, paraphrase TEXT,
  applies_to TEXT, contract_ref TEXT, recorded_by TEXT, created_at INTEGER NOT NULL) STRICT;

CREATE TABLE IF NOT EXISTS sup_bridges(
  bridge_id TEXT PRIMARY KEY, ledger_id TEXT REFERENCES ledgers(ledger_id),
  action TEXT NOT NULL CHECK(action IN ('bridge','transfer','rewire')),
  state TEXT NOT NULL, approved_by TEXT, detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json)),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;

CREATE TABLE IF NOT EXISTS sup_messages(
  msg_id     TEXT PRIMARY KEY,
  direction  TEXT NOT NULL CHECK(direction IN ('in','out')),
  channel    TEXT NOT NULL CHECK(channel IN ('telegram','tell','ask-gateway')),
  chat_id TEXT, message_id TEXT, from_ref TEXT, to_ref TEXT, via TEXT,
  text       TEXT NOT NULL,
  ok         INTEGER CHECK(ok IS NULL OR ok IN (0,1)),
  read_at    INTEGER, at INTEGER NOT NULL) STRICT;
CREATE INDEX IF NOT EXISTS ix_sup_messages_unread ON sup_messages(direction,read_at,at);

CREATE TABLE IF NOT EXISTS sup_signals(
  scope TEXT NOT NULL CHECK(scope IN ('supervisor-enabled','supervisor-busy','core-debug-enabled','core-debug-diagnostics')), key TEXT NOT NULL,
  holder_pid INTEGER, token TEXT, value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
  at INTEGER NOT NULL, expires_at INTEGER, PRIMARY KEY(scope,key)) STRICT;

-- llm_usage (machine): cost of Supervisor and [Worker].
CREATE TABLE IF NOT EXISTS llm_usage(
  usage_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type       TEXT NOT NULL CHECK(subject_type IN ('supervisor-turn','worker-attempt')),
  sup_attempt_id     INTEGER REFERENCES sup_attempts(attempt_id) ON DELETE CASCADE,
  turn_ref           TEXT, span_id TEXT,
  provider           TEXT NOT NULL, request_model TEXT, response_model TEXT,
  input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER, reasoning_tokens INTEGER,
  cost_usd REAL, turns INTEGER, tool_calls INTEGER, tool_errors INTEGER,
  source             TEXT NOT NULL CHECK(source IN ('cli-transcript','provider-report')),
  at                 INTEGER NOT NULL,
  CHECK((subject_type='worker-attempt' AND sup_attempt_id IS NOT NULL) OR (subject_type='supervisor-turn' AND turn_ref IS NOT NULL))) STRICT;
CREATE INDEX IF NOT EXISTS ix_musage ON llm_usage(subject_type,at);

-- ---------------------------------------------------------------------------------------------------------
-- B2. Reconciler engine (replaces reconciler.sqlite, reconciler-starts.json, reconciler.heartbeat)
-- Principle (LOG-AUDIT-MACHINE sec. 5): everything with a duration is APPEND-ONLY history; "current state" is a view
-- or one thin row. No DELETE, no rewriting history. Every action has an id; every consequence references that id.
-- ---------------------------------------------------------------------------------------------------------
-- process_runs (G1, MB-04): EVERY long-lived runtime process (engine, harness, gateway, tunnel, telegram-bridge,
-- settler, push-mains, land) one row: why it spawned, why it died, who killed it, last heartbeat before death.
CREATE TABLE IF NOT EXISTS process_runs(
  run_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role              TEXT NOT NULL CHECK(role IN ('engine','harness','gateway','tunnel','telegram-bridge','settler','push','land','boot','other')),
  pid               INTEGER NOT NULL, host TEXT, rev TEXT, epoch INTEGER,
  parent_action_id  TEXT,                          -- engine_actions.id that spawned it (if any)
  start_reason      TEXT NOT NULL CHECK(start_reason IN ('boot','ensure-stale-heartbeat','self-reload','crash-restart','manual','scheduled','action')),
  started_at        INTEGER NOT NULL,
  last_heartbeat_at INTEGER,
  draining_since    INTEGER,                       -- MB-04: handing over; ensure must NOT kill a draining process
  ended_at          INTEGER,
  exit_code         INTEGER,
  exit_reason       TEXT CHECK(exit_reason IS NULL OR exit_reason IN ('clean','reload-handover','crash','killed','lost-lease','stopped','unknown')),
  killed_by         TEXT,                          -- 'boot-ensure' | 'supervisor' | 'owner' | pid:<n>
  heartbeat_age_at_end_ms INTEGER,
  CHECK(ended_at IS NULL OR exit_reason IS NOT NULL)) STRICT;
CREATE INDEX IF NOT EXISTS ix_process_runs ON process_runs(role,started_at);
-- End fields may be filled only once (append-only in meaning).
CREATE TRIGGER IF NOT EXISTS process_runs_end_once BEFORE UPDATE OF ended_at, exit_reason, killed_by ON process_runs
  WHEN OLD.ended_at IS NOT NULL BEGIN
    SELECT RAISE(ABORT,'process run already ended');
  END;
CREATE TRIGGER IF NOT EXISTS process_runs_no_delete BEFORE DELETE ON process_runs
  WHEN OLD.started_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 7776000000 BEGIN   -- only GC deletes rows older than 90 days
    SELECT RAISE(ABORT,'process_runs are append-only (90-day retention)');
  END;
-- /api/reconciler starts24h: engine starts = view.
CREATE VIEW IF NOT EXISTS v_engine_starts AS
SELECT run_id, started_at AS at, pid, rev, epoch, start_reason AS reason, ended_at, exit_reason, killed_by
FROM process_runs WHERE role='engine';

-- engine_leader: one current row (fence). History in leader_history.
CREATE TABLE IF NOT EXISTS engine_leader(
  name TEXT PRIMARY KEY, holder TEXT NOT NULL, pid INTEGER NOT NULL, epoch INTEGER NOT NULL,
  process_run_id INTEGER REFERENCES process_runs(run_id),
  heartbeat_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, rev TEXT,
  draining INTEGER NOT NULL DEFAULT 0 CHECK(draining IN (0,1)),   -- MB-04: the lease still renews on its own timer while draining
  passes INTEGER, last_pass_ms INTEGER, last_error TEXT) STRICT;
-- leader_history (G2): one row per epoch; how long the lead was held, why released.
CREATE TABLE IF NOT EXISTS leader_history(
  epoch          INTEGER PRIMARY KEY,
  holder TEXT NOT NULL, pid INTEGER NOT NULL, process_run_id INTEGER REFERENCES process_runs(run_id), rev TEXT,
  acquired_at    INTEGER NOT NULL,
  acquired_how   TEXT NOT NULL CHECK(acquired_how IN ('fresh','takeover-stale','handover')),
  released_at    INTEGER,
  release_reason TEXT CHECK(release_reason IS NULL OR release_reason IN ('reload','lost','killed','stop','crash'))) STRICT;
CREATE TRIGGER IF NOT EXISTS leader_history_release_once BEFORE UPDATE ON leader_history
  WHEN OLD.released_at IS NOT NULL OR NEW.epoch<>OLD.epoch OR NEW.acquired_at<>OLD.acquired_at BEGIN
    SELECT RAISE(ABORT,'leader_history is append-only');
  END;
CREATE TRIGGER IF NOT EXISTS leader_history_no_delete BEFORE DELETE ON leader_history BEGIN
    SELECT RAISE(ABORT,'leader_history is append-only');
  END;

CREATE TABLE IF NOT EXISTS engine_cursors(
  ledger_id TEXT PRIMARY KEY REFERENCES ledgers(ledger_id), last_seq INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS engine_queue(
  controller TEXT NOT NULL, key TEXT NOT NULL, due_at INTEGER, reason TEXT, tries INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, PRIMARY KEY(controller,key)) STRICT;

-- schedules (MB-01): the timetable of every periodic duty lives in the DB, NOT in RAM - a fresh engine rereads it,
-- no repeated "first run" (housekeeping once/day once ran 32 times in 3.5 hours).
CREATE TABLE IF NOT EXISTS schedules(
  controller       TEXT NOT NULL CHECK(controller IN ('job','workflow','resource','host','gc','workers','learning','sla')),
  duty             TEXT NOT NULL,                -- housekeeping, sweep, push, digest, backup, blob-sweep, transcripts, boot ...
  interval_ms      INTEGER NOT NULL CHECK(interval_ms>0),
  last_started_at  INTEGER, last_finished_at INTEGER,
  last_result      TEXT CHECK(last_result IS NULL OR last_result IN ('done','failed','unknown','skipped')),
  last_action_id   TEXT,                         -- engine_actions.id
  last_result_digest TEXT,
  next_due_at      INTEGER NOT NULL,
  running_pid      INTEGER,                      -- a run currently in flight (no overlap)
  PRIMARY KEY(controller,duty)) STRICT;

-- engine_actions (MB-03): result is NOT truncated at 4000 chars - result_json is only a small structured summary;
-- the full result, stdout and stderr of the child verb are blobs. id is DETERMINISTIC = sha(controller, key, verb, epoch, observed_generation).
CREATE TABLE IF NOT EXISTS engine_actions(
  id TEXT PRIMARY KEY,
  controller TEXT NOT NULL CHECK(controller IN ('job','workflow','resource','host','gc','workers','learning','sla')),
  duty TEXT,                                     -- schedules.duty when the action is a periodic run
  key TEXT, verb TEXT, argv_digest TEXT, epoch INTEGER, observed_generation INTEGER,
  span_id TEXT CHECK(span_id IS NULL OR length(span_id)=16), trace_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('intent','running','done','failed','unknown','fenced')),
  mode TEXT CHECK(mode IS NULL OR mode IN ('shadow','active')),
  ledger_id TEXT, workflow_id TEXT, job_id TEXT, attempt_id INTEGER,
  request_id TEXT,                               -- api_requests.request_id of the child verb
  child_run_id INTEGER REFERENCES process_runs(run_id),
  started_at INTEGER, finished_at INTEGER, exit_code INTEGER,
  result_json TEXT CHECK(result_json IS NULL OR (json_valid(result_json) AND length(result_json)<=8192)),
  result_sha TEXT REFERENCES blobs(sha256),      -- full result
  stdout_sha TEXT REFERENCES blobs(sha256),
  stderr_sha TEXT REFERENCES blobs(sha256),      -- FULL stderr (today it is cut to 6 lines)
  error_signature TEXT) STRICT;                  -- stable error signature (no HEAD) for grouping/recurrence
CREATE INDEX IF NOT EXISTS ix_engine_actions_ctl    ON engine_actions(controller,started_at);
CREATE INDEX IF NOT EXISTS ix_engine_actions_entity ON engine_actions(ledger_id,workflow_id,job_id);
CREATE INDEX IF NOT EXISTS ix_engine_actions_sig    ON engine_actions(controller,error_signature);
-- action_steps (G13): a step inside a long action.
CREATE TABLE IF NOT EXISTS action_steps(
  action_id TEXT NOT NULL REFERENCES engine_actions(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL, step TEXT NOT NULL, started_at INTEGER NOT NULL, ms INTEGER,
  ok INTEGER CHECK(ok IS NULL OR ok IN (0,1)), detail TEXT,
  PRIMARY KEY(action_id,step_no)) STRICT;

-- controller_modes: current mode; mode_changes (G6): append-only history, who changed it and why.
CREATE TABLE IF NOT EXISTS controller_modes(
  controller TEXT PRIMARY KEY CHECK(controller IN ('job','workflow','resource','host','gc','workers','learning')),
  mode TEXT NOT NULL CHECK(mode IN ('off','shadow','active')), set_at INTEGER, set_by TEXT) STRICT;
CREATE TABLE IF NOT EXISTS mode_changes(
  change_id INTEGER PRIMARY KEY AUTOINCREMENT,
  controller TEXT NOT NULL, from_mode TEXT, to_mode TEXT NOT NULL CHECK(to_mode IN ('off','shadow','active')),
  by TEXT NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL) STRICT;
CREATE TRIGGER IF NOT EXISTS mode_changes_append_only BEFORE UPDATE ON mode_changes BEGIN
    SELECT RAISE(ABORT,'mode_changes are append-only');
  END;
CREATE TRIGGER IF NOT EXISTS controller_modes_recorded BEFORE UPDATE OF mode ON controller_modes
  WHEN NEW.mode<>OLD.mode AND NOT EXISTS(SELECT 1 FROM mode_changes c WHERE c.controller=NEW.controller AND c.to_mode=NEW.mode
         AND c.change_id=(SELECT max(change_id) FROM mode_changes WHERE controller=NEW.controller)) BEGIN
    SELECT RAISE(ABORT,'mode change must be recorded in mode_changes first');
  END;

-- sla_episodes (G3): EVERY SLA clock episode one row, APPEND-ONLY. No DELETE, no overwrite: violated_at,
-- reported_at, cleared_at (+ clear_reason) are each filled exactly once. Open clocks = v_sla_open.
CREATE TABLE IF NOT EXISTS sla_episodes(
  episode_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  entity       TEXT NOT NULL, state TEXT NOT NULL, code TEXT NOT NULL,   -- READY_UNDISPATCHED, WORKER_SILENT, SEAT_DEAF, TRANSCRIPT_MISSING ...
  severity     TEXT NOT NULL CHECK(severity IN ('warn','critical')),
  ledger_id TEXT, workflow_id TEXT,
  entered_at   INTEGER NOT NULL, sla_ms INTEGER NOT NULL,
  violated_at  INTEGER, reported_at INTEGER, di_id TEXT,
  cleared_at   INTEGER,
  clear_reason TEXT CHECK(clear_reason IS NULL OR clear_reason IN ('resolved','superseded','entity-gone','workflow-stopped')),
  CHECK(cleared_at IS NULL OR clear_reason IS NOT NULL)) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sla_open ON sla_episodes(entity,state) WHERE cleared_at IS NULL;   -- one open episode per (entity,state)
CREATE INDEX IF NOT EXISTS ix_sla_code ON sla_episodes(code,entered_at);
CREATE TRIGGER IF NOT EXISTS sla_episodes_fill_once BEFORE UPDATE ON sla_episodes
  WHEN NEW.entity<>OLD.entity OR NEW.state<>OLD.state OR NEW.code<>OLD.code OR NEW.entered_at<>OLD.entered_at
    OR (OLD.violated_at IS NOT NULL AND NEW.violated_at IS NOT OLD.violated_at)
    OR (OLD.reported_at IS NOT NULL AND NEW.reported_at IS NOT OLD.reported_at)
    OR (OLD.cleared_at  IS NOT NULL AND NEW.cleared_at  IS NOT OLD.cleared_at) BEGIN
    SELECT RAISE(ABORT,'sla_episodes are append-only: fields fill once');
  END;
CREATE TRIGGER IF NOT EXISTS sla_episodes_no_delete BEFORE DELETE ON sla_episodes BEGIN
    SELECT RAISE(ABORT,'sla_episodes are append-only');
  END;

CREATE TABLE IF NOT EXISTS invariant_violations(
  violation_id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('warn','critical')),
  entity TEXT NOT NULL, ledger_id TEXT, workflow_id TEXT, episode_id INTEGER REFERENCES sla_episodes(episode_id),
  violated_at INTEGER NOT NULL, cleared_at INTEGER, di_id TEXT, lesson_id TEXT,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json))) STRICT;
CREATE INDEX IF NOT EXISTS ix_inv_open ON invariant_violations(cleared_at,code);

-- ---------------------------------------------------------------------------------------------------------
-- B3. Machine: services, seats, terminals, deliveries, turns, locks, claims, agent sessions
-- Ownership rule (no cross-DB transaction): machine resources (terminals, worktrees, locks) are owned by machine;
-- op_attempts only POINTS to them (terminal_handle, worktree_path). Resource ctrl/GC reconcile drift both ways.
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services(
  name TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('host-app','http','tunnel','connector','scheduled-task','ledger')),
  state TEXT NOT NULL CHECK(state IN ('healthy','ok','degraded','down','quarantined','restarting','booting','stale')),
  since INTEGER, pid INTEGER, port INTEGER, url TEXT,
  last_probe_json TEXT CHECK(last_probe_json IS NULL OR json_valid(last_probe_json)),
  quarantined_until INTEGER) STRICT;
CREATE TABLE IF NOT EXISTS service_probes(
  probe_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL REFERENCES services(name) ON DELETE CASCADE,
  at INTEGER NOT NULL, ok INTEGER NOT NULL CHECK(ok IN (0,1)), latency_ms INTEGER,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json))) STRICT;   -- kept 14 days
CREATE INDEX IF NOT EXISTS ix_probes ON service_probes(name,at);
-- service_events (G5): every state change and every restart, append-only (replaces the windowed services.restarts_json).
CREATE TABLE IF NOT EXISTS service_events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL REFERENCES services(name) ON DELETE CASCADE,
  at INTEGER NOT NULL, from_state TEXT, to_state TEXT NOT NULL,
  probe_ms INTEGER, probe_error TEXT,
  action TEXT CHECK(action IS NULL OR action IN ('restart','quarantine','release','none')), action_id TEXT) STRICT;
CREATE INDEX IF NOT EXISTS ix_service_events ON service_events(name,at);
CREATE TRIGGER IF NOT EXISTS service_events_append_only BEFORE UPDATE ON service_events BEGIN
    SELECT RAISE(ABORT,'service_events are append-only');
  END;

-- seats: long-lived LLM seats - ONE place. 'parked' = deliberately no Kernel (workflow paused/stopped): the
-- controller does NOT "fix" a parked seat (MB-08). Consecutive input failures counted per seat (MB-05); replace
-- the seat after K failures in T minutes (SLA SEAT_DEAF).
CREATE TABLE IF NOT EXISTS seats(
  seat_id TEXT PRIMARY KEY,                      -- 'kernel:<ledger name>:<wf>' | 'supervisor'
  role TEXT NOT NULL CHECK(role IN ('kernel','supervisor')),
  ledger_id TEXT REFERENCES ledgers(ledger_id), workflow_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('empty','parked','booting','live','busy','stale','dead','replacing','quarantined')),
  parked_reason TEXT,
  terminal_handle TEXT, agent TEXT, model TEXT, routed_by TEXT, pid INTEGER,
  kernel_rev TEXT, acked_rev TEXT,
  booted_at INTEGER, last_seen_at INTEGER, replaced_count INTEGER NOT NULL DEFAULT 0,
  input_failures_consecutive INTEGER NOT NULL DEFAULT 0,   -- consecutive unwritable/exited/unavailable
  input_failures_total INTEGER NOT NULL DEFAULT 0,
  last_input_failure_at INTEGER, last_input_ok_at INTEGER,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json)),
  CHECK(state<>'parked' OR parked_reason IS NOT NULL)) STRICT;

-- deliveries (G11, MB-02): EVERY message delivery to a seat (DI, inbox, doorbell, wake, telegram) and its outcome.
CREATE TABLE IF NOT EXISTS deliveries(
  delivery_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  message_kind TEXT NOT NULL CHECK(message_kind IN ('decision','inbox','doorbell','wake','telegram','notice')),
  message_ref  TEXT NOT NULL,                    -- di_id | inbox_id | msg_id
  ledger_id TEXT, seat_id TEXT REFERENCES seats(seat_id), terminal_handle TEXT,
  channel      TEXT NOT NULL,
  attempted_at INTEGER NOT NULL,
  outcome      TEXT NOT NULL CHECK(outcome IN ('delivered','busy-deferred','unwritable','exited','unavailable','failed')),
  turn_id      INTEGER,                          -- seat_turns.turn_id the message opened
  detail TEXT) STRICT;
CREATE INDEX IF NOT EXISTS ix_deliveries_seat ON deliveries(seat_id,attempted_at);
CREATE INDEX IF NOT EXISTS ix_deliveries_msg  ON deliveries(message_kind,message_ref);
-- Per-seat input-failure counters live in the DB, maintained automatically on each delivery.
CREATE TRIGGER IF NOT EXISTS deliveries_count_seat_failures AFTER INSERT ON deliveries WHEN NEW.seat_id IS NOT NULL BEGIN
    UPDATE seats SET
      input_failures_consecutive = CASE WHEN NEW.outcome IN ('unwritable','exited','unavailable','failed')
                                        THEN input_failures_consecutive+1 ELSE 0 END,
      input_failures_total = input_failures_total + (NEW.outcome IN ('unwritable','exited','unavailable','failed')),
      last_input_failure_at = CASE WHEN NEW.outcome IN ('unwritable','exited','unavailable','failed') THEN NEW.attempted_at ELSE last_input_failure_at END,
      last_input_ok_at = CASE WHEN NEW.outcome='delivered' THEN NEW.attempted_at ELSE last_input_ok_at END
    WHERE seat_id=NEW.seat_id;
  END;
CREATE TRIGGER IF NOT EXISTS deliveries_append_only BEFORE UPDATE OF outcome, attempted_at, message_ref ON deliveries BEGIN
    SELECT RAISE(ABORT,'deliveries are append-only');
  END;

-- seat_turns (G12): each work turn of a seat: who woke it, how long it ran, why it ended.
CREATE TABLE IF NOT EXISTS seat_turns(
  turn_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id      TEXT NOT NULL REFERENCES seats(seat_id),
  woken_by_delivery INTEGER REFERENCES deliveries(delivery_id),
  started_at   INTEGER NOT NULL, ended_at INTEGER,
  end_reason   TEXT CHECK(end_reason IS NULL OR end_reason IN ('idle','budget','interrupted','replaced','crashed')),
  actions_count INTEGER NOT NULL DEFAULT 0,
  span_id      TEXT) STRICT;
CREATE INDEX IF NOT EXISTS ix_seat_turns ON seat_turns(seat_id,started_at);

-- seat_transcript_snapshots: periodic redacted scrollback snapshots of Kernel/Supervisor seats.
CREATE TABLE IF NOT EXISTS seat_transcript_snapshots(
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id     TEXT NOT NULL REFERENCES seats(seat_id),
  terminal_handle TEXT,
  at INTEGER NOT NULL, lines INTEGER NOT NULL, bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL REFERENCES blobs(sha256),
  UNIQUE(seat_id,sha256)) STRICT;
CREATE INDEX IF NOT EXISTS ix_seat_snap ON seat_transcript_snapshots(seat_id,at);

-- Worker accounting is Orca's (orchestration worker-list): which worker terminal is active, reclaimable or released, its
-- liveness and its next action are read from Orca, never from a runtime table. This table keeps only what Orca does not
-- account for: the GC's first sighting of a plain shell (role shell/other) and its verified close.
CREATE TABLE IF NOT EXISTS terminals(
  handle TEXT PRIMARY KEY, title TEXT,
  role TEXT NOT NULL CHECK(role IN ('shell','other')),
  opened_at INTEGER, closed_at INTEGER, close_verified_at INTEGER, closed_by TEXT) STRICT;
CREATE INDEX IF NOT EXISTS ix_terminals_open    ON terminals(closed_at,role);

CREATE TABLE IF NOT EXISTS host_locks(
  name TEXT PRIMARY KEY, holder_pid INTEGER NOT NULL, holder TEXT, process_run_id INTEGER REFERENCES process_runs(run_id),
  started_at INTEGER NOT NULL, heartbeat_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  handed_over_from INTEGER,
  state TEXT NOT NULL DEFAULT 'held' CHECK(state IN ('starting','held','released'))) STRICT;

-- claims (G14, MB-04, MB-17): temporary resources (temp dirs, temp worktrees, lock files) are CLAIMED before
-- creation; GC removes them safely (safeRemove, never follows junctions) once the owner pid is dead.
CREATE TABLE IF NOT EXISTS claims(
  claim_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_path   TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK(kind IN ('temp-dir','worktree','lock-file','fixture','scratch')),
  owner_action_id TEXT, owner_pid INTEGER NOT NULL, owner_run_id INTEGER REFERENCES process_runs(run_id),
  has_junctions   INTEGER NOT NULL DEFAULT 0 CHECK(has_junctions IN (0,1)),
  created_at      INTEGER NOT NULL, released_at INTEGER, swept_at INTEGER, sweep_error TEXT) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_live ON claims(resource_path) WHERE released_at IS NULL AND swept_at IS NULL;

CREATE TABLE IF NOT EXISTS agent_sessions(
  session_id      TEXT PRIMARY KEY,
  agent           TEXT NOT NULL CHECK(agent IN ('devin','codex','claude')),
  terminal_handle TEXT, ledger_id TEXT, workflow_id TEXT, job_id TEXT, attempt_id INTEGER, sup_attempt_id INTEGER, seat_id TEXT,
  started_at INTEGER, ended_at INTEGER,
  transcript_sha  TEXT REFERENCES blobs(sha256), archive_ref TEXT, bytes INTEGER, archived_at INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_agent_sessions_attempt ON agent_sessions(ledger_id,attempt_id);

-- ---------------------------------------------------------------------------------------------------------
-- B4. Resources: RAM/CPU, pool, provider, quota, guard, host leases, budget
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS throttle_state(       -- replaces ram-throttle.json (one current row; carries the writer's rev - MB-15)
  id INTEGER PRIMARY KEY CHECK(id=1),
  mode TEXT NOT NULL CHECK(mode IN ('normal','heavy','critical')),
  effective_cap INTEGER, heavy_cap INTEGER, running INTEGER,
  free_ram_pct REAL, free_ram_mb INTEGER, cpu_pct REAL, cpu_hot INTEGER, since INTEGER, updated_at INTEGER NOT NULL,
  reason TEXT, writer TEXT NOT NULL, writer_rev TEXT NOT NULL,
  slot_targets_json TEXT CHECK(slot_targets_json IS NULL OR json_valid(slot_targets_json)),
  priorities_json TEXT CHECK(priorities_json IS NULL OR json_valid(priorities_json))) STRICT;
-- throttle_events (G7): EVERY mode change, APPEND-ONLY (no overwrite, no delete).
CREATE TABLE IF NOT EXISTS throttle_events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  from_mode TEXT, to_mode TEXT NOT NULL CHECK(to_mode IN ('normal','heavy','critical')), reason TEXT,
  free_ram_pct REAL, cpu_pct REAL, effective_cap INTEGER, running INTEGER, writer_rev TEXT,
  sample_json TEXT CHECK(sample_json IS NULL OR json_valid(sample_json))) STRICT;
CREATE TRIGGER IF NOT EXISTS throttle_events_no_update BEFORE UPDATE ON throttle_events BEGIN
    SELECT RAISE(ABORT,'throttle_events are append-only');
  END;
CREATE TRIGGER IF NOT EXISTS throttle_events_no_delete BEFORE DELETE ON throttle_events BEGIN
    SELECT RAISE(ABORT,'throttle_events are append-only');
  END;
-- A mode change in throttle_state requires a matching throttle_events row written first (no transition is lost).
CREATE TRIGGER IF NOT EXISTS throttle_state_recorded BEFORE UPDATE OF mode ON throttle_state
  WHEN NEW.mode<>OLD.mode AND NOT EXISTS(SELECT 1 FROM throttle_events e WHERE e.seq=(SELECT max(seq) FROM throttle_events)
         AND e.to_mode=NEW.mode AND e.from_mode IS OLD.mode) BEGIN
    SELECT RAISE(ABORT,'throttle mode change must be recorded in throttle_events first');
  END;
-- throttle_decisions (G7): which op was deferred by throttle, for how long.
CREATE TABLE IF NOT EXISTS throttle_decisions(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, ledger_id TEXT, workflow_id TEXT, job_id TEXT,
  reason TEXT NOT NULL, waited_ms INTEGER, released_at INTEGER) STRICT;

CREATE TABLE IF NOT EXISTS host_samples(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('host','op-footprint','worker-footprint')),
  ledger_id TEXT, workflow_id TEXT, attempt_id INTEGER, sup_attempt_id INTEGER, subject TEXT,
  ram_mb INTEGER, cpu_pct REAL, free_ram_mb INTEGER, free_ram_pct REAL, free_disk_gb REAL,
  mode TEXT, effective_cap INTEGER, running INTEGER,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json))) STRICT;           -- kept 14 days
CREATE INDEX IF NOT EXISTS ix_host_samples ON host_samples(kind,at);
CREATE TABLE IF NOT EXISTS provider_health(
  provider TEXT PRIMARY KEY CHECK(provider IN ('devin','codex','claude')),
  status TEXT NOT NULL CHECK(status IN ('healthy','striking','unavailable','recovered')),
  failure_kind TEXT, strikes INTEGER NOT NULL DEFAULT 0, strike_limit INTEGER,
  circuit_open_until INTEGER, recovered_at INTEGER, reason TEXT, updated_at INTEGER NOT NULL,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json))) STRICT;
CREATE TABLE IF NOT EXISTS provider_health_events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, at INTEGER NOT NULL, from_status TEXT, to_status TEXT,
  failure_kind TEXT, ledger_id TEXT, attempt_id INTEGER,
  detail_json TEXT CHECK(detail_json IS NULL OR json_valid(detail_json))) STRICT;
CREATE TABLE IF NOT EXISTS pool_backoff(
  pool TEXT PRIMARY KEY, until_at INTEGER, strikes INTEGER NOT NULL DEFAULT 0, reason TEXT, updated_at INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS quotas(
  provider TEXT NOT NULL, window TEXT NOT NULL, used REAL, limit_value REAL, reset_at INTEGER, source TEXT,
  observed_at INTEGER NOT NULL, PRIMARY KEY(provider,window)) STRICT;
CREATE TABLE IF NOT EXISTS guard_jobs(           -- replaces .claude/runtime/guards/jobs/<job>.json (STARCI_GUARD_FILE)
  job_id TEXT PRIMARY KEY, ledger_id TEXT, workflow_id TEXT, attempt_id INTEGER,
  allow_json TEXT NOT NULL CHECK(json_valid(allow_json)),
  hooks_json TEXT CHECK(hooks_json IS NULL OR json_valid(hooks_json)),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, released_at INTEGER) STRICT;
CREATE TABLE IF NOT EXISTS guard_refusals(       -- replaces .claude/runtime/guards/refusals.jsonl
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, ledger_id TEXT, workflow_id TEXT, job_id TEXT, attempt_id INTEGER,
  tool TEXT, command TEXT, code TEXT, reason TEXT, remedy TEXT, cwd TEXT) STRICT;
CREATE TABLE IF NOT EXISTS host_resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0)) STRICT;
CREATE TABLE IF NOT EXISTS host_leases(
  resource_key TEXT NOT NULL, token TEXT NOT NULL, ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
  workflow_id TEXT NOT NULL, job_id TEXT NOT NULL, attempt_id INTEGER, holder TEXT, units INTEGER NOT NULL CHECK(units>0),
  acquired_at INTEGER NOT NULL, expires_at INTEGER NOT NULL CHECK(expires_at>acquired_at), PRIMARY KEY(resource_key,token)) STRICT;
CREATE INDEX IF NOT EXISTS ix_host_leases_expiry ON host_leases(expires_at);
CREATE TABLE IF NOT EXISTS budgets(
  scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL, used_value INTEGER NOT NULL DEFAULT 0,
  reserved_value INTEGER NOT NULL DEFAULT 0, window TEXT, updated_at INTEGER) STRICT;
CREATE TABLE IF NOT EXISTS budget_reservations(
  scope_key TEXT NOT NULL REFERENCES budgets(scope_key), ledger_id TEXT NOT NULL, job_id TEXT NOT NULL,
  units INTEGER NOT NULL, at INTEGER, PRIMARY KEY(scope_key,ledger_id,job_id)) STRICT;

-- ---------------------------------------------------------------------------------------------------------
-- B5. GC, land gate, push, lane, worktree, environment
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gc_runs(
  run_id INTEGER PRIMARY KEY AUTOINCREMENT, action_id TEXT, started_at INTEGER NOT NULL, finished_at INTEGER,
  trigger TEXT CHECK(trigger IS NULL OR trigger IN ('event','sweep','housekeeping','low-disk','low-ram','blob-sweep','manual')),
  freed_bytes INTEGER,
  collectors_json TEXT CHECK(collectors_json IS NULL OR json_valid(collectors_json)),
  counts_json TEXT CHECK(counts_json IS NULL OR json_valid(counts_json)),
  errors_json TEXT CHECK(errors_json IS NULL OR json_valid(errors_json)),
  report_sha TEXT REFERENCES blobs(sha256)) STRICT;        -- full report (G4: not truncated)
-- gc_items (G4, MB-14): EVERY thing GC touched, one row: collect/refuse/keep, how many bytes, retries, FINAL outcome.
CREATE TABLE IF NOT EXISTS gc_items(
  item_id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER REFERENCES gc_runs(run_id) ON DELETE CASCADE,
  collector TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, owner_ref TEXT, age_ms INTEGER,
  action TEXT NOT NULL CHECK(action IN ('collect','refuse','keep','closed','killed','removed','archived','failed')),
  reason TEXT, bytes INTEGER,
  tries INTEGER NOT NULL DEFAULT 1, next_try_at INTEGER,   -- retry scheduled at grace - age + margin, not exactly at grace
  last_error TEXT,
  outcome TEXT CHECK(outcome IS NULL OR outcome IN ('done','dropped','gave-up')),   -- final outcome, always written
  verified_gone_at INTEGER,
  at INTEGER NOT NULL) STRICT;
CREATE INDEX IF NOT EXISTS ix_gc_items_kind ON gc_items(collector,kind,at);
CREATE INDEX IF NOT EXISTS ix_gc_items_open ON gc_items(outcome,next_try_at);
CREATE TABLE IF NOT EXISTS gc_marks(
  run_id  INTEGER NOT NULL REFERENCES gc_runs(run_id) ON DELETE CASCADE,
  sha256  TEXT NOT NULL,
  source  TEXT NOT NULL,                         -- ledger name | 'machine'
  pinned  INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
  PRIMARY KEY(run_id,sha256,source)) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS lanes(
  name TEXT PRIMARY KEY, worktree_path TEXT NOT NULL, branch TEXT NOT NULL, base_sha TEXT, head_sha TEXT,
  owner TEXT NOT NULL,                           -- 'supervisor' | 'owner-chat' | 'worker:<job>'
  sup_job_id TEXT REFERENCES sup_jobs(job_id),
  state TEXT NOT NULL CHECK(state IN ('open','landing','landed','abandoned','removed')),
  created_at INTEGER NOT NULL, landed_at INTEGER, removed_at INTEGER,
  report_sha TEXT REFERENCES blobs(sha256)) STRICT;
-- land_queue (G9, MB-10): when a lane entered the gate and who holds the gate when busy.
CREATE TABLE IF NOT EXISTS land_queue(
  ticket_id TEXT PRIMARY KEY, lane TEXT REFERENCES lanes(name), commit_sha TEXT NOT NULL, commits INTEGER, requested_by TEXT,
  state TEXT NOT NULL CHECK(state IN ('queued','running','passed','failed','cancelled')),
  enqueued_at INTEGER NOT NULL, gate_at INTEGER, busy_holder TEXT, started_at INTEGER, finished_at INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_land_queue_state ON land_queue(state,enqueued_at);
CREATE TABLE IF NOT EXISTS land_runs(
  run_id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT REFERENCES land_queue(ticket_id), lane TEXT,
  span_id TEXT NOT NULL CHECK(length(span_id)=16), parent_span_id TEXT,
  commit_sha TEXT NOT NULL, landed_sha TEXT,
  commits_json TEXT CHECK(commits_json IS NULL OR (json_valid(commits_json) AND json_type(commits_json)='array')),   -- every picked commit, in order (a3-2)
  result TEXT NOT NULL CHECK(result IN ('passed','failed','conflict','refused')), reason TEXT,
  push_id INTEGER,                               -- MB-12: a 'passed' land links to the real push result
  specs_json TEXT CHECK(specs_json IS NULL OR json_valid(specs_json)),
  stdout_sha TEXT REFERENCES blobs(sha256), stderr_sha TEXT REFERENCES blobs(sha256),
  started_at INTEGER NOT NULL, finished_at INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_land_runs_lane ON land_runs(lane,started_at);
-- pushes (G8, MB-03): one row per push, with a stable error signature and the FULL log in a blob.
CREATE TABLE IF NOT EXISTS pushes(
  push_id INTEGER PRIMARY KEY AUTOINCREMENT, repo_root TEXT NOT NULL, branch TEXT, head TEXT NOT NULL, from_sha TEXT, to_sha TEXT,
  result TEXT NOT NULL CHECK(result IN ('pushed','refused','skipped','failed')), reason TEXT,
  failure_signature TEXT,                        -- secret-scan:<rule> | lint:<rule> | jest:<suite> ... (no HEAD)
  ms INTEGER, action_id TEXT,
  scan_json TEXT CHECK(scan_json IS NULL OR json_valid(scan_json)),
  stdout_sha TEXT REFERENCES blobs(sha256), stderr_sha TEXT REFERENCES blobs(sha256),
  at INTEGER NOT NULL,
  CHECK(result IN ('pushed','skipped') OR failure_signature IS NOT NULL)) STRICT;
CREATE INDEX IF NOT EXISTS ix_pushes ON pushes(repo_root,at);

CREATE TABLE IF NOT EXISTS worktrees(
  path TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('workflow','critic','land-scratch','push-scratch','supervisor-staging','lane')),
  repo_root TEXT NOT NULL, branch TEXT, base_sha TEXT, head_sha TEXT, port INTEGER,
  ledger_id TEXT, workflow_id TEXT, job_id TEXT, attempt_id INTEGER, lane TEXT, claim_id INTEGER REFERENCES claims(claim_id),
  created_at INTEGER NOT NULL, removed_at INTEGER, archived_ref TEXT, remove_error TEXT,
  -- One worktree per Kernel workflow: Orca creates and owns it, so the registry keys it by Orca's worktree id, records the
  -- workflow's last checkpoint and the moment its finish asked for its release (the host-side GC removes it once the
  -- Kernel's and the ops' terminals are released; never from inside itself).
  orca_id TEXT, checkpoint_sha TEXT, release_pending_at INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_worktrees_live    ON worktrees(removed_at,kind);
CREATE INDEX IF NOT EXISTS ix_worktrees_attempt ON worktrees(ledger_id,attempt_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_worktrees_orca_id ON worktrees(orca_id) WHERE orca_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_worktrees_workflow ON worktrees(workflow_id,kind,removed_at);

CREATE TABLE IF NOT EXISTS env_servers(
  server_id TEXT PRIMARY KEY, env TEXT, service TEXT, repo_root TEXT,
  ledger_id TEXT, workflow_id TEXT, job_id TEXT, attempt_id INTEGER,
  command TEXT, cwd TEXT, port INTEGER, pid INTEGER, url TEXT,
  state TEXT NOT NULL CHECK(state IN ('starting','ready','failed','stopped')),
  started_at INTEGER, stopped_at INTEGER, log_sha TEXT REFERENCES blobs(sha256)) STRICT;
CREATE TABLE IF NOT EXISTS uat_slots(
  slot_id TEXT PRIMARY KEY, ledger_id TEXT, workflow_id TEXT, job_id TEXT, attempt_id INTEGER,
  browser_profile TEXT, port INTEGER, acquired_at INTEGER, expires_at INTEGER, released_at INTEGER) STRICT;
CREATE TABLE IF NOT EXISTS connectors(           -- holds NO secrets; secrets live in .starcistacks + sops
  name TEXT PRIMARY KEY, kind TEXT, state TEXT, pid INTEGER, port INTEGER, public_url TEXT,
  config_json TEXT CHECK(config_json IS NULL OR json_valid(config_json)),
  cursor_json TEXT CHECK(cursor_json IS NULL OR json_valid(cursor_json)),     -- e.g. telegram offset, route chats
  updated_at INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS ask_requests(
  ask_id TEXT PRIMARY KEY, ledger_id TEXT, workflow_id TEXT, di_id TEXT, channel TEXT, question TEXT NOT NULL,
  form_url TEXT,
  state TEXT NOT NULL CHECK(state IN ('open','answered','retired','expired')),
  asked_at INTEGER NOT NULL, answered_at INTEGER, answer_ref TEXT) STRICT;

-- ---------------------------------------------------------------------------------------------------------
-- B6. Machine-level observability
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machine_logs(
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  actor TEXT NOT NULL CHECK(actor IN ('reconciler','supervisor','worker','gc','host','land','watchdog','connector','harness','runtime')),
  controller TEXT, ledger_id TEXT, workflow_id TEXT, job_id TEXT, attempt_id INTEGER, action_id TEXT,
  trace_id TEXT, span_id TEXT,
  level TEXT NOT NULL CHECK(level IN ('debug','info','warn','error')),
  kind TEXT NOT NULL, msg TEXT NOT NULL,
  data_json TEXT CHECK(data_json IS NULL OR json_valid(data_json)),
  refs_json TEXT CHECK(refs_json IS NULL OR json_valid(refs_json)),
  src TEXT UNIQUE) STRICT;                       -- append-only; GC deletes by retention (debug 14 days, the rest 90 days)
CREATE INDEX IF NOT EXISTS ix_mlogs_at   ON machine_logs(at);
CREATE INDEX IF NOT EXISTS ix_mlogs_kind ON machine_logs(actor,kind,seq);
CREATE INDEX IF NOT EXISTS ix_mlogs_ent  ON machine_logs(ledger_id,workflow_id,job_id,seq);
CREATE TRIGGER IF NOT EXISTS machine_logs_append_only BEFORE UPDATE ON machine_logs BEGIN
    SELECT RAISE(ABORT,'machine_logs are append-only');
  END;
CREATE VIRTUAL TABLE IF NOT EXISTS machine_logs_fts USING fts5(msg, kind, controller, content='machine_logs', content_rowid='seq',
  tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER IF NOT EXISTS machine_logs_fts_insert AFTER INSERT ON machine_logs BEGIN
    INSERT INTO machine_logs_fts(rowid,msg,kind,controller) VALUES (NEW.seq,NEW.msg,NEW.kind,NEW.controller);
  END;
CREATE TRIGGER IF NOT EXISTS machine_logs_fts_delete AFTER DELETE ON machine_logs BEGIN
    INSERT INTO machine_logs_fts(machine_logs_fts,rowid,msg,kind,controller) VALUES ('delete',OLD.seq,OLD.msg,OLD.kind,OLD.controller);
  END;

-- metrics_snapshots: controllers write these (progress, rca, frontier, coverage, verify ...) so the harness does NOT have to run a verb.
CREATE TABLE IF NOT EXISTS metrics_snapshots(
  snap_id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('op-health','progress','rca','frontier','coverage','verify','model-scorecard','throughput','ram')),
  ledger_id TEXT, workflow_id TEXT, window_ms INTEGER, subject TEXT,
  data_json TEXT CHECK(data_json IS NULL OR json_valid(data_json)),
  data_sha TEXT REFERENCES blobs(sha256)) STRICT;
CREATE INDEX IF NOT EXISTS ix_metrics ON metrics_snapshots(kind,ledger_id,workflow_id,at);

CREATE TABLE IF NOT EXISTS notifications(
  notif_id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('digest','urgent','ask','ack','media')),
  text TEXT NOT NULL, media_sha TEXT REFERENCES blobs(sha256), sent_at INTEGER, delivery TEXT, ref TEXT,
  dedupe_key TEXT UNIQUE) STRICT;                -- replaces telegram-sent.json / telegram-media-sent.json

-- ---------------------------------------------------------------------------------------------------------
-- B7. Durable views of machine.sqlite
-- ---------------------------------------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_services AS
SELECT s.*, COALESCE(m.ui,'unknown') AS ui,
       (SELECT count(*) FROM service_events e WHERE e.name=s.name AND e.action='restart'
          AND e.at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 86400000) AS restarts_24h,
       (SELECT count(*) FROM service_probes p WHERE p.name=s.name AND p.ok=0
          AND p.at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 86400000) AS failed_probes_24h
FROM services s LEFT JOIN ui_state_map m ON m.entity='service' AND m.native=s.state;

CREATE VIEW IF NOT EXISTS v_seats AS
SELECT s.*, COALESCE(m.ui,'unknown') AS ui,
       (SELECT max(at) FROM seat_transcript_snapshots x WHERE x.seat_id=s.seat_id) AS last_snapshot_at
FROM seats s LEFT JOIN ui_state_map m ON m.entity='seat' AND m.native=s.state;

CREATE VIEW IF NOT EXISTS v_engine_actions AS
SELECT a.*, COALESCE(m.ui,'unknown') AS ui FROM engine_actions a
LEFT JOIN ui_state_map m ON m.entity='engine-action' AND m.native=a.state;

-- Open SLA clocks (replaces the old sla_clocks table).
CREATE VIEW IF NOT EXISTS v_sla_open AS
SELECT e.*, e.entered_at + e.sla_ms AS due_at,
       CASE WHEN e.violated_at IS NULL THEN 'waiting' WHEN e.severity='critical' THEN 'bad' ELSE 'warn' END AS ui
FROM sla_episodes e WHERE e.cleared_at IS NULL;

-- Periodic duties overdue or running too often (MB-01).
CREATE VIEW IF NOT EXISTS v_schedules AS
SELECT s.*, (CAST(unixepoch('subsec')*1000 AS INTEGER) - s.next_due_at) AS overdue_ms,
       (SELECT count(*) FROM engine_actions a WHERE a.controller=s.controller AND a.duty=s.duty
          AND a.started_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 86400000) AS runs_24h,
       CASE WHEN (SELECT count(*) FROM engine_actions a WHERE a.controller=s.controller AND a.duty=s.duty
                   AND a.started_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 86400000) > 2 * (86400000 / s.interval_ms) + 1 THEN 'bad'
            WHEN s.next_due_at < CAST(unixepoch('subsec')*1000 AS INTEGER) - s.interval_ms THEN 'warn' ELSE 'ok' END AS ui
FROM schedules s;

CREATE VIEW IF NOT EXISTS v_open_sup_decisions AS
SELECT di_id, kind, summary, status, opened_at, due_at, escalations, delivered_at,
       (CAST(unixepoch('subsec')*1000 AS INTEGER) - opened_at) AS age_ms,
       CASE WHEN due_at IS NOT NULL AND due_at < CAST(unixepoch('subsec')*1000 AS INTEGER) THEN 'bad'
            WHEN delivered_at IS NULL THEN 'warn'
            WHEN status='claimed' THEN 'running' ELSE 'waiting' END AS ui
FROM sup_decision_items WHERE status IN ('open','claimed','escalated');

-- Deaf seats (MB-05): consecutive input failures >= 3 -> SLA SEAT_DEAF -> replace the seat.
CREATE VIEW IF NOT EXISTS v_deaf_seats AS
SELECT seat_id, role, workflow_id, state, input_failures_consecutive, last_input_failure_at, last_input_ok_at
FROM seats WHERE state NOT IN ('parked','empty') AND input_failures_consecutive >= 3;

CREATE VIEW IF NOT EXISTS v_leaks AS
SELECT 'worktree' AS kind, path AS target, ledger_id, job_id AS owner, created_at AS since FROM worktrees
 WHERE removed_at IS NULL AND kind IN ('push-scratch','land-scratch')
UNION ALL SELECT 'lease', resource_key, ledger_id, job_id, acquired_at FROM host_leases
 WHERE expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL SELECT 'lease', path, NULL, job_id, acquired_at FROM sup_leases WHERE expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL SELECT 'guard', job_id, ledger_id, job_id, created_at FROM guard_jobs
 WHERE released_at IS NULL AND expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL SELECT 'claim', resource_path, NULL, owner_action_id, created_at FROM claims
 WHERE released_at IS NULL AND swept_at IS NULL AND created_at < CAST(unixepoch('subsec')*1000 AS INTEGER) - 3600000
UNION ALL SELECT 'lock', name, NULL, holder, started_at FROM host_locks
 WHERE state<>'released' AND expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER);

CREATE VIEW IF NOT EXISTS v_engine_health AS
SELECT l.holder, l.pid, l.epoch, l.rev, l.heartbeat_at, l.draining, l.passes, l.last_pass_ms, l.last_error,
       (CAST(unixepoch('subsec')*1000 AS INTEGER) - l.heartbeat_at) AS heartbeat_age_ms,
       (SELECT count(*) FROM process_runs r WHERE r.role='engine' AND r.started_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 3600000) AS starts_last_hour,
       (SELECT count(*) FROM process_runs r WHERE r.role='engine' AND r.exit_reason IN ('crash','killed','lost-lease')
          AND r.ended_at > CAST(unixepoch('subsec')*1000 AS INTEGER) - 86400000) AS bad_exits_24h,
       (SELECT count(*) FROM engine_queue) AS queue_depth,
       (SELECT count(*) FROM sla_episodes WHERE violated_at IS NOT NULL AND cleared_at IS NULL) AS open_violations,
       CASE WHEN l.expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER) THEN 'bad'
            WHEN l.last_error IS NOT NULL OR l.draining=1 THEN 'warn' ELSE 'ok' END AS ui
FROM engine_leader l;

CREATE VIEW IF NOT EXISTS v_search_ids AS
SELECT 'sup-decision' AS kind, di_id AS id, summary AS title FROM sup_decision_items
UNION ALL SELECT 'sup-job', job_id, title FROM sup_jobs
UNION ALL SELECT 'trace', trace_id, title FROM sup_jobs
UNION ALL SELECT 'lane', name, branch FROM lanes
UNION ALL SELECT 'land-ticket', ticket_id, commit_sha FROM land_queue
UNION ALL SELECT 'commit', landed_sha, lane FROM land_runs WHERE landed_sha IS NOT NULL
UNION ALL SELECT 'action', id, controller||' '||COALESCE(verb,'') FROM engine_actions
UNION ALL SELECT 'terminal', handle, title FROM terminals
UNION ALL SELECT 'seat', seat_id, state FROM seats
UNION ALL SELECT 'service', name, state FROM services
UNION ALL SELECT 'worktree', path, branch FROM worktrees
UNION ALL SELECT 'ledger', name, repo_root FROM ledgers
UNION ALL SELECT 'blob', sha256, media_type FROM blobs;

CREATE VIEW IF NOT EXISTS v_live_marks AS
SELECT 'machine_logs' AS topic, COALESCE(max(seq),0) AS mark FROM machine_logs
UNION ALL SELECT 'engine_actions', COALESCE(max(COALESCE(finished_at,started_at)),0) FROM engine_actions
UNION ALL SELECT 'violations', COALESCE(max(max(violation_id), max(COALESCE(cleared_at,0))),0) FROM invariant_violations
UNION ALL SELECT 'services', COALESCE(max(seq),0) FROM service_events
UNION ALL SELECT 'deliveries', COALESCE(max(delivery_id),0) FROM deliveries
UNION ALL SELECT 'sup_decisions', COALESCE(max(max(opened_at), max(COALESCE(resolved_at,0))),0) FROM sup_decision_items;

-- ---------------------------------------------------------------------------------------------------------
-- B8. Cross-DB queries - NO durable view (SQLite forbids a main view referencing an ATTACHed DB).
--   * Cross-ledger lists (progress, op_history, media, open_work, blocking, settle_overdue, scorecard): engine/db/machine.mjs
--     forEachLedger(fn) opens each runtime.sqlite read-only, runs the same-named view, adds the ledger column, merges in JS.
--     attachLedgers(batch <= 9) is for ad-hoc queries only.
--   * Blob GC: mark PER ledger into gc_marks (per each DB's blob_ref_columns) then sweep - no ATTACH-UNION.
-- ---------------------------------------------------------------------------------------------------------

-- Provider/account capacity and durable launch/release evidence share this current host schema.
-- Additive host provider/account admission receipts. Slot units are concurrent launches,
-- never provider tokens, credits or measured spend. Released receipts retain attempt identity.
CREATE TABLE provider_reservations(
  fence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  attempt_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  account TEXT NOT NULL,
  model TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('kernel','op','supervisor','worker','critic')),
  scope_json TEXT,
  state TEXT NOT NULL CHECK(state IN ('reserved','launching','live','unknown','released')),
  slots INTEGER NOT NULL DEFAULT 1 CHECK(slots=1),
  max_parallel INTEGER NOT NULL CHECK(max_parallel>=0),
  quota_json TEXT,
  estimate_json TEXT,
  override_json TEXT,
  launch_identity TEXT,
  host_request_id TEXT,
  handle TEXT,
  pid INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  released_at INTEGER,
  proof_json TEXT
) STRICT;
CREATE INDEX provider_reservations_active ON provider_reservations(provider,account,state);
CREATE TABLE provider_reservation_events(
  id INTEGER PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES provider_reservations(id),
  at INTEGER NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  proof_json TEXT
) STRICT;
