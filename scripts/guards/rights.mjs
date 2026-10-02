// rights.mjs - the ROLE RIGHTS of the PreToolUse command guard (rules R223 RIGHTS_ROLE_DENIED, R224 RIGHTS_PROTECTED_ZONE).
//
// Who may do what is decided by the caller's role, which the guard already resolves from the Orca terminal the agent
// runs in (scripts/guards/command-guard.mjs boundGuard, hook-install.mjs bindSeatGuard) and never from anything the agent
// says about itself:
//   op          an op worker of a workflow on an app (job guard, role op): path 3 of the source process
//   supervisor  the Supervisor seat (seat guard) and its [Worker] jobs (job guard of workflow 'supervisor'): path 2, the
//               self-upgrade of .claude
//   lead        the Kernel (job guard, role kernel)
//   coordinator a session launched with STARCI_ROLE=coordinator (the land seat)
//   release     STARCI_ROLE=release AND the host lock held live by role release (scripts/machine/host-lock.mjs): the release cut
//   null        no guard, no seat, no role: the owner's own session, which the rights never restrict
//
// Command admission is data in modules/kernel/command-policy.yaml and is evaluated by command-policy.mjs. This module keeps
// only role resolution and the small parsers that both the PreToolUse guard and PATH shim share. It imports nothing heavy:
// the YAML of either policy loads only after a caller is known to have a bound role.
import fs from 'node:fs';
import path from 'node:path';
import { guardsRoot } from './guards-root.mjs';
import { pathKey } from '../lib/path-key.mjs';

const ENV_ROLES = new Set(['op', 'supervisor', 'lead', 'coordinator', 'release']);
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');
const RUNTIME_MARKER = path.join('knowledge', 'hfs', 'runtime-slots.yaml');
const WALK_LIMIT = 24;

/** <guards root>/seats/<handle>.json (the seat guard bound to an Orca terminal), or null. */
export function boundSeat(handle, { root, env = process.env } = {}) {
  if (!handle) return null;
  try { return JSON.parse(fs.readFileSync(path.join(guardsRoot(root, env), 'seats', `${safeName(handle)}.json`), 'utf8')); }
  catch { return null; }
}

/** <guards root>/terminals/<handle>.json (the terminal-bound job guard), or null. */
export function boundGuard(handle, { root, env = process.env } = {}) {
  if (!handle) return null;
  try { return JSON.parse(fs.readFileSync(path.join(guardsRoot(root, env), 'terminals', `${safeName(handle)}.json`), 'utf8')); }
  catch { return null; }
}

/**
 * The caller's rights role, or null (the owner's own session). `lockOwner` is the host lock's owner object (or null): the
 * release role needs it, so a session cannot claim release by an environment variable alone.
 */
export function rightsRoleOf({ guard = null, seat = null, env = process.env, lockOwner = null } = {}) {
  const claimed = String(env?.STARCI_ROLE ?? '').toLowerCase();
  if (guard?.role === 'kernel') return 'lead';
  if (guard?.role === 'op') return guard.workflowId === 'supervisor' ? 'supervisor' : 'op';
  if (seat?.role === 'supervisor') return 'supervisor';
  // A claim never outranks a bound guard or seat; the release claim holds only while the host lock is held live by role release.
  if (claimed === 'release') return lockOwner && !lockOwner.stale && lockOwner.role === 'release' ? 'release' : null;
  if (ENV_ROLES.has(claimed)) return claimed;
  return null;
}

/* ------------------------------------------------------------------------------------------ command-policy parsers */

const GIT_GLOBAL_WITH_VALUE = new Set(['--git-dir', '--work-tree', '--namespace', '--super-prefix', '--exec-path', '--attr-source']);

/** {sub, rest} of `git [global options] <sub> <args...>`. */
export function gitSubOf(args) {
  let i = 0;
  while (i < args.length) {
    const a = String(args[i]);
    if ((a === '-C' || a === '-c' || a === '--config-env' || GIT_GLOBAL_WITH_VALUE.has(a)) && i + 1 < args.length) { i += 2; continue; }
    if (a.startsWith('-')) { i += 1; continue; }
    break;
  }
  return { sub: args[i] == null ? null : String(args[i]), rest: args.slice(i + 1).map(String) };
}

const PUSH_VALUE_OPTIONS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
const PUSH_ALL = /^--(?:all|mirror|tags|follow-tags|prune)$/;

/** The destination refs of one `git push` call: {remote, refs[], broad}. broad = the call pushes more than the refspecs name. */
export function pushTargets(rest) {
  const words = [];
  let broad = false;
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (PUSH_VALUE_OPTIONS.has(a)) { i += 1; continue; }
    if (a.startsWith('-')) { if (PUSH_ALL.test(a)) broad = true; continue; }
    words.push(a);
  }
  const refs = words.slice(1).map((spec) => {
    const s = spec.replace(/^\+/, '');
    const dst = s.includes(':') ? s.slice(s.indexOf(':') + 1) : s;
    return dst.replace(/^refs\/heads\//, 'refs/heads/');
  });
  return { remote: words[0] ?? null, refs, broad: broad || words.length < 2 };
}

