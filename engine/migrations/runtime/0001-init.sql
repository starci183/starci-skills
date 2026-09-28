-- ############################################################################################################
-- PHẦN A — runtime.sqlite (mỗi dự án) → engine/migrations/runtime/0001-init.sql
-- ############################################################################################################

-- ---------------------------------------------------------------------------------------------------------
-- A0. Danh tính, phiên bản, từ vựng
-- ---------------------------------------------------------------------------------------------------------
-- meta: ledger_id (UUID, khoá của machine.ledgers), schema='starci/runtime@1', created_at, journal_mode, product,
-- repo_root, blob_root, runtime_rev, sqlite_version.
CREATE TABLE IF NOT EXISTS meta(
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL) STRICT;

-- schema_migrations: 0001-init ghi dòng đầu; mỗi bước sau: backup VACUUM INTO + integrity_check trước,
-- foreign_key_check + quick_check trước COMMIT. Code từ chối GHI khi user_version > CODE_VERSION.
CREATE TABLE IF NOT EXISTS schema_migrations(
  version       INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,                -- '0001-init'
  runtime_rev   TEXT,
  sql_sha256    TEXT    NOT NULL,                -- digest file migration đã chạy
  backup_path   TEXT, backup_sha256 TEXT,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  status        TEXT NOT NULL CHECK(status IN ('running','done','failed'))) STRICT;

-- ui_states: bộ trạng thái hiển thị DUY NHẤT (UI-API §3.4).
CREATE TABLE IF NOT EXISTS ui_states(
  ui    TEXT PRIMARY KEY CHECK(ui IN ('bad','warn','running','waiting','ok','done','unknown')),
  rank  INTEGER NOT NULL,                        -- thứ tự xếp: bad trước
  label_vi TEXT NOT NULL) STRICT;
INSERT OR IGNORE INTO ui_states VALUES
  ('bad',0,'Hỏng / Kẹt'),('warn',1,'Chậm / Cảnh báo'),('running',2,'Đang chạy'),('waiting',3,'Chờ'),
  ('ok',4,'Ổn'),('done',5,'Xong'),('unknown',6,'Chưa rõ');

-- ui_state_map: ánh xạ tĩnh trạng thái gốc → ui. Quy tắc theo thời gian (quá hạn, SLA) nằm trong view/hàm và chỉ
-- được NÂNG mức (waiting→warn→bad), không hạ.
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
  ('job','answering','waiting'),('job','reported','running'),('job','deciding','waiting'),
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

-- blob_ref_columns: danh sách DUY NHẤT các cột tham chiếu blob (GC mark đọc bảng này; spec so với sqlite_master mọi
-- cột *_sha / sha256 để không bỏ sót cột mới).
CREATE TABLE IF NOT EXISTS blob_ref_columns(
  table_name TEXT NOT NULL, column_name TEXT NOT NULL, PRIMARY KEY(table_name,column_name)) STRICT;
INSERT OR IGNORE INTO blob_ref_columns VALUES
  ('goal_inputs','sha256'),('op_attempts','prompt_sha'),('op_attempts','transcript_sha'),('op_attempts','session_sha'),
  ('attempt_transcript_snapshots','sha256'),
  ('check_runs','stdout_sha'),('check_runs','stderr_sha'),('check_runs','output_sha'),('job_artifacts','sha256'),
  ('work_citations','sha256'),('product_lands','output_sha'),('events','payload_sha');

-- Bảng chuyển trạng thái hợp lệ (dữ liệu, không phải code). Trigger ở A2/A3/A4 từ chối mọi cặp không có ở đây.
CREATE TABLE IF NOT EXISTS workflow_transitions(
  from_phase TEXT NOT NULL, to_phase TEXT NOT NULL, PRIMARY KEY(from_phase,to_phase)) STRICT;
INSERT OR IGNORE INTO workflow_transitions VALUES
  ('awaiting-approval','queued'),('awaiting-approval','stopped'),
  ('queued','running'),('queued','stopped'),
  ('running','paused'),('running','stopped'),('running','finished'),
  ('paused','running'),('paused','stopped'),
  ('stopped','queued'),                          -- chỉ verb owner `api lifecycle --resume`; controller KHÔNG BAO GIỜ làm (MB-08)
  ('stopped','archived'),('finished','archived');
CREATE TABLE IF NOT EXISTS job_transitions(
  from_status TEXT NOT NULL, to_status TEXT NOT NULL, PRIMARY KEY(from_status,to_status)) STRICT;
INSERT OR IGNORE INTO job_transitions VALUES
  ('queued','ready'),('queued','cancelled'),
  ('ready','queued'),('ready','leased'),('ready','cancelled'),
  ('leased','running'),('leased','ready'),('leased','cancelled'),        -- leased→ready: dispatch bị từ chối trước khi op nhận hợp đồng (H13: không tiêu lần thử)
  ('running','answering'),('answering','running'),
  ('running','reported'),('answering','reported'),
  ('running','effect_unknown'),('running','ready'),('running','failed'),('running','cancelled'),   -- running→ready: requeue sau worker chết
  ('effect_unknown','running'),('effect_unknown','ready'),('effect_unknown','failed'),
  ('reported','deciding'),('reported','succeeded'),('reported','failed'),   -- reported KHÔNG → cancelled (H9: archive không bỏ việc đã report)
  ('deciding','succeeded'),('deciding','failed'),('deciding','cancelled');

-- ---------------------------------------------------------------------------------------------------------
-- A1. Blob — chỉ mục kho nội dung (nội dung KHÔNG nằm trong SQLite)
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blobs(
  sha256      TEXT PRIMARY KEY CHECK(length(sha256)=64),
  bytes       INTEGER NOT NULL CHECK(bytes>=0),
  media_type  TEXT    NOT NULL,                  -- image/png, video/webm, application/json, text/plain, text/x-diff ...
  encoding    TEXT CHECK(encoding IS NULL OR encoding='gzip'),   -- sha256 luôn là của byte GỐC
  redaction   TEXT CHECK(redaction IS NULL OR redaction IN ('v1','binary')),   -- 'v1' = văn bản đã qua bộ lọc bí mật v1
                                                 -- (transcript, log); 'binary' = nhị phân không lọc được; NULL = không cần
  file_uri    TEXT    NOT NULL,                  -- đường tuyệt đối, ví dụ C:/Users/Hi/.starci/artifacts/ab/ab12...
  http_path   TEXT GENERATED ALWAYS AS ('/api/blob/' || sha256) VIRTUAL,  -- harness 4547 phục vụ; không thể lệch
  created_at  INTEGER NOT NULL,                  -- GC không đụng blob trẻ hơn 24 giờ (grace put-trước-insert)
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),  -- 1 khi một bản ghi Work trích: không bao giờ bị sweep
  archived_at INTEGER,                            -- đã nằm trong một zip D:/starci-archive đã kiểm chứng
  archive_ref TEXT) STRICT;                       -- '<zip path>!<entry>'

