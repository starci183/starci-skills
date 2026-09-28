// verify-failure.mjs — why a failed attempt failed, and who owns the fix (lane op-verify, 2026-09-28).
//
// Before this module a failed settle routed on the report outcome alone: every `failed` fell to
// `failed-retries-the-same-op` unless a from-specific route found a build job to reopen, so a UAT that
// named a backend defect re-ran the same walk three times at an unchanged HEAD (nivo app-auth
// uat.verify a1-a5, inc-2a2228098860) and a lint MEASUREMENT leg whose findings were the very
// measurement it was asked for failed three times into an owner gate (nivo fe-canon review.verify
// a1-a4, inc-46ce3d247d77). The route table (modules/models/kinds.yaml) now keys failed routes on a
// failure CLASS as well, computed here from the report and the kernel's recorded checks:
//
//   environment    the stack under test was not ready (a failing env-health check, a blocked report of
//                  kind environment); not a product defect and never counted against the product
//   tool           a checker could not run (canon-scan exit 2/3, a crashed runner); retried
//   findings       a lint gate measured violations: the review-findings route repairs the build
//   product        the verify ran and the product is wrong; the owning build op is repaired (rootCause)
//   deterministic  a non-verify op failed exactly as its previous attempt did at the same HEAD
//   transient      nothing above: the one class the same-op retry route accepts
//
// A report may state its class (`failureClass`); the api only accepts one the evidence does not
// contradict. Nothing here writes: api.mjs settle and enqueueNextStep call it.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { FAILURE_CLASSES } from './report-envelope.mjs';
/** The verify ops whose red is, by default, a defect in what they walked or measured - never in the walk. */
export const VERIFY_OPS = ['uat.verify', 'uat.assisted.verify', 'e2e.verify', 'integration.verify', 'interface.audit', 'review.verify', 'security.verify', 'perf.verify'];
/** The ops that walk a served stack: `api dispatch` runs the environment pre-step (scripts/uat/env-health.mjs) for them. */
export const ENV_GATED_OPS = ['uat.verify', 'uat.assisted.verify', 'e2e.verify'];
/** review.verify modes whose run is a measurement: scripts execute and write reports only (CONTEXT.md). */
export const MEASUREMENT_MODES = ['lint', 'stales'];
export const ENV_HEALTH_CHECK = 'env-health';

// Exit-code semantics of the checkers a measurement runs. `error` codes mean the tool did not measure;
// any other nonzero code of a known measuring tool is findings. An unknown command's nonzero exit in a
// measurement leg is findings too unless its evidence says it could not run.
const MEASURING_TOOLS = [
  { id: 'canon-scan', match: /canon-scan(\.mjs)?\b/i, error: [2, 3] },
  // check-scoped-lint: 1 findings, 2 unavailable|invalid. `--all` reports a repository obligation the
  // repository has not declared as unavailable - owed by the repository owner, measured, not a crash.
  { id: 'check-scoped-lint', match: /check-scoped-lint(\.mjs)?\b/i, error: [], invalid: /status\s*=\s*invalid|ARGUMENT_INVALID/i },
  { id: 'check-stales', match: /check-stales(\.mjs)?\b/i, error: [2, 3] },
  { id: 'starci-validate', match: /starci(\.mjs)?\s+validate\b|\bvalidate\b.*\.starciwork/i, error: [2] },
  { id: 'eslint', match: /\beslint\b|\blint(:check)?\b/i, error: [2] },
  { id: 'tsc', match: /\btsc\b|typecheck/i, error: [] },
];
const CANNOT_RUN = /\b(ENOENT|command not found|is not recognized|cannot find module|MODULE_NOT_FOUND|could not run|did not run|crash(ed)?|SCANNER_UNAVAILABLE|CHECK_UNAVAILABLE|timed? ?out|killed)\b/i;

