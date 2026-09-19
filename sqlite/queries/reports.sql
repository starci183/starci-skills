-- ============================================================================
-- queries/reports.sql — the worker↔kernel IPC tables: contracts (kernel→worker,
-- read via `starci op-contract`), reports (worker→kernel, written by
-- `starci report`), checks (kernel's re-run results per attempt).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reports — worker → kernel. UNIQUE(workflow_id,dispatch_id) makes one dispatch
-- idempotent; a re-report UPSERTs rather than duplicating.
-- ---------------------------------------------------------------------------

-- source: store.mjs::writeReport — outcome required; COALESCE keeps the earlier
-- op/attempt/generation when a re-report omits them
INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,created_at)
  VALUES(?,?,?,?,?,?,?,?,?)
  ON CONFLICT(workflow_id,dispatch_id) DO UPDATE SET
    op_id=COALESCE(excluded.op_id,reports.op_id),
    attempt=COALESCE(excluded.attempt,reports.attempt),
    generation=COALESCE(excluded.generation,reports.generation),
    outcome=excluded.outcome,
    report_json=excluded.report_json,
    from_terminal=COALESCE(excluded.from_terminal,reports.from_terminal),
    created_at=excluded.created_at;

-- source: store.mjs::readReports — every report of a workflow; consumed_at is
-- surfaced so the kernel can skip already-integrated ones
SELECT * FROM reports WHERE workflow_id=? ORDER BY dispatch_id;

-- source: kernel.mjs::reportJsonBytes (~588) — the immutable bytes a report row
-- was written with; the ledger's replacement for a report file's sha256
SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=?;

-- source: kernel.mjs::archiveOpReport (~1892) + owner.mjs (~223) — mark a report
-- consumed so it is never re-read as an answer (e.g. an op that became an ask)
UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL;

-- source: store.mjs::exportTo — workflow-export's human-readable file layout
SELECT dispatch_id,report_json FROM reports WHERE workflow_id=? ORDER BY dispatch_id;

-- TODO-missing: no "pending reports" query (WHERE consumed_at IS NULL across a
-- workflow) — the kernel lists all reports and filters in JS.

-- ---------------------------------------------------------------------------
-- contracts — kernel → worker. PK (workflow_id,op_id,attempt): one row per attempt.
-- ---------------------------------------------------------------------------

-- source: store.mjs::writeContract — INSERT OR REPLACE: a rewrite of the same
-- attempt's contract replaces it
INSERT OR REPLACE INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at)
  VALUES(?,?,?,?,?,?,?);

-- source: store.mjs::readContract — latest attempt when attempt is omitted
SELECT * FROM contracts WHERE workflow_id=? AND op_id=? ORDER BY attempt DESC LIMIT 1;
SELECT * FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?;

-- source: store.mjs::exportTo
SELECT op_id,attempt,markdown body FROM contracts WHERE workflow_id=? ORDER BY op_id,attempt;

-- ---------------------------------------------------------------------------
-- checks — kernel's own re-run check results, keyed identically to contracts.
-- ---------------------------------------------------------------------------

-- source: store.mjs::writeChecks / readChecks
INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?);
SELECT * FROM checks WHERE workflow_id=? AND op_id=? ORDER BY attempt DESC LIMIT 1;
SELECT * FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?;

-- source: store.mjs::exportTo
SELECT op_id,attempt,checks_json body FROM checks WHERE workflow_id=? ORDER BY op_id,attempt;
