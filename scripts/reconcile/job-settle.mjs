#!/usr/bin/env node
// job-settle.mjs — SETTLE as a deterministic runtime service (owner ruling settle-runtime-service, 2026-09-28): the
// first controller of the reconciler architecture (one loop engine, idempotent controllers per concern, LLMs as
// deciders only). The watchdog loop only CALLS it (scripts/kernel/watchdog.mjs), so it can move into the engine as is.
//
//   node scripts/reconcile/job-settle.mjs --repo <ledger-owner> [--workflow <id>] [--job <id>] [--dry-run] [--json]
//   node scripts/reconcile/job-settle.mjs --all [--dry-run] [--json]          every config.yaml supervisor.repos ledger
//   node scripts/reconcile/job-settle.mjs --invariant [--repo <r>] [--json]  read-only report of reported jobs past invariantMaxAgeMs
//
// reconcileJobSettle({repo, workflowId?, jobId?}) drives each job whose worker filed a report through explicit states,
// one typed ledger event per transition:
//
//   reported --(outcome done + declared checks re-verify green)--> settled   event job-settle-settled
//   reported --(the report or a raw re-run decides it: failed|partial, blocked|ask, a red re-run)--> settled fail|blocked
//                                                                          event job-settle-settled (H1: no Kernel needed)
//   reported --(a checker that could not run)---------------------> stays reported, retried; after tail.maxAttempts
//                                                                    one runtime-defect Decision Item (H7: never red)
//   reported --(judgment: not re-verifiable, owner act, refusal)--> kernel    event job-settle-needs-kernel
//   settled  --(worker close proven, or closed and verified now)--> released  event job-settle-released
//   released --(isolated op: its product worktree removed, verified)--> worktree-removed  event job-worktree-removed
//            (scripts/kernel/product-worktree.mjs productWorktreeDuty; DESIGN §16.7)
//
// `reported` is a live job (running/answering/effect_unknown) with a reports row for its contract's dispatch, consumed
// or not: consume is part of settle, so consumed-but-unsettled is due like filed. The settle itself is the SAME code
// path as the Kernel's: `api check --checks-file` (the re-run results) then `api settle --verdict pass`, so every
// refusal of settle (landed proof, cut checks, draw acceptance, handover approval ...) still holds; a refusal hands the
// job to the Kernel with its code. The settler settles what the evidence decides without judgment (H1): a failed or
// partial report fails, a blocked or ask report settles blocked, a done report whose RAW re-run is red fails (claim
// overruled, the failure routes then run). It never passes on a worker-declared exit code (H8): every verdict is the
// raw exit the runtime observed. It never settles an op whose pass is an owner act, nor a done report nothing re-verifies.
//
// Idempotent: a settled job is not due; a needs-kernel handover is recorded once per dispatch and reason; a release is
// recorded once per job. Two passes never work one job: each item takes a per-job host lock.
//
// Verification ("declared checks verify green"):
//   - a checks row the Kernel already recorded for the attempt: green -> settle; red -> kernel;
//   - else every check the report declares must claim exit 0 (a *-before/baseline measurement is evidence, not a
//     verdict, and is skipped), and every one that is a check (not a git/read action)
//     must be a runtime check the settler can re-run without a shell: node <runtime>/bin/starci.mjs validate ...,
//     node <runtime>/scripts/checks/<x>.mjs ... (never --fix/--write/--apply), node <runtime>/scripts/work/work-graph.mjs
//     validate|show|diff ...; each re-run (argv, no shell, cwd = the ledger repo) must exit 0;
//   - a cut slice (payload.cut) records the two cut checks settle demands: a canon slice (params.canonFamilies) re-runs
//     canon-scan in-process over its owned paths (cut-slice-postcondition, paths never on a command line) and the
//     declared re-runs are its cut-regression-inventory; any other cut, and the set-closing pass (full-regression-final),
//     is the Kernel's.
//   - CANON PARITY (contract change canon-parity-settle): a done code.refactor canon cut slice whose declared checks are
//     red or not re-verifiable is measured by the settler itself over its owned paths against its admission base
//     (scripts/reconcile/canon-parity.mjs): canon-scan 0 findings, check-scoped-lint no new finding, typecheck no new
//     error, every declared red superseded by those owned-scope measurements (foreign residue). Any new finding -> Kernel.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor, updateAttempt } from '../../engine/ledger-db.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { claimManager, lockHolder } from '../connectors/lib.mjs';
import { canonParityVerdict, parityEligible, parityFingerprint, parityTransient, PARITY_REASONS, resolveOwnedRoot } from './canon-parity.mjs';
import { checkRunStatusOf, checkVerdictOf } from './check-verdict.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const SKILL_ROOT = path.resolve(path.dirname(selfFile), '..', '..');
const API_FILE = path.join(SKILL_ROOT, 'scripts', 'kernel', 'api.mjs');

export const EVENTS = Object.freeze({
  settled: 'job-settle-settled',
  needsKernel: 'job-settle-needs-kernel',
  released: 'job-settle-released',
  invariant: 'job-settle-invariant-violated',
  checkUnavailable: 'job-settle-check-unavailable',
});
export const STATES = Object.freeze({ reported: 'reported', settled: 'settled', released: 'released', kernel: 'needs-kernel' });
// A job whose op filed its report (api report moves it to reported) until a verdict settles it.
const LIVE = ['running', 'answering', 'effect_unknown', 'reported', 'deciding'];
const SETTLED = ['succeeded', 'failed', 'cancelled'];
/** Ops whose pass is an owner act, never a machine verdict. */
export const KERNEL_ONLY_OPS = Object.freeze(['handover.review']);
const CUT_SLICE_CHECKS = ['cut-slice-postcondition', 'cut-regression-inventory'];