/** How one red check of a measurement leg reads: 'findings' (it measured) or 'error' (it did not). */
export function measurementCheckClass(check) {
  if (!check || !Number.isInteger(check.exitCode) || check.exitCode === 0) return null;
  const command = `${check.name ?? ''} ${check.command ?? ''}`;
  const evidence = String(check.evidence ?? '');
  const tool = MEASURING_TOOLS.find((t) => t.match.test(command));
  if (tool?.error.includes(check.exitCode)) return 'error';
  if (tool?.invalid?.test(evidence)) return 'error';
  if (!tool && CANNOT_RUN.test(evidence)) return 'error';
  if (tool && CANNOT_RUN.test(evidence) && !/finding|violation|status\s*=\s*(findings|unavailable)/i.test(evidence)) return 'error';
  return 'findings';
}

const payloadOf = (job) => {
  if (!job) return {};
  if (job.payload && typeof job.payload === 'object') return job.payload;
  try { return JSON.parse(job.payload_json ?? '{}') ?? {}; } catch { return {}; }
};
const opOf = (job) => job?.op_id ?? payloadOf(job).opId ?? null;

/**
 * Whether a job is a MEASUREMENT leg: review.verify in a measurement mode that is not a gate. An
 * explicit params.lintRole (measurement|gate) decides; otherwise a leg is the gate once a build op of its workflow settled
 * succeeded before it was enqueued (the final lint after code.refactor), and the measurement before.
 * `buildOps` is the build-family op list (kinds.yaml family build).
 */
export function isMeasurementLeg(db, job, { buildOps = [] } = {}) {
  if (opOf(job) !== 'review.verify') return false;
  const params = payloadOf(job).params ?? {};
  if (!MEASUREMENT_MODES.includes(params.mode)) return false;
  if (params.lintRole === 'gate') return false;
  if (params.lintRole === 'measurement') return true;
  if (!db || !buildOps.length) return true;
  const built = db.prepare(`SELECT 1 FROM jobs WHERE workflow_id=? AND status='succeeded' AND kind<>'kernel' AND op_id IN (${buildOps.map(() => '?').join(',')}) AND updated_at<=? LIMIT 1`)
    .get(job.workflow_id, ...buildOps, job.created_at ?? Date.now());
  return !built;
}

/** The red checks of a measurement leg split by class: {findings[], errors[]}. */
export function measurementSplit(checks) {
  const findings = [], errors = [];
  for (const check of Array.isArray(checks) ? checks : []) {
    const cls = measurementCheckClass(check);
    if (cls === 'findings') findings.push(check);
    else if (cls === 'error') errors.push(check);
  }
  return { findings, errors };
}

/** A stable signature of an attempt's failure: HEAD plus every red check's name and exit code. Empty when there is nothing to compare. */
export function failureSignature(report, checks = null) {
  const red = (Array.isArray(checks) ? checks : Array.isArray(report?.checks) ? report.checks : [])
    .filter((c) => c && Number.isInteger(c.exitCode) && c.exitCode !== 0)
    .map((c) => `${String(c.name).trim()}=${c.exitCode}`).sort();
  if (!red.length) return '';
  return `${String(report?.head ?? '').slice(0, 12)}|${red.join(',')}`;
}

const envCheckRed = (checks) => (Array.isArray(checks) ? checks : []).some((c) => c && String(c.name ?? '').trim().toLowerCase() === ENV_HEALTH_CHECK && Number.isInteger(c.exitCode) && c.exitCode !== 0);
const otherNode = (rc, op) => rc && typeof rc.node === 'string' && rc.node.trim() && rc.self !== true && rc.node.split('#')[0] !== op;

/**
 * The failure class of one failed attempt.
 *   report      the filed starci/op-report@1 envelope (may be null: no report)
 *   checks      the kernel-recorded checks of the attempt (api check), else the report's
 *   measurement true for a measurement leg (isMeasurementLeg)
 *   prior       the previous attempt of the same lineage: {report, checks} or null
 * Returns {class, reason, stated?}.
 */
