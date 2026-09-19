-- ============================================================================
-- queries/budgets.sql — LEDGER-scoped budgets (repo budgets, scope_key naming
-- the pool). reserved_value = in-flight holds; used_value = consumed spend.
-- Admission rule (admission.mjs::reserveBudgets): used + reserved + request
-- must fit limit_value, and the budget must be DECLARED (row exists).
-- machine-scoped budgets (machine:* scope_key) live in machine.sqlite — see
-- machine-arbiter.sql.
-- ============================================================================

-- source: admission.mjs::setBudget — declare/raise a limit
INSERT INTO budgets(scope_key,limit_value) VALUES(?,?)
  ON CONFLICT(scope_key) DO UPDATE SET limit_value=excluded.limit_value;

-- ---------------------------------------------------------------------------
-- RESERVE — inside journal.transaction (reserveBudgets)
-- ---------------------------------------------------------------------------

-- the admission check reads the whole row; undeclared or exhausted refuses
SELECT * FROM budgets WHERE scope_key=?;

-- hold units: bump reserved, record the per-job reservation
UPDATE budgets SET reserved_value=reserved_value+? WHERE scope_key=?;
INSERT INTO budget_reservations(scope_key,job_id,units) VALUES(?,?,?);

-- ---------------------------------------------------------------------------
-- RETURN / CONSUME — admission.mjs::returnBudgets (release path) and
-- jobs.mjs::complete (settlement path). Both delete the reservation; only the
-- settlement path adds the units to used_value.
-- ---------------------------------------------------------------------------

-- the job's outstanding holds
SELECT scope_key,units FROM budget_reservations WHERE job_id=?;

-- release (consume=false → units+0) or consume (consume=true → used+=units);
-- MAX(0,...) floors reserved at zero so a double-release cannot go negative
UPDATE budgets SET reserved_value=MAX(0,reserved_value-?),used_value=used_value+? WHERE scope_key=?;

DELETE FROM budget_reservations WHERE job_id=?;

-- ---------------------------------------------------------------------------
-- MIGRATION reads/writes (scripts/ledger-migrate.mjs)
-- ---------------------------------------------------------------------------

-- journal-side read: the reservations of one workflow's jobs (journal has no
-- workflow_id on budget_reservations — reached through jobs)
SELECT br.scope_key,br.job_id,br.units FROM budget_reservations br JOIN jobs j ON j.job_id=br.job_id WHERE j.workflow_id=?;

-- ledger-side import (repo-scoped only; machine:* scopes go to machine.sqlite)
INSERT OR IGNORE INTO budgets(scope_key,limit_value,used_value,reserved_value) VALUES(?,?,?,?);
INSERT OR IGNORE INTO budget_reservations(scope_key,job_id,units) VALUES(?,?,?);

-- TODO-missing: no SELECT that lists budget utilisation for a dashboard
-- (budgets has no reader beyond the reserve path); status views compose
-- budgets + budget_reservations joins in JS if needed.
