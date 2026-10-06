// units.mjs — the work unit a job is a try of (H3, H4, H5; DBTREE work_units + jobs_enqueue_guard).
//
// One unit is one bounded piece of work: one op, one subject key (engine/admission.mjs unitSubjectKey) and one goal
// revision - a work_units row. Every op job is a try of exactly one unit (jobs.unit_id, try_no, retry_of|resume_of).
// Every way a job enters the ledger - starci kernel enqueue, graph-edit, the failure routes (cli.mjs enqueueFollowOn) - admits the
// try HERE, so none of them can start a fresh budget for the same work, chain a retry to another unit's or a passed
// job, or re-run a passed unit without a reopen reason. The schema triggers refuse the same things; this answers first
// with a typed refusal the Kernel can act on. admitUnit only reads; writeUnitTry writes inside the caller's transaction.
import { AWAITING_OWNER_STATUS, UNIT_TRY_BUDGET, admitUnitTry, ownedPathsIntersect, unitSubjectKey } from '../../engine/admission.mjs';
import { createUnit, getUnit, jobResult, reopenUnit } from '../../engine/db/ledger.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { refuse } from '../../engine/refuse.mjs';

const payloadOf = (row) => parseJsonOr(row?.payload_json ?? '{}') ?? {};

const pathsOf = (list) => (Array.isArray(list) ? list : []).map((p) => (typeof p === 'string' ? p : p?.path)).filter((p) => typeof p === 'string' && p.trim());
const safeIntersect = (a, b) => { try { return ownedPathsIntersect(a, b); } catch { return a === b; } };

/** Every try of one unit, oldest first, each with the settle result retryDisposition reads (result_json). */
function unitTriesOf(db, workflowId, unitId) {
  if (!unitId) return [];
  return db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND unit_id=? AND kind='op' ORDER BY try_no").all(workflowId, unitId)
    .map((row) => ({ ...row, result_json: JSON.stringify(jobResult(db, row.job_id) ?? {}) }));
}

