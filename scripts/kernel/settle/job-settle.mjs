// job-settle.mjs — SETTLE as a deterministic runtime service: the first reconciler controller (one loop engine,
// idempotent controllers per concern, LLMs as deciders only), called by the watchdog and movable into the engine as is.
//
// Internal args: --repo <ledger-owner> [--workflow <id>] [--job <id>] [--dry-run] [--json] | --all | --invariant.
//
// reconcileJobSettle({repo, workflowId?, jobId?}) drives each job whose worker filed a report through explicit states,
// one typed ledger event per transition:
//
//   reported --(outcome done + declared checks re-verify green)--> settled   event job-settle-settled
//   reported --(failed|partial, blocked|ask, or a red raw re-run)--> settled fail|blocked (H1: no Kernel needed)
//   reported --(checker unavailable)--> stays reported; after tail.maxAttempts one runtime-defect DI (H7: never red)
//   reported --(judgment: not re-verifiable, owner act, refusal)--> kernel    event job-settle-needs-kernel
//   settled  --(managed worker release proven)--> released  event job-settle-released
//
// `reported` is a live job (running/answering/effect_unknown) with a reports row for its contract's dispatch, consumed
// or not: consume is part of settle, so consumed-but-unsettled is due like filed. The settle itself is the SAME code
// path as `starci kernel record-checks` then `starci kernel settle`; every refusal still holds, and hands the
// job to the Kernel with its code. The settler settles what the evidence decides without judgment (H1): a failed or
// partial report fails, blocked/ask settles blocked, and a done report whose RAW re-run is red fails. Only security.verify can carry an observed lint exit 1 as complete typed findings; it stays raw 1. It never passes on a worker-declared exit code (H8): every verdict is the
// raw exit the runtime observed. It never settles an op whose pass is an owner act, nor a done report nothing re-verifies.
//
// Idempotent: a settled job is not due; a needs-kernel handover is recorded once per dispatch and reason; a release is
// recorded once per job. Two passes never work one job: each item takes a per-job host lock.
//
// Verification ("declared checks verify green"):
//   - a checks row the Kernel already recorded for the attempt: green -> settle; red -> kernel;
//   - else every check the report declares must claim exit 0 (a *-before/baseline measurement is evidence, not a
//     verdict, and is skipped), and every one that is a check (not a git/read action)
//     must be a runtime check the settler can re-run without a shell: starci runtime validate ..., the package CLI,
//     scripts/checks/<x>.mjs (never --fix/--write/--apply), or starci work graph validate|show|diff; each re-run
//     (argv, no shell) must exit 0; current mechanical proofs run in their filed target, with complete native output. The security.verify lint exception above still requires its typed carriage judge;
//   - a cut slice (payload.cut) records the two cut checks settle demands: a canon slice (params.canonFamilies) re-runs
//     canon-scan in-process over its owned paths (cut-slice-postcondition, paths never on a command line) and the
//     declared re-runs are its cut-regression-inventory; any other cut, and the set-closing pass (full-regression-final),
//     is the Kernel's.
//   - CANON PARITY (contract change canon-parity-settle): a done code.refactor canon cut slice whose declared checks are
//     red or not re-verifiable is measured by the settler itself over its owned paths against its admission base
//     (scripts/kernel/settle/canon-parity.mjs): canon-scan 0 findings, the gate's lint no new finding, typecheck no new
//     error, every declared red superseded by those owned-scope measurements (foreign residue). Any new finding -> Kernel.
import '../../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runNode } from '../../api/node/run-node.mjs';
import { spawnNode } from '../../api/node/spawn-node.mjs';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor, updateAttempt, releaseLeases, setCondition } from '../../../engine/db/ledger.mjs';
import { claimManager, lockHolder } from '../../connectors/lib.mjs';
import { SETTLED_JOB_LIST } from '../../../engine/admission.mjs';
import { NEEDS_KERNEL_EVENT, KERNEL_ONLY_OPS, reportedJobs, kernelHandoverOf } from '../../machine/reported-jobs.mjs';
import { eachInOrder } from '../../lib/in-order.mjs';
import { workflowWorktreeOf } from '../../machine/workflow-tree.mjs';
import { reconcileAttemptPlacements } from '../attempt-placement.mjs';
import { currentRuntimeRev } from '../runtime-rev.mjs';
import { releaseEndedGates, recordGateRejudged } from '../gate-holds-ended.mjs';
import { kernelTerminalOf, runtimeCriticFor } from './critic-run.mjs';
import { recoverPreparedSettlement } from './prepared-recovery.mjs';
import { settlerSettings, runtimeEnv, verifyReported, recordSettlerCheck, parse, slug, jsonOf } from './job-settle-verify.mjs';
import { tempRoot } from '../../../engine/temp-root.mjs';
export { classifyCheck, argvOf } from './check-command.mjs';
export { settlerSettings, runtimeEnv, verifyReported, recordSettlerCheck, rerunCheck, isBaselineCheck, parityCacheFile } from './job-settle-verify.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const SKILL_ROOT = path.resolve(path.dirname(selfFile), '..', '..', '..');
const API_FILE = path.join(SKILL_ROOT, 'scripts', 'kernel', 'cli.mjs');

