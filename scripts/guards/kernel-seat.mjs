// kernel-seat.mjs — what a Kernel seat (a bound guard of role kernel) may run, from the `kernel` table of
// modules/kernel/command-policy.yaml. The PreToolUse guard and the PATH shims evaluate it (command-policy.mjs policyVerdict): a
// mutating verb is the runtime's, never the seat's. A refused verb carries the Kernel's menu, so the seat answers in one step.
import path from 'node:path';
import { refusal } from './rights.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { kernelMailboxVerdict } from './install-verdict.mjs';
import { orcaSelfLifecycleAllowed } from './orca-self-lifecycle.mjs';

const OPTION = /^--?([A-Za-z][\w-]*)(?:=.*)?$/;
const flagsOf = (args) => new Set(args.map((value) => OPTION.exec(String(value))?.[1]).filter(Boolean));
const HINT_TIMEOUT_MS = 45_000;

/** The first two non-option words of a starci call: its group and verb. */
const starciWords = (args) => args.filter((value) => !String(value).startsWith('-')).slice(0, 2).map(String);

/** Whether the Kernel seat may run `starci <group> <verb>` with these option names: {allowed, reason?}. */
export function kernelSeatAllowsVerb(table, group, verb, flags = new Set()) {
  if (!(table?.verbs?.[group] ?? []).includes(verb)) return { allowed: false, reason: `starci ${group} ${verb} is not a verb of the Kernel seat` };
  const blocked = (table['read-flags']?.[verb] ?? []).find((flag) => flags.has(flag));
  return blocked ? { allowed: false, reason: `starci ${group} ${verb} --${blocked} mutates the workflow` } : { allowed: true };
}

/** The Decide section of the seat's own `starci kernel status` text (its open menu), or '' when the status cannot be read. */
export function menuHintOf(guard, { env = process.env, root = skillRoot } = {}) {
  if (!guard?.ledgerRepo || !guard?.workflowId) return '';
  try {
    const run = runNode([path.join(root, 'scripts', 'kernel', 'cli.mjs'), 'status', '--repo', guard.ledgerRepo, '--workflow', guard.workflowId],
      { cwd: root, env, timeout: HINT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
    const lines = String(run.stdout ?? '').split(/\r?\n/);
    const start = lines.findIndex((line) => line.startsWith('Decide ('));
    if (start < 0) return 'The menu is empty: nothing waits on the Kernel; yield until the runtime wakes it.';
    const end = lines.findIndex((line, index) => index > start && !line.startsWith(' '));
    return lines.slice(start, end < 0 ? undefined : end).join('\n');
  } catch { return ''; }
}

const useOf = (table, hint) => [table.use ?? 'starci kernel decide', hint].filter(Boolean).join('\n');

/** The refusal of a call a Kernel seat may not make, or null when the seat may run it. Programs other than starci are refused unless pure reads. */
export function kernelSeatVerdict({ policy, program, args, text, guard = null, handle = null, env = process.env }) {
  const table = policy?.kernel;
  if (!table) return null;
  // The seat is an Orca worker: its own heartbeat, ask and worker_done stay, and its mailbox stays the runtime's.
  if (program === 'orca') {
    const mailbox = kernelMailboxVerdict('orca', args, guard);
    if (mailbox) return mailbox;
    if (orcaSelfLifecycleAllowed({ role: 'lead', args, handle, policy })) return null;
  }
  if (program === 'starci') {
    const [group, verb] = starciWords(args);
    const verdict = kernelSeatAllowsVerb(table, group, verb, flagsOf(args));
    if (verdict.allowed) return null;
    const use = useOf(table, menuHintOf(guard, { env }));
    return refusal('KERNEL_USE_DECIDE', text, `${verdict.reason}: the runtime runs it, and the Kernel answers the items of its menu`, use, use);
  }
  const reads = new Set((policy.read ?? []).map(String));
  const denied = new Set((table['deny-programs'] ?? []).map(String));
  if (reads.has(program) && !denied.has(program)) return null;
  const use = useOf(table, '');
  return refusal('KERNEL_STARCI_ONLY', text, `the Kernel seat runs starci verbs and pure reads: ${program} is neither`, use, use);
}
