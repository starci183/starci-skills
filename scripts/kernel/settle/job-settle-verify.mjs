// job-settle-verify.mjs — the settler's read/verify half (split from job-settle.mjs under HFS): the check_runs reads
// with hash-verified blobs, the H8 declared-checks verdict (a raw re-run or nothing, never the worker's declared exit),
// the in-process canon-scan of a cut slice, and the canon-parity verdict with its per-dispatch refusal cache. Nothing
// here appends to the ledger; the controller in job-settle.mjs wires these verdicts to events.

import '../../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runNode } from '../../api/node/run-node.mjs';
import { classifyCheck } from './check-command.mjs';
import { slash as norm } from '../../lib/path-key.mjs';
import { observationContextOf, observeCheck } from '../mechanism-observation.mjs';
import { judgeInspectionRun } from '../mechanism-proofs.mjs';
import { filedReportOf, collectJobFiles } from '../job-artifacts.mjs';
import { withWorkflowLock } from '../workflow-checkpoint.mjs';
import { ledgerFileFor } from '../../../engine/db/ledger.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { canonParityVerdict, parityEligible, parityFingerprint, PARITY_REASONS, resolveOwnedRoot, stripSlashes } from './canon-parity.mjs';
import { checkRunStatusOf, checkVerdictOf } from './check-verdict.mjs';
import { KERNEL_ONLY_OPS } from '../../machine/reported-jobs.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
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

export const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
export const slug = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
/** The environment a runtime child runs with: never an op caller's identity (api callerOf reads these). */
export const runtimeEnv = (env = process.env) => {
  const out = { ...env, STARCI_CALLER: 'runtime-settler' };
  delete out.ORCA_TERMINAL_HANDLE;
  return out;
};

/* ------------------------------------------------------------ reads */

