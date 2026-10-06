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

function spawnDetached({ args, emit, repo, wf, pushId, dir, resultFile }) {
  fs.mkdirSync(dir, { recursive: true });
  const argv = [API_FILE, 'dispatch-ready', '--repo', repo, '--workflow', wf, '--foreground', '--push-id', pushId, ...(args.max ? ['--max', String(args.max)] : [])];
  const log = fs.openSync(`${resultFile}.log`, 'a');
  const child = spawnNode(argv, { detached: true, stdio: ['ignore', log, log], env: process.env });
  child.unref();
  emit({ ok: true, workflowId: wf, pushId, detached: true, pid: child.pid, resultFile }, `dispatch-ready ${pushId} running in the background (pid ${child.pid}); result: ${resultFile}; the next starci kernel status shows the running count`, args.json);
}

function processReadyJob({ db, repo, wf, jobId, dryRun }) {
  const job = jobRow(db, jobId);
  if (job?.status !== 'queued') return { result: { jobId, skipped: `status ${job?.status ?? 'gone'}` }, launched: 0, stop: false };
  const failed = failedShapesOf(db, wf, job).get(shapeOf(job.op_id, job.payload));
  if (failed) return { result: { jobId, skipped: `same-failing-shape as ${failed.jobId} (${failed.causes.join(', ')}): change it with starci kernel graph-edit (widen/params/split) first` }, launched: 0, stop: false };
  if (dryRun) return { result: { jobId, would: job.payload.kernelModel ? `dispatch --model ${job.payload.kernelModel}` : 'route + dispatch --spawn' }, launched: 1, stop: false };

  const model = job.payload.kernelModel ?? null;
  if (!model) {
    const route = apiRun(['route', '--job', jobId, ...(job.payload.difficulty ? ['--difficulty', job.payload.difficulty] : [])], { repo, timeoutMs: 300_000 });
    if (!route.ok) return { result: { jobId, route: route.json?.reason ?? route.json?.error ?? `exit ${route.status}` }, launched: 0, stop: false };
  }
  const dispatch = apiRun(['dispatch', '--job', jobId, '--spawn', ...(model ? ['--model', model] : [])], { repo, timeoutMs: 15 * 60_000 });
  const waiting = dispatch.json?.waiting === true;
  const result = { jobId, dispatched: dispatch.ok && !waiting,
    waiting: waiting ? (dispatch.json?.reason ?? dispatch.json?.throttle?.reason ?? 'waiting') : null,
    error: dispatch.ok ? null : (dispatch.json?.reason ?? dispatch.json?.error ?? `exit ${dispatch.status}`) };
  const stop = waiting && /host-resources|workers-max|heavy-paused|does-not-fit|priority-reserved|worktree-cap/.test(JSON.stringify(dispatch.json ?? {}));
  return { result, launched: dispatch.ok && !waiting ? 1 : 0, stop };
}

function resultRows(results, includeWould, prefix) {
  return results.map((result) => {
    const status = includeWould
      ? (result.dispatched ? 'dispatched' : result.would ?? result.skipped ?? result.waiting ?? result.route ?? result.error)
      : (result.dispatched ? 'dispatched' : result.skipped ?? result.waiting ?? result.route ?? result.error);
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
      const processed = processReadyJob({ db, repo, wf, jobId, dryRun: Boolean(args['dry-run']) });
      results.push(processed.result);
      launched += processed.launched;
      // A host refusal (RAM, disk, workers cap, a repository at its worktree cap) will refuse the next one too: stop and let the next wake retry.
      if (processed.stop) break;
    }
    const out = { ok: true, workflowId: wf, pushId, before: { running: p.running, allowed: p.allowedParallel, queuedReady: p.queuedReady }, target: k, launched, results, dryRun: Boolean(args['dry-run']) };
    if (!args['dry-run']) {
      recordKernel(ledger, { workflowId: wf, entityType: 'dispatch-push', entityId: pushId, kind: PUSH_KIND, repo, payload: out,
        msg: `dispatch-ready ${pushId}: ${launched}/${k} launched (running ${p.running} of ${p.allowedParallel} allowed)`,
        markdown: `Parallelism push **${pushId}**: running ${p.running} of ${p.allowedParallel} allowed, ${p.queuedReady} queued-ready. Launched ${launched} of ${k}.\n\n${resultRows(results, false, '- ')}` });
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(resultFile, JSON.stringify(out, null, 2)); } catch { /* the event stands */ }
    }
    emit(out, `dispatch-ready ${pushId}: launched ${launched} of ${k} (running ${p.running} of ${p.allowedParallel} allowed)\n${resultRows(results, true, '  ')}`, args.json);
  },
};
