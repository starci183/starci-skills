// critic-reach.mjs — what the Critic (rights role `critic`) may reach, enforced and not described. Its job guard names one
// directory (`reach.dir`: the product files and the rubric handed to it) and one file (`reach.verdictFile`: its answer). The
// shell may run only the read-only programs modules/kernel/command-policy.yaml `critic.read` lists, on paths inside that
// directory, and the writers it lists only onto the verdict file; the Orca self-lifecycle verbs (worker_done, escalation) stay.
// The Edit and Write tools reach the verdict file only; on Claude and Devin the Read, Grep and Glob tools reach the directory only.
// Every other command, path or tool is refused with RIGHTS_CRITIC_REACH.
import path from 'node:path';
import { pathKey, sameOrUnder } from '../lib/path-key.mjs';
import { refusal } from './rights.mjs';

export const CRITIC_REACH_CODE = 'RIGHTS_CRITIC_REACH';
const USE = 'read only the files in your own directory and write only the verdict file there; report with worker_done or an escalation';
const OPTION_PATH = /^-(?:path|filepath|literalpath)$/i;
// Programs whose operands are text, not paths: only an expansion could smuggle a path into them.
const TEXT_PROGRAMS = new Set(['echo', 'printf', 'write-output', 'write-host']);

const deny = (text, reason) => refusal(CRITIC_REACH_CODE, text, reason, USE, USE);
const inside = (file, dir) => sameOrUnder(pathKey(path.resolve(file)), pathKey(path.resolve(dir)));
const same = (a, b) => pathKey(path.resolve(a)) === pathKey(path.resolve(b));
/** Readable by the Critic: its directory, and the one Task file the runtime wrote for it outside that directory (reach.taskFile). */
const readable = (file, guard) => inside(file, guard.reach.dir) || (typeof guard.reach.taskFile === 'string' && same(file, guard.reach.taskFile));
const expands = (value, program) => /[$`]/.test(value) || (!TEXT_PROGRAMS.has(program) && (/%/.test(value) || /^~/.test(value)));

/** The verdict file of the guard, absolute. */
const verdictPathOf = (guard) => path.resolve(guard.reach.dir, guard.reach.verdictFile);

/** The operands that name paths in `args`: the value of `--opt=value`, every non-option word. */
function pathWords(args) {
  return args.map(String).flatMap((word) => {
    if (!word.startsWith('-')) return [word];
    const at = word.indexOf('=');
    return at < 0 ? [] : [word.slice(at + 1)];
  });
}

/** The words of a read program outside the critic's directory, or an expansion no check can resolve. */
function readReach({ program, args, cwd, guard }) {
  const dir = guard.reach.dir;
  if (!inside(cwd, dir)) return cwd;
  const words = TEXT_PROGRAMS.has(program) ? args.map(String).filter((word) => expands(word, program)) : pathWords(args);
  return words.find((word) => expands(word, program) || (!TEXT_PROGRAMS.has(program) && !readable(path.resolve(cwd, word), guard))) ?? null;
}

/** The target path a writer program names: the -Path/-FilePath value, else its first non-option word. */
function writeTarget(args) {
  const list = args.map(String);
  const named = list.findIndex((word) => OPTION_PATH.test(word));
  if (named >= 0) return list[named + 1] ?? null;
  return list.find((word) => !word.startsWith('-')) ?? null;
}

/**
 * The refusal of one shell command of a Critic, or null. `critic` is the policy section (read[], write[]), `text` the
 * command as written. Orca lifecycle verbs are judged before this by the caller.
 */
export function criticCommandVerdict({ program, args, cwd, guard, critic, text }) {
  const dir = guard?.reach?.dir;
  if (!dir) return deny(text, 'the critic guard names no directory, so nothing is reachable');
  const base = cwd ?? dir;
  if ((critic?.write ?? []).includes(program)) {
    const target = writeTarget(args);
    return target && !expands(target, program) && same(path.resolve(base, target), verdictPathOf(guard)) ? null
      : deny(text, `the critic writes only ${guard.reach.verdictFile} in its directory`);
  }
  if (!(critic?.read ?? []).includes(program)) return deny(text, `the critic runs only read-only commands (${program} is not one of them)`);
  const outside = readReach({ program, args: args.map(String), cwd: base, guard });
  return outside === null ? null : deny(text, `the critic reads only inside its own directory (${outside} is not)`);
}

/** The refusal of a write to `filePath` (a file tool or a shell redirection target) by a Critic, or null. */
export function criticWriteVerdict({ filePath, guard, tool = 'shell' }) {
  if (!guard?.reach?.dir) return deny(filePath, 'the critic guard names no directory, so nothing is writable');
  return same(filePath, verdictPathOf(guard)) ? null : deny(filePath, `the critic writes only ${guard.reach.verdictFile} (${tool} targeted another path)`);
}

/** The refusal of a read tool call (Read, Grep, Glob) of a Critic, or null: `paths` are the absolute paths the call reaches. */
export function criticReadVerdict({ paths, guard, tool }) {
  const dir = guard?.reach?.dir;
  if (!dir) return deny(tool, 'the critic guard names no directory, so nothing is readable');
  const outside = paths.find((one) => !readable(one, guard));
  return outside ? deny(`${tool} ${outside}`, `the critic reads only inside its own directory (${tool} reached ${outside})`) : null;
}
