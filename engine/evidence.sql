-- Evidence in DB + blob store: ledger schema (owner 2026-09-28: "thiết kế sql và lưu lại").
-- Target: every product ledger <repo>/.starciwork/runtime.sqlite (SQLite, WAL).
-- Blob CONTENT lives outside git in ~/.starci/artifacts/<sha[0:2]>/<sha256>; the DB holds the index and structure.
-- Migration: versioned and idempotent (scripts/kernel ledger migrator), run inside one transaction per ledger,
--            with the ledger backed up first.

PRAGMA foreign_keys = ON;

-- 1. Blob registry: one row per content-addressed blob that any ledger row references.
--    The row stays while a reference exists. GC deletes the row and the file once the refcount is 0 and the retention
--    policy has archived it.
CREATE TABLE IF NOT EXISTS blobs (
  sha256      TEXT PRIMARY KEY CHECK (length(sha256) = 64),
  bytes       INTEGER NOT NULL CHECK (bytes >= 0),
  media_type  TEXT    NOT NULL,                 -- e.g. application/json, text/plain, image/png, video/webm, text/x-diff
  encoding    TEXT,                             -- NULL | 'gzip' (stored compressed; sha256 is of the ORIGINAL bytes)
  file_uri    TEXT,                             -- absolute blob path; NULL for metadata-only Work proof hashes
  http_path   TEXT,                             -- /api/blob/<sha256>; NULL when no blob bytes are present
  created_at  INTEGER NOT NULL,                 -- ms epoch
  archived_at INTEGER,                          -- set when the blob was included in a verified D:/starci-archive zip
  archive_ref TEXT                              -- zip path + entry name holding the archived copy
);

-- 2. Job artifacts: each file-like output of a job attempt.
--    Replaces the path-only job_artifacts. `name` is a LOGICAL name (not a filesystem path) unique within the attempt.
--    storage = 'blob'       -> content in the blob store (sha256 references blobs)
--    storage = 'work-proof' -> a Work-record proof committed in .starciwork (repo_path set); sha256 = hash of that file
CREATE TABLE IF NOT EXISTS job_artifacts_v2 (
  artifact_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id  TEXT    NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id       TEXT    NOT NULL,
  op_id        TEXT,
  attempt      INTEGER NOT NULL DEFAULT 1,
  cut          TEXT,
  role         TEXT    NOT NULL CHECK (role IN ('check-output','check-stdout','check-stderr','patch','report-attachment',
                                                'screenshot','video','dom','render','redline','proof','log')),
  kind         TEXT    NOT NULL,               -- kept from v1 (e.g. 'patch','file','report')
  subkind      TEXT,
  name         TEXT    NOT NULL,               -- logical name, e.g. 'checks/canon-before.json', 'patch.diff'
  storage      TEXT    NOT NULL CHECK (storage IN ('blob','work-proof')),
  sha256       TEXT    NOT NULL,
  bytes        INTEGER NOT NULL,
  media_type   TEXT,
  repo_path    TEXT,                           -- only for storage='work-proof': path inside the repo's .starciwork
  label        TEXT,
  origin       TEXT,                           -- who produced it: 'op','settler','checker','kernel','backfill'
  head_sha     TEXT, landed_sha TEXT, base_sha TEXT,   -- patch provenance (kept from v1)
  created_at   INTEGER NOT NULL,
  UNIQUE (workflow_id, job_id, attempt, name),
  CHECK ((storage = 'blob' AND repo_path IS NULL) OR (storage = 'work-proof' AND repo_path IS NOT NULL)),
  FOREIGN KEY (sha256) REFERENCES blobs(sha256) DEFERRABLE INITIALLY DEFERRED
    -- enforced only for storage='blob' (work-proof rows insert their hash into blobs too, as a metadata-only row,
    -- so that the FK holds uniformly)
);
CREATE INDEX IF NOT EXISTS ix_artifacts_job   ON job_artifacts_v2(workflow_id, job_id, attempt);
CREATE INDEX IF NOT EXISTS ix_artifacts_blob  ON job_artifacts_v2(sha256);
CREATE INDEX IF NOT EXISTS ix_artifacts_role  ON job_artifacts_v2(workflow_id, role);