-- ---------------------------------------------------------------------------------------------------------
-- A2. Workflow và goal
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflows(
  workflow_id         TEXT PRIMARY KEY,          -- wf-<slug>-<base36 time>
  trace_id            TEXT NOT NULL UNIQUE CHECK(length(trace_id)=32),   -- W3C trace id, sinh lúc tạo, giữ qua mọi revision
  title               TEXT,
  display_name        TEXT,                      -- '<Sản phẩm> · <việc gì>' (tiếng Việt)
  phase               TEXT NOT NULL CHECK(phase IN ('awaiting-approval','queued','running','paused','stopped','finished','archived')),
  phase_reason        TEXT,                      -- lý do đổi phase gần nhất (chi tiết ở lifecycle_changes)
  ledger_mode         TEXT,
  source_roots_json   TEXT CHECK(source_roots_json IS NULL OR json_valid(source_roots_json)),
  generation          INTEGER NOT NULL DEFAULT 0,          -- spec: tăng khi goal/đồ thị đổi
  observed_generation INTEGER NOT NULL DEFAULT 0,          -- status: generation mà Kernel đã xử lý xong (K8s)
  goal_identity       TEXT,
  pin_digest          TEXT,
  allowed_parallel    INTEGER,
  finished_json       TEXT CHECK(finished_json IS NULL OR json_valid(finished_json)),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  finished_at         INTEGER,
  archived_at         INTEGER) STRICT;

-- lifecycle_changes: lịch sử đổi phase, append-only (MB-08, G10). Chủ ghi duy nhất: verb `api lifecycle`
-- (define-goal, start, pause, stop, resume, finish, archive) — cùng giao dịch với UPDATE workflows.phase.
CREATE TABLE IF NOT EXISTS lifecycle_changes(
  change_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  from_phase  TEXT, to_phase TEXT NOT NULL,
  by          TEXT NOT NULL,                     -- owner | kernel:<wf> | supervisor | comeback
  reason      TEXT NOT NULL,
  at          INTEGER NOT NULL) STRICT;
CREATE TRIGGER IF NOT EXISTS lifecycle_changes_append_only BEFORE UPDATE ON lifecycle_changes BEGIN
    SELECT RAISE(ABORT,'lifecycle_changes are append-only');
  END;
-- Phase chỉ đổi theo workflow_transitions VÀ phải có dòng lifecycle_changes khớp được ghi ngay trước trong cùng giao dịch.
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
  markdown       TEXT NOT NULL,                  -- goal text thầy duyệt (nguồn relaunch khi comeback)
  json           TEXT NOT NULL CHECK(json_valid(json)),   -- op chain đã derive
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

-- workflow_purges: bia mộ của đường xoá duy nhất (không FK: sống sót sau purge).
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
-- A3. Đồ thị: unit (bước) và cạnh
-- Từ vựng: unit = bước logic; job = một lần thử có input cụ thể (try_no); attempt = một lần dispatch (op_attempts).
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
  unit_id        TEXT NOT NULL,                  -- = job_id của job đầu tiên trong họ
  op_id          TEXT NOT NULL,
  subject_key    TEXT NOT NULL,                  -- danh tính công việc, chuẩn hoá: '<cut_id>#<ordinal>' hoặc digest(records + owned_paths)
  goal_revision  INTEGER NOT NULL,
  title          TEXT,
  cut_id         TEXT, cut_ordinal INTEGER, cut_total INTEGER,
  repository     TEXT,
  state          TEXT NOT NULL CHECK(state IN ('planned','queued','running','reported','deciding','done','failed','dropped')),
  current_job_id TEXT,
  tries          INTEGER NOT NULL DEFAULT 0,     -- số job trong họ
  dispatches     INTEGER NOT NULL DEFAULT 0,     -- số lần dispatch cộng dồn
  try_budget     INTEGER NOT NULL DEFAULT 5 CHECK(try_budget>=1),   -- H3: vượt thì INSERT jobs bị từ chối
  budget_raised_by  TEXT,                        -- ai nâng ngân sách (owner | supervisor) ...
  budget_raised_ref TEXT,                        -- ... và vì sao (di_id / incident_id); bắt buộc khi try_budget > mặc định
  reopen_reason  TEXT, reopened_by TEXT, reopened_at INTEGER,   -- H5: chỉ cách duy nhất để chạy lại unit đã done
  created_at     INTEGER NOT NULL, updated_at INTEGER NOT NULL, done_at INTEGER,
  PRIMARY KEY(workflow_id,unit_id),
  UNIQUE(workflow_id,op_id,subject_key,goal_revision),            -- H3/H5: không thể "tạo unit mới" cho cùng một việc
  CHECK(try_budget<=5 OR (budget_raised_by IS NOT NULL AND budget_raised_ref IS NOT NULL))) STRICT;
