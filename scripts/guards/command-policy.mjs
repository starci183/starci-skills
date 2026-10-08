// command-policy.mjs - the shared R223 command-policy evaluator.
//
// Both enforcement entries call policyVerdict with the object loaded from modules/kernel/command-policy.yaml:
// command-guard.mjs for PreToolUse hosts, and shimDecision for the PATH wrappers installed in every Orca worker terminal.
// A wrapper calls `await shimDecision({ program: 'git', args: process.argv.slice(2) })`; on a verdict it writes
// shimRefusalLines(verdict) to stderr and exits 2, otherwise it execs the real tool. A missing or unreadable policy fails
// open, because the guard never takes the shell away on its own fault.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { slash } from '../lib/path-key.mjs';
import { SKILL_ROOT } from './guards-root.mjs';
import { boundGuard, boundSeat, gitListFormRead, gitSubOf, nodeWholeSuite, pushTargets, refusal as baseRefusal, rightsRoleOf } from './rights.mjs';
import { refusalLines } from './refusals.mjs';
import { RUNTIME_CHANGE_CODE, runtimeChangeRefusal } from '../machine/runtime-change.mjs';
import { kernelMailboxVerdict } from './install-verdict.mjs';
import { orcaSelfLifecycleAllowed } from './orca-self-lifecycle.mjs';

const policyCache = new Map();
const compiledCache = new WeakMap();
const toSet = (value) => new Set(Array.isArray(value) ? value.map(String) : []);
const programName = (value) => path.basename(slash(value)).toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, '');
// These utilities have no state-changing form. Keeping this tiny compiled subset beside the evaluator lets the hook avoid
// filesystem/YAML work for its hottest path; the complete admission table remains command-policy.yaml and is tested through
// policyVerdict. Programs with even one writing option belong to guarded-read and are deliberately absent here.
const INTRINSIC_READ = new Set(['ls', 'dir', 'cat', 'type', 'head', 'tail', 'wc', 'uniq', 'cut', 'tr', 'diff', 'cmp', 'comm', 'rg', 'grep', 'egrep', 'fgrep',
  'pwd', 'which', 'where', 'whoami', 'hostname', 'stat', 'file', 'realpath', 'readlink', 'dirname', 'basename', 'date', 'true', 'false', 'test', '[', 'expr',
  'seq', 'md5sum', 'sha1sum', 'sha256sum', 'shasum', 'cksum', 'od', 'xxd', 'hexdump', 'jq', 'yq', 'column', 'nl', 'rev', 'tac', 'fold', 'fmt', 'join', 'paste']);

/** True only for a program whose every form is intrinsically read-only. */
// A PowerShell drive path like env: lists the whole environment (ls env:, dir env:, cat env:): never the hot path, the ENV_DUMP rule judges it.
export const intrinsicPolicyRead = (command) => INTRINSIC_READ.has(programName(command?.program)) && !(command?.args ?? []).some((a) => /env:/i.test(String(a)));

