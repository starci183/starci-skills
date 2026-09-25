-- ============================================================================
-- machine.sql — the machine registry `%LOCALAPPDATA%/StarCi/runtime/machine.sqlite`
-- (schema `starci/machine-db@1`, MACHINE_VERSION=1). This is the EXECUTED source
-- of truth: `engine/ledger-db.mjs` reads and db.exec()s this file inside the v1
-- create transaction (migrateMachine); checked against `docs/ledger-db.md` §4.
--
-- The live table is `ledgers`: the host's registry of every runtime.sqlite,
-- written by reserveTwoPhase (registerLedger) and read by scripts/agent/balance.mjs
-- and scripts/kernel/prune-registry.mjs. `resources`, `leases`, `budgets` and
-- `budget_reservations` are reserved: no runtime writer. They stay so the table
-- shape of existing registries never changes.
--
-- Open facts (openMachine): foreign_keys=ON, synchronous=FULL, journal_mode=WAL
-- requested, user_version=1 set in the create transaction. busy_timeout 15s.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ledgers — the registry of every runtime.sqlite this arbiter has seen.
-- ledger_id is the ledger's own meta.ledger_id (a UUID minted at create, stored
-- INSIDE the ledger — never derived from the path, so a renamed/junctioned/UNC
-- checkout keeps its leases). `file` is only the last known path, refreshed on
-- every register.
-- ----------------------------------------------------------------------------
CREATE TABLE ledgers(ledger_id TEXT PRIMARY KEY, file TEXT NOT NULL, registered_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);

-- ----------------------------------------------------------------------------
-- resources — reserved.
-- ----------------------------------------------------------------------------
CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));

-- ----------------------------------------------------------------------------
-- leases — reserved. pruneRegistry keeps a `ledgers` row that still owns one.
-- ----------------------------------------------------------------------------
CREATE TABLE leases(
  resource_key TEXT NOT NULL, token TEXT NOT NULL, ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
  workflow_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0),
  acquired_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(resource_key,token));
CREATE INDEX machine_leases_expiry ON leases(expires_at);

-- ----------------------------------------------------------------------------
-- budgets / budget_reservations — reserved. pruneRegistry keeps a `ledgers` row
-- that still owns a reservation.
-- ----------------------------------------------------------------------------
CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL, used_value INTEGER NOT NULL DEFAULT 0, reserved_value INTEGER NOT NULL DEFAULT 0);
CREATE TABLE budget_reservations(scope_key TEXT NOT NULL, ledger_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL, PRIMARY KEY(scope_key,ledger_id,job_id));