const optionName = (value) => String(value).split('=', 1)[0];
const optionWords = (rest, takesValue = new Set()) => {
  const options = [], words = [];
  for (let i = 0; i < rest.length; i += 1) {
    const value = String(rest[i]);
    if (value === '--') { words.push(...rest.slice(i + 1).map(String)); break; }
    if (!value.startsWith('-')) { words.push(value); continue; }
    options.push(value);
    if (!value.includes('=') && takesValue.has(optionName(value)) && rest[i + 1] != null) words.push(String(rest[++i]));
  }
  return { options, words };
};

const BRANCH_READ = new Set(['--list', '-l', '-a', '--all', '-r', '--remotes', '-v', '--verbose', '--show-current', '--contains', '--merged', '--points-at']);
const BRANCH_VALUES = new Set(['--contains', '--merged', '--points-at']);
const TAG_READ = new Set(['-l', '--list', '-v', '--verify', '--points-at', '--contains', '--merged', '-n']);
const TAG_VALUES = new Set(['--points-at', '--contains', '--merged']);
const CONFIG_READ = new Set(['--get', '--get-all', '--get-regexp', '--list', '-l', '--show-origin']);

/** Whether one of git's mixed read/write subcommands is in an explicitly read-only form. */
export function gitListFormRead(sub, rest) {
  const list = rest.map(String);
  if (sub === 'branch') {
    const { options, words } = optionWords(list, BRANCH_VALUES);
    if (options.some((value) => !BRANCH_READ.has(optionName(value)))) return false;
    const valueCount = options.filter((value) => BRANCH_VALUES.has(optionName(value)) && !value.includes('=')).length;
    return options.some((value) => ['--list', '-l'].includes(optionName(value))) || words.length <= valueCount;
  }
  if (sub === 'tag') {
    if (!list.length) return true;
    const { options, words } = optionWords(list, TAG_VALUES);
    const normalized = options.map((value) => /^-n\d*$/.test(value) ? '-n' : optionName(value));
    if (normalized.some((value) => !TAG_READ.has(value))) return false;
    const valueCount = normalized.filter((value, index) => TAG_VALUES.has(value) && !options[index].includes('=')).length;
    if (normalized.includes('-l') || normalized.includes('--list')) return true;
    return normalized.some((value) => TAG_READ.has(value)) && (normalized.includes('-v') || normalized.includes('--verify') ? words.length <= valueCount + 1 : words.length <= valueCount);
  }
  const words = list.filter((value) => !value.startsWith('-'));
  if (sub === 'stash') return ['list', 'show'].includes(words[0]) && !words.slice(1).some((value) => value === 'push');
  if (sub === 'worktree') return words[0] === 'list';
  if (sub === 'remote') {
    const options = list.filter((value) => value.startsWith('-'));
    if (options.some((value) => !['-v', '--verbose', '--all', '--push'].includes(optionName(value)))) return false;
    return !words.length || (words[0] === 'show' && words.length <= 2) || (words[0] === 'get-url' && words.length <= 2);
  }
  if (sub === 'config') return list.some((value) => CONFIG_READ.has(optionName(value)))
    && !list.some((value) => value.startsWith('-') && !CONFIG_READ.has(optionName(value)));
  if (sub === 'reflog') return !words.length || (words[0] === 'show' && words.length <= 2);
  if (sub === 'notes') return ['list', 'show'].includes(words[0]);
  return false;
}

const NODE_VALUE_FLAGS = new Set(['--import', '--require', '-r', '--loader', '--experimental-loader', '--conditions', '-C', '--test-reporter', '--test-reporter-destination', '--test-concurrency', '--test-name-pattern', '--test-skip-pattern', '--test-timeout', '--eval', '-e', '--print', '-p']);
const WHOLE_TREE = [/(?:^|\/)tests\/\*\*/, /^\*\*\/\*\.(?:spec|test)\.m?js$/, /^(?:\.\/)?tests\/?$/];

/** True when a `node --test` call names no file or names the whole tests tree (a glob over tests/**, or the tests directory itself). */
export function nodeWholeSuite(args) {
  const list = args.map(String);
  if (!list.includes('--test')) return false;
  const targets = [];
  for (let i = 0; i < list.length; i += 1) {
    if (NODE_VALUE_FLAGS.has(list[i])) { i += 1; continue; }
    if (!list[i].startsWith('-')) targets.push(list[i].replace(/\\/g, '/'));
  }
  return !targets.length || targets.some((x) => WHOLE_TREE.some((re) => re.test(x)));
}

/* ----------------------------------------------------------------------------------------------------- file writes */

const refusal = (code, command, reason, remedy) => ({ code, command: String(command).slice(0, 200), reason, remedy });

