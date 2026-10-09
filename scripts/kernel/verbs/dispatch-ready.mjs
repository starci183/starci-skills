// starci kernel dispatch-ready — the parallelism push (owner 2026-09-28: the priority workflow ran 2 units with 21 queued-ready
// and 60% free RAM). Routes and dispatches up to the allowed parallelism (starci kernel status progress.allowedParallel: the RAM
// cap, the pools, the workflow's priority reserve) in ONE call, so a Kernel on a modest model does not hand-dispatch
// one job per turn. Each job goes through the ordinary `starci kernel route` + `starci kernel dispatch --spawn` (every admission refusal
// stands: leases, host resources, RAM throttle, seams, autopilot). A queued unit whose shape already failed for a
// shape-related cause is skipped (never the same failing shape; change it with graph-edit first).
//
//   dispatch-ready --workflow <wf> [--max <n>] [--dry-run] [--foreground]
//
// Without --foreground the pushes run in a detached child (dispatches can outlast an agent's command window) and the
// verb answers at once with the result file; the next `starci kernel status` shows the running count.
import fs from 'node:fs';
import { kernelScratchDirOf } from '../op-prompt.mjs';
import path from 'node:path';
import { spawnNode } from '../../api/node/spawn-node.mjs';
import { API_FILE, PUSH_KIND, apiRun, failedShapesOf, jobRow, newId, recordKernel, refuse, shapeOf } from '../kernel-authority.mjs';
import { refuseDecisionsFirst } from '../../machine/decisions.mjs';
import { updateJob } from '../../../engine/db/ledger.mjs';
import { currentRuntimeRev } from '../runtime-rev.mjs';
import { fingerprintOf, isHeld, memoOf, nextMemo } from '../dispatch-refusal-memo.mjs';

function spawnDetached({ args, emit, repo, wf, pushId, dir, resultFile }) {
  fs.mkdirSync(dir, { recursive: true });
  const argv = [API_FILE, 'dispatch-ready', '--repo', repo, '--workflow', wf, '--foreground', '--push-id', pushId, ...(args.max ? ['--max', String(args.max)] : [])];
  const log = fs.openSync(`${resultFile}.log`, 'a');
  const child = spawnNode(argv, { detached: true, stdio: ['ignore', log, log], env: process.env });
  child.unref();
  emit({ ok: true, workflowId: wf, pushId, detached: true, pid: child.pid, resultFile }, `dispatch-ready ${pushId} running in the background (pid ${child.pid}); result: ${resultFile}; the next starci kernel status shows the running count`, args.json);
}

/**
 * The typed refusal a child verb left — {code, reason, step?}, never a bare 'exit N'. A child's emit carries
 * its typed keys in apiRun.json (a route refusal's reason/detail, a refuse()'s code/error); a dispatch-rejected
 * child (`rejected: 'dispatch-rejected'`, which names no reason key itself) is read back from the fresh job
 * result rejectDispatch just wrote: reason/step/detail of the refused launch (cli.mjs dispatchRejectedMessage).
 */
function childRefusal(child, { db = null, jobId = null } = {}) {
  const j = child?.json ?? {};
  const settled = j.rejected === 'dispatch-rejected' && db && jobId ? (jobRow(db, jobId)?.result ?? null) : null;
  const rejected = settled?.reason === 'dispatch-rejected' ? settled : null;
  const code = j.code ?? j.rejected ?? rejected?.reason ?? j.reason ?? j.refused ?? `exit-${child?.status ?? 'unknown'}`;
  const reason = j.detail ?? j.error ?? j.reason ?? j.refused
    ?? rejected?.detail ?? rejected?.signal ?? rejected?.message
    ?? (j.managed?.step ? `managed dispatch failed at ${j.managed.step}` : null)
    ?? (String(child?.err ?? child?.out ?? '').trim().slice(0, 300) || `exit ${child?.status}`);
  const step = rejected?.step ?? j.managed?.step ?? null;
  const watch = Array.isArray(j.watch) ? j.watch.filter((file) => typeof file === 'string') : [];
  return { code, reason: String(reason).slice(0, 400), ...(j.cause ? { cause: j.cause } : {}), ...(step ? { step } : {}), ...(watch.length ? { watch } : {}) };
}

