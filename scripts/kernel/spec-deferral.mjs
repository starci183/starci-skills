// spec-deferral.mjs — the owner's product-test switches (config.yaml root `specs`, owner 2026-09-28:
// "speed up development; test later when asked").
//
//   specs: {unit: false}  product unit/integration tests (jest, vitest, test:ci, coverage gates, Sonar coverage)
//   specs: {e2e: false}   product e2e tests (e2e.verify, Playwright/e2e specs)
//
// Defaults (owner 2026-09-29, engine/config.mjs SPEC_DEFAULTS): unit ON, e2e OFF (e2e runs only when the goal or the owner asks). What an op
// does when its class is off is data in its
// brief, `policy.specsToggle: {unit?, e2e?}` (modules/ops/ops/<op>.yaml), one of SPECS_TOGGLE_VALUES:
//   defer-leg    the op's only job is that class of testing: the kernel never dispatches it. Its queued job
//                settles `succeeded` with result {verdict: 'deferred', deferred: {kind, reason}} and no attempt
//                spent, so every leg behind it proceeds; `api run-deferred-tests` re-queues it later.
//   skip         the op runs, but neither runs nor writes that class of test and demands no coverage of it
//                (build ops: test:ci/jest/coverage are not run, Sonar still runs).
//   not-counted  a review/verify gate that would demand those tests or that coverage does not count them.
// uat.verify is outside both classes: it is owner-deferred separately until credentials.
//
// Explicit-ask-only ops (owner ruling 2026-09-29): an op whose brief declares `policy.explicitAsk: <kind>`
// (integration.verify: live OAuth/SMTP/payment/provider verification with real credentials) runs only when the
// goal asked for it (phraseSets.<kind>Intent in modules/goal/archetypes.yaml, read by scripts/route/explicit-ask.mjs)
// or the owner forced it (`api run-deferred-tests`). The enqueue stamps payload.explicitAsk from the goal text; a job
// without the stamp - an already-approved leg the goal never asked for - settles deferred at once, the same
// deferral path as specs.e2e=false: never dispatched, no attempt spent, dependents not blocked.
//
// The switches are read per call (ownerSpecs: engine/config.mjs specsSettings over the tolerant owner read), so a kernel that re-reads .claude on its
// runtime rev picks a flip up on its next wake; nothing restarts.

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { inspectOwnerConfig, specsSettings } from '../../engine/config.mjs';
import { enqueueJob, recordJobResult, setJobStatus } from '../../engine/db/ledger.mjs';
import { explicitAsk } from '../route/explicit-ask.mjs';

export const SPECS_CLASSES = Object.freeze(['unit', 'e2e']);
/** Every kind a leg can be deferred under: the owner's two switches and the explicit-ask-only ops. */
export const DEFERRAL_KINDS = Object.freeze([...SPECS_CLASSES, 'integration']);
export const SPECS_TOGGLE_VALUES = Object.freeze(['defer-leg', 'skip', 'not-counted']);
export const TESTS_DEFERRED_EVENT = 'tests-deferred';
export const TESTS_REQUEUED_EVENT = 'tests-requeued';
export const DEFERRED_VERDICT = 'deferred';
/** The reason a deferral carries: the owner key that caused it. */
export const deferReasonOf = (kind) => (SPECS_CLASSES.includes(kind) ? `specs.${kind}=false` : `${kind} verification runs only on an explicit ask or before release, and this goal did not ask for it`);

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

const askCache = new Map();
/** The kind an op runs only on an explicit ask for (`policy.explicitAsk` of its brief, e.g. 'integration'), else null. */
export function opExplicitAskKind({ skillRoot, op }) {
  if (!op) return null;
  const file = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  let stamp;
  try { const stat = fs.statSync(file); stamp = `${stat.mtimeMs}:${stat.size}`; } catch { return null; }
  const cached = askCache.get(file);
  if (cached?.stamp === stamp) return cached.kind;
  let kind = null;
  try { const declared = parseYaml(fs.readFileSync(file, 'utf8'))?.policy?.explicitAsk; kind = typeof declared === 'string' && declared ? declared : null; } catch { kind = null; }
  askCache.set(file, { stamp, kind });
  return kind;
}

