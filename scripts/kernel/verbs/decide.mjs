// starci kernel decide — the Kernel's one decision verb.
//
//   decide --workflow <wf> --item <menu id> --choice <choice> --reason <why> [--text <input>] [--evidence <ref>[,<ref>...]]
//       answers one item of the menu `starci kernel status` prints: the choice is validated against the current menu, recorded in the
//       decision log and executed (scripts/kernel/verbs/shared/menu-decide.mjs). `none-fits` escalates the item up the role chain.
//
// The decision log of owner 2026-09-28 (guardrail d): every idea is a row hypothesis -> action -> metric -> keep/revert, so a
// restarted Kernel reads what was tried and never repeats a failed idea. The Supervisor audits it.
//
//   decide --workflow <wf> --hypothesis <why> --action-key <key> --metric <what to measure> [--command <c>]
//   decide --workflow <wf> --close <id> --result keep|revert --observed <what the metric showed>
//   decide --workflow <wf> --list
//
// A new decision whose --action-key was already reverted is refused (decision-repeats-failed); so is one whose key is still open
// (decision-open).
import { refuse } from '../kernel-authority.mjs';
import { decisionsOf } from '../progress-rca.mjs';
import { closeEntry, openEntry } from '../decision-log.mjs';
import { decideMenuItem } from './shared/menu-decide.mjs';

const decisionLine = (d) => {
  const observed = d.observed ? ` -> ${d.observed}` : '';
  return `${d.id} [${d.status}] ${d.actionKey ?? '-'}: ${d.hypothesis}${observed}`;
};
const listDecisions = (wf, log, args, emit) => emit({ ok: true, workflowId: wf, decisions: log }, log.map(decisionLine).join('\n') || 'no decisions yet', args.json);
function closeDecision({ ledger, args, repo, emit, wf, now, log }) {
  const d = log.find((x) => x.id === args.close);
  if (!d) throw refuse(`decision ${args.close} is not in ${wf}'s log`, 'decision-unknown');
  if (d.status !== 'open') throw refuse(`decision ${d.id} is already ${d.status}`, 'decision-closed');
  if (!['keep', 'revert'].includes(args.result)) throw refuse('--result keep|revert', 'decision-result-invalid');
  if (!String(args.observed ?? '').trim()) throw refuse('--observed <what the metric showed> is required', 'decision-observed-missing');
  const after = closeEntry({ ledger, repo, workflowId: wf, entry: d, result: args.result, observed: args.observed, now });
  const hint = args.result === 'revert' ? `; undo its edits: starci kernel graph-edit --workflow ${wf} --edit undo --undo <edit id> for each edit citing ${d.id}` : '';
  emit({ ok: true, workflowId: wf, id: d.id, result: args.result, after }, `decision ${d.id} closed ${args.result}${hint}`, args.json);
}
function openDecision({ ledger, args, repo, emit, wf, now, log }) {
  for (const k of ['hypothesis', 'action-key', 'metric']) if (!String(args[k] ?? '').trim()) throw refuse(`decide needs --${k}`, 'decision-incomplete');
  const key = String(args['action-key']).trim();
  const failed = log.find((d) => d.actionKey === key && d.status === 'revert');
  if (failed) throw refuse(`action ${key} was tried in ${failed.id} and reverted (${failed.observed ?? 'no effect'}): pick the next untried action in starci kernel status rca.actions, or change the shape and log it under a new key`, 'decision-repeats-failed', { tried: failed.id });
  const current = log.find((d) => d.actionKey === key && d.status === 'open');
  if (current) throw refuse(`action ${key} is already being measured in ${current.id}: close it first (decide --close ${current.id} --result keep|revert --observed ...)`, 'decision-open', { open: current.id });
  const { id, payload } = openEntry({ ledger, repo, workflowId: wf, hypothesis: args.hypothesis, actionKey: key, metric: args.metric, command: args.command ?? null, now });
  emit({ ok: true, workflowId: wf, id, ...payload }, `decision ${id} opened for ${key}; cite it with --decision ${id}, and close it next wake (decide --close ${id} --result keep|revert --observed ...)`, args.json);
}

export default {
  verb: 'decide',
  required: ['workflow'],
  kernelOnly: true,
  flags: ['list'],
  usage: '  decide   --workflow <id> (--item <menu id> --choice <choice> --reason <why> [--text <input>] [--evidence <ref,...>] | --hypothesis <why> --action-key <key> --metric <m> [--command <c>] | --close <id> --result keep|revert --observed <text> | --list)   answer a menu item, or keep the decision log',
  async run(ctx) {
    const { ledger, args, repo, emit } = ctx;
    const wf = args.workflow, now = Date.now();
    if (args.item) return decideMenuItem(ctx);
    const log = decisionsOf(ledger.db, wf);
    if (args.list) return listDecisions(wf, log, args, emit);
    if (args.close) return closeDecision({ ledger, args, repo, emit, wf, now, log });
    openDecision({ ledger, args, repo, emit, wf, now, log });
  },
};
