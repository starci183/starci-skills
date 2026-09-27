// spec-deferral.mjs — the owner's product-test switches (config.yaml root `specs`, owner 2026-09-28:
// "speed up development; test later when asked").
//
//   specs: {unit: false}  product unit/integration tests (jest, vitest, test:ci, coverage gates, Sonar coverage)
//   specs: {e2e: false}   product e2e tests (e2e.verify, Playwright/e2e specs)
//
// Absent or true is the behaviour before the switch. What an op does when its class is off is data in its
// brief, `policy.specsToggle: {unit?, e2e?}` (modules/ops/ops/<op>.yaml), one of SPECS_TOGGLE_VALUES:
//   defer-leg    the op's only job is that class of testing: the kernel never dispatches it. Its queued job
//                settles `succeeded` with result {verdict: 'deferred', deferred: {kind, reason}} and no attempt
//                spent, so every leg behind it proceeds; `api run-deferred-tests` re-queues it later.
//   skip         the op runs, but neither runs nor writes that class of test and demands no coverage of it
//                (build ops: test:ci/jest/coverage are not run, Sonar runs with --no-coverage).
//   not-counted  a review/verify gate that would demand those tests or that coverage does not count them.
// uat.verify is outside both classes: it is owner-deferred separately until credentials.
//
// The switches are read per call (ownerSpecs: engine/config.mjs specsSettings over the tolerant owner read), so a kernel that re-reads .claude on its
// runtime rev picks a flip up on its next wake; nothing restarts.

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { inspectOwnerConfig, specsSettings } from '../../engine/config.mjs';

export const SPECS_CLASSES = Object.freeze(['unit', 'e2e']);
export const SPECS_TOGGLE_VALUES = Object.freeze(['defer-leg', 'skip', 'not-counted']);
export const TESTS_DEFERRED_EVENT = 'tests-deferred';
export const TESTS_REQUEUED_EVENT = 'tests-requeued';
export const DEFERRED_VERDICT = 'deferred';
/** The reason a deferral carries: the owner key that caused it. */
export const deferReasonOf = (kind) => `specs.${kind}=false`;

// A test path is e2e when a segment or name part says so (test/e2e/**, *.e2e-spec.ts, playwright/**).
const E2E_PATH = /(?:^|[\\/._-])e2e(?:[\\/._-]|$)|playwright/i;

const briefCache = new Map();
/** The op's `policy.specsToggle` ({unit?, e2e?} of SPECS_TOGGLE_VALUES), {} when it declares none or the brief is unreadable. */
export function opSpecsToggle({ skillRoot, op }) {
  if (!op) return {};
  const file = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  let stamp;
  try { const stat = fs.statSync(file); stamp = `${stat.mtimeMs}:${stat.size}`; } catch { return {}; }
  const cached = briefCache.get(file);
  if (cached?.stamp === stamp) return cached.toggle;
  let toggle = {};
  try {
    const declared = parseYaml(fs.readFileSync(file, 'utf8'))?.policy?.specsToggle;
    if (declared && typeof declared === 'object') toggle = Object.fromEntries(SPECS_CLASSES.filter((kind) => SPECS_TOGGLE_VALUES.includes(declared[kind])).map((kind) => [kind, declared[kind]]));
  } catch { toggle = {}; }
  briefCache.set(file, { stamp, toggle });
  return toggle;
}

/** The owner switches {harness, unit, e2e} of the owner config.yaml under `root`, read fresh (an unreadable file reads all on). */
export const ownerSpecs = (root) => { try { return specsSettings(inspectOwnerConfig(root).config); } catch { return specsSettings(null); } };
/** The owner switches; `settings` passes a fixed read through (tests, one read per command). */
export const specsOf = ({ skillRoot, settings = null } = {}) => settings ?? ownerSpecs(skillRoot);

/** The classes that are off, e.g. ['unit', 'e2e']. */
export const specsOff = (settings) => SPECS_CLASSES.filter((kind) => settings?.[kind] === false);