/** Load and parse the command policy once per runtime root. An unreadable or invalid file is cached as policy null. */
export function loadCommandPolicy({ root = SKILL_ROOT, read = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const key = path.resolve(root);
  if (policyCache.has(key)) return policyCache.get(key);
  let policy = null;
  try {
    const value = parseYaml(String(read(path.join(key, 'modules', 'kernel', 'command-policy.yaml'))));
    if (value && typeof value === 'object' && !Array.isArray(value)) policy = value;
  } catch { /* fail open */ }
  policyCache.set(key, policy);
  return policy;
}

const compile = (policy) => {
  if (!policy || typeof policy !== 'object') return null;
  if (compiledCache.has(policy)) return compiledCache.get(policy);
  let backupRef = null;
  try { backupRef = new RegExp(String(policy.roles?.['backup-ref'] ?? '')); } catch { /* invalid policy fails closed nowhere */ }
  const value = {
    bound: toSet(policy.roles?.bound), nodeTest: toSet(policy.roles?.['node-test']), suiteOps: toSet(policy.roles?.['suite-ops']),
    backupRoles: toSet(policy.roles?.['backup-roles']), backupRef,
    runtime: toSet(policy.runtime), nodeScripts: Array.isArray(policy['node-scripts']) ? policy['node-scripts'].map(slash) : [],
    read: toSet(policy.read), scopedWrite: toSet(policy['scoped-write']), npmPrograms: toSet(policy.npm?.programs), npmRead: toSet(policy.npm?.read),
    gitRead: toSet(policy.git?.read), gitListForms: toSet(policy.git?.['list-forms']), orcaRead: toSet(policy.orca?.read), orcaGroups: toSet(policy.orca?.['groups-read']),
  };
  compiledCache.set(policy, value);
  return value;
};

const refusal = (code, command, reason, use) => baseRefusal(code, command, reason, use, use);
const textOf = ({ program, args, word }) => [word ?? program, ...args].map(String).join(' ').trim();
const useOf = (entry, fallback) => typeof entry?.use === 'string' && entry.use ? entry.use : fallback;
const RIGHTS_CODES = new Set(['RIGHTS_ROLE_DENIED', 'RIGHTS_GIT_PUSH', 'RIGHTS_GIT_TAG', 'RIGHTS_GIT_COMMIT', 'RIGHTS_GIT_SYNC', 'RIGHTS_NPM_PUBLISH', 'RIGHTS_NPM_CI_UNLOCKED',
  'RIGHTS_SUITE_RUN', 'RIGHTS_RELEASE_CUT', 'RIGHTS_RAW_TOOL']);
/** The code a table entry names, when it is one of the R223 codes (a typo in the table never invents a code). */
const codeOf = (entry, fallback) => (RIGHTS_CODES.has(entry?.code) ? entry.code : fallback);
const genericUse = 'use the starci verb of the action (modules/cli/commands) or ask the owner';
const raw = (role, text, use = genericUse, what = 'raw tool command') => refusal('RIGHTS_RAW_TOOL', text, `the ${role} role does not run this ${what} directly because side effects go through a starci verb`, use);

/** A headless-call verb (policy.calls) or a capability verb (policy.renders) refuses every bound role but the ops the table names. */
const callVerdict = ({ role, program, args, guard, policy, text }) => {
  if (program !== 'starci') return null;
  const words = args.filter((value) => !value.startsWith('-'));
  const call = [...Object.values(policy.calls ?? {}), ...Object.values(policy.renders ?? {})].find((entry) => words[0] === entry.verb?.[0] && words[1] === entry.verb?.[1]);
  if (!call || (role === 'op' && toSet(call.ops).has(String(guard?.op ?? '')))) return null;
  return refusal('RIGHTS_ROLE_DENIED', text, `${guard?.op ?? role} does not run starci ${call.verb.join(' ')}: only ${[...toSet(call.ops)].join(', ')} call it`, useOf(call, genericUse));
};

const RELEASE_SCRIPTS = new Set(['release:cut', 'release:publish']);
const releaseCall = (program, args, policy) => {
  if (program === 'starci' && args[0] === 'release' && toSet(policy.release?.verbs).has(String(args[1] ?? ''))) return true;
  if (program === 'node' && args.some((value) => /(?:^|[\\/])release-(?:cut|publish)\.mjs$/i.test(String(value)))) return true;
  return toSet(policy.npm?.programs).has(program) && args.some((value, index) => RELEASE_SCRIPTS.has(String(value)) && ['run', 'run-script'].includes(String(args[index - 1] ?? '')));
};

const PM_VALUE_FLAGS = new Set(['--prefix', '--cwd', '-C', '--dir', '--workspace', '-w', '--registry', '--tag', '--filter']);
const packageWords = (args) => {
  const words = [];
  for (let i = 0; i < args.length; i += 1) {
    const value = String(args[i]);
    if (value === '--') break;
    if (value.startsWith('-')) {
      const name = value.split('=', 1)[0];
      if (!value.includes('=') && PM_VALUE_FLAGS.has(name)) i += 1;
      continue;
    }
    words.push(value);
  }
  return words;
};
const afterDashDash = (args) => { const at = args.indexOf('--'); return at < 0 ? [] : args.slice(at + 1).map(String).filter((value) => !value.startsWith('-')); };
const cleanInstall = (word) => ['ci', 'clean-install', 'install-clean', 'cit', 'install-ci-test'].includes(word);
const suiteScript = (words) => ['test', 't'].includes(words[0]) || (['run', 'run-script'].includes(words[0]) && words[1] === 'test');
const publishScript = (words) => ['run', 'run-script'].includes(words[0]) && /^(?:release:)?publish.*$/.test(words[1] ?? '');

const nodeValueFlags = new Set(['--import', '--require', '-r', '--loader', '--experimental-loader', '--conditions', '-C', '--test-reporter', '--test-reporter-destination', '--test-concurrency', '--test-name-pattern', '--test-skip-pattern', '--test-timeout']);
const nodeOperands = (args) => {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    const value = String(args[i]);
    if (nodeValueFlags.has(value)) { i += 1; continue; }
    if (!value.startsWith('-')) out.push(value);
  }
  return out;
};
const nodeEntry = (args, entries) => {
  const script = nodeOperands(args)[0];
  if (!script) return false;
  const normalized = slash(script);
  return entries.some((entry) => normalized === entry || normalized.endsWith(`/${entry}`));
};
const hasOption = (args, ...names) => args.some((value) => names.some((name) => value === name || (name.startsWith('--') && String(value).startsWith(`${name}=`)) || (name.length === 2 && name.startsWith('-') && String(value).startsWith(name))));