export const EVENTS = Object.freeze({
  settled: 'job-settle-settled',
  needsKernel: NEEDS_KERNEL_EVENT,
  released: 'job-settle-released',
  invariant: 'job-settle-invariant-violated',
  checkUnavailable: 'job-settle-check-unavailable',
});
export const STATES = Object.freeze({ reported: 'reported', settled: 'settled', released: 'released', kernel: 'needs-kernel' });
const SETTLED = SETTLED_JOB_LIST;

const repoKey = (repo) => crypto.createHash('sha1').update(path.resolve(repo).toLowerCase()).digest('hex').slice(0, 10);

/* ------------------------------------------------------------ the invariant */

/**
 * THE INVARIANT (Supervisor tick): no reported job older than maxAgeMs, whatever its outcome (H1), that the runtime
 * neither settled nor handed to the Kernel nor holds for a checker that could not run. Each one is a runtime bug (settle-unsettled-report). [{workflowId, jobId, op, outcome, ageMin, consumed}]
 */
const uncheckable = (db, it) => Boolean(db.prepare("SELECT 1 FROM events WHERE kind=? AND entity_id=? LIMIT 1").get(EVENTS.checkUnavailable, it.jobId));
function unsettledViolations(db, { now = Date.now(), maxAgeMs = settlerSettings().invariantMaxAgeMs, workflowId = null } = {}) {
  return reportedJobs(db, { workflowId }).filter((it) => now - it.filedAt > maxAgeMs && !KERNEL_ONLY_OPS.includes(it.op) && !kernelHandoverOf(db, it) && !uncheckable(db, it))
    .map((it) => ({ workflowId: it.workflowId, jobId: it.jobId, dispatchId: it.dispatchId, op: it.op, outcome: it.outcome, ageMin: Math.round((now - it.filedAt) / 60_000), ageMs: now - it.filedAt, consumed: it.consumedAt != null }));
}



/* ------------------------------------------------------------ actions */

/** `starci kernel <verb> ... --json` as the runtime: {ok, value, error, code} */
export function runApi(args, { env = process.env, timeoutMs = 600_000 } = {}) {
  const r = runNode([API_FILE, ...args, '--json'], { cwd: SKILL_ROOT, timeout: timeoutMs, env: runtimeEnv(env), maxBuffer: 64 * 1024 * 1024 });
  const value = jsonOf(r.stdout), err = jsonOf(r.stderr);
  const ok = r.status === 0 && value?.ok !== false;
  return { ok, value, status: r.status, code: value?.code ?? err?.code ?? value?.reason ?? null,
    error: ok ? null : String(value?.error ?? value?.reason ?? err?.error ?? r.stderr ?? r.error?.message ?? '').slice(0, 600) };
}

const tmpDir = () => path.join(tempRoot(), 'starci-settler');
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
const RED_REASONS = Object.freeze(['rerun-red', 'declared-check-red', 'cut-postcondition-red', 'parity-rerun-red', 'parity-lint-new', 'parity-tsc-new', 'parity-diff-red']);
/**
 * What the evidence decides without judgment (H1), or null when it needs the Kernel: {verdict, checks?}. A failed or
 * partial report fails; a blocked or ask report settles blocked (an ask waits on the owner); a done report whose raw
 * re-run is red fails with that red recorded first.
 */
