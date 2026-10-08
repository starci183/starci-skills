// op-prompt-verbs.mjs — the "your verbs" block of an [Op] prompt: the exact `starci <group> <verb>` calls the op's contract names, from
// the CLI catalog (packages/cli/src/catalog.generated.mjs), so a worker never runs --help or re-reads its contract yaml for a flag.
// The bound is modules/models/runtimes.yaml allocation.opVerbs; a verb the contract names that the catalog lacks is a contract defect
// (tests/kernel/op-prompt-verbs.spec.mjs), never printed.
import fs from 'node:fs';
import { cliGroups, cliVerb } from '../machine/cli-verbs.mjs';
import { allocationSettings } from '../../engine/config.mjs';

const CALL = /\bstarci ([a-z][a-z0-9-]*) ([a-z][a-z0-9-]*)/g;
const FLAG = /--([a-z][a-z0-9-]*)/g;

/** The declared bound of the block; refuses when the contract omits it. */
export function opVerbsBound() {
  const bound = allocationSettings()?.opVerbs;
  for (const key of ['maxVerbs', 'maxChars', 'lineChars']) {
    if (!Number.isInteger(bound?.[key]) || bound[key] <= 0) throw new Error(`modules/models/runtimes.yaml allocation.opVerbs.${key} must declare a positive integer`);
  }
  return bound;
}

/** Every `group verb` call the text names in the order it first appears, with the flags written within 300 characters after each call. */
export function namedCalls(text) {
  const calls = new Map();
  const groups = new Set(cliGroups());
  const hits = [...String(text).matchAll(CALL)].filter((hit) => groups.has(hit[1]));
  for (const [index, hit] of hits.entries()) {
    const key = `${hit[1]} ${hit[2]}`;
    const end = Math.min(hit.index + 300, hits[index + 1]?.index ?? Infinity);
    const flags = [...text.slice(hit.index + hit[0].length, end).matchAll(FLAG)].map((flag) => flag[1]);
    calls.set(key, [...new Set([...(calls.get(key) ?? []), ...flags])]);
  }
  return calls;
}

/** The `group verb` calls the text names under a catalog group whose verb the catalog lacks: a contract defect, never printed. */
export const missingVerbs = (text) => [...namedCalls(text).keys()].filter((key) => !catalogVerb(key));

/** The catalog verb row of `group verb`, or null. */
const catalogVerb = (key) => cliVerb(...key.split(' '));

const flagText = (flag) => {
  if (flag.type === 'boolean') return `--${flag.name}`;
  return `--${flag.name} <${flag.type === 'enum' ? flag.enum.join('|') : flag.name}>`;
};

/** One line of the block: the call, its positionals, the required flags and the flags the contract uses, then the catalog summary. */
function verbLine(key, usedFlags, lineChars) {
  const verb = catalogVerb(key);
  const positional = (verb.positional ?? []).map((entry) => (entry.required ? `<${entry.name}>` : `[${entry.name}]`));
  const flags = (verb.flags ?? []).filter((flag) => flag.required || usedFlags.includes(flag.name));
  const words = [key, ...positional, ...flags.map((flag) => (flag.required ? flagText(flag) : `[${flagText(flag)}]`))];
  const line = `  starci ${words.join(' ')} - ${verb.summary ?? ''}`;
  return line.length <= lineChars ? line : `${line.slice(0, lineChars - 3)}...`;
}

// A verb the op may run: catalogued, not a standing verb the prompt prints in full, not in a group of the Kernel or above, and not
// restricted to roles that exclude a worker.
const opCallable = (key, bound) => {
  const verb = catalogVerb(key);
  if (!verb || (bound.standing ?? []).includes(key) || (bound.omitGroups ?? []).includes(key.split(' ')[0])) return false;
  return !verb.roles || verb.roles.includes('worker');
};

/** The block's lines for the contract text `contractText`; empty when the contract names no catalogued verb beyond the standing ones. */
export function opVerbsLines(contractText) {
  const bound = opVerbsBound();
  const rows = [...namedCalls(contractText)].filter(([key]) => opCallable(key, bound));
  const lines = [];
  let chars = 0;
  for (const [key, flags] of rows.slice(0, bound.maxVerbs)) {
    const line = verbLine(key, flags, bound.lineChars);
    if (chars + line.length + 1 > bound.maxChars) break;
    lines.push(line);
    chars += line.length + 1;
  }
  if (!rows.length) return [];
  const omitted = rows.length - lines.length;
  const more = omitted ? ` (${omitted} more: starci <group> <verb> --help)` : '';
  return [`your verbs: the starci calls your contract names, with the flags it uses - run them as written, no --help needed${more}:`, ...lines];
}

/** The block for the brief file `briefFile`; an unreadable brief names no verb. */
export function opVerbsOfBrief(briefFile) {
  try { return opVerbsLines(fs.readFileSync(briefFile, 'utf8')); } catch { return []; }
}