/** The tries of a unit that spent its budget: a try that ended awaiting_owner asked a question and spent none. */
export function spentTriesOf(db, unit) {
  return Number(unit.tries) - Number(db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=? AND unit_id=? AND status=?').get(unit.workflow_id, unit.unit_id, AWAITING_OWNER_STATUS).n);
}

/** {unit, tries, last} of one unit, or null. */
export function unitStateOf(db, workflowId, unitId) {
  const unit = unitId ? getUnit(db, workflowId, unitId) : null;
  if (!unit) return null;
  const tries = unitTriesOf(db, workflowId, unitId);
  return { unit, tries, last: tries.at(-1) ?? null, exhausted: spentTriesOf(db, unit) >= Number(unit.try_budget) };
}

/**
 * Failed units of `op` in the goal revision whose latest try shares owned paths or records with `payload`: the same
 * work under another spelling. A new unit over them would restart their budget (H3), so enqueue refuses it.
 */
function failedOverlapsOf(db, { workflowId, op, goalRevision, payload, exclude = new Set() }) {
  const want = [...pathsOf(payload.owned_paths), ...pathsOf(payload.records)];
  if (!want.length) return [];
  const units = db.prepare("SELECT * FROM work_units WHERE workflow_id=? AND op_id=? AND goal_revision=? AND state='failed'").all(workflowId, op, goalRevision);
  return units.filter((u) => !exclude.has(u.unit_id)).flatMap((u) => {
    const last = u.current_job_id ? db.prepare('SELECT job_id, payload_json FROM jobs WHERE job_id=?').get(u.current_job_id) : null;
    const p = payloadOf(last);
    const theirs = [...pathsOf(p.owned_paths), ...pathsOf(p.records)];
    return theirs.some((a) => want.some((b) => safeIntersect(a, b)))
      ? [{ unitId: u.unit_id, jobId: last?.job_id ?? null, tries: Number(u.tries), budget: Number(u.try_budget) }] : [];
  });
}

/**
 * Admit one try (the enqueue gate). `payload` is the new job's {cut, params, records, owned_paths}; `retryOf` names the
 * predecessor explicitly (its unit is this job's unit, whatever the new shape); `reopen` {reason, by} re-runs a passed
 * unit; `derivedFrom` [jobIds] marks a unit a graph edit carved out of other units (split, merge, recut, wire): it gets
 * what is left of their budgets, never a fresh one. `resolveLatest` (the runtime's own routes) follows the named job to
 * its unit's latest try. Returns {unitId|null (a new unit), subjectKey, goalRevision, tryBudget, tryNo, retryOf,
 * resumeOf, retryClass, reopen} or throws a typed refusal (engine/admission.mjs admitUnitTry, plus
 * unit-overlaps-failed-unit and retry-of-foreign).
 */
export function admitUnit(db, { workflowId, op, payload, goalRevision, retryOf = null, reopen = null, derivedFrom = [], resolveLatest = false }) {
  if (!Number.isInteger(goalRevision)) throw refuse(`workflow ${workflowId} has no approved goal revision: a unit belongs to one`, 'goal-revision-missing');
  let subjectKey = unitSubjectKey({ cut: payload.cut, params: payload.params, records: payload.records, ownedPaths: payload.owned_paths });
  let unit = null;
  if (retryOf) {
    const prior = db.prepare("SELECT * FROM jobs WHERE job_id=? AND workflow_id=? AND kind='op'").get(retryOf, workflowId);
    if (!prior || prior.op_id !== op || !prior.unit_id) throw refuse(`--retry-of ${retryOf} is not an earlier ${op} job of ${workflowId}`, 'retry-of-foreign');
    unit = getUnit(db, workflowId, prior.unit_id);
    subjectKey = unit.subject_key; goalRevision = unit.goal_revision;
    if (resolveLatest) retryOf = unit.current_job_id ?? retryOf;
  } else {
    unit = db.prepare('SELECT * FROM work_units WHERE workflow_id=? AND op_id=? AND subject_key=? AND goal_revision=?').get(workflowId, op, subjectKey, goalRevision) ?? null;
  }
  let tryBudget = unit ? Number(unit.try_budget) : UNIT_TRY_BUDGET, derived = null;
  if (!unit) {
    const sources = [...new Set((derivedFrom ?? []).map((id) => db.prepare('SELECT unit_id FROM jobs WHERE job_id=? AND workflow_id=?').get(id, workflowId)?.unit_id).filter(Boolean))];
    if (sources.length) {
      const left = sources.map((id) => { const u = getUnit(db, workflowId, id); return Number(u.try_budget) - Number(u.tries); });
      tryBudget = Math.max(1, Math.min(UNIT_TRY_BUDGET, ...left));
      derived = sources;
    }
    const overlaps = failedOverlapsOf(db, { workflowId, op, goalRevision, payload, exclude: new Set(sources) });
    if (overlaps.length) {
      const names = overlaps.map((o) => `${o.unitId} (latest ${o.jobId}, ${o.tries}/${o.budget} tries)`).join(', ');
      throw refuse(`this ${op} work overlaps failed unit(s) ${names}: a new unit would restart their budget. Retry it with --retry-of ${overlaps[0].jobId} (a widened shape stays in its unit), or reshape it through starci kernel graph-edit`,
        'unit-overlaps-failed-unit', { overlaps });
    }
  }
  const admitted = admitUnitTry({ unit, tries: unit ? unitTriesOf(db, workflowId, unit.unit_id) : [], retryOf, reopen });
  return { unitId: unit?.unit_id ?? null, subjectKey, goalRevision, tryBudget, derivedFrom: derived, ...admitted };
}

/**
 * Write the admitted unit side of a new job inside the caller's transaction: a new unit is created (its id is the new
 * job's id), a passed one is reopened with its reason. Returns the fields ledger.enqueueJob takes for the job.
 */
export function writeUnitTry(db, admitted, { workflowId, jobId, op, title = null, cut = null, repository = null, at = Date.now() }) {
  let unitId = admitted.unitId;
  if (!unitId) {
    unitId = jobId;
    createUnit(db, { workflowId, unitId, opId: op, subjectKey: admitted.subjectKey, goalRevision: admitted.goalRevision, title,
      cutId: cut?.id != null ? String(cut.id) : null, cutOrdinal: cut?.ordinal ?? null, cutTotal: cut?.total ?? null, repository,
      tryBudget: admitted.tryBudget, createdAt: at });
  } else if (admitted.reopen) {
    reopenUnit(db, { workflowId, unitId, reason: admitted.reopen.reason, by: admitted.reopen.by, at });
  }
  return { unitId, tryNo: admitted.tryNo, retryOf: admitted.retryOf, resumeOf: admitted.resumeOf, retryClass: admitted.retryClass };
}
