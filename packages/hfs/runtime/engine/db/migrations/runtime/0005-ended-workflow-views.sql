-- 0005-ended-workflow-views (starci/runtime@1, user_version 4 -> 5). Applied by engine/ledger-db.mjs migrateLedger on the first
-- writer open of an older ledger (after a VACUUM INTO backup and an integrity_check, with foreign_key_check + quick_check
-- before COMMIT); a fresh ledger runs 0001 then the forward files.
--
-- The runtime views stop surfacing the live leftovers of an ENDED workflow (phase archived|finished): archive/finish close
-- the workflow's live Decision Items inside their own transaction before the phase flips, and events_refuse_archived refuses
-- every later write, so a leftover live DI (2026-09-30 nivo-backend di-876124d7) can never be resolved and only ever reads
-- 'bad' in the UI — a permanent attention item and blocker on work that no longer runs. Every leg carries the ENDED
-- predicate of scripts/reconciler/decisions.mjs listDecisions: LEFT JOIN workflows w; the row survives when its workflow is
-- missing or not ended (w.phase IS NULL OR w.phase NOT IN ('archived','finished')).
--   v_decision_rows  keeps an ended workflow's resolved rows (decision history) and drops only its live-status leftovers;
--   v_blocking       applies the join per UNION leg — an ended workflow owes no unit, decision, condition, incident,
--                    worker-question, settle-tail, product-land or settle-overdue row;
--   v_open_work      the same per leg (decision + job).
DROP VIEW IF EXISTS v_decision_rows;
DROP VIEW IF EXISTS v_blocking;
DROP VIEW IF EXISTS v_open_work;
CREATE VIEW v_decision_rows AS
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

CREATE VIEW v_blocking AS
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

CREATE VIEW v_open_work AS
SELECT 'decision' AS kind, d.workflow_id, d.di_id AS ref, d.summary AS what, d.opened_at AS since, d.due_at
  FROM decision_items d LEFT JOIN workflows w ON w.workflow_id=d.workflow_id
 WHERE d.status IN ('open','claimed','escalated')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'))
UNION ALL
SELECT 'job-'||j.status, j.workflow_id, j.job_id, j.op_id, j.updated_at, j.deadline
  FROM jobs j LEFT JOIN workflows w ON w.workflow_id=j.workflow_id
 WHERE j.status IN ('leased','running','answering','effect_unknown')
   AND (w.phase IS NULL OR w.phase NOT IN ('archived','finished'));
