// op-starci.mjs — the starci groups an Op never runs, from the `op` table of modules/kernel/command-policy.yaml. An Op's starci calls are
// its work: the capability verbs for servers, renders, image generation and tests, the checks, and its report to its Kernel. The control
// plane (the Supervisor, the reconciler, workflow start and routing, Debug) belongs to the controllers, the Kernel and the Supervisor.
import { refusal } from './rights.mjs';

/** The first non-option word of a starci call: its group. */
const groupOf = (args) => String(args.find((word) => !String(word).startsWith('-')) ?? '');

/** The refusal of a starci call of a group an Op never runs, or null. */
export function opStarciVerdict({ policy, program, args, text }) {
  const table = policy?.op;
  if (!table || program !== 'starci') return null;
  const group = groupOf(args);
  if (!(table['deny-groups'] ?? []).includes(group)) return null;
  return refusal('RIGHTS_OP_CONTROL_PLANE', text, `starci ${group} is the control plane: an Op runs the capability verbs of its work and reports to its Kernel`, table.use, table.use);
}
