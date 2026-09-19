-- ============================================================================
-- queries/machine-arbiter.sql — statements run against machine.sqlite
-- (the cross-ledger arbiter, NOT the ledger). Two files cannot share a
-- transaction, so this is the one place 1.0.4 DETECTS drift instead of making
-- it unrepresentable — bounded to ai/* quota and machine budgets, all TTL'd,
-- all swept on the supervisor tick (docs/ledger-db.md §6).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- REGISTRY — which ledgers exist and where they were last seen
-- ---------------------------------------------------------------------------

-- source: ledger-db.mjs::openMachine.registerLedger — ledger_id is the ledger's
-- meta.ledger_id, never derived from the path; `file` is refreshed every open.
INSERT INTO ledgers(ledger_id,file,registered_at,seen_at) VALUES(?,?,?,?)
  ON CONFLICT(ledger_id) DO UPDATE SET file=excluded.file,seen_at=excluded.seen_at;

-- ---------------------------------------------------------------------------
-- RESERVE — machine.reserve: one tiny transaction of its own
-- ---------------------------------------------------------------------------

-- expire first, then check declared capacity and current usage
DELETE FROM leases WHERE expires_at<=?;
SELECT capacity FROM resources WHERE resource_key=?;
SELECT COALESCE(SUM(units),0) u FROM leases WHERE resource_key=?;

-- insert the reservation; the returned token is what lands in the ledger's
-- leases.machine_ref as the pair
INSERT INTO leases(resource_key,token,ledger_id,workflow_id,job_id,units,acquired_at,expires_at)
  VALUES(?,?,?,?,?,?,?,?);

-- ---------------------------------------------------------------------------
-- RELEASE / RENEW
-- ---------------------------------------------------------------------------

-- source: machine.release — tokens from the ledger's machine_ref values
DELETE FROM leases WHERE token=?;

-- source: admission.mjs::renew — heartbeat bumps the paired machine token too
UPDATE leases SET expires_at=? WHERE token=?;

-- ---------------------------------------------------------------------------
-- SWEEP — machine.sweep: delete expired rows and rows whose paired ledger
-- lease no longer exists (proven by reopening the ledger read-only at
-- ledgers.file and matching meta.ledger_id — a different id proves the ledger
-- moved, never that the lease is live).
-- ---------------------------------------------------------------------------

DELETE FROM leases WHERE expires_at<=?;

-- group live machine leases by the ledger that owns them
SELECT l.resource_key,l.token,l.ledger_id,l.job_id,g.file
  FROM leases l JOIN ledgers g ON g.ledger_id=l.ledger_id;

-- run AGAINST THE INSPECTED LEDGER (read-only), per grouped row:
-- does the paired lease still exist? if not → orphan → delete machine row
SELECT 1 FROM leases WHERE job_id=? AND machine_ref=? LIMIT 1;
DELETE FROM leases WHERE resource_key=? AND token=?;

-- ---------------------------------------------------------------------------
-- CAPACITY / BUDGETS
-- ---------------------------------------------------------------------------

-- source: openMachine.setCapacity / admission.mjs::setCapacity (machine-scoped keys)
INSERT INTO resources(resource_key,capacity) VALUES(?,?)
  ON CONFLICT(resource_key) DO UPDATE SET capacity=excluded.capacity;

-- source: engine.mjs (~319) — declared per-provider quota for the load view
SELECT resource_key,capacity FROM resources WHERE resource_key LIKE 'ai/provider:%' ORDER BY resource_key;

-- source: ledger-migrate.mjs::machineApply — journal import of ai/* state
INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,?);
INSERT OR IGNORE INTO budgets(scope_key,limit_value,used_value,reserved_value) VALUES(?,?,?,?);
INSERT OR IGNORE INTO leases(resource_key,token,ledger_id,workflow_id,job_id,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?);
INSERT OR IGNORE INTO budget_reservations(scope_key,ledger_id,job_id,units) VALUES(?,?,?,?);
