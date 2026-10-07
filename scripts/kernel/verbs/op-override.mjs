// starci kernel op-override — a per-workflow LOCAL variant of one op (owner 2026-09-28, tier 1): extra guidance notes, a longer
// command window, a routing difficulty/model/effort, stored with the workflow and applied by starci kernel dispatch to every
// later job of that op in THIS workflow (packet context.kernel_override). Its `model` is also the route's pool pin
// (scripts/kernel/verbs/route.mjs): the Kernel's recorded decision outranks retry-lineage demotion of that pool —
// an ineligible pin is a typed 'op-override-ineligible' refusal, never a silent different pool. The shared manifest
// is never touched; a shared fix is a tier-2 kernel-proposal. Additive only: an override never removes a check,
// write, step or gate, and a note that says skip/disable/relax a check is refused (kernel-authority.mjs validateOverride).
//
//   op-override --workflow <wf> --op <op> --set '<json>' --decision <id>
//   op-override --workflow <wf> --op <op> --clear --decision <id>
//   op-override --workflow <wf> [--op <op>]            show
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../../engine/runtime-root.mjs';
import { OVERRIDE_KIND, newId, opOverrideOf, recordKernel, refuse, requireDecision, validateOverride } from '../kernel-authority.mjs';

export default {
  verb: 'op-override',
  required: ['workflow'],
  kernelOnly: true,
  flags: ['clear'],
  usage: "  op-override --workflow <id> --op <op> (--set '<json>' | --clear) --decision <id>   a local, additive variant of one op for this workflow (notes, commandTimeoutMs, difficulty, model, effort)",
  run({ ledger, args, repo, emit }) {
    const db = ledger.db, wf = args.workflow;
    if (!args.set && !args.clear) {
      const ops = args.op ? [args.op] : db.prepare('SELECT DISTINCT entity_id op FROM events WHERE workflow_id=? AND kind=?').all(wf, OVERRIDE_KIND).map((r) => r.op);
      const out = Object.fromEntries(ops.map((op) => [op, opOverrideOf(db, wf, op)]));
      emit({ ok: true, workflowId: wf, overrides: out }, Object.entries(out).map(([op, o]) => `${op}: ${o ? JSON.stringify(o) : '(none)'}`).join('\n') || 'no op override', args.json);
      return;
    }
    if (!args.op || !fs.existsSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${args.op}.yaml`))) throw refuse(`--op names no op brief (${args.op})`, 'unknown-op');
    const decision = requireDecision(db, wf, args.decision);
    let override = null;
    if (!args.clear) {
      let parsed;
      try { parsed = JSON.parse(args.set); } catch (e) { throw refuse(`--set is not JSON: ${e.message}`, 'override-invalid'); }
      override = { ...opOverrideOf(db, wf, args.op), ...validateOverride(parsed) };
    }
    const prev = opOverrideOf(db, wf, args.op);
    const id = newId('ovr');
    recordKernel(ledger, { workflowId: wf, entityType: 'op-override', entityId: args.op, kind: OVERRIDE_KIND, repo,
      payload: { id, op: args.op, override, cleared: Boolean(args.clear), previous: prev, decision: decision.id },
      msg: `op-override ${args.op} ${args.clear ? 'cleared' : JSON.stringify(override)}`,
      markdown: `Local override of **${args.op}** for this workflow (decision ${decision.id}):\n\n\`${args.clear ? 'cleared' : JSON.stringify(override)}\`\n\nPrevious: \`${JSON.stringify(prev)}\`` });
    const action = args.clear ? 'cleared' : `set: ${JSON.stringify(override)}`;
    emit({ ok: true, workflowId: wf, op: args.op, override, previous: prev, id },
      `${args.op} override ${action} (applies to every later dispatch of ${args.op} in ${wf}; restore: op-override --set '${JSON.stringify(prev ?? {})}' or --clear)`, args.json);
  },
};