/** allocation.settler with defaults for a runtime without the block. */
export function settlerSettings(allocation = (() => { try { return allocationSettings(); } catch { return {}; } })()) {
  const s = allocation?.settler ?? {};
  const pos = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    everyMs: pos(s.everyMs, 60_000), rerunTimeoutMs: pos(s.rerunTimeoutMs, 300_000), itemBudgetMs: pos(s.itemBudgetMs, 900_000),
    invariantMaxAgeMs: pos(s.invariantMaxAgeMs, 180_000), releaseWindowMs: pos(s.releaseWindowMs, 86_400_000),
    tail: { retryMs: pos(s.tail?.retryMs, 120_000), maxAttempts: pos(s.tail?.maxAttempts, 5) },
  };
}

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const slug = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
const repoKey = (repo) => crypto.createHash('sha1').update(path.resolve(repo).toLowerCase()).digest('hex').slice(0, 10);
/** The environment a runtime child runs with: never an op caller's identity (api callerOf reads these). */
export const runtimeEnv = (env = process.env) => {
  const out = { ...env, STARCI_CALLER: 'runtime-settler' };
  for (const k of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB', 'STARCI_OP_PROVIDER']) delete out[k];
  return out;
};

/* ------------------------------------------------------------ reads */

/**
 * The reported jobs: a live op job of a not-archived workflow with a reports row for its
 * contract's dispatch, filed or consumed. Pure SQL over the ledger; the attempt's contract binds the dispatch. [{jobId, workflowId, op, attempt, status, workerId,
 * payload, dispatchId, outcome, consumedAt, filedAt, report}]
 */
export function reportedJobs(db, { workflowId = null, jobId = null } = {}) {
  const where = ["j.kind='op'", `j.status IN (${LIVE.map(() => '?').join(',')})`];
  const args = [...LIVE];
  if (workflowId) { where.push('j.workflow_id=?'); args.push(workflowId); }
  if (jobId) { where.push('j.job_id=?'); args.push(jobId); }
  return db.prepare(`SELECT j.job_id, j.workflow_id, j.op_id, j.try_no AS attempt, j.status, j.worker_id, j.payload_json, a.attempt_id,
      r.dispatch_id, r.outcome, r.consumed_at, r.created_at AS filed_at, r.report_json
    FROM jobs j
    JOIN op_attempts a ON a.job_id=j.job_id AND a.attempt_id=(SELECT max(x.attempt_id) FROM op_attempts x WHERE x.job_id=j.job_id)
    JOIN reports r ON r.attempt_id=a.attempt_id
    JOIN workflows w ON w.workflow_id=j.workflow_id AND w.phase<>'archived'
    WHERE ${where.join(' AND ')} ORDER BY r.created_at`).all(...args).map((r) => ({
    jobId: r.job_id, workflowId: r.workflow_id, op: r.op_id, attempt: r.attempt, attemptId: r.attempt_id, status: r.status, workerId: r.worker_id,
    payload: parse(r.payload_json) ?? {}, dispatchId: r.dispatch_id, outcome: r.outcome, consumedAt: r.consumed_at ?? null,
    filedAt: Number(r.filed_at), report: parse(r.report_json) ?? {},
  }));
}

/** The latest run of each check of the item's attempt for one runner (check_runs, alpha.3). */
export function checkRunsOf(db, item, runner = 'op') {
  const attemptId = attemptIdOf(db, item);
  if (attemptId == null) return [];
  return db.prepare(`SELECT c.name, c.phase, c.runner, c.command, c.cwd, c.exit_code, c.declared_exit_code, c.status, c.started_at, c.finished_at,
      c.stdout_sha, c.stderr_sha, c.output_sha, c.summary_json
    FROM check_runs c WHERE c.attempt_id=? AND c.runner=? AND c.run_seq=(SELECT max(run_seq) FROM check_runs x
      WHERE x.attempt_id=c.attempt_id AND x.runner=c.runner AND x.phase=c.phase AND x.name=c.name) ORDER BY c.check_id`).all(attemptId, runner);
}
/** The op_attempts row the item's report was filed from. */
const attemptIdOf = (db, item) => item.attemptId ?? db.prepare(`SELECT attempt_id FROM op_attempts WHERE (workflow_id=? AND dispatch_id=?) OR job_id=?
  ORDER BY (dispatch_id=?) DESC, dispatch_seq DESC LIMIT 1`).get(item.workflowId, item.dispatchId ?? null, item.jobId, item.dispatchId ?? null)?.attempt_id ?? null;

/** Blob references are read and verified before a recorded check is trusted. */
async function checksFromStore(db, item, { store = null } = {}) {
  const rows = checkRunsOf(db, item);
  if (!rows.length) return { item, source: 'report' }; // in-flight jobs dispatched before the migration
  const blobs = store ?? await import('../lib/artifact-store.mjs');
  const declared = Array.isArray(item.report?.checks) ? item.report.checks : [];
  const byName = new Map(declared.map((c) => [String(c.name), c]));
  const checks = [];
  for (const row of rows) {
    const raw = {};
    for (const [key, sha] of [['stdout', row.stdout_sha], ['stderr', row.stderr_sha], ['output', row.output_sha]]) {
      if (!sha) continue;
      try { raw[key] = await blobs.getBlob(sha); }
      catch { return { reason: 'check-output-missing', detail: [`${row.name}:${key}:${sha}`] }; }
      if (!Buffer.isBuffer(raw[key]) || crypto.createHash('sha256').update(raw[key]).digest('hex') !== sha)
        return { reason: 'check-output-corrupt', detail: [`${row.name}:${key}:${sha}`] };
    }
    const claim = byName.get(row.name) ?? {};
    const output = raw.output ? parse(raw.output.toString('utf8')) : null;
    if (raw.output && output === null) return { reason: 'check-output-invalid', detail: [`${row.name}:output is not JSON`] };
    checks.push({ ...claim, name: row.name, command: row.command ?? claim.command ?? '', exitCode: row.exit_code ?? row.declared_exit_code,
      status: row.status, phase: row.phase, summary: parse(row.summary_json), ...(output !== null ? { output } : {}),
      ...(raw.stdout ? { stdoutTail: raw.stdout.toString('utf8').slice(-300) } : {}),
      ...(raw.stderr ? { stderrTail: raw.stderr.toString('utf8').slice(-300) } : {}) });
  }
  if (declared.length !== checks.length || declared.some((c) => !checks.some((r) => r.name === c.name)))
    return { reason: 'check-run-missing', detail: [
      `declared=${declared.length} stored=${checks.length}`,
      ...declared.filter((c) => !checks.some((r) => r.name === c.name)).map((c) => String(c.name)),
    ].slice(0, 8) };
  return { item: { ...item, report: { ...item.report, checks } }, source: 'check-runs' };
}

/** The latest needs-kernel handover of a job's current dispatch, or null. */
export function kernelHandoverOf(db, item) {
  const row = db.prepare(`SELECT payload_json, created_at FROM events WHERE kind=? AND entity_id=? AND json_extract(payload_json,'$.dispatchId')=?
    ORDER BY seq DESC LIMIT 1`).get(EVENTS.needsKernel, item.jobId, item.dispatchId);
  return row ? { ...(parse(row.payload_json) ?? {}), at: Number(row.created_at) } : null;
}

/**
 * What waits on the Kernel's decision in one workflow: reported jobs the settler handed over (needs-kernel) and the
 * owner-act ops it never settles (H1: every other outcome the settler settles itself). [{jobId, op, attempt, outcome, reason, ageMin, consumed}] oldest first. `ageMs` filters.
 */
export function kernelDecisionItems(db, workflowId, { now = Date.now(), ageMs = 0 } = {}) {
  return reportedJobs(db, { workflowId }).filter((it) => now - it.filedAt >= ageMs).flatMap((it) => {
    const handover = kernelHandoverOf(db, it);
    const ownerAct = KERNEL_ONLY_OPS.includes(it.op);
    if (!handover && !ownerAct) return [];
    return [{ jobId: it.jobId, op: it.op, attempt: it.attempt, outcome: it.outcome, dispatchId: it.dispatchId,
      reason: handover?.reason ?? 'owner-act',
      ...(handover?.detail ? { detail: handover.detail } : {}), ageMin: Math.round((now - it.filedAt) / 60_000), consumed: it.consumedAt != null }];
  });
}

/**
 * THE INVARIANT (Supervisor tick): no reported job older than maxAgeMs, whatever its outcome (H1), that the runtime
 * neither settled nor handed to the Kernel nor holds for a checker that could not run. Each one is a runtime bug (settle-unsettled-report). [{workflowId, jobId, op, outcome, ageMin, consumed}]
 */
const uncheckable = (db, it) => Boolean(db.prepare("SELECT 1 FROM events WHERE kind=? AND entity_id=? LIMIT 1").get(EVENTS.checkUnavailable, it.jobId));
export function unsettledViolations(db, { now = Date.now(), maxAgeMs = settlerSettings().invariantMaxAgeMs, workflowId = null } = {}) {
  return reportedJobs(db, { workflowId }).filter((it) => now - it.filedAt > maxAgeMs && !KERNEL_ONLY_OPS.includes(it.op) && !kernelHandoverOf(db, it) && !uncheckable(db, it))
    .map((it) => ({ workflowId: it.workflowId, jobId: it.jobId, dispatchId: it.dispatchId, op: it.op, outcome: it.outcome, ageMin: Math.round((now - it.filedAt) / 60_000), ageMs: now - it.filedAt, consumed: it.consumedAt != null }));
}

/* ------------------------------------------------------------ verification */

/** Split a command line into argv, quotes honoured; null when it holds a shell operator or a <placeholder>. */
export function argvOf(command) {
  const s = String(command ?? '').trim();
  if (!s) return null;
  const out = []; let cur = ''; let q = null; let any = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; any = true; continue; }
    if (/\s/.test(c)) { if (cur || any) out.push(cur); cur = ''; any = false; continue; }
    if ('&|;<>`'.includes(c) || (c === '$' && s[i + 1] === '(')) return null;
    cur += c;
  }
  if (q) return null;
  if (cur || any) out.push(cur);
  return out;
}