/** The latest run of each check of the item's attempt for one runner (check_runs). */
function checkRunsOf(db, item, runner = 'op') {
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

/** One check_runs row's blob contents, hash-verified: {raw} or {reason, detail}. */
async function checkRowBlobs(row, blobs) {
  const raw = {};
  for (const [key, sha] of [['stdout', row.stdout_sha], ['stderr', row.stderr_sha], ['output', row.output_sha]]) {
    if (!sha) continue;
    try { raw[key] = await blobs.getBlob(sha); }
    catch { return { reason: 'check-output-missing', detail: [`${row.name}:${key}:${sha}`] }; }
    if (!Buffer.isBuffer(raw[key]) || crypto.createHash('sha256').update(raw[key]).digest('hex') !== sha)
      return { reason: 'check-output-corrupt', detail: [`${row.name}:${key}:${sha}`] };
  }
  return { raw };
}

/** Blob references are read and verified before a recorded check is trusted. */
async function checksFromStore(db, item, { store = null } = {}) {
  const rows = checkRunsOf(db, item);
  const blobs = store ?? await import('../../../engine/db/blob.mjs');
  const declared = Array.isArray(item.report?.checks) ? item.report.checks : [];
  const byName = new Map(declared.map((c) => [String(c.name), c]));
  const checks = [];
  for (const row of rows) {
    const got = await checkRowBlobs(row, blobs);
    if (got.reason) return { reason: got.reason, detail: got.detail };
    const raw = got.raw;
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

/* ------------------------------------------------------------ verification */

const BASELINE_NAME = /(?:^|[-_.\s])(?:before|baseline)(?:$|[-_.\s])/i;

/** Re-run one runtime check: argv, no shell, cwd = the ledger repo. {exitCode, ms, tail} */
export function rerunCheck(c, { repo, timeoutMs, env = process.env, run = runNode }) {
  const t0 = Date.now();
  const r = run([c.script, ...c.argv], { cwd: repo, timeout: timeoutMs, env: { ...runtimeEnv(env), ...(c.mechanical ? { STARCI_RUNTIME: c.runtimeRoot } : {}) }, maxBuffer: 64 * 1024 * 1024 });
  let exitCode = null;
  if (r.error) exitCode = r.error.code === 'ETIMEDOUT' ? 124 : 127;
  else if (!r.signal && Number.isInteger(r.status)) exitCode = r.status;
  const stdout = Buffer.isBuffer(r.stdout) ? r.stdout : Buffer.from(String(r.stdout ?? ''));
  const stderr = Buffer.isBuffer(r.stderr) ? r.stderr : Buffer.from(String(r.stderr ?? r.error?.message ?? ''));
  return { exitCode, ms: Date.now() - t0, startedAt: t0, finishedAt: Date.now(), cwd: repo,
    stdout, stderr, output: jsonOf(stdout.toString('utf8')),
    processStatus: Number.isInteger(r.status) ? r.status : null, processSignal: r.signal ?? null, processError: r.error ? String(r.error.code ?? r.error.message) : null,
    tail: String(r.stderr || r.stdout || r.error?.message || '').trim().split(/\r?\n/).slice(-2).join(' ').slice(0, 300) };
}

/** Canon-scan over a slice's owned paths, in-process (no path on a command line). {exitCode, status, findings, root} */
async function canonSliceCheck(item, { repo }) {
  const { ownedPathPlacements } = await import('../target-repo.mjs');
  const owned = item.payload.owned_paths ?? [];
  // The slice is measured in its workflow's worktree (part A's registry), where it worked, never the live checkout.
  const { workflowWorktreeOf } = await import('../../machine/workflow-tree.mjs');
  const tree = workflowWorktreeOf({ env: process.env }, item.workflowId);
  const worktree = tree?.path && fs.existsSync(tree.path) ? tree.path : undefined;
  const places = ownedPathPlacements({ op: item.op, payload: item.payload, ownedPaths: owned, repo, worktree });
  const bases = [...new Set(places.map((p) => p.base && path.resolve(p.base)).filter(Boolean))];
  if (!owned.length || places.some((p) => p.unresolved || !p.base) || bases.length !== 1) return { exitCode: 2, status: 'unresolved', why: 'owned paths do not resolve into one checkout' };
  const { scanCanon, parseCanonScanArgs } = await import('../../gates/canon-scan.mjs');
  // The options are built in memory (argv parsing only derives the machines); the paths never reach a command line.
  const options = parseCanonScanArgs(['--root', bases[0], '--families', String(item.payload.params?.canonFamilies ?? 'all'), '--json']);
  options.paths = places.map((p) => {
    const s = norm(p.path);
    return stripSlashes(s.endsWith('/**') ? s.slice(0, -3) : s);
  });
  const report = await scanCanon(options);
  const findings = Array.isArray(report?.findings) ? report.findings.length : null;
  const list = (Array.isArray(report?.findings) ? report.findings : []).slice(0, 500).map((f) => ({ file: norm(f.file ?? ''), ruleId: f.ruleId ?? null, line: f.line ?? null, family: f.family ?? null }));
  let exitCode = 3;
  if (report?.status === 'ok') exitCode = 0;
  else if (report?.status === 'findings') exitCode = 1;
  return { exitCode, status: report?.status ?? null, findings, list, root: bases[0], paths: places.length, output: report };
}

/**
 * Persist each settler measurement before its verdict is used, including failed re-runs: one check_runs row
 * (scripts/machine/evidence-store.mjs recordCheck) with the RAW exit this runner observed, stdout/stderr/output as
 * redacted blobs. A checker that could not run (exit 124 timeout / 127 spawn failure, or status 'unavailable') is
 * 'unavailable', never red (H7). Returns the check id.
 */
export async function recordSettlerCheck(ledger, item, run, { now = Date.now } = {}) {
  const { stageBlob, recordCheck, CHECK_STATUSES } = await import('../../machine/evidence-store.mjs');
  const bytes = (content) => {
    if (content == null) return null;
    if (Buffer.isBuffer(content)) return content;
    return Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
  };
  const blob = (content, mediaType) => { const b = bytes(content); return b?.length ? stageBlob(b, { mediaType, repoRoots: [item.repo].filter(Boolean) }) : null; };
  const stdout = blob(run.stdout, 'text/plain'), stderr = blob(run.stderr, 'text/plain'), output = blob(run.output, 'application/json');
  const at = now();
  const status = CHECK_STATUSES.includes(run.status) ? run.status : checkRunStatusOf(run);
  const store = () => ledger.transaction((db) => {
    const attemptId = attemptIdOf(db, item);
    if (attemptId == null) throw Object.assign(new Error(`no attempt for job ${item.jobId}`), { code: 'check-attempt-missing' });
    return recordCheck(db, { attemptId, name: String(run.name), phase: run.phase ?? 'verify', runner: run.runner ?? 'settler', command: run.command ?? null,
      cwd: run.cwd ?? null, inputDigest: run.inputDigest ?? null, exitCode: Number.isInteger(run.exitCode) ? run.exitCode : null,
      declaredExitCode: Number.isInteger(run.declaredExitCode) ? run.declaredExitCode : null, attribution: run.attribution ?? null, status,
      unavailable: status === 'unavailable' || run.exitCode === 124 || run.exitCode === 127, startedAt: run.startedAt ?? at, finishedAt: run.finishedAt ?? at,
      stdout, stderr, output, summary: { ...(run.summary), ...(run.native ? { native: run.native } : {}) }, note: run.note ?? null, now: at }).checkId;
  });
  return run.native ? withWorkflowLock({ db: ledger.db, ledger, repo: item.repo, env: process.env }, { workflowId: item.workflowId }, store) : store();
}

/** The workflow's canon-wire legs of the slice's op, queued or running: [{jobId, status, ownedPaths}]. */
function canonWireLegsOf(db, item) {
  try {
    return db.prepare(`SELECT job_id, status, payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND status IN ('queued','leased','running')
      AND json_extract(payload_json,'$.params.canonWire') IN (1, 'true')`).all(item.workflowId, item.op)
      .map((r) => ({ jobId: r.job_id, status: r.status, ownedPaths: (parse(r.payload_json)?.owned_paths ?? []).map(String) }));
  } catch { return []; }
}
const PARITY_RECHECK_MS = 30 * 60_000;
/** <ledger dir>/settle-parity/<jobId>.json: the last non-green parity verdict of a dispatch. */
export const parityCacheFile = (repo, jobId) => path.join(path.dirname(ledgerFileFor(path.resolve(repo))), 'settle-parity', `${slug(jobId)}.json`);
function readParityCache(repo, item) { try { return JSON.parse(fs.readFileSync(parityCacheFile(repo, item.jobId), 'utf8')); } catch { return null; } }
function writeParityCache(repo, item, rec) {
  try { const f = parityCacheFile(repo, item.jobId); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ dispatchId: item.dispatchId, ...rec })); } catch { /* a cache */ }
}
/** STARCI_SETTLER_PARITY=0 turns the canon parity verifier off (the rollback of canon-parity-settle). */
const parityEnabled = (env = process.env) => String(env.STARCI_SETTLER_PARITY ?? '1') !== '0';
/** A baseline measured BEFORE the change (canon-scan-before, gate-before ...): evidence, never a verdict. */
export const isBaselineCheck = (c) => BASELINE_NAME.test(String(c?.name ?? ''));

