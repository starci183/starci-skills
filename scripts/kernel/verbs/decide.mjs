// starci kernel decide — the Kernel's DECISION LOG (owner 2026-09-28, guardrail d): every idea is a row hypothesis -> action ->
// metric -> keep/revert, so a restarted Kernel reads what was tried and never repeats a failed idea. The Supervisor
// audits it. Every mutating kernel verb (graph-edit, redesign, op-override) names an open decision.
//
//   decide --workflow <wf> --hypothesis <why> --action-key <key> --metric <what to measure> [--command <c>]
//   decide --workflow <wf> --close <id> --result keep|revert --observed <what the metric showed>
//   decide --workflow <wf> --list
//
// A new decision whose --action-key was already reverted is refused (decision-repeats-failed); so is one whose key
// is still open (decision-open). Brainstorming beyond starci kernel status rca.actions is allowed: invent a key, log it here.
import { recordKernel, refuse, newId } from '../kernel-authority.mjs';
import { DECISION_KIND, DECISION_RESULT_KIND, decisionsOf, opJobsOf, unitsOf } from '../progress-rca.mjs';

const snapshot = (db, wf, now = Date.now()) => {
  const units = unitsOf(opJobsOf(db, wf)).filter((u) => u.state !== 'dropped');
  const done = units.filter((u) => u.state === 'done');
  return { at: now, unitsDone: done.length, unitsTotal: units.length, doneLastHour: done.filter((u) => u.doneAt >= now - 3_600_000).length,
    running: units.reduce((n, u) => n + u.open.filter((j) => j.status !== 'queued').length, 0) };
};
const decisionLine = (d) => {
  const observed = d.observed ? ` -> ${d.observed}` : '';
  return `${d.id} [${d.status}] ${d.actionKey ?? '-'}: ${d.hypothesis}${observed}`;
};
const listDecisions = (wf, log, args, emit) => emit({ ok: true, workflowId: wf, decisions: log }, log.map(decisionLine).join('\n') || 'no decisions yet', args.json);
function closeDecision({ ledger, args, repo, emit, db, wf, now, log }) {
  const d = log.find((x) => x.id === args.close);
  if (!d) throw refuse(`decision ${args.close} is not in ${wf}'s log`, 'decision-unknown');
  if (d.status !== 'open') throw refuse(`decision ${d.id} is already ${d.status}`, 'decision-closed');
  if (!['keep', 'revert'].includes(args.result)) throw refuse('--result keep|revert', 'decision-result-invalid');
  if (!String(args.observed ?? '').trim()) throw refuse('--observed <what the metric showed> is required', 'decision-observed-missing');
  const after = snapshot(db, wf, now);
  recordKernel(ledger, { workflowId: wf, entityType: 'decision', entityId: d.id, kind: DECISION_RESULT_KIND, repo,
    payload: { result: args.result, observed: String(args.observed), after, before: d.baseline ?? null },
    msg: `decision ${d.id} ${args.result}: ${args.observed}`, markdown: `Decision **${d.id}** (${d.actionKey}) -> **${args.result}**\n\nObserved: ${args.observed}\n\nBefore: ${JSON.stringify(d.baseline ?? null)}\nAfter: ${JSON.stringify(after)}`,
    level: args.result === 'keep' ? 'info' : 'warn' });
  const hint = args.result === 'revert' ? `; undo its edits: starci kernel graph-edit --workflow ${wf} --edit undo --undo <edit id> for each edit citing ${d.id}` : '';
  emit({ ok: true, workflowId: wf, id: d.id, result: args.result, after }, `decision ${d.id} closed ${args.result}${hint}`, args.json);
}
function openDecision({ ledger, args, repo, emit, db, wf, now, log }) {
  for (const k of ['hypothesis', 'action-key', 'metric']) if (!String(args[k] ?? '').trim()) throw refuse(`decide needs --${k}`, 'decision-incomplete');
  const key = String(args['action-key']).trim();
  const failed = log.find((d) => d.actionKey === key && d.status === 'revert');
  if (failed) throw refuse(`action ${key} was tried in ${failed.id} and reverted (${failed.observed ?? 'no effect'}): pick the next untried action in starci kernel status rca.actions, or change the shape and log it under a new key`, 'decision-repeats-failed', { tried: failed.id });
  const current = log.find((d) => d.actionKey === key && d.status === 'open');
  if (current) throw refuse(`action ${key} is already being measured in ${current.id}: close it first (decide --close ${current.id} --result keep|revert --observed ...)`, 'decision-open', { open: current.id });
  const id = newId('dec');
  const baseline = snapshot(db, wf, now);
  const payload = { hypothesis: String(args.hypothesis), actionKey: key, metric: String(args.metric), command: args.command ?? null, baseline };
  const commandText = args.command ? `\n\nCommand: \`${args.command}\`` : '';
  recordKernel(ledger, { workflowId: wf, entityType: 'decision', entityId: id, kind: DECISION_KIND, repo, payload,
    msg: `decision ${id} ${key}: ${args.hypothesis}`, markdown: `Decision **${id}**\n\nHypothesis: ${args.hypothesis}\n\nAction: \`${key}\`${commandText}\n\nMetric: ${args.metric}\n\nBaseline: ${JSON.stringify(baseline)}` });
  emit({ ok: true, workflowId: wf, id, ...payload }, `decision ${id} opened for ${key}; cite it with --decision ${id}, and close it next wake (decide --close ${id} --result keep|revert --observed ...)`, args.json);
}

export default {
  verb: 'decide',
  required: ['workflow'],
  kernelOnly: true,
  flags: ['list'],
  usage: '  decide   --workflow <id> (--hypothesis <why> --action-key <key> --metric <m> [--command <c>] | --close <id> --result keep|revert --observed <text> | --list)   the Kernel decision log',
  run({ ledger, args, repo, emit }) {
    const db = ledger.db, wf = args.workflow, now = Date.now();
    const log = decisionsOf(db, wf);
    if (args.list) return listDecisions(wf, log, args, emit);
    if (args.close) return closeDecision({ ledger, args, repo, emit, db, wf, now, log });
    openDecision({ ledger, args, repo, emit, db, wf, now, log });
  },
};