const norm = (p) => String(p).replace(/\\/g, '/');
const ACTION = /^(?:git\s+(?:add|commit|status|rev-parse|log|diff|show|push|fetch|cat-file|merge-base|ls-files|branch|stash)\b|n\/a\b|read\b|cat\b|type\b|ls\b|dir\b)/i;
const BASELINE_NAME = /(?:^|[-_.\s])(?:before|baseline)(?:$|[-_.\s])/i;
const MUTATING_FLAG = /^--(?:fix|write|apply|in-place)(?:=|$)/;

/**
 * One declared check, classified: {kind: 'action'} (evidence of an action, not a check), {kind: 'runtime', argv, script}
 * (re-runnable), or {kind: 'foreign', why}.
 */
export function classifyCheck(check, { skillRoot = SKILL_ROOT } = {}) {
  const command = String(check?.command ?? '').trim();
  if (!command || ACTION.test(command)) return { kind: 'action' };
  const argv = argvOf(command);
  if (!argv) return { kind: 'foreign', why: 'shell-or-placeholder' };
  if (!/^node(?:\.exe)?$/i.test(path.basename(argv[0])) || !argv[1]) return { kind: 'foreign', why: 'not-a-runtime-check' };
  const rel = /(?:^|\/)\.claude\/((?:bin|scripts)\/.+\.mjs)$/i.exec(norm(argv[1]))?.[1]
    ?? (norm(path.resolve(argv[1])).toLowerCase().startsWith(`${norm(skillRoot).toLowerCase()}/`) ? norm(path.relative(skillRoot, path.resolve(argv[1]))) : null);
  if (!rel) return { kind: 'foreign', why: 'outside-runtime' };
  const rest = argv.slice(2);
  if (rest.some((a) => MUTATING_FLAG.test(a))) return { kind: 'foreign', why: 'mutating-flag' };
  const ok = (rel === 'bin/starci.mjs' && rest[0] === 'validate')
    || (/^scripts\/checks\/[\w.-]+\.mjs$/.test(rel))
    || (rel === 'scripts/work/work-graph.mjs' && ['validate', 'show', 'diff'].includes(rest[0]));
  if (!ok) return { kind: 'foreign', why: `not-a-check-script:${rel}` };
  return { kind: 'runtime', script: path.join(skillRoot, ...rel.split('/')), argv: rest, rel };
}

/** Re-run one runtime check: argv, no shell, cwd = the ledger repo. {exitCode, ms, tail} */
export function rerunCheck(c, { repo, timeoutMs, env = process.env, run = spawnSync }) {
  const t0 = Date.now();
  const r = run(process.execPath, [c.script, ...c.argv], { cwd: repo, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, env: runtimeEnv(env), maxBuffer: 64 * 1024 * 1024 });
  const exitCode = r.error ? (r.error.code === 'ETIMEDOUT' ? 124 : 127) : (r.status ?? 1);
  const stdout = Buffer.isBuffer(r.stdout) ? r.stdout : Buffer.from(String(r.stdout ?? ''));
  const stderr = Buffer.isBuffer(r.stderr) ? r.stderr : Buffer.from(String(r.stderr ?? r.error?.message ?? ''));
  return { exitCode, ms: Date.now() - t0, startedAt: t0, finishedAt: Date.now(), cwd: repo,
    stdout, stderr, output: jsonOf(stdout.toString('utf8')),
    tail: String(r.stderr || r.stdout || r.error?.message || '').trim().split(/\r?\n/).slice(-2).join(' ').slice(0, 300) };
}

/** Canon-scan over a slice's owned paths, in-process (no path on a command line). {exitCode, status, findings, root} */
export async function canonSliceCheck(item, { repo }) {
  const { ownedPathPlacements } = await import('../kernel/target-repo.mjs');
  const owned = item.payload.owned_paths ?? [];
  // An isolated op (DESIGN §16.7) is measured in its OWN worktree, never the live checkout its siblings still edit.
  const own = item.payload.productWorktree;
  const worktree = own?.op?.path && (!own.jobId || own.jobId === item.jobId) && fs.existsSync(own.op.path) ? own.op.path : undefined;
  const places = ownedPathPlacements({ op: item.op, payload: item.payload, ownedPaths: owned, repo, worktree });
  const bases = [...new Set(places.map((p) => p.base && path.resolve(p.base)).filter(Boolean))];
  if (!owned.length || places.some((p) => p.unresolved || !p.base) || bases.length !== 1) return { exitCode: 2, status: 'unresolved', why: 'owned paths do not resolve into one checkout' };
  const { scanCanon, parseCanonScanArgs } = await import('../checks/canon-scan.mjs');
  // The options are built in memory (argv parsing only derives the machines); the paths never reach a command line.
  const options = parseCanonScanArgs(['--root', bases[0], '--families', String(item.payload.params?.canonFamilies ?? 'all'), '--json']);
  options.paths = places.map((p) => norm(p.path).replace(/\/\*\*$/, '').replace(/\/+$/, ''));
  const report = await scanCanon(options);
  const findings = Array.isArray(report?.findings) ? report.findings.length : null;
  const list = (Array.isArray(report?.findings) ? report.findings : []).slice(0, 500).map((f) => ({ file: norm(f.file ?? ''), ruleId: f.ruleId ?? null, line: f.line ?? null, family: f.family ?? null }));
  return { exitCode: report?.status === 'ok' ? 0 : report?.status === 'findings' ? 1 : 3, status: report?.status ?? null, findings, list, root: bases[0], paths: places.length, output: report };
}