function mechanicalSettleOf(item, verdict) {
  if (KERNEL_ONLY_OPS.includes(item.op)) return null;
  if (['failed', 'partial'].includes(item.outcome)) return { verdict: 'fail' };
  if (['blocked', 'ask'].includes(item.outcome)) return { verdict: 'blocked' };
  if (item.outcome !== 'done' || !RED_REASONS.includes(verdict.reason)) return null;
  // A parity measurement records its own check_runs; its red is recorded for starci kernel settle as one runtime check.
  const checks = verdict.checks?.checks?.length ? verdict.checks
    : { checks: [{ name: verdict.reason, exitCode: 1, command: 'runtime settler (canon parity)', evidence: (verdict.detail ?? []).join('; ').slice(0, 1500) || verdict.reason }] };
  return { verdict: 'fail', checks };
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
    const { openDecisionRow } = await import('../../machine/decisions.mjs');
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
  const runtimeRev = currentRuntimeRev();
  if (prior?.reason === verdict.reason && (prior.code ?? null) === (verdict.code ?? null) && (prior.runtimeRev ?? null) === runtimeRev) return { jobId: item.jobId, state: STATES.kernel, reason: verdict.reason, recorded: false };
  event(ledger, item, EVENTS.needsKernel, { from: STATES.reported, to: STATES.kernel, op: item.op, attempt: item.attempt, outcome: item.outcome,
    reason: verdict.reason, runtimeRev, ...(verdict.detail ? { detail: verdict.detail } : {}), ...(verdict.code ? { code: verdict.code } : {}), ageMs: now - item.filedAt });
  ledger.transaction(() => recordGateRejudged(ledger.db, item.workflowId, item.jobId, { reason: verdict.reason, detail: verdict.detail ?? [], at: now }));
  return { jobId: item.jobId, state: STATES.kernel, reason: verdict.reason, recorded: true };
}

/** The proof a settled job's worker is gone, from its payload; null when unproven. */
export function releaseProofOf(payload) {
  const wr = payload?.workerReleased, mw = payload?.managedWorker;
  if (wr?.custody?.state === 'released') return `held-release:${wr.custody.proof ?? 'released'}`;
  if (mw?.custody?.state === 'released') return `managed:${mw.custody.proof ?? 'released'}`;
  return null;
}

/**
 * settled -> released for every settled op job of the scope inside releaseWindowMs with no release event, on the proof
 * of its managed release in its payload (settle's worker-release receipt). A job whose release is unproven stays settled.
 */
export async function releaseSettled(ledger, { workflowId = null, jobId = null, now = Date.now(), settings = settlerSettings(), dryRun = false } = {}) {
  const where = ["kind='op'", `status IN (${SETTLED.map(() => '?').join(',')})`, 'updated_at>?'];
  const args = [...SETTLED, now - settings.releaseWindowMs];
  if (workflowId) { where.push('workflow_id=?'); args.push(workflowId); }
  if (jobId) { where.push('job_id=?'); args.push(jobId); }
  const rows = ledger.db.prepare(`SELECT job_id, workflow_id, op_id, try_no AS attempt, worker_id, payload_json, status FROM jobs j WHERE ${where.join(' AND ')}
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.kind=? AND e.entity_id=j.job_id)`).all(...args, EVENTS.released);
  const out = [];
  for (const row of rows) {
    const payload = parse(row.payload_json) ?? {};
    const item = { jobId: row.job_id, workflowId: row.workflow_id, op: row.op_id, attempt: row.attempt, dispatchId: null };
    // A job that never bound a worker has nothing to release: no transition, no event.
    if (!payload.managed) continue;
    const proof = releaseProofOf(payload);
    if (!proof) { out.push({ jobId: row.job_id, state: STATES.settled, released: false, reason: 'managed-unproven' }); continue; }
    if (!dryRun) {
      event(ledger, item, EVENTS.released, { from: STATES.settled, to: STATES.released, status: row.status, handle: null, proof });
      markAttempt(ledger, item, { releasedAt: now });
    }
    out.push({ jobId: row.job_id, state: STATES.released, proof });
  }
  return out;
}

/* ------------------------------------------------------------ the controller */

const lockName = (repo, id) => `job-settle-${repoKey(repo)}-${slug(id)}`;

/** The verifier's verdict for one reported job; a throwing verifier reads as a red `verify-error` verdict. */
async function verdictOf(ledger, fresh, { repo, settings, env, dryRun, verify }) {
  try { return await verify(ledger.db, fresh, { repo, settings, env,
    record: dryRun ? async () => {} : (run) => recordSettlerCheck(ledger, fresh, run) }); }
  catch (error) { return { green: false, reason: 'verify-error', detail: [String(error?.message ?? error).slice(0, 300)] }; }
}

