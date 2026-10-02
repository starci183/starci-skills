// starci kernel redesign — the HEAVY path (owner 2026-09-28: "ops draw the graph, the Kernel only makes light edits"): when the
// RCA says the cut, the scope or the leg plan is wrong, the Kernel does not redesign it itself. It dispatches the op
// that owns that artifact with the RCA as its brief:
//   work.author   re-cut the remaining units (work graph `cut`)
//   scope.define  re-scope (work graph `draw`)
//   goal.revise   change the leg plan
// runtimes.yaml allocation.redesign names the ops and routes them to a strong reasoning pool (routeAs, minDifficulty)
// whatever their usual order: starci kernel route honours payload.redesign. The RCA (clusters, examples, ranked actions) rides
// in packet context.kernel_override.redesign, so the op reads WHY before it redesigns.
//
//   redesign --workflow <wf> --op work.author|scope.define|goal.revise --paths <csv> --decision <id> [--brief <text>]
import { allocationSettings } from '../../../engine/config.mjs';
import { apiRun, jobRow, recordKernel, refuse, requireDecision, setPayload, newId } from '../kernel-authority.mjs';

export default {
  verb: 'redesign',
  required: ['workflow', 'op', 'paths'],
  kernelOnly: true,
  usage: '  redesign --workflow <id> --op work.author|scope.define|goal.revise --paths <csv> --decision <id> [--brief <text>]   dispatch the owning op with the RCA as its brief (strong reasoning pool)',
  async run({ ledger, args, repo, emit }) {
    const db = ledger.db, wf = args.workflow;
    const cfg = allocationSettings()?.redesign ?? {};
    const ops = Array.isArray(cfg.ops) ? cfg.ops : ['work.author', 'scope.define', 'goal.revise'];
    if (!ops.includes(args.op)) throw refuse(`redesign dispatches only ${ops.join(', ')} (runtimes.yaml allocation.redesign.ops); a light change is starci kernel graph-edit`, 'redesign-op-refused');
    const decision = requireDecision(db, wf, args.decision);
    const st = apiRun(['status', '--workflow', wf], { repo, timeoutMs: 300_000 });
    const rca = st.json?.rca ?? null;
    const progress = st.json?.progress ?? null;
    const brief = {
      id: rca?.id ?? null,
      why: rca?.why ?? null,
      progress: progress ? { unitsDone: progress.unitsDone, unitsTotal: progress.unitsTotal, unitsPerHour: progress.unitsPerHour, stall: progress.stall?.reasons ?? [] } : null,
      clusters: (rca?.clusters ?? []).slice(0, 8).map((c) => ({ cause: c.cause, count: c.count, open: c.open, why: c.why, examples: c.examples, destinations: c.destinations })),
      ask: String(args.brief ?? `Redesign so the remaining units can pass: the clusters above are why the current ${args.op === 'goal.revise' ? 'leg plan' : args.op === 'scope.define' ? 'scope' : 'cut'} does not progress.`),
    };
    const r = apiRun(['enqueue', '--workflow', wf, '--op', args.op, '--paths', String(args.paths), '--what', `redesign ${rca?.id ?? ''}`.trim(), '--title', `${args.op}: redesign from RCA ${rca?.id ?? ''}`.trim()], { repo });
    if (!r.ok || !r.json?.job_id) throw refuse(`enqueue ${args.op} refused: ${r.json?.reason ?? ''} ${r.json?.detail ?? r.json?.error ?? r.err ?? r.out}`.trim(), r.json?.reason ?? 'enqueue-refused');
    const jobId = r.json.job_id;
    const job = jobRow(db, jobId);
    const payload = { ...job.payload, redesign: { rca: brief.id, routeAs: cfg.routeAs ?? 'implementation.plan', minDifficulty: cfg.minDifficulty ?? 'hard', effort: cfg.effort, decision: decision.id, brief },
      difficulty: ['hard', 'insane'].includes(job.payload.difficulty) ? job.payload.difficulty : (cfg.minDifficulty ?? 'hard'),
      kernelOverride: { ...(job.payload.kernelOverride ?? {}), notes: [...(job.payload.kernelOverride?.notes ?? []), `Redesign from the Kernel's RCA ${brief.id ?? ''}: read packet context.kernel_override.redesign.brief (progress, failure clusters with examples) before you change anything; fix the cause that blocks the most units.`] } };
    setPayload(ledger, job, payload);
    const id = newId('redesign');
    recordKernel(ledger, { workflowId: wf, entityType: 'redesign', entityId: id, kind: 'kernel-redesign', repo, payload: { id, op: args.op, jobId, rca: brief.id, decision: decision.id },
      msg: `redesign ${args.op} (${jobId}) from RCA ${brief.id}`, markdown: `Heavy redesign: **${args.op}** enqueued as ${jobId} with RCA ${brief.id} as its brief (decision ${decision.id}).\n\n${brief.why ?? ''}` });
    emit({ ok: true, workflowId: wf, id, jobId, op: args.op, rca: brief.id, routeAs: payload.redesign.routeAs, difficulty: payload.difficulty },
      `redesign ${id}: ${args.op} enqueued as ${jobId} with RCA ${brief.id}; it routes as ${payload.redesign.routeAs} at >= ${payload.difficulty} - now starci kernel route --job ${jobId} and starci kernel dispatch --job ${jobId} --spawn (or starci kernel dispatch-ready)`, args.json);
  },
};
