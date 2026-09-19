-- ============================================================================
-- queries/verify-retire.sql — the statements behind `ledger-verify`, the §12
-- anchor boundary, liveness probes, retention and retirement. These are the
-- queries that turn "is this record still the agreed one" into a yes/no.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CHAIN + ANCHOR (docs/ledger-db.md §7/§12)
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::verifyChain — ordered walk, JS recomputes each link
-- (full statement in events-tail.sql)
SELECT seq,event_id,kind,payload_json,created_at,prev_digest,digest FROM events WHERE workflow_id=? ORDER BY seq;

-- source: ledger-db.mjs::verifyAnchor + hosts/orca/launch.mjs::anchorStatus —
-- the anchored head must still exist at its seq with its digest, and a snapshot
-- at-or-after the anchored generation must exist. Either failing →
-- 'ledger-behind-anchor' (a restored/rolled-back file, fail closed).
SELECT 1 FROM events WHERE workflow_id=? AND seq=? AND digest=?;
SELECT 1 FROM state_snapshots WHERE workflow_id=? AND generation>=? LIMIT 1;

-- ---------------------------------------------------------------------------
-- LIVENESS — "what still binds a workflow to this ledger"
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::liveRows — leases + unsettled jobs; EMPTY means the
-- workflow may be retired
SELECT job_id,resource_key FROM leases WHERE workflow_id=? ORDER BY job_id,resource_key;
SELECT job_id,status,generation FROM jobs WHERE workflow_id=? AND status NOT IN ('succeeded','failed','cancelled') ORDER BY job_id;

-- ---------------------------------------------------------------------------
-- ENUMERATION — ledgerWorkflows: every workflow the ledger holds a row for
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::ledgerWorkflows — ids unioned across six tables
SELECT DISTINCT workflow_id FROM workflows;
SELECT DISTINCT workflow_id FROM state_snapshots;
SELECT DISTINCT workflow_id FROM jobs;
SELECT DISTINCT workflow_id FROM events;
SELECT DISTINCT workflow_id FROM leases;
SELECT DISTINCT workflow_id FROM incidents;
-- per-id counts for the same report
SELECT count(*) n FROM state_snapshots WHERE workflow_id=?;
SELECT count(*) n FROM jobs WHERE workflow_id=?;
SELECT count(*) n FROM events WHERE workflow_id=?;

-- ---------------------------------------------------------------------------
-- RETENTION — pruneRetiredGenerations: a retired generation keeps no settled
-- jobs and none of their events; live reservations and unsettled jobs survive
-- whatever their generation (journal.mjs RETENTION, ported whole).
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::pruneRetiredGenerations
DELETE FROM jobs WHERE workflow_id=? AND generation<? AND status IN ('succeeded','failed','cancelled')
  AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.job_id=jobs.job_id);
DELETE FROM events WHERE workflow_id=? AND generation<?
  AND (entity_type<>'job' OR NOT EXISTS (SELECT 1 FROM jobs j WHERE j.job_id=events.entity_id));

-- ---------------------------------------------------------------------------
-- RETIREMENT — retireWorkflow: refuses while liveRows is non-empty; then drops
-- every row keyed on the workflow, finally its `workflows` registration.
-- preserveRuntimeCustody keeps the latest state body + newest receipt per
-- runtime file (the workflows row must then stay too — the kept snapshot
-- references it).
-- ---------------------------------------------------------------------------

-- custody-preserved variant picks:
SELECT snapshot_id,generation FROM state_snapshots WHERE workflow_id=? AND state_json<>'' ORDER BY generation DESC,snapshot_id DESC LIMIT 1;
SELECT max(seq) seq FROM events WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written' GROUP BY entity_id;
DELETE FROM state_snapshots WHERE workflow_id=? AND snapshot_id<>?;

-- the unconditional drops (one DELETE per keyed table)
DELETE FROM state_snapshots WHERE workflow_id=?;
DELETE FROM jobs WHERE workflow_id=?;
DELETE FROM events WHERE workflow_id=?;                    -- or ... AND seq NOT IN (<kept seqs>) under custody
DELETE FROM incidents WHERE workflow_id=?;
DELETE FROM goals WHERE workflow_id=?;
DELETE FROM reports WHERE workflow_id=?;
DELETE FROM contracts WHERE workflow_id=?;
DELETE FROM checks WHERE workflow_id=?;
DELETE FROM inbox WHERE workflow_id=?;
DELETE FROM inputs WHERE workflow_id=?;
DELETE FROM signals WHERE scope=?;                         -- scope IS the workflow id
DELETE FROM workflows WHERE workflow_id=?;                 -- last, and only in the non-custody path

-- ---------------------------------------------------------------------------
-- HOUSEKEEPING on open — openLedger order: migrate → record journal_mode →
-- compact → reclaim. None of these are optional; a handle that skips them is
-- inspectLedger (read-only).
-- ---------------------------------------------------------------------------
PRAGMA wal_checkpoint(TRUNCATE);      -- runCheckpoint / checkpointLedger — before ANY file copy (§3)
PRAGMA incremental_vacuum;            -- reclaimSpace (journal.mjs) — freed pages back to the FS
PRAGMA user_version;                  -- migrateLedger/migrateMachine version gate
PRAGMA auto_vacuum;                   -- read back to report the achieved mode
SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta';     -- pre-meta v1 ledger backfill probe
SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='events_digest_chain';  -- trigger backfill probe