/**
 * A red verdict either ends the settle ({result}: dry-run row, checker unavailable, hand-off to the Kernel) or is
 * settled mechanically ({settleAs, verdict}: the mechanical verdict and the verdict carrying its checks and `via`).
 */
async function redRedirectOf(ledger, fresh, verdict, { now, settings, dryRun }) {
  const mechanical = verdict.unavailable ? null : mechanicalSettleOf(fresh, verdict);
  if (dryRun) return { result: { target: mechanical ? 'settled' : 'kernel', row: { jobId: fresh.jobId, reason: verdict.reason, ...(mechanical ? { verdict: mechanical.verdict } : {}), unavailable: Boolean(verdict.unavailable), dryRun: true } } };
  if (verdict.unavailable) return { result: { target: 'skipped', row: await checkerUnavailable(ledger, fresh, verdict, { now: now(), settings }) } };
  if (!mechanical) return { result: { target: 'kernel', row: { ...handToKernel(ledger, fresh, verdict, { now: now() }), ...(verdict.detail ? { detail: verdict.detail } : {}) } } };
  const viaReason = mechanical.checks ? `+${verdict.reason}` : '';
  return { settleAs: mechanical.verdict, verdict: { ...verdict, checks: mechanical.checks ?? null, via: `report-${fresh.outcome}${viaReason}` } };
}

/** Records the mechanical settle's checks through the API; a refusal is the hand-off result, success is null. */
function recordMechanicalChecks(ledger, fresh, verdict, { repo, env, now, api }) {
  if (!verdict.checks) return null;
  const file = checksFile(fresh, verdict.checks);
  const checked = api(['record-checks', '--repo', repo, '--job', fresh.jobId, '--checks-file', file], { env });
  try { fs.rmSync(file, { force: true }); } catch { /* temp */ }
  if (checked.ok) return null;
  return { target: 'kernel', row: handToKernel(ledger, fresh, { reason: 'check-refused', code: checked.code, detail: [checked.error] }, { now: now() }) };
}

/** The result of a refused settle API call: an already-settled job is skipped, anything else goes to the Kernel. */
function settleRefused(ledger, fresh, settled, now) {
  if (settled.code === 'job-settled') return { target: 'skipped', row: { jobId: fresh.jobId, reason: 'already-settled' } };
  return { target: 'kernel', row: handToKernel(ledger, fresh, { reason: 'settle-refused', code: settled.code, detail: [settled.error] }, { now: now() }) };
}

/**
 * One reported job's settle inside its per-job lock: verify, then the mechanical write path (record-checks, settle,
 * events). Returns {target: 'skipped'|'kernel'|'settled', row}; the caller pushes row onto out[target]. Ledger writes
 * stay serialized per job - sequential awaits are the ordering guarantee, not a performance bug.
 */
async function settleReported(ledger, fresh, { repo, settings, env, now, dryRun, verify, api, critic = {} }) {
  // A done decision leg without a Critic verdict of its own is judged with the one the runtime's Critic gives it; a Critic that could not judge holds the settle (the checker-unavailable path).
  const owed = dryRun ? null : await runtimeCriticFor(ledger, fresh, { tree: critic.tree, retryMs: settings.tail.retryMs, now: now(), entry: critic.tree ? kernelTerminalOf(ledger.db, fresh.workflowId) : null, ...critic.seams });
  if (owed?.hold) return { target: 'skipped', row: await checkerUnavailable(ledger, fresh, { reason: 'checker-unavailable', detail: [`critic: ${owed.hold.code ?? 'CRITIC_UNAVAILABLE'}: ${owed.hold.error ?? ''}`] }, { now: now(), settings }) };
  const verdict = await verdictOf(ledger, fresh, { repo, settings, env, dryRun, verify });
  let settleAs = 'pass';
  let judged = verdict;
  if (!verdict.green) {
    const redirect = await redRedirectOf(ledger, fresh, verdict, { now, settings, dryRun });
    if (redirect.result) return redirect.result;
    ({ settleAs, verdict: judged } = redirect);
  }
  if (dryRun) return { target: 'settled', row: { jobId: fresh.jobId, via: judged.via, dryRun: true } };
  const checksRefused = recordMechanicalChecks(ledger, fresh, judged, { repo, env, now, api });
  if (checksRefused) return checksRefused;
  const settled = api(['settle', '--repo', repo, '--job', fresh.jobId, '--verdict', settleAs], { env });
  if (!settled.ok) return settleRefused(ledger, fresh, settled, now);
  const at = now();
  event(ledger, fresh, EVENTS.settled, { from: STATES.reported, to: STATES.settled, op: fresh.op, attempt: fresh.attempt, verdict: settleAs, via: judged.via,
    latencyMs: at - fresh.filedAt, consumedBefore: fresh.consumedAt != null, nextStep: settled.value?.nextStep ?? null, cutSet: settled.value?.cutSet ?? null,
    tail: settled.value?.tail ?? null, ...(judged.parity ? { parity: judged.parity } : {}) });
  markAttempt(ledger, fresh, { settledAt: at, settledBy: 'settler' });
  ledger.transaction(() => releaseEndedGates(ledger.db, fresh.workflowId, { at }));
  return { target: 'settled', row: { jobId: fresh.jobId, op: fresh.op, verdict: settleAs, via: judged.via, latencyMs: at - fresh.filedAt, status: settled.value?.status ?? (settleAs === 'pass' ? 'succeeded' : 'failed') } };
}

