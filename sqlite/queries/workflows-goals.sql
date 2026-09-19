-- ============================================================================
-- queries/workflows-goals.sql — workflow registration and the append-only
-- goals table, plus the ledger's own `meta` identity row.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- meta — identity facts
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::ledgerIdOf — THE identity, never derived from a path
SELECT value FROM meta WHERE key='ledger_id';

-- source: ledger-db.mjs::openLedger — journal_mode kept in step with the mode
-- this open actually achieved (WAL, or its DELETE fallback on UNC/network paths)
INSERT INTO meta(key,value) VALUES('journal_mode',?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value;

-- source: ledger-db.mjs::seedMeta — create-time seeding (INSERT OR IGNORE:
-- identity is minted once, never rewritten)
INSERT OR IGNORE INTO meta(key,value) VALUES(?,?);   -- 'ledger_id'|'schema'|'created_at'

-- ---------------------------------------------------------------------------
-- workflows — registration and heartbeat columns
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::ensureWorkflow — insert-if-absent, always touch updated_at
INSERT OR IGNORE INTO workflows(workflow_id,title,created_at,updated_at,ledger_mode,source_roots_json) VALUES(?,?,?,?,?,?);
UPDATE workflows SET updated_at=? WHERE workflow_id=?;

-- source: store.mjs::createStore — the migration gate: a `_local` dir without
-- this row is `ledger-unmigrated`
SELECT 1 FROM workflows WHERE workflow_id=?;

-- source: kernel.mjs::workflowKnownAt (~4485) — same existence test via
-- inspectLedger when resolving which repo's ledger owns a workflow
SELECT 1 FROM workflows WHERE workflow_id=?;

-- source: store.mjs::currentGeneration — the bound generation an unbound event
-- is filed under (0 only for a never-enrolled workflow)
SELECT generation FROM workflows WHERE workflow_id=?;

-- source: store.mjs::touch — per-save touch: phase/goal_identity/finished fill
-- in when present, never blanked by an absent field
UPDATE workflows SET updated_at=?,phase=COALESCE(?,phase),goal_identity=COALESCE(?,goal_identity),finished_json=COALESCE(?,finished_json)
  WHERE workflow_id=?;

-- source: store.mjs::bindJournal — the durable binding stamps generation+goal
UPDATE workflows SET generation=?,goal_identity=?,updated_at=? WHERE workflow_id=?;

-- source: store.mjs::setGoal — goal identity follows the newest revision
UPDATE workflows SET goal_identity=?,updated_at=? WHERE workflow_id=?;

-- source: store.mjs::listWorkflows — the workflow-list view: registration +
-- newest state body joined; last event and kernel lock read per row
SELECT w.workflow_id id,w.updated_at,
    (SELECT s.state_json FROM state_snapshots s WHERE s.workflow_id=w.workflow_id AND s.state_json<>'' ORDER BY s.snapshot_id DESC LIMIT 1) state_json
  FROM workflows w ORDER BY w.workflow_id DESC;

-- source: hosts/orca/launch.mjs (~877) — retirement decision input
SELECT finished_json FROM workflows WHERE workflow_id=?;

-- source: ledger-migrate.mjs::ledgerApply — import of one workflow row
INSERT INTO workflows(workflow_id,title,created_at,updated_at,ledger_mode,source_roots_json,generation,goal_identity,phase,finished_json,pin_digest)
  VALUES(?,?,?,?,?,?,?,?,?,?,?);

-- source: ledger-migrate.mjs (~163) — inputs.put bumps updated_at via
-- ensureWorkflow; the import restores the imported value
UPDATE workflows SET updated_at=? WHERE workflow_id=?;

-- ---------------------------------------------------------------------------
-- goals — append-only revisions
-- ---------------------------------------------------------------------------

-- source: store.mjs::goal — current revision
SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1;

-- source: store.mjs::setGoal — next revision inside one transaction
SELECT max(revision) latest FROM goals WHERE workflow_id=?;
INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,amendment_json,created_at) VALUES(?,?,?,?,?,?,?);

-- source: store.mjs::reviseGoalMarkdown — a re-render of the SAME revision is an
-- UPDATE, never a new row (a revision is what goal.revise/workflow-amend moves)
SELECT revision FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1;
UPDATE goals SET markdown=? WHERE workflow_id=? AND revision=?;

-- source: ledger-migrate.mjs::ledgerApply — imported goal at its own revision
INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?);
