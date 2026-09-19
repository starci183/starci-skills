-- ============================================================================
-- queries/inbox-signals.sql — owner→kernel inbox, keyed process signals
-- (locks/flags as rows), and the supervisor's runtime_loads provider view.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- inbox — owner answers, amendments, late inputs. Append-only pending rows;
-- the kernel settles each applied/rejected.
-- ---------------------------------------------------------------------------

-- source: store.mjs::inbox.push — arrives pending
INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'pending',?);

-- source: store.mjs::inbox.pending — what the kernel still has to integrate
SELECT * FROM inbox WHERE workflow_id=? AND status='pending' ORDER BY inbox_id;

-- source: store.mjs::inbox.settle — applied/rejected with a disposition record
UPDATE inbox SET status=?,disposition_json=?,applied_at=? WHERE workflow_id=? AND inbox_id=?;

-- ---------------------------------------------------------------------------
-- signals — keyed process facts replacing the old dot-files. scope =
-- workflow_id, or '*' ledger-wide. Known keys: kernel-lock, supervisor-lock,
-- stop, inputs-lock, launch, final-report. holder_pid + token + expires_at
-- fence a lock the way lease_token fences a job.
-- OBSERVED: expires_at is evaluated in JS after the read — no query filters on it.
-- ---------------------------------------------------------------------------

-- source: launch.mjs::signalRow (also store.mjs::signal.get)
SELECT * FROM signals WHERE scope=? AND key=?;

-- source: continuation.mjs — the kernel-lock row for the continuation boundary
SELECT holder_pid,token,value_json,at,expires_at FROM signals WHERE scope=? AND key='kernel-lock';

-- source: store.mjs::listWorkflows — per-workflow lock + stop flag for the list view
SELECT holder_pid,value_json,at FROM signals WHERE scope=? AND key=?;

-- source: launch.mjs::setSignal (upsert) / store.mjs::signal.set (INSERT OR REPLACE)
INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?)
  ON CONFLICT(scope,key) DO UPDATE SET holder_pid=excluded.holder_pid,token=excluded.token,
    value_json=excluded.value_json,at=excluded.at,expires_at=excluded.expires_at;
INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?);

-- source: launch.mjs::clearSignal / store.mjs::signal.clear
DELETE FROM signals WHERE scope=? AND key=?;

-- source: ledger-db.mjs::retireWorkflow — a workflow's signal scope dies with it
DELETE FROM signals WHERE scope=?;

-- ---------------------------------------------------------------------------
-- runtime_loads — supervisor's provider-load view. Rows prefixed
-- 'ai/provider:' are provider entries; the rest are runtime entries
-- (loads.mjs::readRows splits on the prefix).
-- ---------------------------------------------------------------------------

-- source: loads.mjs::readRows — the whole view
SELECT runtime,loads_json FROM runtime_loads;

-- source: loads.mjs::writeRuntimes — adopt: rewrite runtime rows, never touch
-- provider rows
DELETE FROM runtime_loads WHERE runtime NOT LIKE 'ai/provider:%';
INSERT INTO runtime_loads(runtime,loads_json,at) VALUES(?,?,?);

-- source: loads.mjs::recordProviderLoads — upsert provider rows under one tx
INSERT INTO runtime_loads(runtime,loads_json,at) VALUES(?,?,?)
  ON CONFLICT(runtime) DO UPDATE SET loads_json=excluded.loads_json,at=excluded.at;

-- source: loads.mjs::readProviderLoads — the provider projection
SELECT max(at) at FROM runtime_loads WHERE runtime LIKE 'ai/provider:%';
SELECT runtime,loads_json FROM runtime_loads WHERE runtime LIKE 'ai/provider:%';
