-- ============================================================================
-- queries/migration.sql — every statement `scripts/ledger/ledger-migrate.mjs` runs:
-- reads against the RETIRED journal (journal.sqlite, schema
-- starci/operational-journal@1) and writes into the ledger + machine DB.
-- Nothing is deleted from the sources; the `migrations` table is what makes a
-- second run a no-op.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- JOURNAL-SIDE READS (collectWorkflow / collectShared / the reconcile refusal)
-- ---------------------------------------------------------------------------

-- the reconcile refusal (§10): an unsettled job BEHIND the state.json
-- generation is kernel reconcile work, not migrator work → 'kernel-reconcile-required'
SELECT job_id FROM jobs WHERE workflow_id=? AND generation<? AND status NOT IN ('succeeded','failed','cancelled');

-- per-workflow journal rows, imported in the order they were recorded
SELECT * FROM events WHERE workflow_id=? ORDER BY seq;                 -- events (old chain recomputed on import)
SELECT * FROM jobs WHERE workflow_id=? ORDER BY created_at,job_id;
SELECT * FROM leases WHERE workflow_id=? ORDER BY acquired_at,resource_key,job_id;
SELECT * FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id; -- kept as older checkpoints
SELECT * FROM incidents WHERE workflow_id=?;
SELECT br.scope_key,br.job_id,br.units FROM budget_reservations br JOIN jobs j ON j.job_id=br.job_id WHERE j.workflow_id=?;

-- journal-global rows have no workflow scope: imported once under '#shared'
SELECT 1 FROM sqlite_master WHERE name=?;                              -- table-existence probe
SELECT * FROM resources ORDER BY resource_key;
SELECT * FROM budgets ORDER BY scope_key;

-- ---------------------------------------------------------------------------
-- LEDGER-SIDE WRITES (ledgerApply) — all inside one ledger.transaction
-- ---------------------------------------------------------------------------

INSERT INTO workflows(workflow_id,title,created_at,updated_at,ledger_mode,source_roots_json,generation,goal_identity,phase,finished_json,pin_digest) VALUES(?,?,?,?,?,?,?,?,?,?,?);
INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?);

-- events are re-chained on import: the migrator recomputes prev_digest/digest
-- per row (eventDigest mirrors ledger-db's digestOf); the original file seq is
-- preserved inside payload_json._seq, never as the seq column
INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?);

INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,events_head,created_at) VALUES(?,?,?,?,?,?,?);
-- plus the imported live state as checkpoint 'import:<id>:<gen>' with events_head = the new chain head

INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,lease_token,worker_id,deadline,result_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);

-- machine-scoped leases carry their own token into machine_ref (the pair the
-- sweep reconciles)
INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?);

INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?);

-- repo-scoped shared state only (machine:* / ai/* scopes go to machine.sqlite)
INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,?);
INSERT OR IGNORE INTO budgets(scope_key,limit_value,used_value,reserved_value) VALUES(?,?,?,?);
INSERT OR IGNORE INTO budget_reservations(scope_key,job_id,units) VALUES(?,?,?);

INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,created_at) VALUES(?,?,?,?,?,?,?,?,?);
INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,created_at) VALUES(?,?,?,?,?,?);
INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?);
INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'pending',?);
-- inputs are written via ledger.inputs.put (digest computed at write), then:
UPDATE workflows SET updated_at=? WHERE workflow_id=?;                 -- restore the imported timestamp

-- ---------------------------------------------------------------------------
-- migrations — the idempotency + provenance record. One row per source;
-- readMigrations seeds the skip set for a second run.
-- ---------------------------------------------------------------------------

SELECT source FROM migrations;                                          -- readMigrations / prior set

INSERT INTO migrations(source,kind,rows_json,at) VALUES(?,?,?,?);
-- kinds observed: 'workflow-dir' (the _local/workflows/<id> dir + per-table
-- counts), 'journal-workflow' (<journal>#<id> + row counts), 'journal-shared'
-- (<journal>#shared + resource/budget counts), 'workflow-inputs' (inputs dir +
-- imported/lost), 'workflow-anchor' (<dir>#anchor + the checkpoint the anchor
-- was written at), 'local-family-deleted' (§13 families reported
-- deleted-not-imported: name + bytes + files + entries).
