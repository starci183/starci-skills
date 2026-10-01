-- 0004-attempt-why (starci/runtime@1, user_version 3 -> 4). Applied by engine/ledger-db.mjs migrateLedger on the first
-- writer open of an older ledger (after a VACUUM INTO backup and an integrity_check, with foreign_key_check + quick_check
-- before COMMIT); a fresh ledger runs 0001 then the forward files.
--
-- op_attempts.why_json: the owner-facing reason an attempt failed, was blocked, refused or is waiting (starci/why@1,
-- scripts/kernel/why.mjs, docs/why.md), written with the settle. The two attempt views are recreated:
--   v_attempt_state.native  'awaiting-owner' (job awaiting_owner, or verdict blocked + report_outcome ask) and
--                           'rejected' (end_state requeued whose settle_json.reason is dispatch-rejected) are their own states;
--   v_op_history            carries why_json, and its `ui` reads 'awaiting-owner' and 'rejected' for those two natives
--                           (every other native still maps through ui_state_map; job_status stays a column).
ALTER TABLE op_attempts ADD COLUMN why_json TEXT CHECK(why_json IS NULL OR json_valid(why_json));
DROP VIEW IF EXISTS v_op_history;
DROP VIEW IF EXISTS v_attempt_state;
CREATE VIEW v_attempt_state AS
SELECT a.attempt_id,
       CASE WHEN a.end_state='worker-dead' THEN 'worker-dead' WHEN a.end_state='effect-unknown' THEN 'effect-unknown'
            WHEN a.end_state='requeued' AND json_extract(a.settle_json,'$.reason')='dispatch-rejected' THEN 'rejected'
            WHEN a.end_state='requeued' THEN 'requeued'
            WHEN (a.verdict='blocked' AND a.report_outcome='ask')
              OR (a.verdict IS NOT NULL AND (SELECT j.status FROM jobs j WHERE j.job_id=a.job_id)='awaiting_owner') THEN 'awaiting-owner'
            WHEN a.verdict IS NOT NULL THEN a.verdict
            WHEN a.dispatched_at IS NULL THEN 'routed' ELSE 'in-flight' END AS native
FROM op_attempts a;
CREATE VIEW v_op_history AS
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