/** The placement of a reported job's attempt against its workflow's registered tree, before its checks run: a lost admitted path is rebound, or the attempt ended. */
function settlePlacement(ledger, item, { env, dryRun }) {
  const tree = dryRun ? null : workflowWorktreeOf({ env }, item.workflowId);
  return tree ? reconcileAttemptPlacements(ledger, { workflowId: item.workflowId, tree, jobId: item.jobId, env }) : null;
}

/** One reported job under its per-job lock: re-read, settle, and file the row into `out`; a throw is recorded, not rethrown. */
async function settleItem(ledger, item, out, { repo, abs, settings, env, now, dryRun, verify, api, locks, criticSeams }) {
  const held = locks && !dryRun ? claimManager(lockName(repo, item.jobId), { env }) : { ok: true, release: () => {} };
  if (!held.ok) { out.skipped.push({ jobId: item.jobId, reason: 'in-progress' }); return; }
  try {
    // Re-read under the lock: another pass (or the Kernel) may have settled it meanwhile.
    const fresh = reportedJobs(ledger.db, { jobId: item.jobId })[0];
    if (!fresh) { out.skipped.push({ jobId: item.jobId, reason: 'no-longer-reported' }); return; }
    if (settlePlacement(ledger, fresh, { env, dryRun })?.ended.length) { out.skipped.push({ jobId: item.jobId, reason: 'placement-lost' }); return; }
    // A prepared fail decision whose apply never completed blocks every later settle of the attempt: the runtime withdraws one that aims at a base the tree no longer has.
    if (!dryRun) recoverPreparedSettlement(ledger, fresh, { env, now: now() });
    const done = await settleReported(ledger, fresh, { repo: abs, settings, env, now, dryRun, verify, api, critic: { tree: dryRun ? null : workflowWorktreeOf({ env }, fresh.workflowId)?.path ?? null, seams: criticSeams } });
    out[done.target].push(done.row);
  } catch (error) {
    out.ok = false;
    out.errors.push({ jobId: item.jobId, error: String(error?.stack ?? error).slice(0, 400) });
  } finally { held.release(); }
}

/** The pass tail: retry due settle tails (starci kernel settle-tail), then close leaked leases and overdue incidents (H12). */
function retryAndSweep(ledger, out, { repo, workflowId, jobId, settings, env, now }) {
  try { out.tails = retryDueTails({ repo, settings, env, now: now() }); } catch (error) { out.errors.push({ step: 'tail', error: String(error?.message ?? error).slice(0, 300) }); }
  if (jobId) return;
  try { out.leaks = sweepLedgerLeaks(ledger, { workflowId, now: now() }); } catch (error) { out.errors.push({ step: 'leaks', error: String(error?.message ?? error).slice(0, 300) }); }
}

/**
 * One reconcile pass over a ledger (optionally one workflow or one job). Returns {ok, repo, settled[], kernel[],
 * released[], skipped[], errors[]}. Seams: verify (verifyReported), api (runApi), now.
 */
