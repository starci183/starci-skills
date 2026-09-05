// The unchecked ledger, written: `node scripts/record-unchecked.mjs <session>/step-N/parallel-M` reads
// the validated receipt of a done branch and brings @worktrees/unchecked/<product>/<featureId>.jsonl
// into agreement with it. From a plan branch it appends one entry per secondary unit, in the lane that
// plan's domain proves, carrying the unit's own deferral reason. From a verifying branch — the audit,
// the walk, the e2e run (scripts/unchecked.mjs#VERIFY_LANES) — it resolves the entries its lane and its
// unit just covered, and appends one entry per state the receipt deferred, with the reason the receipt
// gave.
//
// It is the counterpart of scripts/record-findings.mjs and is run at the same place: the transition
// that accepts the receipt. An isolated agent never reaches the ledger, because coverage the agent that
// skipped it could also write off would never have been unchecked.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sessionRootOf, hostRootOf } from './validate-request.mjs';
import { VERIFY_LANES, appendUnchecked, uncheckedId, uncheckedOfPlan, laneOf, laneOfPlan, readUnchecked, resolveUnchecked, secondaryUnits } from './unchecked.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The operators whose receipts move the ledger: the plans that tier the units, and the lanes that prove them.
export const PLAN_OPERATORS = new Set(['interface.plan', 'uat.plan']);
export const UNCHECKED_OPERATORS = new Set([...PLAN_OPERATORS, ...Object.keys(VERIFY_LANES)]);
const VALIDATORS = {
  'interface.plan': ['interface-plan', 'validateInterfacePlanStep'],
  'uat.plan': ['uat-plan', 'validateUatPlanStep'],
  'interface.audit': ['interface-audit', 'validateAuditStep'],
  'uat.verify': ['uat-verify', 'validateUatStep'],
  'api.verify': ['api-verify', 'validateApiStep'],
};