/**
 * Persist each settler measurement before its verdict is used, including failed re-runs: one check_runs row
 * (scripts/kernel/evidence-store.mjs recordCheck) with the RAW exit this runner observed, stdout/stderr/output as
 * redacted blobs. A checker that could not run (exit 124 timeout / 127 spawn failure, or status 'unavailable') is
 * 'unavailable', never red (H7). Returns the check id.
 */
export async function recordSettlerCheck(ledger, item, run, { now = Date.now } = {}) {
  const { stageBlob, recordCheck, CHECK_STATUSES } = await import('../kernel/evidence-store.mjs');
  const bytes = (content) => (content == null ? null : Buffer.isBuffer(content) ? content : Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)));
  const blob = (content, mediaType) => { const b = bytes(content); return b && b.length ? stageBlob(b, { mediaType, repoRoots: [item.repo].filter(Boolean) }) : null; };
  const stdout = blob(run.stdout, 'text/plain'), stderr = blob(run.stderr, 'text/plain'), output = blob(run.output, 'application/json');
  const at = now();
  const status = CHECK_STATUSES.includes(run.status) ? run.status : checkRunStatusOf(run);
  return ledger.transaction((db) => {
    const attemptId = attemptIdOf(db, item);
    if (attemptId == null) throw Object.assign(new Error(`no attempt for job ${item.jobId}`), { code: 'check-attempt-missing' });
    return recordCheck(db, { attemptId, name: String(run.name), phase: run.phase ?? 'verify', runner: run.runner ?? 'settler', command: run.command ?? null,
      cwd: run.cwd ?? null, inputDigest: run.inputDigest ?? null, exitCode: Number.isInteger(run.exitCode) ? run.exitCode : null,
      declaredExitCode: Number.isInteger(run.declaredExitCode) ? run.declaredExitCode : null, attribution: run.attribution ?? null, status,
      unavailable: status === 'unavailable' || run.exitCode === 124 || run.exitCode === 127, startedAt: run.startedAt ?? at, finishedAt: run.finishedAt ?? at,
      stdout, stderr, output, summary: run.summary ?? null, note: run.note ?? null, now: at }).checkId;
  });
}

/**
 * Is this reported job green? {green, reason?, detail?, checks?: envelope for api check (null: already recorded), via}
 * Seams: rerun (rerunCheck), canon (canonSliceCheck).
 */
export async function verifyReported(db, item, { repo, settings = settlerSettings(), rerun = rerunCheck, canon = canonSliceCheck, env = process.env,
  parity = parityEnabled(env) ? canonParityVerdict : null, parityDeps = {}, store = null, record = async () => {} } = {}) {
  const loaded = await checksFromStore(db, item, { store });
  if (loaded.reason) return { green: false, reason: loaded.reason, detail: loaded.detail };
  item = loaded.item;
  const plain = await verifyDeclared(db, item, { repo, settings, rerun, canon, env, record });
  // CANON PARITY (canon-parity-settle): a canon cut slice the declared checks cannot carry is measured by the settler
  // itself over its owned paths; it settles only when nothing is new there, else the Kernel gets the parity reason.
  if (plain.green || !parity || !parityEligible(item) || !PARITY_REASONS.includes(plain.reason)) return plain;
  // A measurement takes minutes and the settler passes every minute: a handed-over verdict is reused while the slice's
  // base and owned files are unchanged (PARITY_RECHECK_MS; a sibling's mid-run edit only PARITY_TRANSIENT_MS).
  const resolveRoot = parityDeps.resolveRoot ?? resolveOwnedRoot;
  let fingerprint = null;
  try { fingerprint = await parityFingerprint(item, { repo, resolveRoot }); } catch { fingerprint = null; }
  const cached = fingerprint ? readParityCache(repo, item) : null;
  const now = Date.now();
  if (cached && cached.dispatchId === item.dispatchId && cached.fingerprint === fingerprint
    && now - cached.at < (cached.transient ? PARITY_TRANSIENT_MS : PARITY_RECHECK_MS)) return { ...cached.verdict, cached: true };
  const measured = await parity(item, { repo, settings, env, rerun, canon, classify: (c) => classifyCheck(c), baseline: isBaselineCheck,
    wireLegs: () => canonWireLegsOf(db, item), record, ...parityDeps, resolveRoot });
  const verdict = measured.green ? measured
    : { ...measured, detail: [`declared: ${plain.reason}${plain.detail ? ` ${plain.detail.slice(0, 4).join(', ')}` : ''}`, ...(measured.detail ?? [])].slice(0, 8) };
  if (!verdict.green && fingerprint) writeParityCache(repo, item, { fingerprint, at: now, transient: parityTransient(measured), verdict: { green: false, reason: verdict.reason, detail: verdict.detail } });
  return verdict;
}
/** The workflow's canon-wire legs of the slice's op, queued or running: [{jobId, status, ownedPaths}]. */
export function canonWireLegsOf(db, item) {
  try {
    return db.prepare(`SELECT job_id, status, payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND status IN ('queued','leased','running')
      AND json_extract(payload_json,'$.params.canonWire') IN (1, 'true')`).all(item.workflowId, item.op)
      .map((r) => ({ jobId: r.job_id, status: r.status, ownedPaths: (parse(r.payload_json)?.owned_paths ?? []).map(String) }));
  } catch { return []; }
}
export const PARITY_RECHECK_MS = 30 * 60_000;
export const PARITY_TRANSIENT_MS = 5 * 60_000;
/** <ledger dir>/settle-parity/<jobId>.json: the last non-green parity verdict of a dispatch. */
export const parityCacheFile = (repo, jobId) => path.join(path.dirname(ledgerFileFor(path.resolve(repo))), 'settle-parity', `${slug(jobId)}.json`);
function readParityCache(repo, item) { try { return JSON.parse(fs.readFileSync(parityCacheFile(repo, item.jobId), 'utf8')); } catch { return null; } }
function writeParityCache(repo, item, rec) {
  try { const f = parityCacheFile(repo, item.jobId); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ dispatchId: item.dispatchId, ...rec })); } catch { /* a cache */ }
}
/** STARCI_SETTLER_PARITY=0 turns the canon parity verifier off (the rollback of canon-parity-settle). */
export const parityEnabled = (env = process.env) => String(env.STARCI_SETTLER_PARITY ?? '1') !== '0';
/** A baseline measured BEFORE the change (canon-scan-before, scoped-lint-before ...): evidence, never a verdict. */
export const isBaselineCheck = (c) => BASELINE_NAME.test(String(c?.name ?? ''));