/** The runtime checkout root a path lies in (the nearest ancestor holding the runtime marker), or null. */
export function runtimeRootOf(file, { exists = fs.existsSync } = {}) {
  let dir = path.dirname(path.resolve(file));
  for (let i = 0; i < WALK_LIMIT; i += 1) {
    if (exists(path.join(dir, RUNTIME_MARKER))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}

const insideDir = (file, dir) => { const f = pathKey(file); const d = pathKey(dir); return f === d || f.startsWith(`${d}/`); };

/**
 * The refusal of one file write (an Edit/Write tool call or a shell write target), or null. `edit` is the text the call
 * adds or replaces ({old, new}), read for catalog entries; `declaration` and `zoneOfPath` are injected by the guard (the
 * YAML loads only here, only for a role that can be refused).
 */
export function fileWriteVerdict({ role, filePath, tool = 'Edit', edit = null, guard = null, zone = null, shell = false }) {
  if (role !== 'supervisor' && role !== 'op') return null;
  const file = path.resolve(filePath);
  if (role === 'op') {
    const runtimeRoot = zone?.runtimeRoot ?? runtimeRootOf(file);
    if (!runtimeRoot) return null;
    const own = [guard?.workflowWorktree, ...(guard?.owned ?? [])].filter(Boolean);
    if (own.some((dir) => insideDir(file, dir))) return null;
    return refusal('RIGHTS_OP_RUNTIME_WRITE', file, 'an op works on its app in the workflow worktree and never writes inside the .claude runtime checkout: a defect of the harness is not the op\'s to fix',
      'record a lesson or an upgrade request in your report (kernel report: lessons / upgrade request); the owner path or the supervisor self-upgrade picks it up');
  }
  if (!zone?.runtimeRoot) return null;
  if (zone.zone) {
    return refusal('RIGHTS_PROTECTED_ZONE', zone.rel, `${zone.rel} is in the protected zone (${zone.zone.id}: ${zone.zone.why}): a supervisor self-upgrade does not edit it`,
      'file an owner proposal (what to change in the protected zone and why); only the owner path edits the guard, the release cut, the git hooks, the CI triggers, the test policy, the host lock and the permission settings');
  }
  if (zone.catalog) {
    const named = shell || tool === 'Write' ? ['whole-file write'] : (zone.catalogNames?.(zone.catalog, `${edit?.old ?? ''}\n${edit?.new ?? ''}`) ?? []);
    if (named.length) {
      return refusal('RIGHTS_PROTECTED_ZONE', zone.rel, `${zone.rel} holds catalog entries that enforce the protected zone (${zone.catalog.ids.concat(zone.catalog.codes).slice(0, 6).join(', ')}...): this write ${shell || tool === 'Write' ? 'rewrites the whole file' : `names ${named.join(', ')}`}`,
        'edit other entries with the Edit tool (an edit that names no protected rule id or code passes); a change to a protected entry is an owner proposal');
    }
  }
  return null;
}

const WRITE_LAST = new Set(['cp', 'install', 'copy', 'copy-item', 'cpi']);
const WRITE_ALL = new Set(['mv', 'move', 'move-item', 'mi', 'ren', 'rename', 'rename-item', 'rni', 'rm', 'rmdir', 'rd', 'del', 'erase', 'remove-item', 'ri', 'tee', 'touch', 'truncate', 'set-content', 'sc', 'add-content', 'ac', 'out-file', 'clear-content', 'clc', 'new-item', 'ni', 'mkdir']);
const IN_PLACE = new Set(['sed', 'perl', 'ruby']);

/** The absolute paths one parsed command writes by a known writer program (cp, mv, rm, tee, sed -i, Set-Content, ...). */
export function writeTargetsOf(command) {
  const { program, args, cwd } = command;
  const operands = args.map(String).filter((a) => !a.startsWith('-') && !/^[A-Za-z][A-Za-z0-9]*:$/.test(a));
  let picks = [];
  if (WRITE_LAST.has(program)) picks = operands.slice(-1);
  else if (WRITE_ALL.has(program)) picks = operands;
  else if (IN_PLACE.has(program) && args.some((a) => /^-[a-zA-Z]*i/.test(String(a)))) picks = operands.slice(1);
  else if (program === 'dd') picks = args.map(String).filter((a) => a.startsWith('of=')).map((a) => a.slice(3));
  return picks.filter((p) => p && !/[*?]/.test(p)).map((p) => path.resolve(cwd ?? process.cwd(), p));
}

/** The redirection targets (`> file`, `>> file`, `*> file`) of a raw command text, resolved against `cwd`. */
export function redirectTargetsOf(text, cwd = process.cwd()) {
  const out = [];
  for (const m of String(text ?? '').matchAll(/(?:^|[^<>&0-9])(?:\d|\*)?>{1,2}\s*("[^"\n]+"|'[^'\n]+'|[^\s;&|()<>"']+)/g)) {
    const target = m[1].replace(/^["']|["']$/g, '');
    if (/^(?:&|\/dev\/null$|\$null$|nul$)/i.test(target)) continue;
    out.push(path.resolve(cwd, target));
  }
  return out;
}
