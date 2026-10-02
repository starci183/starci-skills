// api dispatch-ready — the parallelism push (owner 2026-09-28: the priority workflow ran 2 units with 21 queued-ready
// and 60% free RAM). Routes and dispatches up to the allowed parallelism (api status progress.allowedParallel: the RAM
// cap, the pools, the workflow's priority reserve) in ONE call, so a Kernel on a modest model does not hand-dispatch
// one job per turn. Each job goes through the ordinary `api route` + `api dispatch --spawn` (every admission refusal
// stands: leases, host resources, RAM throttle, seams, autopilot). A queued unit whose shape already failed for a
// shape-related cause is skipped (never the same failing shape; change it with graph-edit first).
//
//   dispatch-ready --workflow <wf> [--max <n>] [--dry-run] [--foreground]
//
// Without --foreground the pushes run in a detached child (dispatches can outlast an agent's command window) and the
// verb answers at once with the result file; the next `api status` shows the running count.
import fs from 'node:fs';
import { kernelScratchDirOf } from '../op-prompt.mjs';
import path from 'node:path';
import { spawnNode } from '../../api/node/spawn-node.mjs';
import { API_FILE, PUSH_KIND, apiRun, failedShapesOf, jobRow, newId, recordKernel, refuse, shapeOf } from '../kernel-authority.mjs';
import { refuseDecisionsFirst } from '../../machine/decisions.mjs';

export default {
  verb: 'dispatch-ready',
  required: ['workflow'],
  kernelOnly: true,
  flags: ['foreground'],
  usage: '  dispatch-ready --workflow <id> [--max <n>] [--dry-run] [--foreground]   route + dispatch queued-ready units up to api status progress.allowedParallel',
  async run({ ledger, args, repo, emit }) {
    const db = ledger.db, wf = args.workflow, now = Date.now();
    // Decisions first: a push never runs past the Kernel's open Decision Items (its route/dispatch children are exempt).
    if (!args['dry-run']) refuseDecisionsFirst(db, wf, 'dispatch-ready', { now, repo });
    const pushId = args['push-id'] ?? newId('push');
    const dir = kernelScratchDirOf(repo, wf, 'dispatch');
    const resultFile = path.join(dir, `${pushId}.json`);
    if (!args.foreground && !args['dry-run']) {
      fs.mkdirSync(dir, { recursive: true });
      const argv = [API_FILE, 'dispatch-ready', '--repo', repo, '--workflow', wf, '--foreground', '--push-id', pushId, ...(args.max ? ['--max', String(args.max)] : [])];
      const log = fs.openSync(`${resultFile}.log`, 'a');
      const child = spawnNode(argv, { detached: true, stdio: ['ignore', log, log], env: process.env });
      child.unref();
      emit({ ok: true, workflowId: wf, pushId, detached: true, pid: child.pid, resultFile }, `dispatch-ready ${pushId} running in the background (pid ${child.pid}); result: ${resultFile}; the next api status shows the running count`, args.json);
      return;
    }
    const st = apiRun(['status', '--workflow', wf], { repo, timeoutMs: 300_000 });
    const p = st.json?.progress;
    if (!p) throw refuse(`api status gave no progress block: ${st.json?.error ?? st.err ?? st.out}`.slice(0, 400), 'progress-unreadable');
    const room = Math.max(0, p.allowedParallel - p.running);
    const k = Math.min(room, args.max != null ? Number(args.max) : room);
    const results = [];
    let launched = 0;
    for (const jobId of p.readyJobs ?? []) {
      if (launched >= k) break;
      const job = jobRow(db, jobId);
      if (!job || job.status !== 'queued') { results.push({ jobId, skipped: `status ${job?.status ?? 'gone'}` }); continue; }
      const failed = failedShapesOf(db, wf, job).get(shapeOf(job.op_id, job.payload));
      if (failed) { results.push({ jobId, skipped: `same-failing-shape as ${failed.jobId} (${failed.causes.join(', ')}): change it with api graph-edit (widen/params/split) first` }); continue; }
      if (args['dry-run']) { results.push({ jobId, would: job.payload.kernelModel ? `dispatch --model ${job.payload.kernelModel}` : 'route + dispatch --spawn' }); launched += 1; continue; }
      let model = job.payload.kernelModel ?? null;
      if (!model) {
        const r = apiRun(['route', '--job', jobId, ...(job.payload.difficulty ? ['--difficulty', job.payload.difficulty] : [])], { repo, timeoutMs: 300_000 });
        if (!r.ok) { results.push({ jobId, route: r.json?.reason ?? r.json?.error ?? `exit ${r.status}` }); continue; }
      }
      const d = apiRun(['dispatch', '--job', jobId, '--spawn', ...(model ? ['--model', model] : [])], { repo, timeoutMs: 15 * 60_000 });
      const waiting = d.json?.waiting === true;
      results.push({ jobId, dispatched: d.ok && !waiting, waiting: waiting ? (d.json?.reason ?? d.json?.throttle?.reason ?? 'waiting') : null, error: d.ok ? null : (d.json?.reason ?? d.json?.error ?? `exit ${d.status}`) });
      if (d.ok && !waiting) launched += 1;
      // A host refusal (RAM, disk, fleet cap, a repository at its worktree cap) will refuse the next one too: stop and let the next wake retry.
      if (waiting && /host-resources|fleet-max|heavy-paused|does-not-fit|priority-reserved|worktree-cap/.test(JSON.stringify(d.json ?? {}))) break;
    }
    const out = { ok: true, workflowId: wf, pushId, before: { running: p.running, allowed: p.allowedParallel, queuedReady: p.queuedReady }, target: k, launched, results, dryRun: Boolean(args['dry-run']) };
    if (!args['dry-run']) {
      recordKernel(ledger, { workflowId: wf, entityType: 'dispatch-push', entityId: pushId, kind: PUSH_KIND, repo, payload: out,
        msg: `dispatch-ready ${pushId}: ${launched}/${k} launched (running ${p.running} of ${p.allowedParallel} allowed)`,
        markdown: `Parallelism push **${pushId}**: running ${p.running} of ${p.allowedParallel} allowed, ${p.queuedReady} queued-ready. Launched ${launched} of ${k}.\n\n${results.map((r) => `- ${r.jobId}: ${r.dispatched ? 'dispatched' : r.skipped ?? r.waiting ?? r.route ?? r.error}`).join('\n')}` });
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(resultFile, JSON.stringify(out, null, 2)); } catch { /* the event stands */ }
    }
    emit(out, `dispatch-ready ${pushId}: launched ${launched} of ${k} (running ${p.running} of ${p.allowedParallel} allowed)\n${results.map((r) => `  ${r.jobId}: ${r.dispatched ? 'dispatched' : r.would ?? r.skipped ?? r.waiting ?? r.route ?? r.error}`).join('\n')}`, args.json);
  },
};