CREATE INDEX IF NOT EXISTS ix_units_state ON work_units(workflow_id,state);
CREATE INDEX IF NOT EXISTS ix_units_op    ON work_units(workflow_id,op_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_units_cut ON work_units(workflow_id,cut_id,cut_ordinal,goal_revision) WHERE cut_id IS NOT NULL;
-- Unit đã done chỉ rời 'done' qua reopen có lý do mới (reopened_at đổi) — không có đường tắt.
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
-- A4. Job (try), attempt (dispatch), hợp đồng, lease, idempotency
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs(
  job_id        TEXT PRIMARY KEY,                -- op-<op>-<token10> | kernel-<wf>
  workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  unit_id       TEXT,                            -- NULL cho job kernel
  op_id         TEXT,
  try_no        INTEGER NOT NULL CHECK(try_no>=1),     -- lần thử thứ mấy CỦA UNIT
  retry_of      TEXT REFERENCES jobs(job_id),          -- job trước trong họ (retry đổi hình dạng)
  resume_of     TEXT REFERENCES jobs(job_id),
  retry_class   TEXT CHECK(retry_class IS NULL OR retry_class IN ('business','infra','resume','follow-up')),
  generation    INTEGER NOT NULL,
  kind          TEXT NOT NULL CHECK(kind IN ('op','kernel')),
  role          TEXT,
  status        TEXT NOT NULL CHECK(status IN ('queued','ready','leased','running','answering','reported','deciding',
                                               'effect_unknown','succeeded','failed','cancelled')),
  priority_json TEXT CHECK(priority_json IS NULL OR json_valid(priority_json)),
  lease_token   TEXT,
  worker_id     TEXT,
  deadline      INTEGER,
  payload_json  TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),   -- CHỈ input: records, owned_paths, params, goal_binding, cut, after
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  FOREIGN KEY(workflow_id,unit_id) REFERENCES work_units(workflow_id,unit_id)) STRICT;
CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status,kind,created_at,job_id);
CREATE INDEX IF NOT EXISTS jobs_op    ON jobs(workflow_id,op_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_unit_try ON jobs(workflow_id,unit_id,try_no) WHERE unit_id IS NOT NULL;

-- Cổng enqueue (H3, H4, H5, H9): mọi job op phải có unit; unit chưa done; còn ngân sách; lineage hợp lệ; workflow nhận việc.
CREATE TRIGGER IF NOT EXISTS jobs_enqueue_guard BEFORE INSERT ON jobs WHEN NEW.kind='op' BEGIN
    SELECT RAISE(ABORT,'workflow-not-accepting-work')
      WHERE (SELECT phase FROM workflows WHERE workflow_id=NEW.workflow_id) NOT IN ('queued','running');
    SELECT RAISE(ABORT,'unit-required') WHERE NEW.unit_id IS NULL;
    SELECT RAISE(ABORT,'unit-already-passed')
      WHERE EXISTS(SELECT 1 FROM work_units u WHERE u.workflow_id=NEW.workflow_id AND u.unit_id=NEW.unit_id AND u.state='done');
    SELECT RAISE(ABORT,'unit-try-budget-exhausted')
      WHERE NEW.try_no > (SELECT try_budget FROM work_units u WHERE u.workflow_id=NEW.workflow_id AND u.unit_id=NEW.unit_id);
    -- H5: the try after a reopen follows a PASSED try, so it has no retry_of/resume_of; it is admitted only as the
    -- next try of a unit reopenUnit just moved out of 'done' (reopened_at set, state no longer done).
    SELECT RAISE(ABORT,'first-try-must-be-1-without-lineage')
      WHERE NEW.retry_of IS NULL AND NEW.resume_of IS NULL AND NEW.try_no<>1
        AND NOT EXISTS(SELECT 1 FROM work_units u WHERE u.workflow_id=NEW.workflow_id AND u.unit_id=NEW.unit_id
                         AND u.reopened_at IS NOT NULL AND u.state<>'done' AND NEW.try_no=u.tries+1);
    SELECT RAISE(ABORT,'retry-lineage-invalid: retry_of must be a FAILED job of the same unit with try_no-1')
      WHERE NEW.retry_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jobs p WHERE p.job_id=NEW.retry_of
              AND p.workflow_id=NEW.workflow_id AND p.unit_id=NEW.unit_id AND p.status='failed' AND p.try_no=NEW.try_no-1);
    SELECT RAISE(ABORT,'resume-lineage-invalid: resume_of must be a failed/cancelled job of the same unit')
      WHERE NEW.resume_of IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jobs p WHERE p.job_id=NEW.resume_of
              AND p.workflow_id=NEW.workflow_id AND p.unit_id=NEW.unit_id AND p.status IN ('failed','cancelled'));
  END;
-- Máy trạng thái job (H9): chỉ các cặp trong job_transitions; cancelled/succeeded/failed là kết.
CREATE TRIGGER IF NOT EXISTS jobs_status_guard BEFORE UPDATE OF status ON jobs
  WHEN NEW.status<>OLD.status AND NOT EXISTS(SELECT 1 FROM job_transitions t WHERE t.from_status=OLD.status AND t.to_status=NEW.status) BEGIN
    SELECT RAISE(ABORT,'job-transition-refused');
  END;
-- Job hết đời thì lease của nó biến mất trong cùng giao dịch (H12: không còn lease rò).
CREATE TRIGGER IF NOT EXISTS jobs_release_leases AFTER UPDATE OF status ON jobs
  WHEN NEW.status IN ('succeeded','failed','cancelled') BEGIN
    DELETE FROM leases WHERE job_id=NEW.job_id;
  END;