/** The kinds this goal text explicitly asks for, e.g. ['integration'] (the value the enqueue stamps as payload.explicitAsk). */
export const explicitAsksOf = ({ skillRoot, text }) => ['integration'].filter((kind) => explicitAsk(kind, text, { skillRoot }));

/** The owner switches {harness, unit, e2e} of the owner config.yaml under `root`, read fresh (an unreadable file reads the defaults: harness off, unit on, e2e off). */
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
  const askKind = opExplicitAskKind({ skillRoot, op });
  if (askKind && !(Array.isArray(payload?.explicitAsk) && payload.explicitAsk.includes(askKind))) return { kind: askKind, reason: deferReasonOf(askKind) };
  const toggle = opSpecsToggle({ skillRoot, op });
  const kind = deferClassOf({ toggle, payload });
  if (!kind) return null;
  const specs = specsOf({ skillRoot, settings });
  return specs[kind] === false ? { kind, reason: deferReasonOf(kind) } : null;
}

/** Whether a plan leg of `op` would be deferred (no payload yet: the op's declared class). `goalText` is the approved goal:
 *  an explicit-ask-only op is deferred unless it asks (unknown goal text reads as not asked). */
export function planLegDeferral({ skillRoot, op, settings = null, goalText = null }) {
  const askKind = opExplicitAskKind({ skillRoot, op });
  if (askKind && !(goalText && explicitAsk(askKind, goalText, { skillRoot }))) return { kind: askKind, reason: deferReasonOf(askKind) };
  const toggle = opSpecsToggle({ skillRoot, op });
  const specs = specsOf({ skillRoot, settings });
  const kind = SPECS_CLASSES.find((k) => toggle[k] === 'defer-leg' && specs[k] === false);
  return kind ? { kind, reason: deferReasonOf(kind) } : null;
}

/**
 * Settle one queued job as deferred: status cancelled (queued never goes to succeeded), result {verdict: 'deferred', deferred}, and one
 * `tests-deferred` event. No dispatch, no lease, no attempt spent. Returns the deferral, or null when the
 * job was no longer queued. Runs inside the caller's transaction when one is open.
 */
export function deferJob(ledger, { job, deferral, via, now = Date.now() }) {
  const db = ledger.db;
  const deferred = { kind: deferral.kind, reason: deferral.reason, at: now, via };
  const result = { verdict: DEFERRED_VERDICT, deferred, summary: `deferred: ${deferral.reason} (${SPECS_CLASSES.includes(deferral.kind) ? 'owner config.yaml specs; ' : ''}api run-deferred-tests runs it later)` };
  const write = () => {
    if (db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.job_id)?.status !== 'queued') return null;
    setJobStatus(db, { jobId: job.job_id, to: 'cancelled', reason: 'tests-deferred', at: now });
    recordJobResult(db, { jobId: job.job_id, result, at: now });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: TESTS_DEFERRED_EVENT,
      payload: { opId: job.op_id, attempt: job.try_no, ...deferred } });
    return deferred;
  };
  return db.isTransaction ? write() : ledger.transaction(write);
}

const parse = (text) => { try { return JSON.parse(text ?? 'null') ?? {}; } catch { return {}; } };

/** A workflow's deferred test legs, oldest first: [{jobId, op, attempt, kind, reason, at, via}]. `kind` filters. */
export function deferredTestsOf(db, workflowId, { kind = null } = {}) {
  // A deferred leg is a cancelled job whose job-result says deferred and that no later job resumes yet.
  return db.prepare(`SELECT j.job_id, j.op_id, j.try_no AS attempt, e.payload_json AS result_json FROM jobs j
      JOIN events e ON e.entity_type='job' AND e.entity_id=j.job_id AND e.kind='job-result'
     WHERE j.workflow_id=? AND j.status='cancelled' AND json_extract(e.payload_json,'$.verdict')=?
       AND NOT EXISTS(SELECT 1 FROM jobs n WHERE n.resume_of=j.job_id) ORDER BY j.created_at, j.job_id`)
    .all(workflowId, DEFERRED_VERDICT)
    .map((row) => ({ row, deferred: parse(row.result_json).deferred ?? {} }))
    .filter(({ deferred }) => !kind || deferred.kind === kind)
    .map(({ row, deferred }) => ({ jobId: row.job_id, op: row.op_id, attempt: row.attempt, kind: deferred.kind ?? null, reason: deferred.reason ?? null, at: deferred.at ?? null, via: deferred.via ?? null }));
}