const nestedProgram = (program, args) => {
  if (!['npx', 'bunx', 'corepack'].includes(program)) return null;
  const list = args.map(String);
  let i = 0;
  while (i < list.length && list[i].startsWith('-')) {
    if (['-p', '--package'].includes(list[i].split('=', 1)[0]) && !list[i].includes('=')) i += 1;
    i += 1;
  }
  return list[i] ? { program: programName(list[i]), args: list.slice(i + 1), word: list[i] } : null;
};

const forbiddenOption = (args, options) => args.some((value) => options.some((option) => {
  const arg = String(value), flag = String(option);
  if (!flag.startsWith('-')) return arg === flag;
  if (flag.startsWith('--')) return arg === flag || arg.startsWith(`${flag}=`);
  return arg === flag || (flag.length === 2 && arg.startsWith(flag));
}));

const gitPolicyVerdict = ({ role, args, p, policy, text }) => {
  const { sub, rest } = gitSubOf(args);
  if (!sub || p.gitRead.has(sub)) return null;
  if (p.gitListForms.has(sub) && gitListFormRead(sub, rest)) return null;
  if (sub === 'push') {
    const targets = pushTargets(rest), mayBackup = p.backupRoles.has(role);
    if (mayBackup && p.backupRef && !targets.broad && targets.refs.length && targets.refs.every((ref) => p.backupRef.test(ref))) return null;
  }
  const denied = policy.git?.deny?.[sub];
  const fallbackUse = useOf(policy.git?.deny?.merge, 'starci git sync');
  const use = useOf(denied, fallbackUse);
  const code = codeOf(denied, 'RIGHTS_GIT_SYNC');
  return refusal(code, text, `the ${role} role does not run git ${sub} directly because git writes and synchronization go through the starci git verbs`, use);
};

const npmReadAllowed = (args, words, verb, p) => p.npmRead.has(verb)
  || (verb === 'config' && p.npmRead.has(`config ${words[1] ?? ''}`))
  || (verb === 'pack' && args.includes('--dry-run'));

const npmPublishVerdict = (role, text, policy) => {
  const denied = policy.npm?.deny?.publish, use = useOf(denied, 'starci release cut');
  return refusal(codeOf(denied, 'RIGHTS_NPM_PUBLISH'), text, `the ${role} role does not publish a package because packages are published once per release from the release commit`, use);
};

const npmSuiteVerdict = ({ role, args, p, policy, guard, text, words, verb }) => {
  if (!suiteScript(words) || afterDashDash(args).length) return undefined;
  if (p.suiteOps.has(String(guard?.op ?? ''))) return null;
  const use = useOf(policy.npm?.deny?.[verb === 'run' || verb === 'run-script' ? verb : 'test'], 'starci gate unit --root <app>');
  return refusal('RIGHTS_SUITE_RUN', text, `the ${role} role does not run a whole suite because full suites run only in the release cut or the requested verify ops`, use);
};