/** One declared runtime check's re-run and verdict; pushes its evidence entry. null when green, the stop verdict else. */
async function rerunDeclaredCheck(db, c, { item, repo, settings, env, observation, record, rerun, checks, started }) {
  if (Date.now() - started > settings.itemBudgetMs) return { green: false, reason: 'verify-budget-exceeded', unavailable: true };
  const invoke = (target) => rerun(c, { repo: target, timeoutMs: settings.rerunTimeoutMs, env });
  const r = c.mechanical && observation ? observeCheck(c, observation, invoke) : invoke(repo);
  await record({ name: String(c.check.name ?? c.rel), command: String(c.check.command), phase: 'verify', runner: 'settler',
    declaredExitCode: Number.isInteger(c.check.exitCode) ? c.check.exitCode : null, ...r });
  const v = checkVerdictOf(r);
  if (v.verdict === 'unavailable') {
    const word = v.word ? ` ${v.word}` : '';
    return { green: false, unavailable: true, reason: 'checker-unavailable', detail: [`${c.check.name}:${r.exitCode}${word} ${r.tail ?? ''}`.slice(0, 300)] };
  }
  const entry = { name: String(c.check.name ?? c.rel), exitCode: r.exitCode, command: String(c.check.command).slice(0, 2000),
    evidence: `runtime settler re-run: raw exit ${r.exitCode} in ${Math.round(r.ms / 100) / 10}s (worker declared exit ${c.check.exitCode})` };
  const filed = observation && item.op === 'security.verify' ? filedReportOf(db, { job_id: item.jobId, workflow_id: item.workflowId }, { dispatchId: item.dispatchId }) : null;
  const inspected = filed && judgeInspectionRun(r, collectJobFiles({ repo, envelope: filed.envelope, roots: observation.roots, artifacts: filed.artifacts }).files).status === 'pass';
  if (v.verdict === 'red' && !inspected) return { green: false, reason: 'rerun-red', detail: [`${c.check.name}:${r.exitCode} ${r.tail}`.slice(0, 300)], checks: { checks: [...checks, entry] } };
  checks.push(entry);
  return null;
}