function routeReadyJob(jobId, repo, job, db) {
  const model = job.payload.kernelModel ?? null;
  if (model) return { model, refusal: null };
  const route = apiRun(['route', '--job', jobId, ...(job.payload.difficulty ? ['--difficulty', job.payload.difficulty] : [])], { repo, timeoutMs: 300_000 });
  if (route.ok) return { model, refusal: null };
  const refused = childRefusal(route, { db, jobId });
  return { model, refusal: { result: { jobId, route: `${refused.code}: ${refused.reason}`, refusal: refused }, launched: 0, stop: false } };
}

/** Dispatch one routed job with `--spawn` and read the answer: the result row, 1 when launched, and whether the push must stop on a host limit. */
function dispatchReadyJob({ db, repo, jobId, model }) {
  const dispatch = apiRun(['dispatch', '--job', jobId, '--spawn', ...(model ? ['--model', model] : [])], { repo, timeoutMs: 15 * 60_000 });
  const waiting = dispatch.json?.waiting === true;
  const refused = dispatch.ok || waiting ? null : childRefusal(dispatch, { db, jobId });
  const result = { jobId, dispatched: dispatch.ok && !waiting,
    waiting: waiting ? (dispatch.json?.reason ?? dispatch.json?.throttle?.reason ?? 'waiting') : null,
    error: refused ? `${refused.code}: ${refused.reason}` : null,
    ...(refused ? { refusal: refused } : {}) };
  const stop = waiting && /host-resources|workers-max|heavy-paused|does-not-fit|priority-reserved|worktree-cap/.test(JSON.stringify(dispatch.json ?? {}));
  return { result, launched: dispatch.ok && !waiting ? 1 : 0, stop };
}

/** The refusal this push met for a job, remembered on the job: recorded at the first refusal of a cause and at each growing retry, never as a new row per push. */
function rememberRefusal({ ledger, wf, job: before, refusal, now }) {
  const { db } = ledger;
  // The route and dispatch children wrote the row while they ran: the memo is added to what they left, never to the copy read before.
  const job = jobRow(db, before.job_id) ?? before;
  const fingerprint = fingerprintOf({ db, workflowId: wf, refusal, rev: currentRuntimeRev() ?? null });
  const memo = nextMemo(memoOf(job.payload), { refusal, fingerprint, now });
  ledger.transaction(() => updateJob(db, { jobId: job.job_id, at: job.updated_at, payload: { ...job.payload, dispatchRefusal: memo } }));
  return memo;
}

/** The job is left alone while its last refusal stands: same cause, interval not run out. Returns the held result, or null. */
function heldResult({ db, wf, job, now }) {
  const memo = memoOf(job.payload);
  if (!memo) return null;
  const fingerprint = fingerprintOf({ db, workflowId: wf, refusal: { code: memo.code, step: memo.step, reason: memo.reason, watch: memo.watch }, rev: currentRuntimeRev() ?? null });
  return isHeld(memo, { fingerprint, now })
    ? { jobId: job.job_id, held: 'refusal-backoff', cause: memo.code, count: memo.count, since: memo.firstAt, until: memo.nextAt, reason: memo.reason } : null;
}

function processReadyJob({ ledger, repo, wf, jobId, dryRun, now = Date.now() }) {
  const db = ledger.db;
  const job = jobRow(db, jobId);
  if (job?.status !== 'queued' && job?.status !== 'ready') return { result: { jobId, skipped: `status ${job?.status ?? 'gone'}` }, launched: 0, stop: false };
  const failed = failedShapesOf(db, wf, job).get(shapeOf(job.op_id, job.payload));
  if (failed) return { result: { jobId, skipped: `same-failing-shape as ${failed.jobId} (${failed.causes.join(', ')}): change it with starci kernel graph-edit (widen/params/split) first` }, launched: 0, stop: false };
  const held = dryRun ? null : heldResult({ db, wf, job, now });
  if (held) return { result: held, launched: 0, stop: false };
  if (dryRun) return { result: { jobId, would: job.payload.kernelModel ? `dispatch --model ${job.payload.kernelModel}` : 'route + dispatch --spawn' }, launched: 1, stop: false };

  const { model, refusal } = routeReadyJob(jobId, repo, job, db);
  const outcome = refusal ?? dispatchReadyJob({ db, repo, jobId, model });
  const refused = outcome.result.refusal;
  if (refused) outcome.result.memo = rememberRefusal({ ledger, wf, job, refusal: refused, now });
  return outcome;
}