export function classifyFailure({ op, report, checks = null, measurement = false, prior = null }) {
  const all = [...(Array.isArray(checks) ? checks : []), ...(Array.isArray(report?.checks) ? report.checks : [])];
  const stated = FAILURE_CLASSES.includes(report?.failureClass) ? report.failureClass : null;
  if (report?.blocker?.kind === 'environment' || envCheckRed(all)) {
    return { class: 'environment', reason: report?.blocker?.kind === 'environment' ? 'blocker environment' : `${ENV_HEALTH_CHECK} check red: the stack under test was not ready`, ...(stated ? { stated } : {}) };
  }
  const verify = VERIFY_OPS.includes(op);
  if (measurement) {
    const split = measurementSplit(all);
    if (split.errors.length) return { class: 'tool', reason: `checker(s) did not measure: ${[...new Set(split.errors.map((c) => c.name))].join(', ')}` };
    return { class: 'findings', reason: split.findings.length ? `measured findings: ${[...new Set(split.findings.map((c) => c.name))].join(', ')}` : 'measurement leg' };
  }
  if ((stated === 'tool' || stated === 'transient') && op !== 'review.verify') {
    // A report may call itself transient only when nothing names a product defect.
    if (!otherNode(report?.rootCause, op)) return { class: stated, reason: 'stated by the report', stated };
  }
  if (op === 'review.verify') {
    // A read-only review never repairs: what it measured is findings for the build that made it
    // (kinds.yaml review-findings-repair-the-build); a checker that did not run is a tool failure.
    const split = measurementSplit(all);
    if (split.errors.length) return { class: 'tool', reason: `checker(s) did not measure: ${[...new Set(split.errors.map((c) => c.name))].join(', ')}` };
    if (split.findings.length || stated === 'findings' || otherNode(report?.rootCause, op)) return { class: 'findings', reason: 'a review gate measured findings', ...(stated ? { stated } : {}) };
  }
  if (otherNode(report?.rootCause, op)) return { class: 'product', reason: `rootCause names ${report.rootCause.node}`, ...(stated ? { stated } : {}) };
  if (stated === 'product') return { class: 'product', reason: 'stated by the report', stated };
  const signature = failureSignature(report, checks);
  if (signature && prior && signature === failureSignature(prior.report, prior.checks)) {
    return { class: verify ? 'product' : 'deterministic', reason: `identical failure to the previous attempt (${signature})` };
  }
  if (verify && report) {
    return { class: 'product', reason: 'a verify op filed failed: a defect in what it walked (a report states failureClass transient, tool or environment when it is not)' };
  }
  return { class: 'transient', reason: report ? 'no evidence of a deterministic cause' : 'no report' };
}

// ------------------------------------------------------------------ root cause → owning op and files

// Record id family → the kind that owns a repair of it. `impl` is decided by the record's repository role.
const FAMILY_KIND = {
  ui: 'interface.draw', sds: 'architecture.revise', contract: 'architecture.revise', architecture: 'architecture.revise',
  fr: 'business.revise', br: 'business.revise', ac: 'business.revise', nfr: 'business.revise', journey: 'business.revise',
  data: 'business.revise', decision: 'business.revise',
};
const FAMILY_DIR = { impl: 'impl', ui: 'ui', sds: 'sds', contract: 'contract', fr: 'fr', br: 'br', ac: 'ac', nfr: 'nfr', journey: 'journey', data: 'data', decision: 'decision', uat: 'uat', e2e: 'e2e' };
const ROLE_BUILD = { be: 'backend.implement', backend: 'backend.implement', fe: 'interface.implement', frontend: 'interface.implement' };

const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const posix = (p) => String(p).replace(/\\/g, '/');

/** The workspace repositories {name → role} of a ledger repo (.starciwork/workspace.yaml). */
export function workspaceRoles(repo) {
  const doc = readYaml(path.join(repo, '.starciwork', 'workspace.yaml'));
  const out = {};
  for (const r of Array.isArray(doc?.repositories) ? doc.repositories : []) if (r?.name) out[r.name] = r.role ?? null;
  return out;
}