/**
 * The canon-scan of a cut slice over its owned paths, recorded as cut-slice-postcondition; the declared re-runs are
 * its cut-regression-inventory. null when the postcondition holds, the stop verdict else.
 */
async function slicePostcondition(item, { repo, canon, record, checks, runtime }) {
  if (!item.payload.params?.canonFamilies) return { green: false, reason: 'cut-not-canon' };
  const slice = await canon(item, { repo });
  await record({ name: CUT_SLICE_CHECKS[0], command: `canon-scan --root ${slice.root ?? repo}`, cwd: slice.root ?? repo,
    phase: 'verify', runner: 'settler', exitCode: slice.exitCode, status: slice.status === 'unresolved' ? 'unavailable' : undefined, output: slice.output ?? slice, summary: { status: slice.status, findings: slice.findings } });
  const v = checkVerdictOf({ exitCode: slice.exitCode, status: slice.status });
  if (v.verdict === 'unavailable') {
    const why = slice.why ? ` ${slice.why}` : '';
    return { green: false, unavailable: true, reason: 'checker-unavailable', detail: [`canon-scan ${slice.status ?? '?'}${why}`] };
  }
  if (v.verdict === 'red') {
    const count = slice.findings != null ? ` ${slice.findings} finding(s)` : '';
    return { green: false, reason: 'cut-postcondition-red', detail: [`canon-scan ${slice.status ?? '?'}${count}`],
      checks: { checks: [...checks, { name: CUT_SLICE_CHECKS[0], exitCode: slice.exitCode, command: `canon-scan (in-process) --root ${slice.root}`, evidence: `runtime settler: canon-scan ${slice.status}, ${slice.findings ?? '?'} finding(s) on the slice's owned paths` }] } };
  }
  checks.push({ name: CUT_SLICE_CHECKS[0], exitCode: 0, command: `canon-scan (in-process) --root ${slice.root} over the slice's ${slice.paths} owned path(s)`,
    evidence: `runtime settler: canon-scan status ok, 0 findings on the slice's owned paths (families ${item.payload.params.canonFamilies})` },
    { name: CUT_SLICE_CHECKS[1], exitCode: 0, command: runtime.map((c) => c.check.name).join(' + '),
    evidence: `runtime settler: the ${runtime.length} runtime check(s) re-ran with raw exit 0 - no new failure in the slice's regression inventory` });
  return null;
}