-- 3. Check runs: one row per declared or re-run check of a job attempt. Replaces checks.checks_json blobs of text.
CREATE TABLE IF NOT EXISTS check_runs (
  check_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id   TEXT    NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id        TEXT    NOT NULL,
  op_id         TEXT    NOT NULL,
  attempt       INTEGER NOT NULL,
  name          TEXT    NOT NULL,              -- e.g. 'canon-after', 'check-scoped-lint-after', 'tsc-app'
  phase         TEXT    CHECK (phase IN ('before','after','verify','parity','integrate')),
  runner        TEXT    NOT NULL CHECK (runner IN ('op','settler','kernel','parity','integrate')),
  command       TEXT,                          -- the command line (secrets are never included)
  cwd           TEXT,                          -- worktree / repo the check ran in
  exit_code     INTEGER,
  status        TEXT    NOT NULL CHECK (status IN ('pass','fail','unavailable','error','skipped')),
  started_at    INTEGER,
  finished_at   INTEGER,
  stdout_sha    TEXT REFERENCES blobs(sha256),
  stderr_sha    TEXT REFERENCES blobs(sha256),
  output_sha    TEXT REFERENCES blobs(sha256),   -- parsed JSON output (e.g. canon-scan --json)
  summary_json  TEXT,                          -- small structured summary: {findings, new, owned, foreign, ...}
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_checks_job  ON check_runs(workflow_id, job_id, attempt);
CREATE INDEX IF NOT EXISTS ix_checks_name ON check_runs(workflow_id, name, status);

-- 4. Reports: unchanged table; report_json is the ONLY copy (there is no report.json file). Add attachment linkage.
--    (reports already: report_id, workflow_id, dispatch_id, op_id, attempt, generation, outcome, report_json, ...)
CREATE TABLE IF NOT EXISTS report_attachments (
  report_id    INTEGER NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  artifact_id  INTEGER NOT NULL REFERENCES job_artifacts_v2(artifact_id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, artifact_id)
);

-- 5. Proof claims: artifact_proofs keyed by artifact_id instead of a filesystem path.
CREATE TABLE IF NOT EXISTS artifact_proofs_v2 (
  artifact_id  INTEGER PRIMARY KEY REFERENCES job_artifacts_v2(artifact_id) ON DELETE CASCADE,
  claims_json  TEXT NOT NULL,
  code_sha     TEXT,
  deps_json    TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

-- 6. Blob reference count view: GC deletes a blob only when refs = 0 and archived_at IS NOT NULL.
CREATE VIEW IF NOT EXISTS blob_refs AS
SELECT b.sha256, b.bytes, b.archived_at,
       (SELECT count(*) FROM job_artifacts_v2 a WHERE a.sha256 = b.sha256)
     + (SELECT count(*) FROM check_runs c WHERE c.stdout_sha = b.sha256 OR c.stderr_sha = b.sha256 OR c.output_sha = b.sha256)
       AS refs
FROM blobs b;

-- 8. One durable row per operation attempt; populated across route, dispatch, report, settle and release.
CREATE TABLE IF NOT EXISTS op_attempts (
  attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  op_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  dispatch_id TEXT,
  agent TEXT CHECK (agent IN ('devin','codex','claude','qwen')),
  provider TEXT, model TEXT, pool TEXT, effort TEXT,
  terminal_handle TEXT, worktree_path TEXT, branch TEXT,
  base_sha TEXT, head_sha TEXT,
  routed_at INTEGER, dispatched_at INTEGER, started_at INTEGER, reported_at INTEGER,
  settled_at INTEGER, released_at INTEGER, worktree_removed_at INTEGER,
  report_outcome TEXT, verdict TEXT,
  settled_by TEXT CHECK (settled_by IN ('settler','kernel','supervisor')),
  failure_class TEXT,
  tokens_in INTEGER, tokens_out INTEGER, cost_usd REAL,
  UNIQUE (workflow_id, job_id, attempt)
);
CREATE INDEX IF NOT EXISTS ix_op_attempts_workflow ON op_attempts(workflow_id, op_id, attempt);
CREATE INDEX IF NOT EXISTS ix_op_attempts_dispatched ON op_attempts(workflow_id, dispatched_at);

-- 9. Materialized work-DAG edges used by the workflow board.
CREATE TABLE IF NOT EXISTS unit_edges (
  workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('after','seam','dependsOn')),
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workflow_id, from_unit, to_unit, kind)
);
CREATE INDEX IF NOT EXISTS ix_unit_edges_to ON unit_edges(workflow_id, to_unit);

-- 10. Read-only query surfaces for the harness and operators.
CREATE VIEW IF NOT EXISTS v_op_history AS
SELECT a.*, j.status AS job_status, j.kind AS job_kind,
       r.report_id, r.report_json,
       (SELECT count(*) FROM check_runs c WHERE c.workflow_id=a.workflow_id AND c.job_id=a.job_id AND c.attempt=a.attempt) AS check_count,
       (SELECT count(*) FROM check_runs c WHERE c.workflow_id=a.workflow_id AND c.job_id=a.job_id AND c.attempt=a.attempt AND c.status='fail') AS failed_checks
