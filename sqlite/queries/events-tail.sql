-- ============================================================================
-- queries/events-tail.sql — the hash-chained event log (entity_type
-- 'workflow' = audit trail; 'job' = custody/job receipts; 'runtime-file' =
-- acknowledged file writes). seq is the workflow-wide order; the digest chain
-- (prev_digest || event_id || kind || payload_json || created_at → sha256) is
-- enforced by the events_digest_chain TRIGGER, so writers may supply or omit
-- digests and the stored chain is always recomputed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- APPEND
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::openLedger.appendEvent (digest computed in JS; the
-- trigger recomputes it identically, so either path lands the same row)
INSERT OR IGNORE INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at)
  VALUES(?,?,?,?,?,?,?,?,?,?);

-- source: store.mjs::insertEvent — same shape; `ignore` flag flips INSERT ↔
-- INSERT OR IGNORE (transition receipts must not double-land)
INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at)
  VALUES(?,?,?,?,?,?,?,?,?,?);

-- source: jobs.mjs::complete — the job settlement receipt deliberately OMITS
-- prev_digest/digest; `digest DEFAULT ''` keeps NOT NULL satisfied and the
-- trigger fills the real chain values. Do NOT hand-roll this INSERT with a
-- computed digest elsewhere — engine.mjs:515 notes a hand-rolled row with a
-- missing digest silently vanishes under INSERT OR IGNORE.
INSERT INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at)
  VALUES(?,?,?,?,?,?,?,?);

-- read-back of what was appended
SELECT * FROM events WHERE event_id=?;                    -- appendEvent / dedupe (jobs.complete)
SELECT seq FROM events WHERE event_id=?;                  -- store.insertEvent return

-- ---------------------------------------------------------------------------
-- TAIL / REPLAY
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::eventsHead — the chain head (what a new row links to)
SELECT digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1;

-- source: store.mjs::anchorCheckpoint + hosts/orca/launch.mjs::ledgerAnchorWrite
SELECT seq,digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1;

-- source: ledger-db.mjs::readAccessors.events (dynamic WHERE) — full replay,
-- optionally after a seq
SELECT * FROM events WHERE 1=1 AND workflow_id=? AND seq>? ORDER BY seq;

-- source: store.mjs::readEvents — the WORKFLOW audit lines only (what
-- `workflow-tail` renders)
SELECT seq,payload_json,created_at FROM events
  WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? AND seq>? ORDER BY seq;

-- source: store.mjs::listWorkflows — newest audit line per workflow
SELECT seq,payload_json,created_at FROM events
  WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? ORDER BY seq DESC LIMIT 1;

-- source: supervisor.mjs::inspectWorkflow — last activity heartbeat of a workflow
SELECT kind,created_at FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1;

-- ---------------------------------------------------------------------------
-- CUSTODY / RECEIPTS — runtime-file acknowledgement events
-- ---------------------------------------------------------------------------

-- source: candidate-bridge.mjs::lastCustodySeq — where custody observation starts
SELECT COALESCE(max(seq),0) AS seq FROM events
  WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written';

-- source: candidate-bridge.mjs::custodyReceipt — find the exact post-baseline
-- receipt for a file (payload carries file/sha256/size/state)
SELECT seq,event_id,payload_json FROM events
  WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written'
    AND seq>? ORDER BY seq DESC;

-- source: ledger-db.mjs::retireWorkflow(preserveRuntimeCustody) — newest receipt
-- per runtime file, kept when the rest of the workflow is retired
SELECT max(seq) seq FROM events
  WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written'
  GROUP BY entity_id;

-- ---------------------------------------------------------------------------
-- CHAIN VERIFICATION — the full ordered walk; verifyChain recomputes each link
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::verifyChain — rows in order; JS recomputes digest and
-- compares prev_digest link-by-link. First retained row's prev_digest is the
-- seed (retention may have legitimately deleted its predecessor — the
-- truncation stays VISIBLE rather than failing the walk).
SELECT seq,event_id,kind,payload_json,created_at,prev_digest,digest
  FROM events WHERE workflow_id=? ORDER BY seq;

-- ---------------------------------------------------------------------------
-- RETENTION / RETIREMENT deletes (full set in verify-retire.sql)
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::pruneRetiredGenerations
DELETE FROM events WHERE workflow_id=? AND generation<?
  AND (entity_type<>'job' OR NOT EXISTS (SELECT 1 FROM jobs j WHERE j.job_id=events.entity_id));

-- source: ledger-db.mjs::retireWorkflow
DELETE FROM events WHERE workflow_id=?;
DELETE FROM events WHERE workflow_id=? AND seq NOT IN (<kept custody receipt seqs>);
