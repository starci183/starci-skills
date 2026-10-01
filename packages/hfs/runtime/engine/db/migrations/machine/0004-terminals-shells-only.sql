-- 0004-terminals-shells-only (starci/machine@1, user_version 3 -> 4). Applied by engine/machine-db.mjs migrateMachine on
-- the first writer open of an older machine.sqlite (after an integrity_check and a VACUUM INTO backup, with foreign_key_check
-- + quick_check before COMMIT); a fresh machine.sqlite runs 0001 then the forward files.
--
-- Worker accounting is Orca's (orchestration worker-list, lane WLIST): which worker terminal is active, reclaimable or
-- released, its liveness and its next action are read from Orca, never from a runtime table. machine.sqlite terminals
-- keeps only what Orca does not account for: the GC's first sighting of a plain shell (role shell/other) and its
-- verified close. The worker columns (ledger, workflow, job, attempt, Supervisor attempt, seat, pid, owner, expiry, last
-- output, refusal count) and every row of a worker role go; the views that read them are rebuilt without them
-- (v_seats loses the terminal join, v_leaks the terminal branch; v_search_ids is unchanged but names the table).
DROP VIEW IF EXISTS v_seats;
DROP VIEW IF EXISTS v_leaks;
DROP VIEW IF EXISTS v_search_ids;
DROP INDEX IF EXISTS ix_terminals_open;
DROP INDEX IF EXISTS ix_terminals_attempt;
CREATE TABLE terminals_v4(
  handle TEXT PRIMARY KEY, title TEXT,
  role TEXT NOT NULL CHECK(role IN ('shell','other')),
  opened_at INTEGER, closed_at INTEGER, close_verified_at INTEGER, closed_by TEXT) STRICT;
INSERT INTO terminals_v4(handle,title,role,opened_at,closed_at,close_verified_at,closed_by)
  SELECT handle,title,role,opened_at,closed_at,close_verified_at,closed_by FROM terminals WHERE role IN ('shell','other');
DROP TABLE terminals;
ALTER TABLE terminals_v4 RENAME TO terminals;
CREATE INDEX IF NOT EXISTS ix_terminals_open ON terminals(closed_at,role);

CREATE VIEW IF NOT EXISTS v_seats AS
SELECT s.*, COALESCE(m.ui,'unknown') AS ui,
       (SELECT max(at) FROM seat_transcript_snapshots x WHERE x.seat_id=s.seat_id) AS last_snapshot_at
FROM seats s LEFT JOIN ui_state_map m ON m.entity='seat' AND m.native=s.state;

CREATE VIEW IF NOT EXISTS v_leaks AS
SELECT 'worktree' AS kind, path AS target, ledger_id, job_id AS owner, created_at AS since FROM worktrees
 WHERE removed_at IS NULL AND kind IN ('op','push-scratch','land-scratch')
UNION ALL SELECT 'lease', resource_key, ledger_id, job_id, acquired_at FROM host_leases
 WHERE expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL SELECT 'lease', path, NULL, job_id, acquired_at FROM sup_leases WHERE expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL SELECT 'guard', job_id, ledger_id, job_id, created_at FROM guard_jobs
 WHERE released_at IS NULL AND expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER)
UNION ALL SELECT 'claim', resource_path, NULL, owner_action_id, created_at FROM claims
 WHERE released_at IS NULL AND swept_at IS NULL AND created_at < CAST(unixepoch('subsec')*1000 AS INTEGER) - 3600000
UNION ALL SELECT 'lock', name, NULL, holder, started_at FROM host_locks
 WHERE state<>'released' AND expires_at < CAST(unixepoch('subsec')*1000 AS INTEGER);

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
