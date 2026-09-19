-- ============================================================================
-- queries/state-snapshots.sql — the recovery state. checkpoint_id namespaces
-- the write kind ('save:'/'bind:'/'transition:'/'import:'), and retention
-- (compactSnapshots, ported from the retired journal) keeps the bound
-- (workflow,generation,goal_identity) to ONE body + transition/bind rows +
-- only the latest save row. Retired generations keep nothing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- WRITE
-- ---------------------------------------------------------------------------

-- source: store.mjs::insertSnapshot — `ignore` flips INSERT ↔ INSERT OR IGNORE;
-- transitions use plain INSERT because a replayed transitionId must throw
-- (idempotency is checked by checkpoint_id first, see below).
INSERT OR IGNORE INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,events_head,created_at)
  VALUES(?,?,?,?,?,?,?);

-- source: store.mjs::transition — the idempotency probe before replaying
SELECT 1 FROM state_snapshots WHERE checkpoint_id=?;

-- ---------------------------------------------------------------------------
-- READ — "where does this workflow resume"
-- ---------------------------------------------------------------------------

-- source: store.mjs::latestBody — newest non-empty body; generation/goal filters
-- optional (durable binding scopes by both)
SELECT state_json FROM state_snapshots
  WHERE workflow_id=? AND state_json<>'' AND generation=? AND goal_identity=?
  ORDER BY snapshot_id DESC LIMIT 1;

-- source: store.mjs::bindJournal — refuse binding to a generation whose durable
-- snapshot belongs to a different approved goal
SELECT goal_identity FROM state_snapshots WHERE workflow_id=? AND generation=? ORDER BY snapshot_id DESC LIMIT 1;
SELECT 1 FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? LIMIT 1;
SELECT checkpoint_id FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? ORDER BY snapshot_id DESC LIMIT 1;

-- source: continuation.mjs::ledgerFacts — the continuation boundary's snapshot row
SELECT checkpoint_id,generation,goal_identity,state_json,events_head,created_at
  FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id DESC LIMIT 1;

-- source: terminals.mjs::siblingKernelGone — is a sibling workflow finished?
SELECT state_json FROM state_snapshots WHERE workflow_id=? AND state_json<>'' ORDER BY snapshot_id DESC LIMIT 1;

-- source: candidate-bridge.mjs::durableProjection / latestProjection — the
-- durable state a foreign workflow enrolled under, read-only via inspectLedger
SELECT goal_identity,state_json FROM state_snapshots
  WHERE workflow_id=? AND generation=? AND state_json<>'' ORDER BY snapshot_id DESC LIMIT 1;
SELECT generation,goal_identity,state_json FROM state_snapshots
  WHERE workflow_id=? AND state_json<>'' ORDER BY snapshot_id DESC LIMIT 1;

-- source: candidate-bridge.mjs::runtimeWriters — enumerate every foreign
-- runtime writer sharing this ledger: newest body per workflow
SELECT s.workflow_id,s.goal_identity,s.state_json FROM state_snapshots s
  WHERE s.state_json<>'' AND s.snapshot_id=(SELECT max(snapshot_id) FROM state_snapshots WHERE workflow_id=s.workflow_id);

-- source: ledger-db.mjs::verifyAnchor / hosts/orca/launch.mjs::anchorStatus —
-- does the ledger still reach the anchor's generation?
SELECT 1 FROM state_snapshots WHERE workflow_id=? AND generation>=? LIMIT 1;

-- source: hosts/orca/launch.mjs::ledgerAnchorWrite — checkpoint the anchor points at
SELECT checkpoint_id,generation FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id DESC LIMIT 1;

-- source: ledger-db.mjs::retireWorkflow(preserveRuntimeCustody) — the one body
-- that stays when custody receipts are preserved
SELECT snapshot_id,generation FROM state_snapshots
  WHERE workflow_id=? AND state_json<>'' ORDER BY generation DESC,snapshot_id DESC LIMIT 1;

-- ---------------------------------------------------------------------------
-- RETENTION — compactSnapshots (ledger-db.mjs:69-83 = journal.mjs:54-68)
-- bound form (workflow_id,generation,goal_identity all given):
-- ---------------------------------------------------------------------------
UPDATE state_snapshots SET state_json=''
  WHERE workflow_id=? AND generation=? AND goal_identity=? AND state_json<>''
    AND snapshot_id NOT IN (SELECT snapshot_id FROM state_snapshots
      WHERE workflow_id=? AND generation=? AND goal_identity=? ORDER BY snapshot_id DESC LIMIT ?);
DELETE FROM state_snapshots
  WHERE workflow_id=? AND generation=? AND checkpoint_id LIKE 'save:%'
    AND snapshot_id<>(SELECT max(snapshot_id) FROM state_snapshots WHERE workflow_id=? AND generation=?);
DELETE FROM state_snapshots WHERE workflow_id=? AND generation<?;

-- unbound form (each workflow's newest generation is the bound one):
DELETE FROM state_snapshots WHERE 1=1 AND generation<
  (SELECT max(generation) FROM state_snapshots m WHERE m.workflow_id=state_snapshots.workflow_id);
UPDATE state_snapshots SET state_json='' WHERE state_json<>''
  AND snapshot_id NOT IN (SELECT snapshot_id FROM state_snapshots s
    WHERE s.workflow_id=state_snapshots.workflow_id AND s.generation=state_snapshots.generation
      AND s.goal_identity=state_snapshots.goal_identity ORDER BY s.snapshot_id DESC LIMIT ?);
DELETE FROM state_snapshots WHERE checkpoint_id LIKE 'save:%'
  AND snapshot_id<>(SELECT max(snapshot_id) FROM state_snapshots s
    WHERE s.workflow_id=state_snapshots.workflow_id AND s.generation=state_snapshots.generation);

-- ---------------------------------------------------------------------------
-- ENUMERATION / RETIREMENT
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::ledgerWorkflows — distinct workflow ids + row counts
SELECT DISTINCT workflow_id FROM state_snapshots;
SELECT count(*) n FROM state_snapshots WHERE workflow_id=?;

-- source: ledger-db.mjs::retireWorkflow
DELETE FROM state_snapshots WHERE workflow_id=?;
DELETE FROM state_snapshots WHERE workflow_id=? AND snapshot_id<>?;   -- keep the custody body