export async function reconcileJobSettle({ repo, workflowId = null, jobId = null, dryRun = false, now = Date.now, env = process.env,
  settings = settlerSettings(), verify = verifyReported, api = runApi, locks = true, criticSeams = {} } = {}) {
  await loadDecisions();
  const abs = path.resolve(repo);
  const out = { ok: true, repo: abs, workflowId, jobId, settled: [], kernel: [], released: [], skipped: [], errors: [] };
  const ledger = openLedger({ file: ledgerFileFor(abs) });
  try {
    await eachInOrder(reportedJobs(ledger.db, { workflowId, jobId }), (item) => settleItem(ledger, item, out,
      { repo, abs, settings, env, now, dryRun, verify, api, locks, criticSeams }));
    try { out.released = await releaseSettled(ledger, { workflowId, jobId, now: now(), settings, dryRun }); }
    catch (error) { out.ok = false; out.errors.push({ step: 'release', error: String(error?.message ?? error).slice(0, 300) }); }
    if (!dryRun) retryAndSweep(ledger, out, { repo, workflowId, jobId, settings, env, now });
  } finally { ledger.close(); }
  return out;
}

/* ------------------------------------------------------------ leaks (H12) */

/** An open incident without a due time is overdue after this long (its owner still answers for it). */
const INCIDENT_DEFAULT_DUE_MS = 24 * 3_600_000;
const LIVE_JOB = new Set(['leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown']);
const DECIDER_OF = { owner: 'owner', supervisor: 'supervisor' };
/**
 * H12: the ledger's leaks (DBTREE v_ledger_leaks), each closed through its owner:
 *   - an expired lease of a job that is not live any more (queued/ready: a launch that never finished) is released;
 *   - an expired lease of a live job raises the job's LeaseLive=False condition (owner controller): the Job controller's
 *     dead-worker step reads it, and v_blocking shows it until the lease is renewed or the job settles;
 *   - an open incident past its due time (or older than INCIDENT_DEFAULT_DUE_MS without one) opens ONE stale-gate
 *     Decision Item for the incident's owner.
 * Returns {leases:[...], incidents:[...]}. Idempotent: a condition only moves once, a Decision Item is keyed.
 */
function sweepLedgerLeaks(ledger, { workflowId = null, now = Date.now() } = {}) {
  const db = ledger.db, out = { leases: [], incidents: [] };
  const scoped = (sql) => workflowId ? `${sql} AND workflow_id=?` : sql;
  const args = (...a) => (workflowId ? [...a, workflowId] : a);
  const leases = db.prepare(scoped('SELECT DISTINCT l.job_id, l.workflow_id, j.status FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE l.expires_at < ?').replace('AND workflow_id', 'AND l.workflow_id')).all(...args(now));
  for (const lease of leases) {
    if (!LIVE_JOB.has(lease.status)) {
      const released = ledger.transaction((tx) => releaseLeases(tx, { jobId: lease.job_id }));
      out.leases.push({ jobId: lease.job_id, status: lease.status, released });
      continue;
    }
    const moved = ledger.transaction((tx) => setCondition(tx, { workflowId: lease.workflow_id, entityType: 'job', entityId: lease.job_id, type: 'LeaseLive', status: 'False',
      reason: 'LeaseExpired', owner: 'controller', message: `${lease.status} job's lease expired: its worker stopped renewing (dead-worker check)`, at: now }));
    out.leases.push({ jobId: lease.job_id, status: lease.status, condition: 'LeaseLive=False', moved });
  }
  const incidents = db.prepare(scoped(`SELECT incident_id, workflow_id, job_id, kind, owner, detail, last_progress, due_at, created_at FROM incidents
    WHERE status='open' AND COALESCE(due_at, created_at + ${INCIDENT_DEFAULT_DUE_MS}) < ?`)).all(...args(now));
  let open = null;
  for (const inc of incidents) {
    try {
      open ??= openDecisionFn();
      const decider = DECIDER_OF[inc.owner] ?? 'kernel';
      const di = open(ledger, { kind: 'stale-gate', decider, workflowId: inc.workflow_id, entity: inc.job_id ? { type: 'job', id: inc.job_id } : { type: 'workflow', id: inc.workflow_id },
        idempotencyKey: `incident-overdue:${inc.incident_id}`, by: 'settler',
        summary: `incident ${inc.incident_id} (${inc.kind}, owner ${inc.owner ?? '-'}) is open past its due time: resolve it or say why it still holds - ${String(inc.detail ?? inc.last_progress ?? '').slice(0, 300)}` }, { now })?.di ?? null;
      out.incidents.push({ incidentId: inc.incident_id, decider, decision: di?.id ?? null });
    } catch (error) { out.incidents.push({ incidentId: inc.incident_id, error: String(error?.message ?? error).slice(0, 200) }); }
  }
  return out;
}
let decisionsModule = null;
const openDecisionFn = () => {
  if (!decisionsModule) throw Object.assign(new Error('decisions module not loaded'), { code: 'decisions-unloaded' });
  return decisionsModule.openDecisionRow;
};
/** Load the Decision Item writer once (scripts/machine/decisions.mjs) before a sweep that may need it. */
export const loadDecisions = async () => { decisionsModule ??= await import('../../machine/decisions.mjs'); return decisionsModule; };

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
    const child = spawnNode([API_FILE, 'settle-tail', '--repo', path.resolve(repo), '--job', jobId, '--json'], { cwd: SKILL_ROOT, detached: true, stdio: 'ignore', env: runtimeEnv(env) });
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

