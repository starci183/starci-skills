-- ============================================================================
-- queries/leases.sql — repo-scoped fences on the LEDGER (runtime.sqlite).
-- A lease row is a live reservation: capacity = resources.capacity minus
-- SUM(units of unexpired leases). The leases_match_job triggers make
-- lease-identity drift impossible to persist; the (job_id, lease_token=token)
-- pair is the fence every mutation is checked against.
-- ai/*/machine:* rows here are MIRRORS — the real reservation is the
-- machine.sqlite row whose token this row carries in machine_ref (§6).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ADMISSION (ledger-db.mjs::reserveTwoPhase, inside the one ledger transaction)
-- ---------------------------------------------------------------------------

-- Does the resource exist, and how much of it is already spoken for?
SELECT capacity FROM resources WHERE resource_key=?;
SELECT COALESCE(SUM(units),0) u FROM leases WHERE resource_key=? AND expires_at>?;

-- Write the reservation. machine_ref is NULL for repo fences and the paired
-- machine token for ai/*/machine:* mirrors.
INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref)
  VALUES(?,?,?,?,?,?,?,?,?,?,?);

-- ---------------------------------------------------------------------------
-- RENEW / RELEASE
-- ---------------------------------------------------------------------------

-- source: admission.mjs::renew — after the jobs deadline update lands (changes=1)
UPDATE leases SET expires_at=? WHERE job_id=? AND token=?;
-- paired machine tokens needing the same bump:
SELECT machine_ref FROM leases WHERE job_id=? AND token=? AND machine_ref IS NOT NULL;

-- source: ledger-db.mjs::releaseTwoPhase — collect machine refs BEFORE deleting
-- (the row's machine_ref is the only place the machine token is recorded)
SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL;
DELETE FROM leases WHERE job_id=?;

-- source: jobs.mjs::complete — settlement deletes by (job_id, token) so a stale
-- token frees nothing
DELETE FROM leases WHERE job_id=? AND token=?;

-- source: admission.mjs::expire — residue sweep: leases whose job already
-- settled (not leased/running/effect_unknown) are dropped; machine refs freed
SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id
  WHERE j.status NOT IN ('leased','running','effect_unknown');
-- and timed-out active leases force their job to effect_unknown:
SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id
  WHERE l.expires_at<=? AND j.status IN ('leased','running');

-- ---------------------------------------------------------------------------
-- READS that decide correctness
-- ---------------------------------------------------------------------------

-- source: engine.mjs (~390, ~415, ~502) — the intent-v1 exact-binding proof:
-- a durable reservation is only honoured when the live lease set equals the
-- admitted expectedResources, unexpired, under the same token.
SELECT resource_key,units,expires_at FROM leases WHERE job_id=? AND token=? ORDER BY resource_key;
SELECT resource_key,units FROM leases WHERE job_id=? AND token=? ORDER BY resource_key;

-- source: engine.mjs workerOnly settle (~465-472) — partial release of machine
-- resources while writer custody is retained: read machine_ref, then delete
SELECT resource_key FROM leases WHERE job_id=? AND token=? AND resource_key LIKE 'ai/provider:%';
SELECT machine_ref FROM leases WHERE job_id=? AND token=? AND resource_key=?;
DELETE FROM leases WHERE job_id=? AND token=? AND resource_key=?;

-- source: engine.mjs::pulse (~636) — adopt an existing operation reservation on
-- restart: which machine:* resources does the found lease hold?
SELECT resource_key FROM leases WHERE job_id=? AND token=? AND resource_key LIKE 'machine:%';

-- source: engine.mjs::staleLeaseProof (~74,89) / neverLaunchedCancelledJob — "does
-- this job hold any lease at all" separates a stale field from a live reservation
SELECT COUNT(*) AS n FROM leases WHERE job_id=?;

-- source: continuation.mjs::ledgerFacts — every live fence of a workflow, for the
-- continuation boundary's picture of what is still held
SELECT resource_key,job_id,workflow_id,op_id,attempt,generation,token,expires_at
  FROM leases WHERE workflow_id=? ORDER BY job_id,resource_key;

-- source: ledger-db.mjs::liveRows — the binding set (paired with unsettled jobs)
SELECT job_id,resource_key FROM leases WHERE workflow_id=? ORDER BY job_id,resource_key;

-- source: engine.mjs provider-loads (~323) — per-provider in-flight usage is read
-- from the ledger's mirror rows (capacity itself is machine-side)
SELECT l.resource_key,l.units,j.job_id,j.workflow_id,j.op_id,j.kind,j.role,j.status,j.payload_json
  FROM leases l JOIN jobs j ON j.job_id=l.job_id
  WHERE l.resource_key LIKE 'ai/provider:%' ORDER BY l.resource_key,j.created_at,j.job_id;

-- ---------------------------------------------------------------------------
-- RETIREMENT
-- ---------------------------------------------------------------------------
-- (leases rows die with their job via ON DELETE CASCADE, and retireWorkflow
-- refuses while any lease binds the workflow — see verify-retire.sql)

-- TODO-missing: no SELECT lists expiring-soon leases for a workflow dashboard;
-- consumers compose leases_expiry index + job status themselves.