async function readJson(file) { if (!existsSync(file)) return null; try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
const branchOf = (dir) => { const m = /step-(\d+)[\\/]parallel-(\d+)$/.exec(path.resolve(dir)); return m ? `${m[1]}/${m[2]}` : null; };

// Which ledger a branch writes to: the session's project is the product, and the feature is the one the
// request named. A branch that names no feature addresses no ledger and says so rather than guessing.
export async function ledgerKeyOf(branchDir, { request = null, state = null } = {}) {
  const sessionRoot = sessionRootOf(branchDir);
  request ??= await readJson(path.join(branchDir, 'request', 'request.json'));
  state ??= sessionRoot ? await readJson(path.join(sessionRoot, 'state.json')) : null;
  const product = state?.project ?? request?.project ?? null;
  const featureId = request?.requirements?.feature ?? request?.requirements?.featureId ?? null;
  return { product, featureId, sessionId: request?.sessionId ?? state?.id ?? null };
}

// What one done branch leaves unchecked and what it covers: `append` are the entries it records,
// `resolve` the ids it closes. Returns null when the branch is not one the ledger listens to.
export async function extractUnchecked(branchDir, { root = ROOT, hostRoot = hostRootOf(root), now = new Date().toISOString() } = {}) {
  const request = await readJson(path.join(branchDir, 'request', 'request.json'));
  const response = await readJson(path.join(branchDir, 'response', 'response.json'));
  if (!request || !response) return null;
  const operator = response.operatorId ?? request.operatorId;
  if (!UNCHECKED_OPERATORS.has(operator)) return null;
  const { product, featureId, sessionId } = await ledgerKeyOf(branchDir, { request });
  const branch = branchOf(branchDir);
  const lane = PLAN_OPERATORS.has(operator) ? laneOfPlan(operator) : laneOf(operator);
  const recordedBy = `${sessionId}/${branch}`;
  // What the branch deferred, before any ledger is addressed: a plan's secondary units, or a
  // verification's deferred states with the reasons its receipt gave.
  const units = PLAN_OPERATORS.has(operator) ? await readJson(path.join(branchDir, 'response', 'data', 'units.json')) : null;
  const verdicts = PLAN_OPERATORS.has(operator) ? null : await readJson(path.join(branchDir, 'response', 'data', 'verdicts.json'));
  const scope = verdicts?.auditScope ?? null;
  const unit = request.unit ?? null;
  const deferredStates = unit ? (scope?.deferredStates ?? []) : [];
  const defers = PLAN_OPERATORS.has(operator) ? secondaryUnits(units).length : deferredStates.length;
  const nothing = { operator, product, featureId, lane, append: [], resolve: [], recordedBy };
  if (!lane) return nothing;
  // A branch that deferred nothing addresses no ledger and needs none; one that did must be able to
  // name the file its entry belongs in, and says so rather than dropping the entry for want of a key.
  if (!product || !featureId) {
    if (!defers) return nothing;
    throw new Error(`${branch}: a done ${operator} branch deferred coverage and names no ledger; the session's project is the product and the request's feature is the featureId`);
  }
  const key = { product, featureId, recordedBy, recordedAt: now };

  if (PLAN_OPERATORS.has(operator)) {
    if (!units) return nothing;
    return { ...nothing, append: uncheckedOfPlan({ ...key, units, lane }) };
  }

  // A verifying branch ran one unit of its lane; the states its receipt deferred are what it did not
  // reach inside that unit, and everything else of that unit is coverage it just took. Such an entry
  // is tier `journey`: the fan-out gate only ever sends a journey unit here, so what went unproved is
  // part of the journey itself, and it is heavier than a whole unit the journey never enters.
  const reasons = new Map((scope?.deferrals ?? []).map((d) => [d.state, d.reason]));
  const append = deferredStates.map((state) => {
    const line = { product, featureId, unit, state, lane, tier: 'journey', reason: reasons.get(state) ?? '', recordedBy, recordedAt: now, resolvedBy: null, resolvedAt: null };
    return { ...line, id: uncheckedId(line) };
  });
  const deferred = new Set(deferredStates);
  const ledger = await readUnchecked(hostRoot, product, featureId);
  const resolve = [];
  for (const entry of ledger.latest.values()) {
    if (entry.resolvedBy !== null || entry.lane !== lane || entry.unit !== unit) continue;
    if (entry.state === null || !deferred.has(entry.state)) resolve.push(entry.id);
  }
  return { ...nothing, append, resolve };
}

export async function recordUnchecked(branchDir, { root = ROOT, hostRoot = hostRootOf(root), now = new Date().toISOString(), validate = true } = {}) {
  branchDir = path.resolve(branchDir);
  const response = await readJson(path.join(branchDir, 'response', 'response.json'));
  if (!response) throw new Error(`${branchDir}: no response.json; the ledger records accepted receipts only`);
  if (response.status !== 'done') throw new Error(`${branchOf(branchDir)}: the branch is ${response.status}, not done; the ledger records accepted receipts only`);
  const entry = VALIDATORS[response.operatorId];
  if (!entry) throw new Error(`${branchOf(branchDir)}: ${response.operatorId} leaves nothing unchecked; only ${[...UNCHECKED_OPERATORS].sort().join(', ')} move the ledger`);
  if (validate) {
    const mod = await import(pathToFileURL(path.join(root, 'operators', entry[0], 'validate.mjs')).href);
    const { errors } = await mod[entry[1]](branchDir, root);
    if (errors.length) throw new Error(`${branchOf(branchDir)}: the receipt does not validate, so nothing is recorded:\n${errors.join('\n')}`);
  }
  const found = await extractUnchecked(branchDir, { root, hostRoot, now });
  if (!found) throw new Error(`${branchOf(branchDir)}: no receipt the ledger listens to`);
  const { file, appended } = await appendUnchecked(hostRoot, found.product, found.featureId, found.append, { root });
  const { resolved } = found.resolve.length
    ? await resolveUnchecked(hostRoot, found.product, found.featureId, found.resolve, { resolvedBy: found.recordedBy, resolvedAt: now, root })
    : { resolved: 0 };
  return { file, lane: found.lane, appended, resolved };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/record-unchecked.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  recordUnchecked(target).then((r) => {
    process.stdout.write(`unchecked: ${r.appended} appended, ${r.resolved} resolved in the ${r.lane} lane of ${path.relative(ROOT, r.file).split(path.sep).join('/')}\n`);
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