/**
 * The declared-checks verdict (H8): every declared check the runtime can re-run IS re-run, and only its RAW exit counts
 * - never the exit the worker declared, never a check the Kernel recorded by hand. A declared red that is not
 * re-verifiable is the worker's own admission (declared-check-red, still subject to canon parity). A checker that could
 * not run is unavailable (H7): {green:false, unavailable:true}, never red. A red re-run carries its raw checks
 * envelope, so the settler records it (api check) before it settles the claim overruled.
 */
async function verifyDeclared(db, item, { repo, settings, rerun, canon, env, record }) {
  if (item.outcome !== 'done') return { green: false, reason: `outcome-${item.outcome}` };
  if (KERNEL_ONLY_OPS.includes(item.op)) return { green: false, reason: 'owner-act' };
  const declared = Array.isArray(item.report.checks) ? item.report.checks : [];
  if (!declared.length) return { green: false, reason: 'no-declared-checks' };
  // A baseline measured BEFORE the change (canon-scan-before, scoped-lint-before ...) is the refactor's starting point,
  // not its verdict: its exit code is evidence, never a red, and it is not re-run (the tree has moved on).
  const classed = declared.filter((c) => !isBaselineCheck(c)).map((c) => ({ check: c, ...classifyCheck(c) }));
  const foreign = classed.filter((c) => c.kind === 'foreign');
  const foreignRed = foreign.filter((c) => c.check?.exitCode !== 0);
  if (foreignRed.length) {
    return { green: false, reason: 'declared-check-red', detail: foreignRed.slice(0, 8).map((c) => `${c.check.name}:${c.check.exitCode}`),
      checks: { checks: foreignRed.map((c) => ({ name: String(c.check.name), exitCode: Number.isInteger(c.check.exitCode) ? c.check.exitCode : 1, command: String(c.check.command ?? '').slice(0, 2000),
        evidence: `worker-declared exit ${c.check.exitCode}, not re-verifiable (${c.why}): the worker's own admission` })) } };
  }
  if (foreign.length) return { green: false, reason: 'check-not-reverifiable', detail: foreign.slice(0, 8).map((c) => `${c.check.name}:${c.why}`) };
  const runtime = classed.filter((c) => c.kind === 'runtime');
  if (!runtime.length) return { green: false, reason: 'nothing-reverifiable' };
  const started = Date.now();
  const checks = [];
  for (const c of runtime) {
    if (Date.now() - started > settings.itemBudgetMs) return { green: false, reason: 'verify-budget-exceeded', unavailable: true };
    const r = rerun(c, { repo, timeoutMs: settings.rerunTimeoutMs, env });
    await record({ name: String(c.check.name ?? c.rel), command: String(c.check.command), phase: 'verify', runner: 'settler',
      declaredExitCode: Number.isInteger(c.check.exitCode) ? c.check.exitCode : null, ...r });
    const v = checkVerdictOf(r);
    if (v.verdict === 'unavailable') return { green: false, unavailable: true, reason: 'checker-unavailable', detail: [`${c.check.name}:${r.exitCode}${v.word ? ` ${v.word}` : ''} ${r.tail ?? ''}`.slice(0, 300)] };
    const entry = { name: String(c.check.name ?? c.rel), exitCode: r.exitCode, command: String(c.check.command).slice(0, 2000),
      evidence: `runtime settler re-run: raw exit ${r.exitCode} in ${Math.round(r.ms / 100) / 10}s (worker declared exit ${c.check.exitCode})` };
    if (v.verdict === 'red') return { green: false, reason: 'rerun-red', detail: [`${c.check.name}:${r.exitCode} ${r.tail}`.slice(0, 300)], checks: { checks: [...checks, entry] } };
    checks.push(entry);
  }
  if (item.payload.cut) {
    if (!item.payload.params?.canonFamilies) return { green: false, reason: 'cut-not-canon' };
    const slice = await canon(item, { repo });
    await record({ name: CUT_SLICE_CHECKS[0], command: `canon-scan --root ${slice.root ?? repo}`, cwd: slice.root ?? repo,
      phase: 'verify', runner: 'settler', exitCode: slice.exitCode, status: slice.status === 'unresolved' ? 'unavailable' : undefined, output: slice.output ?? slice, summary: { status: slice.status, findings: slice.findings } });
    const v = checkVerdictOf({ exitCode: slice.exitCode, status: slice.status });
    if (v.verdict === 'unavailable') return { green: false, unavailable: true, reason: 'checker-unavailable', detail: [`canon-scan ${slice.status ?? '?'}${slice.why ? ` ${slice.why}` : ''}`] };
    if (v.verdict === 'red') {
      return { green: false, reason: 'cut-postcondition-red', detail: [`canon-scan ${slice.status ?? '?'}${slice.findings != null ? ` ${slice.findings} finding(s)` : ''}`],
        checks: { checks: [...checks, { name: CUT_SLICE_CHECKS[0], exitCode: slice.exitCode, command: `canon-scan (in-process) --root ${slice.root}`, evidence: `runtime settler: canon-scan ${slice.status}, ${slice.findings ?? '?'} finding(s) on the slice's owned paths` }] } };
    }
    checks.push({ name: CUT_SLICE_CHECKS[0], exitCode: 0, command: `canon-scan (in-process) --root ${slice.root} over the slice's ${slice.paths} owned path(s)`,
      evidence: `runtime settler: canon-scan status ok, 0 findings on the slice's owned paths (families ${item.payload.params.canonFamilies})` });
    checks.push({ name: CUT_SLICE_CHECKS[1], exitCode: 0, command: runtime.map((c) => c.check.name).join(' + '),
      evidence: `runtime settler: the ${runtime.length} runtime check(s) re-ran with raw exit 0 - no new failure in the slice's regression inventory` });
  }
  return { green: true, via: 'rerun', checks: { checks } };
}

/* ------------------------------------------------------------ actions */

const jsonOf = (text) => {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const direct = parse(t); if (direct) return direct;
  for (const line of t.split(/\r?\n/).reverse()) { const v = parse(line.trim()); if (v && typeof v === 'object') return v; }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  return a >= 0 && b > a ? parse(t.slice(a, b + 1)) : null;
};
/** `node scripts/kernel/api.mjs <verb> ... --json` as the runtime: {ok, value, error, code} */
export function runApi(args, { env = process.env, timeoutMs = 600_000 } = {}) {
  const r = spawnSync(process.execPath, [API_FILE, ...args, '--json'], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, env: runtimeEnv(env), maxBuffer: 64 * 1024 * 1024 });
  const value = jsonOf(r.stdout), err = jsonOf(r.stderr);
  const ok = r.status === 0 && value?.ok !== false;
  return { ok, value, status: r.status, code: value?.code ?? err?.code ?? value?.reason ?? null,
    error: ok ? null : String(value?.error ?? value?.reason ?? err?.error ?? r.stderr ?? r.error?.message ?? '').slice(0, 600) };
}