const npmCleanInstallVerdict = ({ args, policy, handle, lockOwner, text, verb }) => {
  if (!cleanInstall(verb)) return undefined;
  if (args.includes('--dry-run')) return null;
  let owner = null;
  try { owner = lockOwner(); } catch { /* an unreadable lock proves no ownership */ }
  const owns = (held) => !held.stale && (held.role === 'release' || (handle && held.handle === handle));
  if (owner && owns(owner)) return null;
  const denied = policy.npm?.deny?.ci, use = useOf(denied, 'the runtime installs dependencies under the host lock');
  return refusal(codeOf(denied, 'RIGHTS_NPM_CI_UNLOCKED'), text, 'this clean install rewrites node_modules without the caller holding the host lock', use);
};

const npmPolicyVerdict = ({ role, args, p, policy, guard, handle, lockOwner, text }) => {
  const words = packageWords(args), verb = words[0] ?? '';
  if (args.length === 1 && ['-v', '--version'].includes(args[0])) return null;
  if (npmReadAllowed(args, words, verb, p)) return null;
  if (publishScript(words)) return npmPublishVerdict(role, text, policy);
  const suite = npmSuiteVerdict({ role, args, p, policy, guard, text, words, verb });
  if (suite !== undefined) return suite;
  const install = npmCleanInstallVerdict({ args, policy, handle, lockOwner, text, verb });
  if (install !== undefined) return install;
  if (suiteScript(words) && afterDashDash(args).length) return null;
  const denied = policy.npm?.deny?.[verb] ?? policy.npm?.deny?.run;
  const use = useOf(denied, 'starci gate run --root <app>');
  return refusal(codeOf(denied, 'RIGHTS_RAW_TOOL'), text, `the ${role} role does not run this package-manager action directly because scripts and dependency changes go through a starci verb`, use);
};

const SERVES_APP = /(?:^|[\\/])next(?:\.js)?$/;

const nodePolicyVerdict = ({ role, args, p, policy, guard, text }) => {
  if (hasOption(args, '--eval', '-e', '--print', '-p')) return raw(role, text, 'use the starci verb of the action or check a file with node --check', 'inline Node.js program');
  if (args.length === 1 && ['--version', '-v'].includes(args[0])) return null;
  if (hasOption(args, '--check', '-c')) return null;
  if (args.includes('--test')) {
    if (nodeWholeSuite(args)) {
      if (p.suiteOps.has(String(guard?.op ?? ''))) return null;
      return refusal('RIGHTS_SUITE_RUN', text, `the ${role} role does not run a whole suite because full suites run only in the release cut or the requested verify ops`, 'run one explicit spec file or use the matching starci verify verb');
    }
    const targets = nodeOperands(args).filter((value) => value !== 'test');
    if (p.nodeTest.has(role) && targets.length && targets.every((value) => /\.(?:spec|test)\.[cm]?js$/i.test(value))) return null;
    return raw(role, text, 'starci gate unit --root <app> (the op gate selects the specs of the change)', 'raw test runner');
  }
  if (nodeOperands(args).some((value) => SERVES_APP.test(slash(value)))) return raw(role, text, useOf(policy['raw-tools']?.next, genericUse), 'app server start');
  return raw(role, text, genericUse, 'Node.js script');
};

const orcaPolicyVerdict = ({ role, args, p, policy, guard, handle, text }) => {
  const [group, verb] = args;
  const mailbox = kernelMailboxVerdict('orca', args, guard);
  if (mailbox) return mailbox;
  if (orcaSelfLifecycleAllowed({ role, args, handle, policy })) return null;
  // Implicit current-terminal checks retain their existing read admission; an explicit target must prove self.
  const targetedCheck = group === 'orchestration' && verb === 'check' && hasOption(args.slice(2), '--terminal');
  if (!targetedCheck && p.orcaGroups.has(group) && p.orcaRead.has(verb)) return null;
  return raw(role, text, useOf(policy.orca, genericUse), 'Orca mutation');
};

const specificCommandVerdict = (context) => {
  const { role, program, args, p, policy, guard, handle, lockOwner, text } = context;
  if (program === 'git') return gitPolicyVerdict({ role, args, p, policy, text });
  if (p.npmPrograms.has(program)) return npmPolicyVerdict({ role, args, p, policy, guard, handle, lockOwner, text });
  if (program === 'node') return nodePolicyVerdict({ role, args, p, policy, guard, text });
  if (program === 'orca') return orcaPolicyVerdict({ role, args, p, policy, guard, handle, text });
  return undefined;
};