/**
 * Re-queue a workflow's deferred test legs (`api run-deferred-tests`): each gets a new queued job of the same unit
 * (resume_of the deferred one, retry_class resume) with payload.specsForced, so it dispatches even while its class is still off.
 * Returns the re-queued items.
 */
export function requeueDeferredTests(ledger, { workflowId, kind = null, by = 'run-deferred-tests', now = Date.now() }) {
  const db = ledger.db;
  const items = deferredTestsOf(db, workflowId, { kind });
  const run = () => {
    const done = [];
    for (const item of items) {
      const row = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(item.jobId);
      if (!row?.unit_id) continue;
      const payload = { ...parse(row.payload_json), specsForced: { at: now, by, kind: item.kind } };
      // The unit's next try (its tries count, not the deferred job's own try_no: a later try may exist).
      const tryNo = Number(db.prepare('SELECT tries FROM work_units WHERE workflow_id=? AND unit_id=?').get(row.workflow_id, row.unit_id)?.tries ?? row.try_no) + 1;
      const jobId = `${item.jobId}-r${tryNo}`;
      enqueueJob(db, { jobId, workflowId, unitId: row.unit_id, opId: row.op_id, tryNo, resumeOf: item.jobId, retryClass: 'resume',
        generation: row.generation, kind: row.kind, role: row.role, payload, priority: parse(row.priority_json), createdAt: now });
      ledger.appendEvent({ workflowId, entityType: 'job', entityId: jobId, kind: TESTS_REQUEUED_EVENT, payload: { opId: item.op, attempt: tryNo, resumeOf: item.jobId, kind: item.kind, by } });
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
      skip: 'do NOT run or write product unit/integration tests (jest, vitest, test:ci, a slice coverage run) and demand no changed-line coverage; Sonar still runs, so its bugs, smells and security findings still gate. Record the skipped gates as a check named "specs.unit" with exitCode 0 and evidence "skipped: specs.unit=false"; a missing unit/coverage gate is never partial, blocked or a test-gap.',
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
    `specs: product testing is off (config.yaml ${off.map((kind) => (kind === 'e2e' ? 'specs.e2e is not true - its default: e2e runs only when the goal or the owner asks' : `specs.${kind}: false`)).join(', ')}; owner 2026-09-28/29 "speed up development; test later when asked"). This overrides every test, coverage and e2e step, proof and blocker in your brief:`,
    ...off.map((kind) => `  ${kind}: ${say[kind][toggle[kind]]}`),
  ];
}

/**
 * The verification-scope policy every op prompt carries (owner 2026-09-29). A code-writing op writes or updates the unit specs of the
 * source it adds or changes and runs ONLY those (the specs of the changed or added source plus the specs that import it) with typecheck,
 * lint, canon-scan and the build scoped as usual; never the repository's whole unit suite (that is unit.verify's, dispatched only when the
 * goal or the owner asks for it, or the owner's /push-git flow) and never e2e unless the goal or the owner asked (e2e.verify then runs the
 * FULL e2e suite). With specs.unit off the `specs:` line already forbids writing unit specs, so only the whole-suite rule is stated.
 */
export function verificationScopeLines({ settings = null, skillRoot = null } = {}) {
  const unit = (settings ?? specsOf({ skillRoot })).unit !== false;
  return [
    `verification_scope (owner 2026-09-29): ${unit ? "write or update the unit specs of the source you add or change and run ONLY those (the specs of the changed or added source plus the specs that import it) with typecheck, lint, canon-scan and the build scoped to your change" : 'run typecheck, lint, canon-scan and the build scoped to your change'}; never the repository's whole unit suite (unit.verify runs it, dispatched only when the goal or the owner asks; /push-git runs it before a push) and never e2e unless the goal or the owner asked (e2e.verify then runs the full e2e suite). Work inside the .claude runtime follows the same rule: its specs are the ones touching your change.`,
  ];
}