-- op_attempts: MỘT DÒNG CHO MỖI LẦN DISPATCH (requeue sau worker chết → dispatch_seq+1, cùng job).
CREATE TABLE IF NOT EXISTS op_attempts(
  attempt_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id       TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id            TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  unit_id           TEXT,
  op_id             TEXT NOT NULL,
  try_no            INTEGER NOT NULL,            -- = jobs.try_no
  dispatch_seq      INTEGER NOT NULL DEFAULT 1 CHECK(dispatch_seq>=1),
  dispatch_id       TEXT NOT NULL,               -- ctx_... ; STARCI_DISPATCH_ID
  -- tương quan
  span_id           TEXT NOT NULL CHECK(length(span_id)=16),
  parent_span_id    TEXT,                        -- span của decision / lượt Kernel đã dispatch
  -- ai chạy
  agent             TEXT CHECK(agent IS NULL OR agent IN ('devin','codex','claude','qwen')),
  provider          TEXT,
  model             TEXT,                        -- model id đã chứng thực trên màn hình (gen_ai.response.model)
  request_model     TEXT,                        -- model đã yêu cầu (gen_ai.request.model)
  model_profile     TEXT, pool TEXT, effort TEXT, difficulty TEXT,
  routed_by         TEXT CHECK(routed_by IS NULL OR routed_by IN ('route','config','flag','kernel-override')),
  route_chain_json  TEXT CHECK(route_chain_json IS NULL OR json_valid(route_chain_json)),
  route_rejected_json TEXT CHECK(route_rejected_json IS NULL OR json_valid(route_rejected_json)),
  host              TEXT NOT NULL DEFAULT 'orca',
  run_id TEXT, task_id TEXT, terminal_handle TEXT, worker_pid INTEGER,
  managed           INTEGER NOT NULL DEFAULT 0 CHECK(managed IN (0,1)),
  scratch_dir       TEXT,                        -- STARCI_JOB_SCRATCH
  -- tái lập (Bazel action key): đủ để dựng lại đúng lần thử
  runtime_rev       TEXT,                        -- commit .claude
  cli_name          TEXT, cli_version TEXT,      -- devin 2.x, codex 0.x ...
  contract_sha      TEXT,                        -- digest contracts.markdown
  config_sha        TEXT,                        -- digest config.yaml hiệu lực
  prompt_sha        TEXT REFERENCES blobs(sha256),       -- prompt thật đã gửi vào terminal
  transcript_sha    TEXT REFERENCES blobs(sha256),       -- TOÀN BỘ scrollback terminal lúc kết thúc, đã redact (UI-API §2.10);
                                                         -- trong lúc chạy: attempt_transcript_snapshots (mỗi 60 giây)
  session_sha       TEXT REFERENCES blobs(sha256),       -- file session của CLI (~/.claude/projects/*.jsonl, ~/.codex/sessions/...), đã redact
  -- ở đâu
  repo_root TEXT, worktree_path TEXT, branch TEXT, wf_branch TEXT,
  base_sha TEXT, head_sha TEXT, integrated_sha TEXT,
  -- khi nào
  routed_at INTEGER, dispatched_at INTEGER, started_at INTEGER, attested_at INTEGER, reported_at INTEGER,
  consumed_at INTEGER, checked_at INTEGER, settled_at INTEGER, released_at INTEGER,
  terminal_closed_at INTEGER, task_closed_at INTEGER, worktree_removed_at INTEGER,
  wall_ms           INTEGER,                     -- dispatch → settle, monotonic
  -- kết quả: lời op và phán quyết là HAI trường
  report_outcome    TEXT CHECK(report_outcome IS NULL OR report_outcome IN ('done','partial','failed','ask','blocked')),
  verdict           TEXT CHECK(verdict IS NULL OR verdict IN ('pass','fail','partial','blocked','dropped','cancelled')),
  settled_by        TEXT CHECK(settled_by IS NULL OR settled_by IN ('settler','kernel','supervisor','reconcile')),
  decision_id       TEXT,
  failure_class     TEXT, effect_state TEXT, next_step TEXT,
  settle_json       TEXT CHECK(settle_json IS NULL OR json_valid(settle_json)),
  end_state         TEXT CHECK(end_state IS NULL OR end_state IN ('settled','worker-dead','requeued','cancelled','effect-unknown')),
  -- chi phí tóm tắt (chi tiết ở llm_usage); NULL khi không đo được
  tokens_in INTEGER, tokens_out INTEGER, cost_usd REAL,
  usage_source      TEXT CHECK(usage_source IS NULL OR usage_source IN ('cli-transcript','provider-report')),
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
-- Cổng dispatch (H9): dòng attempt chỉ được tạo khi job vừa đi ready→leased (job_transitions chỉ cho leased từ ready)
-- và workflow đang running. Job đã cancelled/archived không thể được dispatch.
CREATE TRIGGER IF NOT EXISTS op_attempts_dispatch_guard BEFORE INSERT ON op_attempts BEGIN
    SELECT RAISE(ABORT,'dispatch-requires-ready-then-leased')
      WHERE (SELECT status FROM jobs WHERE job_id=NEW.job_id) IS NOT 'leased';
    SELECT RAISE(ABORT,'dispatch-requires-running-workflow')
      WHERE (SELECT phase FROM workflows WHERE workflow_id=NEW.workflow_id) IS NOT 'running';
    SELECT RAISE(ABORT,'dispatch-previous-attempt-open')
      WHERE EXISTS(SELECT 1 FROM op_attempts a WHERE a.job_id=NEW.job_id AND a.end_state IS NULL AND a.settled_at IS NULL);
  END;

-- contracts: kernel → op. Khoá theo attempt_id: lần dispatch lại KHÔNG ghi đè hợp đồng của lần trước.
CREATE TABLE IF NOT EXISTS contracts(
  attempt_id   INTEGER PRIMARY KEY REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id       TEXT NOT NULL,
  contract_rev TEXT,                             -- phiên bản hợp đồng đã admit (modules/kernel/contract-changes)
  markdown     TEXT NOT NULL,
  context_json TEXT CHECK(context_json IS NULL OR json_valid(context_json)),
  created_at   INTEGER NOT NULL) STRICT;

-- resources / leases: fence theo đường ghi. Thiếu dòng resources = capacity 1 (không seed trước).
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
  attempt_id   INTEGER,                          -- chủ: lần dispatch đang giữ (NULL giữa lease và dispatch)
  holder       TEXT,                             -- terminal handle / pid đang giữ — GC hỏi được "ai giữ, còn sống không"
  acquired_at  INTEGER NOT NULL,
  renewed_at   INTEGER,
  expires_at   INTEGER NOT NULL CHECK(expires_at>acquired_at),   -- TTL bắt buộc; hết hạn → luồng dead-worker (H12)
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

-- api_requests: idempotency cho mọi verb ghi có thể bị gọi lại (report, settle, decide, enqueue, drop, decisions --resolve).
-- request_id = --request-id hoặc sha(verb + dispatch_id + args). Gọi lại → trả result cũ. Harness KHÔNG ghi (UI chỉ đọc).
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
-- A5. Báo cáo, check, settle, land, artifact, bằng chứng, chi phí LLM
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports(
  report_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  attempt_id    INTEGER NOT NULL UNIQUE REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  dispatch_id   TEXT NOT NULL,
  job_id        TEXT NOT NULL,
  outcome       TEXT NOT NULL CHECK(outcome IN ('done','partial','failed','ask','blocked')),
  report_json   TEXT NOT NULL CHECK(json_valid(report_json)),     -- starci/op-report@1, bản DUY NHẤT
  summary       TEXT GENERATED ALWAYS AS (json_extract(report_json,'$.summary')) VIRTUAL,
  from_terminal TEXT,
  consumed_at   INTEGER,
  created_at    INTEGER NOT NULL,
  UNIQUE(workflow_id,dispatch_id)) STRICT;
-- Report bất biến (H10): nộp lại cùng nội dung → api_requests trả kết quả cũ; khác nội dung → từ chối.
CREATE TRIGGER IF NOT EXISTS reports_immutable BEFORE UPDATE OF report_json, outcome, attempt_id, dispatch_id ON reports BEGIN
    SELECT RAISE(ABORT,'report-already-filed: reports are immutable');
  END;

-- check_runs: mỗi lần chạy một check của một lần thử. run_seq = lần chạy lại thứ mấy của cùng check.
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
  command        TEXT,                           -- không bao giờ chứa bí mật
  cwd            TEXT,
  input_digest   TEXT,                           -- base sha + owned paths + tool rev: khoá dùng lại (thay settle-parity/*.json)
  authority      TEXT NOT NULL CHECK(authority IN ('runtime','declared')),   -- H8: 'runtime' = lệnh chuẩn do runtime sở hữu
                                                 -- và runtime tự chạy; 'declared' = op tự khai, chỉ là bằng chứng, không tính vào verdict
  exit_code      INTEGER,                        -- exit THÔ runner quan sát được (không bao giờ bị hạ về 0)
  declared_exit_code INTEGER,                    -- exit op TỰ KHAI trong report (có thể khác exit_code — đó là tín hiệu)
  attribution_json TEXT CHECK(attribution_json IS NULL OR json_valid(attribution_json)),  -- phần lỗi ngoài slice, có cấu trúc
  status         TEXT NOT NULL CHECK(status IN ('pass','fail','unavailable','error','skipped')),
  started_at     INTEGER, finished_at INTEGER, wall_ms INTEGER,
  stdout_sha     TEXT REFERENCES blobs(sha256),
  stderr_sha     TEXT REFERENCES blobs(sha256),
  output_sha     TEXT REFERENCES blobs(sha256),  -- JSON đã parse (canon-scan --json ...)
  summary_json   TEXT CHECK(summary_json IS NULL OR json_valid(summary_json)),
  note           TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE(attempt_id,runner,phase,name,run_seq),
  CHECK(NOT (status='pass' AND exit_code IS NOT NULL AND exit_code<>0)),       -- H8: không có "pass" với exit thô ≠ 0
  CHECK(runner<>'op' OR authority='declared')) STRICT;                         -- check op tự chạy luôn chỉ là bằng chứng
CREATE INDEX IF NOT EXISTS ix_checks_name  ON check_runs(workflow_id,name,status);
CREATE INDEX IF NOT EXISTS ix_checks_cache ON check_runs(name,input_digest);

-- settle_tails: hàng việc đuôi sau settle (thay <ledger dir>/settle-tail/<job>.json).
CREATE TABLE IF NOT EXISTS settle_tails(
  attempt_id  INTEGER PRIMARY KEY REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  state       TEXT NOT NULL CHECK(state IN ('queued','running','done','failed')),
  tries       INTEGER NOT NULL DEFAULT 0,
  due_at      INTEGER, last_error TEXT,
  queued_at   INTEGER NOT NULL, started_at INTEGER, done_at INTEGER) STRICT;

-- product_lands: api product-land (merge wf/<wf> vào main repo sản phẩm; tách khỏi settle).
CREATE TABLE IF NOT EXISTS product_lands(
  land_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  span_id      TEXT NOT NULL CHECK(length(span_id)=16),
  repo_root    TEXT NOT NULL,
  wf_branch    TEXT NOT NULL,
  main_before  TEXT, merged_sha TEXT,
  result       TEXT NOT NULL CHECK(result IN ('queued','landed','failed','conflict','red','busy','main-moving')),
  reason       TEXT,
  checks_json  TEXT CHECK(checks_json IS NULL OR json_valid(checks_json)),   -- land checks + import scan (tóm tắt)
  output_sha   TEXT REFERENCES blobs(sha256),
  pushed       INTEGER NOT NULL DEFAULT 0 CHECK(pushed IN (0,1)),
  started_at   INTEGER NOT NULL, finished_at INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_lands_wf ON product_lands(workflow_id,started_at);

-- job_artifacts: mọi file đầu ra, byte ở kho blob. Artifact của Kernel (scan, dispatch-ready) không có attempt.
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
  name         TEXT NOT NULL,                    -- tên logic: 'checks/2-canon-scan/output', 'patch.diff', 'rounds/2/desktop-light.png'
  sha256       TEXT NOT NULL REFERENCES blobs(sha256),
  bytes        INTEGER NOT NULL,
  media_type   TEXT NOT NULL,
  label        TEXT,                             -- XBase#state@viewport ...
  scope_ref    TEXT,                             -- id bản ghi Work mà artifact nói về
  round        INTEGER,                          -- vòng vẽ/audit
  run_id       TEXT,                             -- runId của uat.verify
  origin       TEXT NOT NULL CHECK(origin IN ('op','settler','checker','kernel')),
  base_sha TEXT, head_sha TEXT, integrated_sha TEXT,
  created_at   INTEGER NOT NULL,
  CHECK(attempt_id IS NOT NULL OR origin='kernel')) STRICT;
-- Artifact bất biến (H10): khoá (attempt_id, name), byte theo sha; không UPDATE nội dung/tên, không ghi đè sha.
CREATE TRIGGER IF NOT EXISTS job_artifacts_immutable BEFORE UPDATE OF sha256, bytes, name, attempt_id, media_type ON job_artifacts BEGIN
    SELECT RAISE(ABORT,'artifacts are immutable: file a new name');
  END;

-- attempt_transcript_snapshots (UI-API §2.10): snapshot scrollback định kỳ (60 giây) của terminal op khi còn chạy, đã redact.
-- Scrollback không đổi thì không thêm dòng (UNIQUE attempt+sha). Bản cuối là op_attempts.transcript_sha.
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

-- work_citations: bản ghi Work (git) trích artifact/blob nào — ghim blob, hiện ảnh của bản ghi, phát hiện trích gãy.
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

-- interface_audits: phạm vi + phán quyết của interface.audit (thay features/<f>/operations/<name>/index.yaml + E/**).
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

-- llm_usage: chi phí LLM theo OTel GenAI semconv — mỗi (lần thử | lượt Kernel) × model một dòng.
-- Chi phí của Supervisor và [Worker] nằm ở machine.llm_usage.
CREATE TABLE IF NOT EXISTS llm_usage(
  usage_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id        TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  subject_type       TEXT NOT NULL CHECK(subject_type IN ('attempt','kernel-turn')),
  attempt_id         INTEGER REFERENCES op_attempts(attempt_id) ON DELETE CASCADE,   -- khi subject_type='attempt'
  turn_ref           TEXT,                       -- khi 'kernel-turn': '<seat>:<n>' hoặc decision_id
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
-- A6. Hộp thư, Decision Item, quyết định, điều kiện, sự cố, nền dùng chung, tín hiệu
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbox(
  inbox_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id      TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK(kind IN ('goal','goal-revision','peer-message','worker-question','owner-answer','amendment')),
  key              TEXT,
  from_ref         TEXT,                         -- owner | wf-<peer> | attempt:<id>
  attempt_id       INTEGER,                      -- câu hỏi của worker: lần thử nào hỏi
  payload_json     TEXT NOT NULL CHECK(json_valid(payload_json)),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','applied','rejected','done','superseded')),
  disposition_json TEXT CHECK(disposition_json IS NULL OR json_valid(disposition_json)),
  created_at       INTEGER NOT NULL,
  applied_at       INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS ix_inbox_open ON inbox(workflow_id,kind,status);

CREATE TABLE IF NOT EXISTS decision_items(
  di_id              TEXT PRIMARY KEY,           -- di-<sha8>
  -- MB-07: khoá = '<kind>:<entity>:<chữ ký lỗi>:<head|rev>' — MỌI thành phần bắt buộc, không phần rỗng. Chữ ký đổi → DI mới
  -- và DI cũ superseded (superseded_by), không gộp mãi vào DI cũ.
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
  span_id        TEXT NOT NULL CHECK(length(span_id)=16),   -- span con của lượt Kernel; attempt dispatch từ đây lấy làm parent
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

-- conditions (K8s metav1.Condition): trạng thái quan sát theo từng khía cạnh; "vì sao kẹt" = condition đầu tiên
-- chưa True. Controller ghi 'Unknown' lần đầu thấy entity. Mỗi lần status đổi → event 'condition-changed'.
CREATE TABLE IF NOT EXISTS conditions(
  workflow_id         TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  entity_type         TEXT NOT NULL CHECK(entity_type IN ('workflow','unit','job','attempt')),
  entity_id           TEXT NOT NULL,
  type                TEXT NOT NULL,             -- Routed, Dispatched, WorkerAlive, Reported, ChecksPassed, Settled, Released, WorktreeClean, GoalObserved
  status              TEXT NOT NULL CHECK(status IN ('True','False','Unknown')),
  reason              TEXT NOT NULL,             -- CamelCase: ProviderCircuitOpen, RamThrottled, NoReportAfterSla, CheckFailed ...
  message             TEXT,
  owner               TEXT CHECK(owner IS NULL OR owner IN ('owner','supervisor','kernel','controller','op')),  -- ai phải gỡ
  observed_generation INTEGER,
  last_transition_at  INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  PRIMARY KEY(entity_type,entity_id,type)) STRICT;
CREATE INDEX IF NOT EXISTS ix_conditions_open ON conditions(workflow_id,status);

-- incidents: kind là enum (hôm nay hàng trăm kind tự do), có chủ và hạn (GC hỏi được "sự cố nào quá hạn, ai phải gỡ").
CREATE TABLE IF NOT EXISTS incidents(
  incident_id   TEXT PRIMARY KEY,
  workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  op_id TEXT, job_id TEXT, attempt_id INTEGER,
  kind          TEXT NOT NULL CHECK(kind IN ('infra-provider','config-defect','owner-ask','credential-missing','safety-block',
                                             'runtime-defect','evidence-missing','scope-change','partial-effect','other')),
  detail        TEXT,
  owner         TEXT NOT NULL CHECK(owner IN ('kernel','supervisor','owner')),
  due_at        INTEGER,                          -- quá hạn → DI leo thang
  attempts      INTEGER NOT NULL DEFAULT 0, model_calls INTEGER NOT NULL DEFAULT 0,
  tokens        INTEGER NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0,
  last_progress TEXT,
  status        TEXT NOT NULL CHECK(status IN ('open','resolved','superseded')),
  resolved_reason TEXT CHECK(resolved_reason IS NULL OR resolved_reason IN ('fixed','answered','workflow-ended','superseded','dropped')),
  created_at    INTEGER NOT NULL, updated_at INTEGER NOT NULL, resolved_at INTEGER,
  CHECK(status='open' OR (resolved_at IS NOT NULL AND resolved_reason IS NOT NULL))) STRICT;
CREATE INDEX IF NOT EXISTS ix_incidents_open ON incidents(status,due_at);
-- Workflow kết thúc thì sự cố của nó đóng trong cùng giao dịch (H12: 405 sự cố mồ côi).
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

-- signals: CHỈ khoá/fence tiến trình.
CREATE TABLE IF NOT EXISTS signals(
  scope      TEXT NOT NULL CHECK(scope IN ('kernel','stop','launch','decision-doorbell')),
  key        TEXT NOT NULL,
  workflow_id TEXT REFERENCES workflows(workflow_id) ON DELETE CASCADE,   -- tín hiệu không sống lâu hơn workflow (dữ liệu #18)
  holder_pid INTEGER, token TEXT,
  value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
  at         INTEGER NOT NULL, expires_at INTEGER,
  PRIMARY KEY(scope,key)) STRICT;

-- ---------------------------------------------------------------------------------------------------------
-- A7. Sự kiện và log (append-only, FTS)
-- ---------------------------------------------------------------------------------------------------------
-- events: nhật ký kiểm toán. prev_digest/digest do writer JS tính trong BEGIN IMMEDIATE:
--   digest = sha256(prev_digest || event_id || kind || coalesce(payload_json,'') || created_at)
CREATE TABLE IF NOT EXISTS events(
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL UNIQUE,
  workflow_id  TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  attempt_id   INTEGER,                          -- khi sự kiện thuộc một lần thử
  span_id      TEXT,
  kind         TEXT NOT NULL,
  payload_json TEXT CHECK(payload_json IS NULL OR (json_valid(payload_json) AND length(payload_json)<=16384)),
  payload_sha  TEXT REFERENCES blobs(sha256),    -- payload lớn hơn 16 KiB
  prev_digest  TEXT,
  digest       TEXT NOT NULL CHECK(length(digest)=64),
  occurred_at  INTEGER NOT NULL,                  -- lúc việc xảy ra (dữ liệu #12: tách khỏi lúc ghi)
  created_at   INTEGER NOT NULL) STRICT;          -- lúc ghi (recorded_at)
CREATE INDEX IF NOT EXISTS events_entity       ON events(workflow_id,entity_type,entity_id,seq);
CREATE INDEX IF NOT EXISTS events_kind         ON events(workflow_id,kind,seq);
CREATE INDEX IF NOT EXISTS events_workflow_seq ON events(workflow_id,seq);
CREATE INDEX IF NOT EXISTS events_attempt      ON events(attempt_id,seq);
CREATE TRIGGER IF NOT EXISTS events_append_only BEFORE UPDATE ON events BEGIN
    SELECT RAISE(ABORT,'events are append-only');
  END;
-- H9: workflow đã archived không nhận thêm sự kiện (hôm nay 1 840 event ghi sau archive), trừ sự kiện purge.
CREATE TRIGGER IF NOT EXISTS events_refuse_archived BEFORE INSERT ON events
  WHEN (SELECT phase FROM workflows WHERE workflow_id=NEW.workflow_id)='archived' AND NEW.kind NOT LIKE 'purge-%' BEGIN
    SELECT RAISE(ABORT,'workflow-archived: no further writes');
  END;
CREATE TRIGGER IF NOT EXISTS events_delete_only_by_purge BEFORE DELETE ON events
  WHEN NOT EXISTS(SELECT 1 FROM workflow_purges p WHERE p.workflow_id=OLD.workflow_id AND p.state='deleting') BEGIN
    SELECT RAISE(ABORT,'events are append-only: only the owner-approved workflow purge deletes them');
  END;

-- logs: log có kiểu. Op ghi qua `api log` (không còn log.jsonl trong .starciwork); UI chỉ đọc.
-- Mặc định KHÔNG ghi 'debug' vào DB (debug ở blob log thô của lần thử); bật theo workflow thì giữ 14 ngày.
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
  src         TEXT UNIQUE) STRICT;               -- khoá dẫn xuất idempotent (ev:<seq> ...)
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

-- logs_fts: FTS5 external-content trên msg/kind (không đánh data_json). Tìm: logs_fts MATCH '"EADDRINUSE"'.
CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(msg, kind, content='logs', content_rowid='seq',
  tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER IF NOT EXISTS logs_fts_insert AFTER INSERT ON logs BEGIN
    INSERT INTO logs_fts(rowid,msg,kind) VALUES (NEW.seq,NEW.msg,NEW.kind);
  END;
CREATE TRIGGER IF NOT EXISTS logs_fts_delete AFTER DELETE ON logs BEGIN
    INSERT INTO logs_fts(logs_fts,rowid,msg,kind) VALUES ('delete',OLD.seq,OLD.msg,OLD.kind);
  END;

CREATE TABLE IF NOT EXISTS log_cursors(name TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT;  -- events:<ledger> → seq đã dẫn xuất

-- ---------------------------------------------------------------------------------------------------------
-- A8. View truy vấn (bền)
-- ---------------------------------------------------------------------------------------------------------
-- Trạng thái gốc của một lần thử (một chỗ tính, dùng cho ui).
CREATE VIEW IF NOT EXISTS v_attempt_state AS
SELECT attempt_id,
       CASE WHEN end_state='worker-dead' THEN 'worker-dead' WHEN end_state='effect-unknown' THEN 'effect-unknown'
            WHEN end_state='requeued' THEN 'requeued'
            WHEN verdict IS NOT NULL THEN verdict
            WHEN dispatched_at IS NULL THEN 'routed' ELSE 'in-flight' END AS native
FROM op_attempts;

-- Lịch sử op: mỗi lần dispatch (UI /api/attempts).
CREATE VIEW IF NOT EXISTS v_op_history AS
SELECT a.attempt_id, a.workflow_id, a.unit_id, a.job_id, a.op_id, a.try_no, a.dispatch_seq, a.dispatch_id, a.span_id,
       a.agent, a.provider, a.model, a.model_profile, a.pool, a.effort, a.cli_version, a.runtime_rev,
       a.terminal_handle, a.worktree_path, a.branch, a.base_sha, a.head_sha, a.integrated_sha,
       a.routed_at, a.dispatched_at, a.reported_at, a.settled_at, a.released_at, a.worktree_removed_at,
       COALESCE(a.wall_ms, a.settled_at - a.dispatched_at) AS cycle_ms,
       a.report_outcome, a.verdict, a.settled_by, a.failure_class, a.end_state,
       a.tokens_in, a.tokens_out, a.cost_usd, a.usage_source,
       a.prompt_sha, a.transcript_sha, a.session_sha,
       s.native AS attempt_state, COALESCE(m.ui,'unknown') AS ui,
       j.status AS job_status, r.report_id, r.summary AS report_summary,
       (SELECT count(*) FROM check_runs c WHERE c.attempt_id=a.attempt_id)                                 AS checks,
       (SELECT count(*) FROM check_runs c WHERE c.attempt_id=a.attempt_id AND c.status IN ('fail','error')) AS checks_red,
       (SELECT count(*) FROM job_artifacts x WHERE x.attempt_id=a.attempt_id)                              AS artifacts
FROM op_attempts a
JOIN v_attempt_state s ON s.attempt_id=a.attempt_id
LEFT JOIN ui_state_map m ON m.entity='attempt' AND m.native=s.native
LEFT JOIN jobs j    ON j.job_id=a.job_id
LEFT JOIN reports r ON r.attempt_id=a.attempt_id;

-- Hàng unit với lần thử mới nhất (UI /units, /graph).
CREATE VIEW IF NOT EXISTS v_units AS
SELECT u.*, COALESCE(m.ui,'unknown') AS ui,
       (SELECT max(attempt_id) FROM op_attempts a WHERE a.workflow_id=u.workflow_id AND a.unit_id=u.unit_id) AS last_attempt_id
FROM work_units u LEFT JOIN ui_state_map m ON m.entity='unit' AND m.native=u.state;

-- Check với ui.
CREATE VIEW IF NOT EXISTS v_checks AS
SELECT c.*, COALESCE(m.ui,'unknown') AS ui FROM check_runs c LEFT JOIN ui_state_map m ON m.entity='check' AND m.native=c.status;

-- Decision Item với ui có luật thời gian: quá hạn hoặc leo thang ≥ 2 → bad; còn < 20% thời gian → warn.
CREATE VIEW IF NOT EXISTS v_decision_rows AS
SELECT d.*,
       (d.due_at IS NOT NULL AND d.status IN ('open','claimed','escalated') AND d.due_at < CAST(unixepoch('subsec')*1000 AS INTEGER)) AS overdue,
       CASE WHEN d.status IN ('open','claimed','escalated')
                 AND ((d.due_at IS NOT NULL AND d.due_at < CAST(unixepoch('subsec')*1000 AS INTEGER)) OR d.escalations>=2) THEN 'bad'
            WHEN d.status='open' AND d.due_at IS NOT NULL
                 AND (d.due_at - CAST(unixepoch('subsec')*1000 AS INTEGER)) < 0.2*(d.due_at - d.opened_at) THEN 'warn'
            ELSE COALESCE(m.ui,'unknown') END AS ui
FROM decision_items d LEFT JOIN ui_state_map m ON m.entity='decision' AND m.native=d.status;

-- Media có link.
CREATE VIEW IF NOT EXISTS v_media AS
SELECT x.artifact_id, x.workflow_id, x.job_id, x.attempt_id, x.op_id, x.role, x.kind, x.subkind,
       x.name, x.label, x.scope_ref, x.round, x.run_id, x.sha256, x.bytes, x.media_type, x.created_at,
       b.http_path, b.file_uri, b.pinned, b.archived_at
FROM job_artifacts x JOIN blobs b ON b.sha256=x.sha256
WHERE x.role IN ('direction','render','redline','capture','dom','screenshot','video','trace','uat-run')
   OR x.media_type LIKE 'image/%' OR x.media_type LIKE 'video/%';

-- Bằng chứng của một bản ghi Work.
CREATE VIEW IF NOT EXISTS v_record_evidence AS
SELECT c.record_id, c.record_path, c.field, c.role, c.record_rev, c.sha256,
       b.http_path, b.file_uri, b.media_type, b.bytes,
       x.artifact_id, x.workflow_id, x.attempt_id, x.job_id, x.op_id, x.label, x.run_id, x.created_at AS produced_at
FROM work_citations c JOIN blobs b ON b.sha256=c.sha256 LEFT JOIN job_artifacts x ON x.artifact_id=c.artifact_id;

-- Dòng thời gian: event + log + mốc lần thử + check + quyết định (sắp theo at, rồi seq).
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

-- Tiến độ theo unit.
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

-- Hiệu năng model × op.
CREATE VIEW IF NOT EXISTS v_model_scorecard AS
SELECT agent, model, op_id, count(*) AS attempts,
       sum(verdict='pass') AS pass, sum(verdict='fail') AS fail, sum(verdict='blocked') AS blocked,
       sum(end_state='worker-dead') AS worker_dead,
       round(1.0*sum(verdict='pass')/NULLIF(sum(verdict IS NOT NULL),0),3) AS pass_rate,
       avg(COALESCE(wall_ms, settled_at - dispatched_at)) AS avg_cycle_ms,
       sum(tokens_in) AS tokens_in, sum(tokens_out) AS tokens_out, sum(cost_usd) AS cost_usd
FROM op_attempts GROUP BY agent, model, op_id;

-- "Vì sao X kẹt": mọi lý do chặn đang mở, mỗi lý do một dòng, có ai phải gỡ (UI blockedBy).
CREATE VIEW IF NOT EXISTS v_blocking AS
SELECT e.workflow_id, 'unit' AS entity_type, e.to_unit AS entity_id, 'unit' AS blocker_type, e.from_unit AS blocker_id,
       'UpstreamNotDone' AS reason_code, p.state AS detail, p.updated_at AS since, 'kernel' AS who
  FROM unit_edges e JOIN work_units t ON t.workflow_id=e.workflow_id AND t.unit_id=e.to_unit
                    JOIN work_units p ON p.workflow_id=e.workflow_id AND p.unit_id=e.from_unit
 WHERE t.state IN ('planned','queued') AND p.state NOT IN ('done','dropped')
UNION ALL
SELECT workflow_id, COALESCE(entity_type,'workflow'), COALESCE(entity_id,workflow_id), 'decision', di_id,
       'DecisionOpen:'||kind, summary, opened_at, decider
  FROM decision_items WHERE status IN ('open','claimed','escalated')
UNION ALL
SELECT workflow_id, entity_type, entity_id, 'condition', type, reason, message, last_transition_at, COALESCE(owner,'controller')
  FROM conditions WHERE status<>'True'
UNION ALL
SELECT workflow_id, 'job', COALESCE(job_id,workflow_id), 'incident', incident_id, 'IncidentOpen:'||kind, COALESCE(detail,last_progress),
       created_at, owner
  FROM incidents WHERE status='open'
UNION ALL
SELECT workflow_id, 'attempt', CAST(attempt_id AS TEXT), 'question', CAST(inbox_id AS TEXT), 'WorkerQuestionPending',
       json_extract(payload_json,'$.question'), created_at, 'kernel'
  FROM inbox WHERE kind='worker-question' AND status IN ('pending','claimed')
UNION ALL
SELECT workflow_id, 'attempt', CAST(attempt_id AS TEXT), 'settle-tail', CAST(attempt_id AS TEXT), 'SettleTailFailed', last_error,
       COALESCE(started_at,queued_at), 'controller'
  FROM settle_tails WHERE state='failed'
UNION ALL
SELECT l.workflow_id, 'workflow', l.workflow_id, 'product-land', CAST(l.land_id AS TEXT), 'ProductLand:'||l.result, l.reason,
       l.started_at, 'kernel'
  FROM product_lands l
 WHERE l.result IN ('failed','conflict','red')
   AND NOT EXISTS(SELECT 1 FROM product_lands k WHERE k.workflow_id=l.workflow_id AND k.land_id>l.land_id AND k.result='landed');

-- Việc đang mở (DI + job giữ lease/đang chạy).
CREATE VIEW IF NOT EXISTS v_open_work AS
SELECT 'decision' AS kind, workflow_id, di_id AS ref, summary AS what, opened_at AS since, due_at FROM decision_items
 WHERE status IN ('open','claimed','escalated')
UNION ALL
SELECT 'job-'||status, workflow_id, job_id, op_id, updated_at, deadline FROM jobs
 WHERE status IN ('leased','running','answering','effect_unknown');

-- H1: report đã nộp mà chưa settle quá SLA (xanh ≤ 3 phút cho settler; không xanh ≤ 15 phút cho Kernel, rồi DI leo thang).
-- Job ở 'reported'/'deciding' quá SLA KHÔNG được tính là giữ slot fleet (census đọc view này để trừ ra).
CREATE VIEW IF NOT EXISTS v_settle_overdue AS
SELECT a.workflow_id, a.attempt_id, a.job_id, a.unit_id, a.op_id, a.report_outcome, j.status AS job_status,
       a.reported_at, (CAST(unixepoch('subsec')*1000 AS INTEGER) - a.reported_at) AS waiting_ms,
       CASE WHEN a.report_outcome='done' THEN 'settler' ELSE 'kernel' END AS who,
       CASE WHEN a.report_outcome='done' THEN 180000 ELSE 900000 END AS sla_ms,
       (SELECT di_id FROM decision_items d WHERE d.attempt_id=a.attempt_id AND d.status IN ('open','claimed','escalated')) AS open_di
FROM op_attempts a JOIN jobs j ON j.job_id=a.job_id
WHERE a.reported_at IS NOT NULL AND a.settled_at IS NULL AND a.end_state IS NULL
  AND (CAST(unixepoch('subsec')*1000 AS INTEGER) - a.reported_at) > CASE WHEN a.report_outcome='done' THEN 180000 ELSE 900000 END;

-- Rò: lease quá hạn (kèm chủ) và sự cố mở quá hạn — GC/Resource ctrl quét view này (H12).
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

-- Tìm theo id trên mọi thực thể (UI /api/search, phần khoá; phần chữ dùng logs_fts).
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

-- Mốc invalidation cho SSE /api/live (server so với lần trước; ETag dùng thêm PRAGMA data_version).
CREATE VIEW IF NOT EXISTS v_live_marks AS
SELECT 'events' AS topic, COALESCE(max(seq),0) AS mark FROM events
UNION ALL SELECT 'logs', COALESCE(max(seq),0) FROM logs
UNION ALL SELECT 'attempts', COALESCE(max(max(attempt_id), max(COALESCE(settled_at,reported_at,dispatched_at,0))),0) FROM op_attempts
UNION ALL SELECT 'decisions', COALESCE(max(max(opened_at), max(COALESCE(resolved_at,0))),0) FROM decision_items;

-- Tham chiếu blob trong ledger này (tiện tra cứu; GC dùng blob_ref_columns, không dùng view này).
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