/**
 * The class a defer-leg job tests. An op that defers on one class only is that class; one that defers on both
 * (test.author authors unit and e2e specs) is e2e when every owned path it writes is an e2e path, else unit.
 */
export function deferClassOf({ toggle, payload = {} }) {
  const classes = SPECS_CLASSES.filter((kind) => toggle[kind] === 'defer-leg');
  if (classes.length <= 1) return classes[0] ?? null;
  const paths = (Array.isArray(payload.owned_paths) ? payload.owned_paths : []).map((p) => String(p?.path ?? p ?? '')).filter(Boolean);
  return paths.length && paths.every((p) => E2E_PATH.test(p)) ? 'e2e' : 'unit';
}

/**
 * Whether this job is deferred rather than dispatched: {kind, reason} or null. A job the owner asked to run
 * anyway (`api run-deferred-tests` stamps payload.specsForced) is never deferred again.
 */
export function deferralOf({ skillRoot, op, payload = {}, settings = null }) {
  if (payload?.specsForced) return null;
  const toggle = opSpecsToggle({ skillRoot, op });
  const kind = deferClassOf({ toggle, payload });
  if (!kind) return null;
  const specs = specsOf({ skillRoot, settings });
  return specs[kind] === false ? { kind, reason: deferReasonOf(kind) } : null;
}

/** Whether a plan leg of `op` would be deferred (no payload yet: the op's declared class). */
export function planLegDeferral({ skillRoot, op, settings = null }) {
  const toggle = opSpecsToggle({ skillRoot, op });
  const specs = specsOf({ skillRoot, settings });
  const kind = SPECS_CLASSES.find((k) => toggle[k] === 'defer-leg' && specs[k] === false);
  return kind ? { kind, reason: deferReasonOf(kind) } : null;
}

/**
 * Settle one queued job as deferred: status succeeded, result {verdict: 'deferred', deferred}, and one
 * `tests-deferred` event. No dispatch, no lease, no attempt spent. Returns the deferral, or null when the
 * job was no longer queued. Runs inside the caller's transaction when one is open.
 */
export function deferJob(ledger, { job, deferral, via, now = Date.now() }) {
  const db = ledger.db;
  const deferred = { kind: deferral.kind, reason: deferral.reason, at: now, via };
  const result = { verdict: DEFERRED_VERDICT, deferred, summary: `deferred: ${deferral.reason} (owner config.yaml specs; api run-deferred-tests runs it later)` };
  const write = () => {
    const changed = db.prepare("UPDATE jobs SET status='succeeded', result_json=?, lease_token=NULL, worker_id=NULL, deadline=NULL, updated_at=? WHERE job_id=? AND status='queued'")
      .run(JSON.stringify(result), now, job.job_id).changes;
    if (!changed) return null;
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: TESTS_DEFERRED_EVENT,
      payload: { opId: job.op_id, attempt: job.attempt, ...deferred } });
    return deferred;
  };
  return db.isTransaction ? write() : ledger.transaction(write);
}

const parse = (text) => { try { return JSON.parse(text ?? 'null') ?? {}; } catch { return {}; } };

/** A workflow's deferred test legs, oldest first: [{jobId, op, attempt, kind, reason, at, via}]. `kind` filters. */
export function deferredTestsOf(db, workflowId, { kind = null } = {}) {
  return db.prepare("SELECT job_id, op_id, attempt, result_json FROM jobs WHERE workflow_id=? AND status='succeeded' AND json_extract(result_json,'$.verdict')=? ORDER BY created_at, job_id")
    .all(workflowId, DEFERRED_VERDICT)
    .map((row) => ({ row, deferred: parse(row.result_json).deferred ?? {} }))
    .filter(({ deferred }) => !kind || deferred.kind === kind)
    .map(({ row, deferred }) => ({ jobId: row.job_id, op: row.op_id, attempt: row.attempt, kind: deferred.kind ?? null, reason: deferred.reason ?? null, at: deferred.at ?? null, via: deferred.via ?? null }));
}