/** The record file of a Work record id, or null: the id's own path first, then a bounded scan of its feature. */
export function findRecord(repo, id) {
  const m = /^([a-z]+)\.([a-z0-9-]+)\.(.+)$/.exec(String(id ?? '').split('#')[0]);
  if (!m) return null;
  const [, family, feature, rest] = m;
  const work = path.join(repo, '.starciwork');
  const featureDir = path.join(work, 'features', feature);
  const direct = path.join(featureDir, FAMILY_DIR[family] ?? family, ...rest.split('.'), 'index.yaml');
  if (fs.existsSync(direct)) return direct;
  const want = String(id).split('#')[0];
  const stack = [path.join(featureDir, FAMILY_DIR[family] ?? family)];
  let seen = 0;
  while (stack.length && seen < 400) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory() && !/^(E|runs|assets|node_modules)$/.test(e.name)) stack.push(path.join(dir, e.name));
      else if (e.isFile() && e.name === 'index.yaml') {
        seen += 1;
        const file = path.join(dir, e.name);
        try { if (new RegExp(`^id:\\s*['"]?${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*$`, 'm').test(fs.readFileSync(file, 'utf8'))) return file; } catch { /* unreadable */ }
      }
    }
  }
  return null;
}

/**
 * Who owns the repair a rootCause names. `kinds` is the kinds.yaml catalog (family, operator).
 * Returns {op, kind, repository?, role?, record?, ownedPaths[], via} or null when the node resolves to
 * nothing the runtime can repair. An explicit rootCause.op wins over the node's reading.
 */
export function resolveRootOwner({ repo, rootCause, kinds, failing = [], reporterPayload = {} }) {
  if (!rootCause || typeof rootCause !== 'object') return null;
  const catalog = kinds?.kinds ?? {};
  const opOfKind = (kind) => catalog[kind]?.operator ?? kind;
  const node = String(rootCause.node ?? '').trim();
  const roles = repo ? workspaceRoles(repo) : {};
  const declared = Array.isArray(rootCause.files) ? rootCause.files.filter((f) => typeof f === 'string' && f.trim()) : [];
  let kind = null, record = null, repository = null, role = null, via = null;
  const ownedPaths = [];
  if (typeof rootCause.op === 'string' && catalog[rootCause.op]) { kind = rootCause.op; via = 'rootCause.op'; }
  const nodeKind = node.split('#')[0];
  if (!kind && catalog[nodeKind]) { kind = nodeKind; via = 'rootCause.node (op)'; }
  if (repo && /^[a-z]+\.[a-z0-9-]+\..+/.test(node)) {
    const file = findRecord(repo, node);
    if (file) {
      const doc = readYaml(file) ?? {};
      record = posix(path.relative(repo, path.dirname(file)));
      repository = typeof doc.repository === 'string' ? doc.repository : null;
      role = repository ? roles[repository] ?? null : null;
      const family = node.split('.')[0];
      if (!kind) {
        kind = family === 'impl' ? ROLE_BUILD[role] ?? null : FAMILY_KIND[family] ?? null;
        via = `record ${node}${repository ? ` (repository ${repository}, role ${role ?? '?'})` : ''}`;
      }
      const prefix = repository && role && !/^(be|backend)$/.test(role) ? `repository:${repository}/` : '';
      for (const owner of Array.isArray(doc.owners) ? doc.owners : []) if (typeof owner?.path === 'string') ownedPaths.push(`${prefix}${posix(owner.path)}`);
      ownedPaths.push(record);
    }
  }
  if (!kind) return null;
  for (const f of declared) ownedPaths.unshift(posix(f));
  if (!ownedPaths.length) {
    // No record and no declared files: the reporter's own owned source paths of the owner's side.
    const beSide = /backend|^be$/.test(role ?? '') || kind === 'backend.implement';
    const own = (reporterPayload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean)
      .filter((p) => !/^\.starciwork\//.test(p))
      .filter((p) => (beSide ? !/^repository:/.test(p) : kind === 'interface.implement' ? /^repository:/.test(p) : true));
    ownedPaths.push(...own, ...failing.filter((f) => /[\\/]/.test(f)));
  }
  const unique = [...new Set(ownedPaths.map(posix))];
  return { kind, op: opOfKind(kind), family: catalog[kind]?.family ?? null, ...(repository ? { repository } : {}), ...(role ? { role } : {}), ...(record ? { record } : {}), ownedPaths: unique, via };
}