/** The pass right after `starci kernel report` files: detached, never blocking the op's own terminal. */
export function startSettlerFor(repo, { workflowId = null, jobId = null, env = process.env } = {}) {
  try {
    const args = [selfFile, '--repo', path.resolve(repo), ...(workflowId ? ['--workflow', workflowId] : []), ...(jobId ? ['--job', jobId] : []), '--json'];
    const child = spawnNode(args, { cwd: SKILL_ROOT, detached: true, stdio: 'ignore', env: runtimeEnv(env) });
    child.unref();
    return child.pid ?? null;
  } catch { return null; }
}

/** The ledgers the Supervisor watches (config.yaml supervisor.repos, scripts/machine/home.mjs productRepos). */
const supervisedRepos = async () => { try { return (await import('../../machine/home.mjs')).productRepos(); } catch { return []; } };

/** One repo of the CLI pass: the invariant read or one scope-locked reconcile. Repos pass serially (one lock each). */
async function runRepo(repo, { val, has, results }) {
  if (!fs.existsSync(ledgerFileFor(repo))) return;
  if (has('invariant')) {
    const ledger = openLedger({ file: ledgerFileFor(repo) });
    try { results.push({ repo, violations: unsettledViolations(ledger.db) }); } finally { ledger.close(); }
    return;
  }
  // One pass per scope at a time; a second caller leaves it to the running one (it re-reads every item under its lock).
  const scope = claimManager(lockName(repo, `pass-${val('workflow') ?? 'all'}-${val('job') ?? 'all'}`));
  if (!scope.ok) { results.push({ repo, ok: true, action: 'already-running', pid: scope.holder?.pid ?? null }); return; }
  try { results.push(await reconcileJobSettle({ repo, workflowId: val('workflow'), jobId: val('job'), dryRun: has('dry-run') })); }
  finally { scope.release(); }
}

/** One result line of the CLI pass. */
const resultLine = (r) => {
  const counts = r.violations ? ` violations=${r.violations.length}`
    : ` settled=${r.settled?.length ?? 0} kernel=${r.kernel?.length ?? 0} released=${r.released?.filter((x) => x.state === 'released').length ?? 0}`;
  const action = r.action ? ` ${r.action}` : '';
  const errors = r.errors?.length ? ` errors=${r.errors.length}` : '';
  return `[settler] ${r.repo}${counts}${action}${errors}`;
};

/** The settler CLI (`job-settle-main.mjs` runs it): settles the repos named by the flags in `argv`, prints the results and sets the exit code. */
export async function main(argv = process.argv.slice(2)) {
  const val = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const has = (n) => argv.includes(`--${n}`);
  let repos = [];
  if (val('repo')) repos = [path.resolve(val('repo'))];
  else if (has('all') || has('invariant')) repos = await supervisedRepos();
  if (!repos.length) { console.error('use: job-settle.mjs --repo <ledger-owner> [--workflow <id>] [--job <id>] [--dry-run] [--json] | --all | --invariant [--repo <r>]'); process.exit(2); }
  const results = [];
  await eachInOrder(repos, (repo) => runRepo(repo, { val, has, results }));
  const out = { ok: results.every((r) => r.ok !== false), results };
  if (has('json')) console.log(JSON.stringify(out));
  else for (const r of results) console.log(resultLine(r));
  process.exitCode = out.ok ? 0 : 1;
}