/**
 * Re-queue a workflow's deferred test legs (`api run-deferred-tests`): each goes back to queued on its same
 * attempt (none was spent) with payload.specsForced, so it dispatches even while its class is still off.
 * Returns the re-queued items.
 */
export function requeueDeferredTests(ledger, { workflowId, kind = null, by = 'run-deferred-tests', now = Date.now() }) {
  const db = ledger.db;
  const items = deferredTestsOf(db, workflowId, { kind });
  const run = () => {
    const done = [];
    for (const item of items) {
      const row = db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(item.jobId);
      const payload = { ...parse(row?.payload_json), specsForced: { at: now, by, kind: item.kind } };
      const changed = db.prepare("UPDATE jobs SET status='queued', result_json=NULL, payload_json=?, updated_at=? WHERE job_id=? AND status='succeeded' AND json_extract(result_json,'$.verdict')=?")
        .run(JSON.stringify(payload), now, item.jobId, DEFERRED_VERDICT).changes;
      if (!changed) continue;
      ledger.appendEvent({ workflowId, entityType: 'job', entityId: item.jobId, kind: TESTS_REQUEUED_EVENT, payload: { opId: item.op, attempt: item.attempt, kind: item.kind, by } });
      done.push(item);
    }
    return done;
  };
  return db.isTransaction ? run() : ledger.transaction(run);
}

/**
 * The brief lines a dispatched op reads when a class it touches is off (scripts/kernel/op-prompt.mjs).
 * Empty when every class is on, the op declares no specsToggle, or a forced (re-queued) defer-leg runs.
 */
export function specsBriefLines({ skillRoot, op, settings = null, forced = false }) {
  const toggle = opSpecsToggle({ skillRoot, op });
  // A deferred leg the owner asked to run anyway (payload.specsForced) runs its whole brief.
  const off = specsOff(specsOf({ skillRoot, settings })).filter((kind) => toggle[kind] && !(forced && toggle[kind] === 'defer-leg'));
  if (!off.length) return [];
  const say = {
    unit: {
      skip: 'do NOT run or write product unit/integration tests (jest, vitest, test:ci, a slice coverage run) and demand no changed-line coverage; Sonar still runs - with --no-coverage and no --lcov - so its bugs, smells and security findings still gate. Record the skipped gates as a check named "specs.unit" with exitCode 0 and evidence "skipped: specs.unit=false"; a missing unit/coverage gate is never partial, blocked or a test-gap.',
      'not-counted': 'do NOT demand unit/integration test results or coverage: an absent or skipped unit/coverage gate is not counted against the producer, never a finding, partial or blocker; judge every other gate as usual.',
      'defer-leg': 'this leg is deferred and should not be running; report done with the check "specs.unit" evidence "deferred: specs.unit=false" and author nothing.',
    },
    e2e: {
      skip: 'do NOT run or write product e2e tests (backend e2e, Playwright, *.e2e-spec.*); record a check named "specs.e2e" with exitCode 0 and evidence "skipped: specs.e2e=false"; a missing e2e gate is never partial, blocked or a test-gap.',
      'not-counted': 'do NOT demand e2e results: an absent or skipped e2e gate is not counted, never a finding, partial or blocker. UAT is not e2e and keeps its own rules.',
      'defer-leg': 'this leg is deferred and should not be running; report done with the check "specs.e2e" evidence "deferred: specs.e2e=false" and author nothing.',
    },
  };
  return [
    `specs: the owner switched product testing off (config.yaml ${off.map((kind) => `specs.${kind}: false`).join(', ')}; owner 2026-09-28 "speed up development; test later when asked"). This overrides every test, coverage and e2e step, proof and blocker in your brief:`,
    ...off.map((kind) => `  ${kind}: ${say[kind][toggle[kind]]}`),
  ];
}
