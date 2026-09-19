-- ============================================================================
-- queries/jobs-queue.sql — the durable job queue on the LEDGER
-- (runtime.sqlite). Every statement below exists in the shipped kernel; the
-- comment gives the exact source function and the decision it feeds.
--
-- Lifecycle: queued → leased (admission, two-phase) → running (worker claim)
--   → succeeded|failed|cancelled (SETTLED_JOB_STATUSES) — with `effect_unknown`
--   as the off-path state when the terminal effect cannot be proven.
-- The fencing discipline: EVERY transition names (job_id, lease_token) and most
-- name generation too, so a stale worker/bridger cannot settle a job it no
-- longer owns. Settlement consumes budgets, drops leases and writes the
-- `job-<status>` receipt event in ONE transaction (jobs.mjs::complete).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- READ / LOOK UP
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::readAccessors.getJob (also engine.mjs, jobs.mjs::complete)
-- The whole durable row — identity fields are what every fence compares.
SELECT * FROM jobs WHERE job_id=?;

-- source: ledger-db.mjs::readAccessors.listJobs (dynamic WHERE)
-- The queue scan workers and the reconciler start from; ordered oldest-first so
-- claim order is FIFO inside a status/kind. Backed by index jobs_queue.
SELECT * FROM jobs WHERE 1=1 AND status=? AND kind=? ORDER BY created_at,job_id;

-- source: admission.mjs::assertFence
-- "Is this (job,generation,lease_token) still a live reservation?" — the read
-- behind every heartbeat/renew authorization.
SELECT generation,lease_token,status,deadline FROM jobs WHERE job_id=?;
-- caller then requires: generation=? AND lease_token=? AND status IN ('leased','running') AND deadline>now

-- source: continuation.mjs::ledgerFacts (read-only inspectLedger)
-- The continuation boundary's view of what is still owed.
SELECT job_id,workflow_id,op_id,attempt,generation,kind,status,worker_id,deadline,lease_token
  FROM jobs WHERE workflow_id=? ORDER BY created_at,job_id;

-- source: ledger-db.mjs::liveRows — "what still binds a workflow to this ledger"
SELECT job_id,status,generation FROM jobs WHERE workflow_id=? AND status NOT IN ('succeeded','failed','cancelled') ORDER BY job_id;

-- source: jobs.mjs::recoverExpired — jobs whose fence timed out and still need settling
SELECT job_id FROM jobs WHERE status='effect_unknown' AND lease_token IS NOT NULL ORDER BY updated_at;

-- source: engine.mjs::nonSettledKindJobs (inspectLedger, read-only)
-- Model-side jobs of a generation that never reached a terminal state.
SELECT * FROM jobs WHERE workflow_id=? AND generation=?;
-- caller filters kind IN ('model','judge','check') and unsettled in JS

-- source: engine.mjs (retry path, ~line 193)
-- A queued job of a retired generation that never launched (no lease, no job
-- event at all) is proven never-launched and cancelled so it stops binding the
-- workflow forever.
SELECT j.job_id FROM jobs j
  WHERE j.workflow_id=? AND j.generation<=?
    AND j.kind IN ('model','judge','check','operation') AND j.status='queued'
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.job_id=j.job_id)
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.workflow_id=j.workflow_id AND e.entity_type='job' AND e.entity_id=j.job_id)
  ORDER BY j.job_id;

-- source: engine.mjs::pending (~line 666) — via journal.listJobs + JS filter
-- "does this generation still have pending work" — workflow_id, generation,
-- status IN ('queued','leased','running','effect_unknown'). Run as listJobs()
-- then filtered in JS; no dedicated SQL.
-- TODO-missing: a `pendingJobs(workflowId,generation)` prepared query — the
-- engine scans the whole queue and filters in memory.

-- ---------------------------------------------------------------------------
-- WRITE — enqueue / lease / claim / heartbeat / settle
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::openLedger.enqueueJob — job created dormant
INSERT OR IGNORE INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?,?, 'queued',?,?,?);

-- source: ledger-db.mjs::reserveTwoPhase — admission: existing queued job → leased
UPDATE jobs SET status='leased',lease_token=?,deadline=?,updated_at=? WHERE job_id=?;

-- source: ledger-db.mjs::reserveTwoPhase — admission: job row created already leased
-- (identity re-check happens first: existing row must match workflow/op/attempt/
-- generation and still be 'queued', else the reservation refuses)
INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,lease_token,deadline,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?,?,'leased',?,?,?,?,?);

-- source: jobs.mjs::claimNext — a worker took the leased job
UPDATE jobs SET worker_id=?,status='running',updated_at=? WHERE job_id=? AND lease_token=?;