function resultRows(results, includeWould, prefix) {
  return results.map((result) => {
    let status;
    if (includeWould) {
      if (result.dispatched) status = 'dispatched';
      else status = result.would ?? result.skipped ?? result.waiting ?? result.route ?? result.error;
    } else if (result.dispatched) status = 'dispatched';
    else status = result.skipped ?? result.waiting ?? result.route ?? result.error;
    return `${prefix}${result.jobId}: ${status}`;
  }).join('\n');
}

export default {
  verb: 'dispatch-ready',
  required: ['workflow'],
  kernelOnly: true,
  flags: ['foreground'],
  usage: '  dispatch-ready --workflow <id> [--max <n>] [--dry-run] [--foreground]   route + dispatch queued-ready units up to starci kernel status progress.allowedParallel',
  async run({ ledger, args, repo, emit }) {
    const db = ledger.db, wf = args.workflow, now = Date.now();
    // Decisions first: a push never runs past the Kernel's open Decision Items (its route/dispatch children are exempt).
    if (!args['dry-run']) refuseDecisionsFirst(db, wf, 'dispatch-ready', { now, repo });
    const pushId = args['push-id'] ?? newId('push');
    const dir = kernelScratchDirOf(repo, wf, 'dispatch');
    const resultFile = path.join(dir, `${pushId}.json`);
    if (!args.foreground && !args['dry-run']) {
      spawnDetached({ args, emit, repo, wf, pushId, dir, resultFile });
      return;
    }
    const st = apiRun(['status', '--workflow', wf], { repo, timeoutMs: 300_000 });
    const p = st.json?.progress;
    if (!p) throw refuse(`starci kernel status gave no progress block: ${st.json?.error ?? st.err ?? st.out}`.slice(0, 400), 'progress-unreadable');
    const room = Math.max(0, p.allowedParallel - p.running);
    const k = Math.min(room, args.max != null ? Number(args.max) : room);
    const results = [];
    let launched = 0;
    for (const jobId of p.readyJobs ?? []) {
      if (launched >= k) break;
      const processed = processReadyJob({ ledger, repo, wf, jobId, dryRun: Boolean(args['dry-run']) });
      results.push(processed.result);
      launched += processed.launched;
      // A host refusal (RAM, disk, workers cap, a repository at its worktree cap) will refuse the next one too: stop and let the next wake retry.
      if (processed.stop) break;
    }
    const out = { ok: true, workflowId: wf, pushId, before: { running: p.running, allowed: p.allowedParallel, queuedReady: p.queuedReady }, target: k, launched, results, dryRun: Boolean(args['dry-run']) };
    // A push in which every job is held by a refusal it already recorded leaves no row: the cause was recorded when it was met.
    if (!args['dry-run'] && (launched > 0 || results.some((result) => !result.held))) {
      recordKernel(ledger, { workflowId: wf, entityType: 'dispatch-push', entityId: pushId, kind: PUSH_KIND, repo, payload: out,
        msg: `dispatch-ready ${pushId}: ${launched}/${k} launched (running ${p.running} of ${p.allowedParallel} allowed)`,
        markdown: `Parallelism push **${pushId}**: running ${p.running} of ${p.allowedParallel} allowed, ${p.queuedReady} queued-ready. Launched ${launched} of ${k}.\n\n${resultRows(results, false, '- ')}` });
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(resultFile, JSON.stringify(out, null, 2)); } catch { /* the event stands */ }
    }
    emit(out, `dispatch-ready ${pushId}: launched ${launched} of ${k} (running ${p.running} of ${p.allowedParallel} allowed)\n${resultRows(results, true, '  ')}`, args.json);
  },
};
