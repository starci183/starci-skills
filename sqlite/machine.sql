-- ============================================================================
-- machine.sql — the machine arbiter `%LOCALAPPDATA%/StarCi/runtime/machine.sqlite`
-- (schema `starci/machine-db@1`, MACHINE_VERSION=1), extracted VERBATIM from
-- `.dist/kernel/ledger-db.mjs` (const MACHINE_DDL) and checked against
-- `.dist/docs/ledger-db.md` §5.
--
-- WHY A SECOND FILE (§1/§2/§6): one transaction cannot span two SQLite files, and
-- repo fences are per-ledger — but `ai/*` provider quota and `machine:*` budgets
-- are shared across EVERY ledger on the host (the global ceiling of ten admitted
-- AI jobs). So exactly the cross-ledger rows live here, in a table small enough
-- to be reconciled by TTL. Everything else stays in the ledger.
--
-- THE ONE DRIFT SEAM (§6): reserveTwoPhase commits ledger job+lease rows, then
-- takes each ai/*/machine:* need here in its own tiny transaction, and mirrors
-- it back into a ledger lease carrying `machine_ref = token`. A crash between
-- the two leaves a machine row with no ledger row; `machine.sweep()` (run on the
-- supervisor tick) deletes machine leases that are expired OR whose
-- (ledger_id,job_id) no longer holds the paired ledger lease — proven by
-- reopening the registered ledger READ-ONLY and matching meta.ledger_id. A
-- ledger file that now holds a different meta.ledger_id proves the old ledger
-- moved; its machine leases are left to TTL, never swept on a path guess.
-- A stale machine row costs a delayed admission, never a wrong one.
--
-- Open facts (openMachine): foreign_keys=ON, synchronous=FULL, journal_mode=WAL
-- requested, user_version=1 set in the create transaction. busy_timeout 15s.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ledgers — the registry of every runtime.sqlite this arbiter has seen.
-- ledger_id is the ledger's own meta.ledger_id (a UUID minted at create, stored
-- INSIDE the ledger — never derived from the path, so a renamed/junctioned/UNC
-- checkout keeps its leases). `file` is only the last known path, refreshed on
-- every register, and used to reopen the ledger read-only for the sweep.
-- What a row lets the arbiter decide: where to look when proving a machine
-- lease's paired ledger lease is gone.
-- ----------------------------------------------------------------------------
CREATE TABLE ledgers(ledger_id TEXT PRIMARY KEY, file TEXT NOT NULL, registered_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);

-- ----------------------------------------------------------------------------
-- resources — capacity declarations for the cross-ledger resources only:
-- `ai/global` (the global admitted-AI ceiling) and `ai/provider:<name>` (per-
-- provider quota), plus any `machine:*` scope. Repo fences never appear here.
-- ----------------------------------------------------------------------------
CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));

-- ----------------------------------------------------------------------------
-- leases — live cross-ledger reservations. PK (resource_key,token): the token
-- is the machine-side identity that lands in the ledger's leases.machine_ref.
-- No FK to a job: the job row lives in the caller's ledger, unreachable from
-- here — which is exactly why the sweep must PROVE the pair is gone through
-- `ledgers.file` rather than trust a foreign key.
-- ----------------------------------------------------------------------------
CREATE TABLE leases(
  resource_key TEXT NOT NULL, token TEXT NOT NULL, ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
  workflow_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0),
  acquired_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(resource_key,token));
CREATE INDEX machine_leases_expiry ON leases(expires_at);

-- ----------------------------------------------------------------------------
-- budgets / budget_reservations — machine-scoped budgets (scope_key machine:*).
-- Deliberately NO REFERENCES and no CHECK defaults beyond the ledger's shape:
-- the referenced job/budget owner is inside a specific ledger, not this file.
-- PK carries ledger_id so the same job_id under two ledgers never collides.
-- ----------------------------------------------------------------------------
CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL, used_value INTEGER NOT NULL DEFAULT 0, reserved_value INTEGER NOT NULL DEFAULT 0);
CREATE TABLE budget_reservations(scope_key TEXT NOT NULL, ledger_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL, PRIMARY KEY(scope_key,ledger_id,job_id));