FROM op_attempts a
LEFT JOIN jobs j ON j.job_id=a.job_id
LEFT JOIN reports r ON r.workflow_id=a.workflow_id AND r.dispatch_id=a.dispatch_id;

CREATE VIEW IF NOT EXISTS v_media AS
SELECT a.artifact_id, a.workflow_id, a.job_id, a.op_id, a.attempt, a.role, a.kind, a.subkind,
       a.name, a.storage, a.sha256, a.bytes, a.media_type, a.repo_path, a.label, a.created_at,
       b.file_uri, b.http_path
FROM job_artifacts_v2 a JOIN blobs b ON b.sha256=a.sha256
WHERE a.role IN ('screenshot','video','render','redline','dom')
   OR a.media_type LIKE 'image/%' OR a.media_type LIKE 'video/%';

CREATE VIEW IF NOT EXISTS v_timeline AS
SELECT workflow_id, created_at AS at, 'event' AS source, event_id AS item_id, kind, entity_id AS job_id,
       payload_json AS detail_json FROM events
UNION ALL
SELECT workflow_id, at, 'log', CAST(seq AS TEXT), kind, job_id, data_json FROM logs
UNION ALL
SELECT workflow_id, COALESCE(settled_at, reported_at, started_at, dispatched_at, routed_at) AS at,
       'attempt', CAST(attempt_id AS TEXT), COALESCE(verdict, report_outcome, 'active'), job_id,
       json_object('opId',op_id,'attempt',attempt,'agent',agent,'model',model,'verdict',verdict) FROM op_attempts
WHERE COALESCE(settled_at, reported_at, started_at, dispatched_at, routed_at) IS NOT NULL;

CREATE VIEW IF NOT EXISTS v_workflow_progress AS
SELECT w.workflow_id, w.title, w.phase,
       count(j.job_id) AS units_total,
       sum(CASE WHEN j.status='succeeded' THEN 1 ELSE 0 END) AS units_done,
       CASE WHEN count(j.job_id)=0 THEN 0.0
            ELSE CAST(sum(CASE WHEN j.status='succeeded' THEN 1 ELSE 0 END) AS REAL)/count(j.job_id) END AS completion_rate,
       CASE WHEN sum(CASE WHEN j.status='succeeded' THEN 1 ELSE 0 END)=0 THEN NULL
            ELSE CAST((julianday('now')-2440587.5)*86400000 - w.created_at AS INTEGER)
                 * (count(j.job_id)-sum(CASE WHEN j.status='succeeded' THEN 1 ELSE 0 END))
                 / sum(CASE WHEN j.status='succeeded' THEN 1 ELSE 0 END) END AS eta_ms
FROM workflows w LEFT JOIN jobs j ON j.workflow_id=w.workflow_id AND j.kind='op' AND j.status<>'cancelled'
GROUP BY w.workflow_id;

-- 7. Migration of existing data (run once per ledger, inside a transaction, after backup):
--   a) job_artifacts (v1) -> job_artifacts_v2: name = path relative to kernel-evidence/<wf>/jobs/<job>/ (or the proof path);
--      storage = 'work-proof' when path is a Work-record proof under .starciwork/features/**/E/** that stays in git,
--      else the file is put into the blob store (storage='blob'), a blobs row is inserted, and repo_path is NULL.
--   b) artifact_proofs (v1) -> artifact_proofs_v2 by (workflow_id, job_id, path) -> artifact_id.
--   c) checks.checks_json (v1) -> check_runs: one row per entry; raw outputs found in kernel-evidence -> blobs.
--   d) kernel-evidence report.json files: verified identical to reports.report_json, then dropped (DB is the copy).
--   e) Verify counts and hashes; zip kernel-evidence to D:/starci-archive and verify; set blobs.archived_at for archived
--      content only where the zip holds it.
--   f) After ALL readers are switched (lanes ev-report/ev-reconcile/ev-ui-api/ev-gc/ev-kernel): rename
--      job_artifacts -> job_artifacts_v1_retired, artifact_proofs -> artifact_proofs_v1_retired, checks -> checks_v1_retired;
--      then rename *_v2 to the canonical names (job_artifacts, artifact_proofs); drop the *_v1_retired tables in the final
--      no-legacy commit (lane ev-docs), after a verified archive of the ledger.

-- Machine-level Supervisor evidence belongs in the per-host machine.sqlite, not another runtime ledger.
