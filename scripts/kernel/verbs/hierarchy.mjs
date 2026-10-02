// starci kernel hierarchy: split from cli.mjs.
import { AWAITING_OWNER } from '../../../engine/admission.mjs';

export default {
  verb: 'hierarchy',
  required: ['workflow'],
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const out = { ok: true, ...internals.agentHierarchyOf(ledger.db, args.workflow) };
    emit(out, [
      `${out.workflow.nodeId} (${out.workflow.status ?? '-'})`,
      ...out.nodes.map((node) => `  ${node.parentNodeId} -> ${node.nodeId} [${node.status}${node.verdict === AWAITING_OWNER ? ` ${AWAITING_OWNER}` : ''}]${node.runtime.model ? ` ${node.runtime.agent ?? '-'} / ${node.runtime.model}` : ''}`),
    ].join('\n'), args.json);
  },
};