const tmpDir = () => path.join(os.tmpdir(), 'starci-settler');
/** Write the checks envelope to a file (never on a command line). */
const checksFile = (item, envelope) => {
  fs.mkdirSync(tmpDir(), { recursive: true });
  const file = path.join(tmpDir(), `${slug(item.jobId)}-${Date.now()}.checks.json`);
  fs.writeFileSync(file, JSON.stringify(envelope));
  return file;
};

const event = (ledger, item, kind, payload) => ledger.transaction(() => ledger.appendEvent({
  workflowId: item.workflowId, entityType: 'job', entityId: item.jobId, kind, payload: { dispatchId: item.dispatchId ?? null, ...payload } }));

/** Stamp the job's latest attempt (op_attempts, through the ledger writer). */
function markAttempt(ledger, item, fields) {
  ledger.transaction((db) => {
    const attemptId = item.attemptId ?? db.prepare('SELECT max(attempt_id) id FROM op_attempts WHERE job_id=?').get(item.jobId)?.id ?? null;
    if (attemptId != null) updateAttempt(db, { attemptId, ...fields });
  });
}

/** Reasons a raw re-run or the worker's own declared red decide: the claim is overruled, the attempt fails. */
export const RED_REASONS = Object.freeze(['rerun-red', 'declared-check-red', 'cut-postcondition-red', 'parity-rerun-red', 'parity-lint-new', 'parity-tsc-new', 'parity-diff-red']);
/**
 * What the evidence decides without judgment (H1), or null when it needs the Kernel: {verdict, checks?}. A failed or
 * partial report fails; a blocked or ask report settles blocked (an ask waits on the owner); a done report whose raw
 * re-run is red fails with that red recorded first.
 */
export function mechanicalSettleOf(item, verdict) {
  if (KERNEL_ONLY_OPS.includes(item.op)) return null;
  if (['failed', 'partial'].includes(item.outcome)) return { verdict: 'fail' };
  if (['blocked', 'ask'].includes(item.outcome)) return { verdict: 'blocked' };
  if (item.outcome !== 'done' || !RED_REASONS.includes(verdict.reason)) return null;
  // A parity measurement records its own check_runs; its red is recorded for api settle as one runtime check.
  const checks = verdict.checks?.checks?.length ? verdict.checks
    : { checks: [{ name: verdict.reason, exitCode: 1, command: 'runtime settler (canon parity)', evidence: (verdict.detail ?? []).join('; ').slice(0, 1500) || verdict.reason }] };
  return { verdict: 'fail', checks };
  return null;
}

/**
 * H7: a checker that could not run keeps the job reported (the next pass measures again, tail.retryMs apart); after
 * tail.maxAttempts such passes one runtime-defect Decision Item goes to the Supervisor. Never red, never the Kernel's.
 */
async function checkerUnavailable(ledger, item, verdict, { now, settings }) {
  const prior = ledger.db.prepare(`SELECT count(*) n, max(created_at) at FROM events WHERE kind=? AND entity_id=? AND json_extract(payload_json,'$.dispatchId') IS ?`)
    .get(EVENTS.checkUnavailable, item.jobId, item.dispatchId ?? null);
  const tries = Number(prior?.n ?? 0);
  if (tries && now - Number(prior.at) < settings.tail.retryMs) return { jobId: item.jobId, reason: 'checker-unavailable', waiting: true, tries };
  event(ledger, item, EVENTS.checkUnavailable, { op: item.op, try: tries + 1, detail: verdict.detail ?? null });
  if (tries + 1 < settings.tail.maxAttempts) return { jobId: item.jobId, reason: 'checker-unavailable', tries: tries + 1 };
  let decision = null;
  try {
    const { openDecisionRow } = await import('../reconciler/decisions.mjs');
    decision = openDecisionRow(ledger, { kind: 'runtime-defect', decider: 'supervisor', workflowId: item.workflowId, entity: { type: 'job', id: item.jobId },
      idempotencyKey: `checker-unavailable:${item.jobId}:${item.dispatchId ?? '-'}`, by: 'settler',
      summary: `a checker of ${item.op} ${item.jobId} could not run ${tries + 1} time(s): ${(verdict.detail ?? []).join('; ').slice(0, 300)} - tooling, not the op's red; fix the checker and the settler measures again`,
      evidence: (verdict.detail ?? []).map((d) => ({ ref: String(d) })) }, { now })?.di ?? null;
  } catch (error) { decision = { error: String(error?.message ?? error).slice(0, 200) }; }
  return { jobId: item.jobId, reason: 'checker-unavailable', tries: tries + 1, decision: decision?.id ?? decision };
}

/** reported -> needs-kernel, once per dispatch and reason. */
function handToKernel(ledger, item, verdict, { now }) {
  const prior = kernelHandoverOf(ledger.db, item);
  if (prior?.reason === verdict.reason) return { jobId: item.jobId, state: STATES.kernel, reason: verdict.reason, recorded: false };
  event(ledger, item, EVENTS.needsKernel, { from: STATES.reported, to: STATES.kernel, op: item.op, attempt: item.attempt, outcome: item.outcome,
    reason: verdict.reason, ...(verdict.detail ? { detail: verdict.detail } : {}), ...(verdict.code ? { code: verdict.code } : {}), ageMs: now - item.filedAt });
  return { jobId: item.jobId, state: STATES.kernel, reason: verdict.reason, recorded: true };
}

/** The proof a settled job's worker is gone, from its payload; null when unproven. */
export function releaseProofOf(payload) {
  const tc = payload?.terminalClosed, wr = payload?.workerReleased, mw = payload?.managedWorker;
  if (tc?.verified?.ok === true) return `settle-verified:${tc.verified.proof ?? 'ok'}`;
  if (tc?.custody?.state === 'released' && tc?.ok === true) return `settle-custody:${tc.custody.proof ?? 'released'}`;
  if (wr?.custody?.state === 'closed-verified') return `report-close:${wr.custody.proof ?? 'verified'}`;
  if (mw?.custody?.state === 'released') return `managed:${mw.custody.proof ?? 'released'}`;
  return null;
}

/**
 * settled -> released for every settled op job of the scope inside releaseWindowMs with no release event: the proof
 * from its payload, else a verified close of its terminal now (close-verify.mjs, the gc's close). Seam: close.
 */