-- source: job-worker.mjs::runDurableJob — three distinct claim shapes, all fenced:
-- (a) fresh: leased and never had a worker
UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status='leased' AND worker_id IS NULL;
-- (b) staged-result replay: provider already produced a result, settle pending
UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status='effect_unknown';
-- (c) completion-replay: the bridge parked it as 'completion-replay-pending'
UPDATE jobs SET worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status='running' AND worker_id='completion-replay-pending';
-- all three require changes===1 else STARCI_STALE_JOB.

-- source: job-bridge.mjs::request — completion replay claim by the bridge itself
UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND status='effect_unknown' AND lease_token=?;
-- ...and its spawn-failure rollbacks:
UPDATE jobs SET status='effect_unknown',worker_id=NULL,updated_at=? WHERE job_id=? AND lease_token=?;
UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=? AND lease_token=?;

-- source: admission.mjs::renew — heartbeat extends the fencing deadline
UPDATE jobs SET deadline=?,updated_at=? WHERE job_id=? AND generation=? AND lease_token=? AND status IN ('leased','running');
-- only when changes=1 does it also bump leases.expires_at (and machine tokens):
--   UPDATE leases SET expires_at=? WHERE job_id=? AND token=?            (ledger)
--   UPDATE leases SET expires_at=? WHERE token=?                          (machine)

-- source: engine.mjs::launched (~447) — native (Orca) op marked running; worker_id
-- here is the DISPATCH id, not a pid — the host adapter owns liveness.
UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=?;

-- source: engine.mjs (~514) — launch reconciliation rebinds a dispatch that
-- outlived its launcher (worker_id IS NULL is part of the proof it needs one)
UPDATE jobs SET worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status IN ('leased','effect_unknown') AND worker_id IS NULL;

-- source: ledger-db.mjs::releaseTwoPhase — settle with or without a final status
UPDATE jobs SET status=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?;
UPDATE jobs SET lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?;

-- source: jobs.mjs::complete — the terminal write inside the one settlement tx
-- (lease rows deleted, budgets consumed, job-<status> event inserted — all-or-nothing)
UPDATE jobs SET status=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?;

-- source: job-worker.mjs (~59-62) / job-reconcile.mjs (24,28) / engine.mjs (179)
-- effect_unknown: the provider may have produced an effect the kernel cannot
-- prove; the lease stays fenced until reconcile settles it.
UPDATE jobs SET status='effect_unknown',deadline=NULL,result_json=?,updated_at=? WHERE job_id=? AND lease_token=?;

-- source: admission.mjs::expire — timed-out active leases force effect_unknown
-- (capacity stays fenced; the job is reconciled, never silently freed)
UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=?;

-- source: engine.mjs (185) / job-bridge.mjs (37) — proven-dead / rejected jobs
UPDATE jobs SET status='cancelled',result_json=?,updated_at=? WHERE job_id=?;

-- source: admission.mjs::reserve — budget failure after a successful two-phase
-- reserve rolls the job back to queued (releaseTwoPhase already dropped leases)
UPDATE jobs SET status='queued',updated_at=? WHERE job_id=?;

-- ---------------------------------------------------------------------------
-- DELETE — retention (see also queries/verify-retire.sql)
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::pruneRetiredGenerations — retired generations keep no
-- settled jobs; a job holding any lease or unsettled survives whatever its age
DELETE FROM jobs WHERE workflow_id=? AND generation<? AND status IN ('succeeded','failed','cancelled')
  AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.job_id=jobs.job_id);

-- source: engine.mjs provider-loads view (~333) — recent settled jobs that DID
-- launch (immutable spawn receipt AND settlement receipt), last 6h, newest first.
-- This is what powers "recentSettled" per provider in the supervisor's load view.
SELECT j.kind,j.payload_json,
    (SELECT MAX(s.created_at) FROM events s
      WHERE s.workflow_id=j.workflow_id AND s.entity_id=j.job_id
        AND s.kind IN ('job-succeeded','job-failed','job-cancelled','operation-worker-stopped')) AS service_at
  FROM jobs j
  WHERE j.kind IN ('model','judge','operation')
    AND EXISTS (SELECT 1 FROM events l WHERE l.workflow_id=j.workflow_id AND l.entity_id=j.job_id
                AND l.kind IN ('job-spawned','operation-launched'))
    AND EXISTS (SELECT 1 FROM events s WHERE s.workflow_id=j.workflow_id AND s.entity_id=j.job_id
                AND s.kind IN ('job-succeeded','job-failed','job-cancelled','operation-worker-stopped')
                AND s.created_at>=?)
  ORDER BY service_at,j.job_id;