const generalCommandVerdict = ({ role, program, args, p, policy, text }) => {
  const rawTool = policy['raw-tools']?.[program];
  if (rawTool) return raw(role, text, useOf(rawTool, genericUse));
  const guarded = policy['guarded-read']?.[program];
  if (Array.isArray(guarded)) {
    const use = `use the read-only form of ${program}`;
    if (forbiddenOption(args, guarded)) return raw(role, text, use, `${program} write form`);
    const required = policy['require-flag']?.[program];
    if (Array.isArray(required) && !required.some((flag) => args.includes(String(flag)))) return raw(role, text, use, `${program} emitting form`);
    return null;
  }
  if (p.read.has(program) || p.scopedWrite.has(program)) return null;
  return raw(role, text);
};

/**
 * Decide one normalized command for a bound role. Returns null to pass or the shared refusal shape.
 * `lockOwner` is a synchronous reader and is called only for a clean install.
 */
export function policyVerdict({ role, command, guard = null, handle = null, lockOwner = () => null, policy }) {
  const p = compile(policy);
  if (!p || !role || role === 'release' || !p.bound.has(role)) return null;
  let { program, args = [] } = command;
  program = programName(program);
  args = args.map(String);
  const nested = nestedProgram(program, args);
  if (nested) return policyVerdict({ role, command: { ...nested, cwd: command.cwd }, guard, handle, lockOwner, policy });
  const text = textOf({ ...command, program, args });

  if (releaseCall(program, args, policy)) {
    const use = useOf(policy.release, 'starci release cut');
    return refusal('RIGHTS_RELEASE_CUT', text, `the ${role} role does not cut or publish a release because the release cut is owner-approved and runs once per release`, use);
  }
  const owned = role === 'supervisor' && program === 'starci' ? runtimeChangeRefusal(args.filter((value) => !value.startsWith('-'))) : null;
  if (owned) return refusal(RUNTIME_CHANGE_CODE, text, owned.reason, owned.remedy);
  const call = callVerdict({ role, program, args, guard, policy, text });
  if (call) return call;
  if (p.runtime.has(program)) return null;
  if (program === 'node' && nodeEntry(args, p.nodeScripts)) return null;

  const specific = specificCommandVerdict({ role, program, args, p, policy, guard, handle, lockOwner, text });
  if (specific !== undefined) return specific;
  return generalCommandVerdict({ role, program, args, p, policy, text });
}

const needsLock = (program, args, env) => {
  if (String(env?.STARCI_ROLE ?? '').toLowerCase() === 'release') return true;
  const nested = nestedProgram(program, args);
  if (nested) return needsLock(nested.program, nested.args, env);
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(program) && cleanInstall(packageWords(args)[0] ?? '');
};

/** Decide one direct PATH-shim invocation without importing the PreToolUse parser or guard. */
export async function shimDecision({ program, args = [], cwd = process.cwd(), env = process.env, root = SKILL_ROOT } = {}) {
  const normalized = programName(program), argv = args.map(String), handle = env?.ORCA_TERMINAL_HANDLE ?? null;
  let lockOwner = () => null;
  if (needsLock(normalized, argv, env)) {
    try {
      const lock = await import('../machine/host-lock.mjs');
      lockOwner = () => { try { return lock.hostLockOwner({ env }); } catch { return null; } };
    } catch { /* a missing lock reader proves neither release nor install ownership */ }
  }
  const guard = boundGuard(handle, { root, env });
  const seat = boundSeat(handle, { root, env });
  const role = rightsRoleOf({ guard, seat, env, lockOwner: String(env?.STARCI_ROLE ?? '').toLowerCase() === 'release' ? lockOwner() : null });
  const policy = role && role !== 'release' ? loadCommandPolicy({ root }) : null;
  const verdict = policyVerdict({ role, command: { program: normalized, args: argv, cwd, word: normalized }, guard, handle, lockOwner, policy });
  return { role, verdict };
}

/** Format a shim refusal exactly like the PreToolUse hook. */
export function shimRefusalLines(verdict) {
  const command = String(verdict?.command ?? '').trim();
  const at = command.indexOf(' ');
  const tool = at < 0 ? command || 'shell' : command.slice(0, at);
  const tail = at < 0 ? '' : command.slice(at + 1);
  return refusalLines(tool, { ...verdict, command: tail });
}