export async function releaseSettled(ledger, { workflowId = null, jobId = null, now = Date.now(), settings = settlerSettings(), close = null, dryRun = false } = {}) {
  const where = ["kind='op'", `status IN (${SETTLED.map(() => '?').join(',')})`, 'updated_at>?'];
  const args = [...SETTLED, now - settings.releaseWindowMs];
  if (workflowId) { where.push('workflow_id=?'); args.push(workflowId); }
  if (jobId) { where.push('job_id=?'); args.push(jobId); }
  const rows = ledger.db.prepare(`SELECT job_id, workflow_id, op_id, try_no AS attempt, worker_id, payload_json, status FROM jobs j WHERE ${where.join(' AND ')}
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.kind=? AND e.entity_id=j.job_id)`).all(...args, EVENTS.released);
  const out = [];
  let closer = close;
  for (const row of rows) {
    const payload = parse(row.payload_json) ?? {};
    const handle = payload.managed ? null : (row.worker_id ?? payload.orca?.agentTerminalHandle ?? payload.launchTerminal?.handle ?? null);
    const item = { jobId: row.job_id, workflowId: row.workflow_id, op: row.op_id, attempt: row.attempt, dispatchId: null };
    // A job that never bound a worker has nothing to release: no transition, no event.
    if (!handle && !payload.managed) continue;
    let proof = releaseProofOf(payload), closed = null;
    if (!proof && handle) {
      if (dryRun) { out.push({ jobId: row.job_id, state: STATES.settled, wouldClose: handle }); continue; }
      if (!closer) closer = (await import('../lib/close-verify.mjs')).closeAndVerify;
      try { closed = closer(handle, { tree: true }); } catch (error) { closed = { ok: false, reason: String(error?.message ?? error) }; }
      if (closed?.ok) proof = `closed-verified:${closed.proof ?? 'ok'}`;
    }
    if (!proof) { out.push({ jobId: row.job_id, state: STATES.settled, released: false, reason: closed?.reason ?? closed?.error ?? (payload.managed ? 'managed-unproven' : 'unproven') }); continue; }
    if (!dryRun) {
      event(ledger, item, EVENTS.released, { from: STATES.settled, to: STATES.released, status: row.status, handle, proof, ...(closed ? { closedNow: true } : {}) });
      markAttempt(ledger, item, { releasedAt: now });
    }
    out.push({ jobId: row.job_id, state: STATES.released, proof, ...(closed ? { closedNow: true } : {}) });
  }
  return out;
}

/* ------------------------------------------------------------ the controller */

const lockName = (repo, id) => `job-settle-${repoKey(repo)}-${slug(id)}`;

/**
 * One reconcile pass over a ledger (optionally one workflow or one job). Returns {ok, repo, settled[], kernel[],
 * released[], skipped[], errors[]}. Seams: verify (verifyReported), api (runApi), close (for releaseSettled), now.
 */
export async function reconcileJobSettle({ repo, workflowId = null, jobId = null, dryRun = false, now = Date.now, env = process.env,
  settings = settlerSettings(), verify = verifyReported, api = runApi, close = null, locks = true } = {}) {
  const out = { ok: true, repo: path.resolve(repo), workflowId, jobId, settled: [], kernel: [], released: [], skipped: [], errors: [] };
  const ledger = openLedger({ file: ledgerFileFor(path.resolve(repo)) });
  try {
    for (const item of reportedJobs(ledger.db, { workflowId, jobId })) {
      const held = locks && !dryRun ? claimManager(lockName(repo, item.jobId), { env }) : { ok: true, release: () => {} };
      if (!held.ok) { out.skipped.push({ jobId: item.jobId, reason: 'in-progress' }); continue; }
      try {
        // Re-read under the lock: another pass (or the Kernel) may have settled it meanwhile.
        const fresh = reportedJobs(ledger.db, { jobId: item.jobId })[0];
        if (!fresh) { out.skipped.push({ jobId: item.jobId, reason: 'no-longer-reported' }); continue; }
        let verdict;
        try { verdict = await verify(ledger.db, fresh, { repo: path.resolve(repo), settings, env,
          record: dryRun ? async () => {} : (run) => recordSettlerCheck(ledger, fresh, run) }); }
        catch (error) { verdict = { green: false, reason: 'verify-error', detail: [String(error?.message ?? error).slice(0, 300)] }; }
        let settleAs = 'pass';
        if (!verdict.green) {
          const mechanical = verdict.unavailable || parityTransient(verdict) ? null : mechanicalSettleOf(fresh, verdict);
          if (dryRun) { out[mechanical ? 'settled' : 'kernel'].push({ jobId: item.jobId, reason: verdict.reason, ...(mechanical ? { verdict: mechanical.verdict } : {}), unavailable: Boolean(verdict.unavailable), dryRun: true }); continue; }
          if (verdict.unavailable || parityTransient(verdict)) { out.skipped.push(await checkerUnavailable(ledger, fresh, verdict, { now: now(), settings })); continue; }
          if (!mechanical) { out.kernel.push({ ...handToKernel(ledger, fresh, verdict, { now: now() }), ...(verdict.detail ? { detail: verdict.detail } : {}) }); continue; }
          settleAs = mechanical.verdict;
          verdict = { ...verdict, checks: mechanical.checks ?? null, via: `report-${fresh.outcome}${mechanical.checks ? `+${verdict.reason}` : ''}` };
        }
        if (dryRun) { out.settled.push({ jobId: item.jobId, via: verdict.via, dryRun: true }); continue; }
        if (verdict.checks) {
          const file = checksFile(fresh, verdict.checks);
          const checked = api(['check', '--repo', path.resolve(repo), '--job', fresh.jobId, '--checks-file', file], { env });
          try { fs.rmSync(file, { force: true }); } catch { /* temp */ }
          if (!checked.ok) { out.kernel.push(handToKernel(ledger, fresh, { reason: 'check-refused', code: checked.code, detail: [checked.error] }, { now: now() })); continue; }
        }
        const settled = api(['settle', '--repo', path.resolve(repo), '--job', fresh.jobId, '--verdict', settleAs], { env });
        if (!settled.ok) {
          if (settled.code === 'job-settled') { out.skipped.push({ jobId: fresh.jobId, reason: 'already-settled' }); continue; }
          out.kernel.push(handToKernel(ledger, fresh, { reason: 'settle-refused', code: settled.code, detail: [settled.error] }, { now: now() }));
          continue;
        }
        const at = now();
        event(ledger, fresh, EVENTS.settled, { from: STATES.reported, to: STATES.settled, op: fresh.op, attempt: fresh.attempt, verdict: settleAs, via: verdict.via,
          latencyMs: at - fresh.filedAt, consumedBefore: fresh.consumedAt != null, nextStep: settled.value?.nextStep ?? null, cutSet: settled.value?.cutSet ?? null,
          tail: settled.value?.tail ?? null, ...(verdict.parity ? { parity: verdict.parity } : {}) });
        markAttempt(ledger, fresh, { settledAt: at, settledBy: 'settler' });
        out.settled.push({ jobId: fresh.jobId, op: fresh.op, verdict: settleAs, via: verdict.via, latencyMs: at - fresh.filedAt, status: settled.value?.status ?? (settleAs === 'pass' ? 'succeeded' : 'failed') });
      } catch (error) {
        out.ok = false;
        out.errors.push({ jobId: item.jobId, error: String(error?.stack ?? error).slice(0, 400) });
      } finally { held.release(); }
    }
    try { out.released = await releaseSettled(ledger, { workflowId, jobId, now: now(), settings, close, dryRun }); }
    catch (error) { out.ok = false; out.errors.push({ step: 'release', error: String(error?.message ?? error).slice(0, 300) }); }
    // The async settle tail (api settle-tail): a failed or never-started tail run is retried here.
    if (!dryRun) {
      try { out.tails = retryDueTails({ repo, settings, env, now: now() }); } catch (error) { out.errors.push({ step: 'tail', error: String(error?.message ?? error).slice(0, 300) }); }
    }
    // released -> worktree-removed (DESIGN §16.7): every released isolated op's product worktree goes now, finished
    // workflows' integration worktrees once landed, and leftovers are swept (each logged as a bug).
    if (!dryRun && !jobId) {
      try { const { productWorktreeDuty } = await import('../kernel/product-worktree.mjs'); out.productWorktrees = productWorktreeDuty({ ledger, ledgerRepo: path.resolve(repo), now: now() }); }
      catch (error) { out.errors.push({ step: 'product-worktrees', error: String(error?.message ?? error).slice(0, 300) }); }
    }
  } finally { ledger.close(); }
  return out;
}

