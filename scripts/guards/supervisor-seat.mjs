// supervisor-seat.mjs — what the Supervisor seat (a bound caller of role supervisor) may run, from the `supervisor` table of
// modules/kernel/command-policy.yaml. The PreToolUse guard and the PATH shims evaluate it (command-policy.mjs policyVerdict): the
// seat reads, answers the items of its menu with `starci supervisor decide`, records a runtime defect for Debug and runs the
// collectors it owns. Every refusal carries the menu and the decision verb's spelling, so a seat that tries a command from habit
// recovers in one step.
import path from 'node:path';
import { refusal } from './rights.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { runtimeChangeRefusal, RUNTIME_CHANGE_CODE } from '../machine/runtime-change.mjs';

const OPTION = /^--?([A-Za-z][\w-]*)(?:=(.*))?$/;
const HINT_TIMEOUT_MS = 45_000;

/** The option names and the values of the options that carry one (`--item x` or `--item=x`) of a call. */
function optionsOf(args) {
  const names = new Set();
  const values = new Map();
  args.map(String).forEach((word, index, all) => {
    const hit = OPTION.exec(word);
    if (!hit) return;
    names.add(hit[1]);
    const next = all[index + 1];
    const value = hit[2] ?? (next?.startsWith('-') === false ? next : undefined);
    if (value !== undefined) values.set(hit[1], value);
  });
  return { names, values };
}

/** The first three non-option words of a starci call: its group, verb and action. */
const starciActionWords = (args) => args.filter((value) => !String(value).startsWith('-')).slice(0, 3).map(String);

const listed = (table, group, verb) => (table?.verbs?.[group] ?? []).includes(verb);

/** The reason a listed verb is still refused for its action or options, or null. */
function narrowReason(table, { group, verb, action }, options) {
  const actions = table.actions?.[verb];
  if (actions?.includes(action) === false) return `starci ${[group, verb, action].filter(Boolean).join(' ')} is not an action of the Supervisor seat (${actions.join(', ')})`;
  const blocked = (table['read-flags']?.[verb] ?? []).find((flag) => options.names.has(flag));
  if (blocked) return `starci ${group} ${verb} --${blocked} changes state: the menu's decision verb does it`;
  if (verb === 'actions' && action === 'record' && !new RegExp(table['record-items']).test(options.values.get('item') ?? '')) {
    return 'starci supervisor actions record is allowed for a runtime defect only: --item runtime-defect:<cause>';
  }
  return null;
}

/** Whether the seat may run `starci <group> <verb> [action]` with these options: {allowed, reason?}. */
function supervisorSeatAllows(table, words, args = []) {
  const [group, verb, action] = words;
  if (!listed(table, group, verb)) return { allowed: false, reason: `starci ${group} ${verb} is not a verb of the Supervisor seat` };
  const reason = narrowReason(table, { group, verb, action }, optionsOf(args));
  return reason ? { allowed: false, reason } : { allowed: true };
}

/** The menu section the seat reads (its open items and the decision verb's spelling), or '' when it cannot be read. */
function supervisorMenuHint({ env = process.env, root = skillRoot } = {}) {
  try {
    const run = runNode([path.join(root, 'scripts', 'supervisor', 'status.mjs'), '--menu'], { cwd: root, env, timeout: HINT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
    return String(run.stdout ?? '').trim();
  } catch { return ''; }
}

const useOf = (table, hint) => [table.use, hint].filter(Boolean).join('\n');

/** A runtime-change verb the seat tried (land, a fix worker): the Debug code, with the menu as the way on. */
function runtimeChangeVerdict({ table, words, text, env }) {
  const change = runtimeChangeRefusal(words);
  if (!change) return null;
  const use = useOf(table, supervisorMenuHint({ env }));
  return refusal(RUNTIME_CHANGE_CODE, text, change.reason, `${change.remedy}\n${use}`, use);
}

/**
 * The refusal of a call the Supervisor seat may not make, or null when it may run it. A program other than starci passes only as a
 * pure read or as a program whose read forms the general policy judges (orca lifecycle, git, npm); the rest is refused.
 */
export function supervisorSeatVerdict({ policy, program, args, text, env = process.env }) {
  const table = policy?.supervisor;
  if (!table) return null;
  if (program === 'starci') {
    const words = starciActionWords(args);
    const changed = runtimeChangeVerdict({ table, words, text, env });
    if (changed) return changed;
    const verdict = supervisorSeatAllows(table, words, args);
    if (verdict.allowed) return null;
    const use = useOf(table, supervisorMenuHint({ env }));
    return refusal('SUPERVISOR_USE_DECIDE', text, `${verdict.reason}: the runtime runs it, and the Supervisor answers the items of its menu`, use, use);
  }
  const reads = new Set([...(policy.read ?? []), ...Object.keys(policy['guarded-read'] ?? {}), ...(table.defer ?? [])].map(String));
  const denied = new Set((table['deny-programs'] ?? []).map(String));
  if (reads.has(program) && !denied.has(program)) return null;
  const use = useOf(table, supervisorMenuHint({ env }));
  return refusal('SUPERVISOR_STARCI_ONLY', text, `the Supervisor seat runs starci verbs and pure reads: ${program} is neither`, use, use);
}