/**
 * The declared-checks verdict (H8): every declared check the runtime can re-run IS re-run, and only its RAW exit counts
 * - never the exit the worker declared, never a check the Kernel recorded by hand. A declared red that is not
 * re-verifiable is the worker's own admission (declared-check-red, still subject to canon parity). A checker that could
 * not run is unavailable (H7): {green:false, unavailable:true}, never red. A red re-run carries its raw checks
 * envelope, so the settler records it (starci kernel record-checks) before it settles the claim overruled.
 */
async function verifyDeclared(db, item, { repo, settings, rerun, canon, env, record }) {
  if (item.outcome !== 'done') return { green: false, reason: `outcome-${item.outcome}` };
  if (KERNEL_ONLY_OPS.includes(item.op)) return { green: false, reason: 'owner-act' };
  const declared = Array.isArray(item.report.checks) ? item.report.checks : [];
  if (!declared.length) return { green: false, reason: 'no-declared-checks' };
  // A baseline measured BEFORE the change (canon-scan-before, gate-before ...) is the refactor's starting point,
  // not its verdict: its exit code is evidence, never a red, and it is not re-run (the tree has moved on).
  let observation;
  try { observation = observationContextOf(db, db.prepare('SELECT * FROM jobs WHERE job_id=?').get(item.jobId), { repo, skillRoot: SKILL_ROOT }); }
  catch (error) { return { green: false, unavailable: true, reason: 'checker-unavailable', detail: [error.message] }; }
  const classed = declared.filter((c) => !isBaselineCheck(c)).map((c) => ({ check: c, ...classifyCheck(c, { mechanical: Boolean(observation) }) }));
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
    const stop = await rerunDeclaredCheck(db, c, { item, repo, settings, env, observation, record, rerun, checks, started });
    if (stop) return stop;
  }
  if (item.payload.cut) {
    const stop = await slicePostcondition(item, { repo, canon, record, checks, runtime });
    if (stop) return stop;
  }
  return { green: true, via: 'rerun', checks: { checks } };
}

/**
 * Is this reported job green? {green, reason?, detail?, checks?: envelope for starci kernel record-checks (null: already recorded), via}
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
  // base and owned files are unchanged (PARITY_RECHECK_MS).
  const resolveRoot = parityDeps.resolveRoot ?? resolveOwnedRoot;
  let fingerprint = null;
  try { fingerprint = await parityFingerprint(item, { repo, resolveRoot }); } catch { fingerprint = null; }
  const cached = fingerprint ? readParityCache(repo, item) : null;
  const now = Date.now();
  if (cached && cached.dispatchId === item.dispatchId && cached.fingerprint === fingerprint
    && now - cached.at < PARITY_RECHECK_MS) return { ...cached.verdict, cached: true };
  const measured = await parity(item, { repo, settings, env, rerun, canon, classify: (c) => classifyCheck(c), baseline: isBaselineCheck,
    wireLegs: () => canonWireLegsOf(db, item), record, ...parityDeps, resolveRoot });
  const priorDetail = plain.detail ? ` ${plain.detail.slice(0, 4).join(', ')}` : '';
  const verdict = measured.green ? measured
    : { ...measured, detail: [`declared: ${plain.reason}${priorDetail}`, ...(measured.detail ?? [])].slice(0, 8) };
  if (!verdict.green && fingerprint) writeParityCache(repo, item, { fingerprint, at: now, verdict: { green: false, reason: verdict.reason, detail: verdict.detail } });
  return verdict;
}

export const jsonOf = (text) => {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const direct = parse(t); if (direct) return direct;
  for (const line of t.split(/\r?\n/).reverse()) { const v = parse(line.trim()); if (v && typeof v === 'object') return v; }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  return a >= 0 && b > a ? parse(t.slice(a, b + 1)) : null;
};