/* ------------------------------------------------------------ async settle tail queue */

/** The tail queue of one ledger: <ledger dir>/settle-tail/<jobId>.json {jobId, repo, queuedAt, attempts, lastError?}. */
export const tailDir = (repo) => path.join(path.dirname(ledgerFileFor(path.resolve(repo))), 'settle-tail');
export function queueTail(repo, jobId, { now = Date.now() } = {}) {
  const dir = tailDir(repo);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug(jobId)}.json`);
  const prior = parse((() => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } })());
  fs.writeFileSync(file, JSON.stringify({ jobId, repo: path.resolve(repo), queuedAt: prior?.queuedAt ?? now, attempts: prior?.attempts ?? 0, lastAt: prior?.lastAt ?? null, lastError: prior?.lastError ?? null }));
  return file;
}
/** Start the tail runner for one job, detached: it never blocks the settle. */
export function startTail(repo, jobId, { env = process.env } = {}) {
  try {
    const child = spawn(process.execPath, [API_FILE, 'settle-tail', '--repo', path.resolve(repo), '--job', jobId, '--json'],
      { cwd: SKILL_ROOT, detached: true, stdio: 'ignore', windowsHide: true, env: runtimeEnv(env) });
    child.unref();
    return child.pid ?? null;
  } catch { return null; }
}
/** Tails older than retryMs since their last run and under maxAttempts are started again. */
export function retryDueTails({ repo, settings = settlerSettings(), env = process.env, now = Date.now(), start = startTail } = {}) {
  let names = [];
  try { names = fs.readdirSync(tailDir(repo)).filter((n) => n.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const n of names) {
    const rec = parse((() => { try { return fs.readFileSync(path.join(tailDir(repo), n), 'utf8'); } catch { return ''; } })());
    if (!rec?.jobId) continue;
    const last = Number(rec.lastAt ?? rec.queuedAt ?? 0);
    if (rec.attempts >= settings.tail.maxAttempts || now - last < settings.tail.retryMs) continue;
    if (lockHolder(`settle-tail-${repoKey(repo)}-${slug(rec.jobId)}`, env)) continue;
    out.push({ jobId: rec.jobId, attempts: rec.attempts, pid: start(repo, rec.jobId, { env }) });
  }
  return out;
}
export const tailLockName = (repo, jobId) => `settle-tail-${repoKey(repo)}-${slug(jobId)}`;

/* ------------------------------------------------------------ callers */

/** The pass right after `api report` files: detached, never blocking the op's own terminal. */
export function startSettlerFor(repo, { workflowId = null, jobId = null, env = process.env } = {}) {
  try {
    const args = [selfFile, '--repo', path.resolve(repo), ...(workflowId ? ['--workflow', workflowId] : []), ...(jobId ? ['--job', jobId] : []), '--json'];
    const child = spawn(process.execPath, args, { cwd: SKILL_ROOT, detached: true, stdio: 'ignore', windowsHide: true, env: runtimeEnv(env) });
    child.unref();
    return child.pid ?? null;
  } catch { return null; }
}

/** The ledgers the Supervisor watches (config.yaml supervisor.repos, scripts/supervisor/home.mjs productRepos). */
export const supervisedRepos = async () => { try { return (await import('../supervisor/home.mjs')).productRepos(); } catch { return []; } };

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const val = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const has = (n) => argv.includes(`--${n}`);
  const repos = val('repo') ? [path.resolve(val('repo'))] : has('all') || has('invariant') ? await supervisedRepos() : [];
  if (!repos.length) { console.error('use: job-settle.mjs --repo <ledger-owner> [--workflow <id>] [--job <id>] [--dry-run] [--json] | --all | --invariant [--repo <r>]'); process.exit(2); }
  const results = [];
  for (const repo of repos) {
    if (!fs.existsSync(ledgerFileFor(repo))) continue;
    if (has('invariant')) {
      const ledger = openLedger({ file: ledgerFileFor(repo) });
      try { results.push({ repo, violations: unsettledViolations(ledger.db) }); } finally { ledger.close(); }
      continue;
    }
    // One pass per scope at a time; a second caller leaves it to the running one (it re-reads every item under its lock).
    const scope = claimManager(lockName(repo, `pass-${val('workflow') ?? 'all'}-${val('job') ?? 'all'}`));
    if (!scope.ok) { results.push({ repo, ok: true, action: 'already-running', pid: scope.holder?.pid ?? null }); continue; }
    try { results.push(await reconcileJobSettle({ repo, workflowId: val('workflow'), jobId: val('job'), dryRun: has('dry-run') })); }
    finally { scope.release(); }
  }
  const out = { ok: results.every((r) => r.ok !== false), results };
  if (has('json')) console.log(JSON.stringify(out));
  else for (const r of results) console.log(`[settler] ${r.repo}${r.violations ? ` violations=${r.violations.length}` : ` settled=${r.settled?.length ?? 0} kernel=${r.kernel?.length ?? 0} released=${r.released?.filter((x) => x.state === 'released').length ?? 0}${r.action ? ` ${r.action}` : ''}${r.errors?.length ? ` errors=${r.errors.length}` : ''}`}`);
  process.exitCode = out.ok ? 0 : 1;
}
