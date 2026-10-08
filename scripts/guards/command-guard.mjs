#!/usr/bin/env node
// command-guard.mjs — the op guard as a PreToolUse hook: the shell command an op or [Worker] agent is about to run is
// checked before it runs, and a refused one never starts (exit 2, the reason on stderr - the block every host speaks:
// Claude Code, Codex and Devin).
//
// Every agent launches through Orca worker-start, which owns the agent's environment, so a guard can no longer ride
// on the agent's PATH. The launch binds the op's guard to its Orca terminal instead (scripts/guards/hook-install.mjs
// bindGuardTerminal -> <guards root>/terminals/<handle>.json) and launch trust registers this hook in the launch
// worktree's PROJECT settings (scripts/agent/trust.mjs projectTargets: .claude/settings.local.json,
// .devin/config.local.json) and, for Codex, in the config.toml of the managed Codex home (Codex lists no hook of a
// linked worktree's project layer), never a user-global settings file of the owner's own tools. The Kernel's launch binds a guard
// of role 'kernel' the same way (scripts/kernel/start-workflow.mjs, contract change kernel-guard-file): its raw shell
// commands meet every rule below, and its `node cli.mjs <verb>` calls pass. A session with no Orca terminal, or whose
// terminal has no guard bound (the [Supervisor], a lane, the owner's own sessions), meets ONE rule only, wherever this
// hook is registered: an install through a linked node_modules (below), which no caller ever means to run.
//
// What it refuses, each from a real incident:
//  - git: the shared-checkout policy (git-policy.mjs classifyGit - history rewrites, sweeping discards, foreign
//    pathspecs, worktrees, hook bypasses); an App Router pathspec whose glob reading reaches another path.
//  - installs: an install-family command of npm, pnpm or yarn (ci, install/i, add, uninstall, prune, ...; yarn alone)
//    whose package root (cwd, --prefix, -C/--dir, --cwd) has a node_modules - its own, one it sits inside, or its
//    workspace root's - that is a junction or symlink: it empties the live tree the link points to (deps-guard.mjs
//    linkedNodeModulesOf; DEPS_THROUGH_LINK, contract change install-through-link; the third wipe, 2026-10-01, emptied
//    main's packages/grammar/node_modules). Guard file or not. With a guard, also an npm clean install while another
//    workflow's job is leased on the ledger (peerLeasedJobs).
//  - the Kernel's mailbox: `orca orchestration check` from a guard of role kernel (KERNEL_ORCA_CHECK): its --ack
//    consumes deliveries before the ledger records them; the Kernel reads through `starci kernel messages` / `starci kernel questions`
//    and the runtime drains. Ops and [Worker]s keep it: Orca's worker protocol (modules/host/orca/api.yaml
//    operationAgent) has them check their own Run's deliveries, which no ledger record depends on.
//  - the environment: a command that writes the whole environment to output (env, printenv, bare set, export -p, declare -x,
//    Get-ChildItem env:, [Environment]::GetEnvironmentVariables(), node -p process.env, python -c print(os.environ)), even
//    filtered by grep or redacted by sed (ENV_DUMP, scripts/guards/env-dump-verdict.mjs); one named variable is read freely.
//  - links: `ln`, `mklink`, New-Item -ItemType Junction|SymbolicLink|HardLink and [IO.Directory]::Create*Link - an
//    op never creates a link.
//  - processes: a kill by image name or pattern (taskkill /IM or /FI, pkill, killall, Stop-Process -Name, wmic process
//    where name=...), which also ends Orca and every other agent's processes of that name (a lane's taskkill of node.exe
//    restarted Orca, 2026-10-01); a kill whose targets come from a process query (Get-CimInstance Win32_Process,
//    Get-Process, ps | grep, pgrep, then Stop-Process, kill, .Terminate()); an agent ends only the PIDs it started
//    (scripts/guards/process-kill-verdict.mjs).
//  - deletes: a recursive delete (rm -r, rmdir|rd /s, del /s, robocopy /MIR|/PURGE, Remove-Item -Recurse and its
//    aliases), which follows a junction into the live tree; trees go through safeRemove.
//  - workflow history: inside the workflow worktree its guard names (guard.workflowWorktree, contract change
//    workflow-worktree), a git command that changes history or a ref, or discards tracked work (commit, merge, rebase,
//    push, pull, cherry-pick, revert, am, reset to a revision or with a mode, checkout of a branch or a path, switch,
//    restore of the working tree, stash, tag/branch writes, update-ref, filter-branch, replace, reflog expire|delete,
//    notes writes) - ops never commit: the runtime checkpoints a green op at settle (WORKFLOW_HISTORY_CHANGE). Reads
//    (status, diff, log, show, ...) pass, and nothing changes outside that worktree.
//  - launches: `orca terminal create` and a headless agent CLI (codex exec, claude|cursor-agent|devin -p/--print,
//    gemini -p, opencode run) - an agent Orca does not supervise; every agent starts through orca orchestration
//    worker-start. A heredoc body, an echo or a commit message that only mentions a command runs nothing and passes.
//  - role rights (rights.mjs, rules R223 RIGHTS_ROLE_DENIED and R224 RIGHTS_PROTECTED_ZONE): by the caller's role - the job guard,
//    the seat guard or STARCI_ROLE, never a claim in the command - a push, a tag, a publish, an op's commit, a whole-suite
//    run, a clean install without the host lock and a release cut are refused, and a supervisor self-upgrade never writes the
//    protected zone (modules/kernel/protected-zone.yaml) nor an op the .claude runtime checkout: Edit, Write, MultiEdit and
//    NotebookEdit calls are read next to the shell text.
// Before an allowed git command, a stale shared .git/index.lock is recovered (scripts/machine/lock-recovery.mjs preflightIndexLock).
// Fail-open on the guard's OWN faults: a bug here must never take the shell away from a worker.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathKey } from '../lib/path-key.mjs';
import { launchVerdict } from './launch-verdict.mjs';
import { envDumpVerdict } from './env-dump-verdict.mjs';
import { nameKillVerdict, queryKillVerdict } from './process-kill-verdict.mjs';
import { installLinkVerdict, installVerdict, kernelMailboxVerdict } from './install-verdict.mjs';
import { isMain } from '../lib/is-main.mjs';
import { readEnv } from '../lib/env.mjs';
import { readInput } from './hook-io.mjs';
import { boundGuard, boundSeat, fileWriteVerdict, gitSubOf, redirectTargetsOf, rightsRoleOf, runtimeRootOf, writeTargetsOf } from './rights.mjs';
import { intrinsicPolicyRead, loadCommandPolicy, policyVerdict } from './command-policy.mjs';
import { commandsOf, programOf } from './shell-commands.mjs';
import { tempPath } from '../api/fs/temp-path.mjs';
import { findInOrder } from '../lib/in-order.mjs';
import { criticReadVerdict, criticWriteVerdict } from './critic-reach.mjs';
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export { boundGuard } from './rights.mjs';

export { commandsOf, programOf, simpleCommands } from './shell-commands.mjs';

/* ---------------------------------------------------------------- verdicts */

const LINK_ITEM_TYPE = /^(?:junction|symboliclink|hardlink)$/i;
const LINK_API = /::\s*create(?:symbolic|hard)link\b/i;
const linkVerdict = (program, args, word) => {
  const refused = program === 'ln' || program === 'mklink'
    || ((program === 'new-item' || program === 'ni') && args.some((a, i) => (/^-(?:itemtype|type|it)$/i.test(args[i - 1] ?? '') && LINK_ITEM_TYPE.test(a)) || /^-(?:itemtype|type|it):(?:junction|symboliclink|hardlink)$/i.test(a)))
    || LINK_API.test(word) || args.some((a) => LINK_API.test(a));
  if (!refused) return null;
  return { code: 'LINK_CREATE', command: [word, ...args].join(' ').slice(0, 200),
    reason: 'an op worker never creates a junction, symlink or hard link - a link from a scratch tree into a live repository is followed by a recursive delete (git worktree remove, rm -rf, Remove-Item) and empties the live repository',
    remedy: 'work in your dispatched checkout with its own node_modules; a need for another tree or a linked dependency is reported (report blocked environment), never made' };
};

// A recursive delete follows a junction or symlink inside the tree and empties the live tree it points at (a Git for
// Windows worktree removal deleted 674 live files through node_modules junctions; a later incident emptied main's
// node_modules the same way). The runtime's safeRemove removes every link as a
// link first. One junction is removed on its own with `cmd /c rmdir <path>` (no /s), which removes the link only.
const REMOVE_ITEM = new Set(['remove-item', 'ri', 'rm', 'del', 'erase', 'rd', 'rmdir']);
// PowerShell accepts any unambiguous prefix of -Recurse (then an optional :value other than false).
const POWERSHELL_RECURSE = /^-(?:r|re|rec|recu|recur|recurs|recurse)(?::(?!\$?false$).*)?$/i;
const cmdSwitches = (arg) => (/^\/\/?[a-z](?:\/[a-z])*$/i.test(arg) ? arg.toLowerCase().split('/').filter(Boolean) : []);
const hasCmdSwitch = (args, letter) => args.some((a) => cmdSwitches(a).includes(letter));
// The recursive-delete form of one program, or null: `${program} -Recurse`, 'rm -r', 'cmd /s' or the robocopy flag.
const powershellRecursiveHow = (program, options) => options.some((a) => POWERSHELL_RECURSE.test(a) || /^-(?:rf|fr)$/i.test(a)) ? `${program} -Recurse` : null;
const recursiveHowForProgram = (program, options) => {
  if (program === 'remove-item' || program === 'ri')
    return options.some((a) => POWERSHELL_RECURSE.test(a)) ? `${program} -Recurse` : null;
  if (program === 'rm')
    return options.some((a) => a === '--recursive' || (/^-[A-Za-z]+$/.test(a) && /r/i.test(a))) ? 'rm -r' : null;
  if (['rmdir', 'rd', 'del', 'erase'].includes(program))
    return hasCmdSwitch(options, 's') ? `${program} /s` : null;
  if (program === 'robocopy') {
    const flag = options.find((a) => /^(?:\/\/?|-)(?:mir|purge)$/i.test(a));
    return flag ? `robocopy ${flag.replace(/^\/\/|^-/, '/').toUpperCase()}` : null;
  }
  return null;
};
const recursiveHow = (program, options, dialect) => dialect === 'powershell' && REMOVE_ITEM.has(program)
  ? powershellRecursiveHow(program, options) : recursiveHowForProgram(program, options);
const recursiveDeleteVerdict = (program, args, dialect) => {
  const options = args.includes('--') ? args.slice(0, args.indexOf('--')) : args;
  const how = recursiveHow(program, options, dialect);
  if (!how) return null;
  return { code: 'RECURSIVE_DELETE', command: [program, ...args].join(' ').slice(0, 200),
    reason: `${how} deletes a tree recursively and follows every junction or symlink inside it into the live tree it points at (a worktree removal through node_modules junctions deleted 674 live files)`,
    remedy: 'remove a tree only through the runtime\'s safeRemove (scripts/api/fs/safe-remove.mjs), which removes every link as a link first; remove one junction with `cmd /c rmdir <path>` (no /s); a single file with `rm <file>`' };
};

// Ops never commit (contract change workflow-worktree): inside a workflow worktree the runtime is the only writer of
// history - checkpointOp commits a green op at settle, preserveAndReset keeps a failed op's work and resets it. The
// guard bound to an op terminal names that worktree (guard.workflowWorktree); a git command whose directory (cwd, then
// every -C) lies inside it may read, never change history or a ref, and never discard tracked work.
const WORKFLOW_HISTORY_VERBS = new Set(['commit', 'merge', 'rebase', 'push', 'pull', 'cherry-pick', 'revert', 'am', 'update-ref', 'switch', 'filter-branch', 'replace']);
const RESET_MODES = new Set(['--hard', '--soft', '--mixed', '--merge', '--keep']);
const BRANCH_WRITE_FLAGS = new Set(['-d', '-D', '-m', '-M', '-c', '-C', '-f', '-u', '--delete', '--move', '--copy', '--force', '--unset-upstream', '--edit-description', '--no-track']);
const branchWriteValue = (option, name) => option === name || (option.startsWith(`${name}=`)
  && !/[\n\r\u2028\u2029]/.test(option.slice(name.length + 1)));
const isBranchWrite = option => BRANCH_WRITE_FLAGS.has(option) || branchWriteValue(option, '--set-upstream-to') || branchWriteValue(option, '--track');
const BRANCH_READ_WORDS = new Set(['--list', '--all', '--remotes', '--show-current', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format', '--color', '--no-color', '--column', '--no-column', '-vv', '--verbose']);
const BRANCH_READ_VALUES = /^--(?:sort|format|color|column)=/;
const branchRead = (o) => BRANCH_READ_WORDS.has(o) || BRANCH_READ_VALUES.test(o) || /^-[avrl]+$/.test(o);
const insideDir = (dir, root) => { const d = pathKey(dir); const r = pathKey(root); return d === r || d.startsWith(`${r}/`); };

// Why each history-adjacent sub changes history, a ref or tracked work, or null when it only reads.
const SUB_CHANGE = {
  reset: (options, words) => (options.some((o) => RESET_MODES.has(o)) || words.length ? 'git reset to a revision or with a mode moves HEAD or discards tracked work' : null),
  checkout: (options, words, before, dd) => (before.length || dd !== -1 ? 'git checkout switches the branch or discards tracked work' : null),
  restore: (options) => (options.some((o) => o === '--worktree' || o === '-W') || !options.some((o) => o === '--staged' || o === '-S') ? 'git restore discards tracked work in the working tree' : null),
  stash: (options, words) => (['list', 'show'].includes(words[0]) ? null : 'git stash takes tracked work out of the tree'),
  tag: (options, words) => {
    if (words.length && !options.some((o) => o === '-l' || o === '--list')) return 'git tag writes a ref';
    return options.some((o) => o === '-d' || o === '--delete' || o === '-f' || o === '--force') ? 'git tag writes a ref' : null;
  },
  branch: (options, words) => {
    if (options.some(isBranchWrite)) return 'git branch writes a ref';
    return words.length && !options.some((o) => branchRead(o)) ? 'git branch creates a ref' : null;
  },
  reflog: (options, words) => (['expire', 'delete'].includes(words[0]) ? `git reflog ${words[0]} rewrites ref history` : null),
  notes: (options, words) => (!words[0] || ['list', 'show'].includes(words[0]) ? null : 'git notes writes a ref'),
};

/** Why `git <sub> <rest>` changes history, a ref or tracked work, or null when it only reads. */
export function workflowHistoryChange(sub, rest) {
  const dd = rest.indexOf('--');
  const before = dd === -1 ? rest : rest.slice(0, dd);
  const options = before.filter((a) => a.startsWith('-'));
  const words = before.filter((a) => !a.startsWith('-'));
  if (WORKFLOW_HISTORY_VERBS.has(sub)) return `git ${sub} writes history or a ref`;
  return SUB_CHANGE[sub]?.(options, words, before, dd) ?? null;
}

/** The WORKFLOW_HISTORY_CHANGE refusal for one git call inside the guard's workflow worktree, or null. */
function workflowHistoryVerdict({ args, cwd, guard, parseGitArgv }) {
  if (!guard?.workflowWorktree) return null;
  const parsed = parseGitArgv(args, cwd);
  if (!parsed.sub || !insideDir(parsed.cwd, guard.workflowWorktree)) return null;
  const why = workflowHistoryChange(parsed.sub, parsed.rest);
  if (!why) return null;
  return { tool: 'git', code: 'WORKFLOW_HISTORY_CHANGE', command: args.join(' ').slice(0, 200),
    reason: `${why}, inside the workflow worktree ${pathKey(guard.workflowWorktree)}: ops never commit, move a ref or discard tracked work there`,
    remedy: 'leave your changes in the working tree and report: the runtime checkpoints your work at settle (a failed op\'s work is preserved and reset by the runtime)' };
}

// git reads an App Router segment ([locale], [...slug]) in a pathspec as a character class. The policy scopes it as the
// literal path admission granted, so the command is refused only when git's glob reading reaches a path the literal
// reading does not (a sibling like src/app/l/ another workflow owns): the files each reading
// names are compared with git ls-files. The remedy is the same command with :(literal) pathspecs.
function appRouterGlob({ args, cwd, deps }) {
  const { literalAppRouterArgv, parseGitArgv } = deps.policy;
  const listFile = tempPath(`starci-pathspec-${process.pid}-${Date.now()}.nul`);
  try {
    const literal = literalAppRouterArgv(args, { cwd, stdin: null, listFile });
    if (!literal.changed) return null;
    const dir = parseGitArgv(args, cwd).cwd;
    const files = (spec) => {
      const r = deps.git.lsFiles(['-c', '-o', '--exclude-standard', '-z', ...spec], { cwd: dir });
      return r.status === 0 ? new Set(r.stdout.split('\0').filter(Boolean)) : null;
    };
    let globbed, named, remedy;
    if (literal.list == null) {
      const pairs = args.map((a, i) => [a, literal.argv[i]]).filter(([a, l]) => a !== l);
      globbed = files(['--', ...pairs.map((p) => p[0])]);
      named = files(['--', ...pairs.map((p) => p[1])]);
      remedy = `name the paths literally: git ${literal.argv.join(' ')}`;
    } else {
      // ls-files takes no pathspec list: the entries are read here and named after `--`.
      const at = args.findIndex((a) => a === '--pathspec-from-file' || a.startsWith('--pathspec-from-file='));
      const listPath = args[at] === '--pathspec-from-file' ? args[at + 1] : args[at].slice('--pathspec-from-file='.length);
      const entries = deps.policy.parsePathspecList(fs.readFileSync(path.resolve(dir, listPath), 'utf8'), args.includes('--pathspec-file-nul'));
      globbed = files(['--', ...entries]);
      named = files(['--', ...literal.list.split('\0').filter(Boolean)]);
      remedy = 'write each entry of the pathspec list as :(literal)<path>';
    }
    const reached = globbed && named ? [...globbed].filter((f) => !named.has(f)) : [];
    if (!reached.length) return null;
    return { code: 'APP_ROUTER_GLOB',
      reason: `an App Router segment in a pathspec is a glob to git: it would also reach ${reached.slice(0, 5).join(', ')}`,
      remedy };
  } finally { fs.rmSync(listFile, { force: true }); }
}

async function gitVerdict({ args, cwd, env, guard, deps }) {
  const { classifyGit, pathspecListOnStdin } = deps.policy;
  const { revParseQuery, configGet } = deps.git;
  const top = () => { const r = revParseQuery(['--show-toplevel'], { cwd }); return r.status === 0 && r.stdout.trim() ? path.resolve(r.stdout.trim()) : null; };
  const currentConfig = (key) => { const r = configGet(cwd, key); return r.ok ? r.stdout : null; };
  const verdict = classifyGit(args, { cwd, owned: guard?.owned ?? null, top: guard?.owned?.length ? top() : null, env, stdin: null, currentConfig });
  const command = args.join(' ').slice(0, 200);
  if (!verdict.allow) return { tool: 'git', ...verdict, command };
  if (!pathspecListOnStdin(args)) { const glob = appRouterGlob({ args, cwd, deps }); if (glob) return { tool: 'git', ...glob, command }; }
  const dashC = args.indexOf('-C');
  await deps.indexLock.preflightIndexLock({ cwd: dashC >= 0 && args[dashC + 1] ? path.resolve(cwd, args[dashC + 1]) : cwd, guard, env, say: deps.say });
  return null;
}

const loadDeps = async () => {
  const [policy, npm, { lsFiles }, { revParseQuery }, { configGet }, indexLock] = await Promise.all([import('./git-policy.mjs'), import('./deps-guard.mjs'), import('../api/git/ls-files.mjs'), import('../api/git/rev-parse-query.mjs'), import('../api/git/config-get.mjs'), import('../machine/lock-recovery.mjs')]);
  return { policy, npm, git: { lsFiles, revParseQuery, configGet }, indexLock, say: (line) => process.stderr.write(`${line}\n`) };
};

const NEEDS_HOST_LOCK = /\b(?:npm|pnpm|yarn|bun)\b[^\n]*\b(?:ci|clean-install|install-clean|cit|install-ci-test)\b/;

/** A synchronous reader of the host lock owner (loaded only when a command or a release claim needs it), or a null reader. */
async function lockOwnerReader(env) {
  try {
    const lock = await import('../machine/host-lock.mjs');
    return () => { try { return lock.hostLockOwner({ env }); } catch { return null; } };
  } catch { return () => null; }
}

/** {role, handle, lockOwner, policy}: the caller's role and the shared command policy loaded only for a bound role. */
async function rightsContext({ guard = null, seat = null, env = process.env, text = '' } = {}) {
  const claimsRelease = String(env?.STARCI_ROLE ?? '').toLowerCase() === 'release';
  const lockOwner = claimsRelease || NEEDS_HOST_LOCK.test(text) ? await lockOwnerReader(env) : () => null;
  const role = rightsRoleOf({ guard, seat, env, lockOwner: claimsRelease ? lockOwner() : null });
  return { role, handle: env?.ORCA_TERMINAL_HANDLE ?? null, lockOwner, policy: role && role !== 'release' ? loadCommandPolicy({ root: skillRoot }) : null };
}

/** The refusal of one file write for the rights role, or null: the zone declaration loads only for a role that can be refused. */
async function fileRightsVerdict({ role, filePath, tool = 'Edit', edit = null, guard = null, shell = false }) {
  if (role === 'critic') return criticWriteVerdict({ filePath, guard, tool });
  if ((role !== 'supervisor' && role !== 'op') || !runtimeRootOf(filePath)) return null;
  let zone = { runtimeRoot: runtimeRootOf(filePath) };
  if (role === 'supervisor') {
    const pz = await import('./protected-zone.mjs');
    zone = { ...pz.zoneOfPath(filePath), catalogNames: pz.catalogNames };
  }
  return fileWriteVerdict({ role, filePath, tool, edit, guard, zone, shell });
}

/** The rights refusal of one parsed shell call: its commands (policyVerdict) and the files they write (fileRightsVerdict). */
const policyToolVerdict = (command, verdict) => {
  const whole = [command.word ?? command.program, ...command.args].join(' ');
  return { tool: command.program, ...verdict, command: verdict.command === whole ? command.args.join(' ').slice(0, 200) : verdict.command };
};

async function rightsOfCall({ commands, command, cwd, ctx, guard }) {
  if (!ctx.role) return null;
  // The file rights are the more specific refusal (a write into the protected zone, an op writing the runtime checkout): they come before the generic command policy.
  if (ctx.role === 'supervisor' || ctx.role === 'op' || ctx.role === 'critic') {
    // The Critic's writer programs are judged whole by the command policy (their content words are not paths): only its redirections are targets here.
    const targets = [...(ctx.role === 'critic' ? [] : commands.flatMap((c) => writeTargetsOf(c))), ...redirectTargetsOf(command, cwd)];
    let refusal = null;
    await findInOrder(targets, async (filePath) => {
      const v = await fileRightsVerdict({ role: ctx.role, filePath, tool: 'shell', guard, shell: true });
      if (v) refusal = { tool: 'shell', ...v };
      return Boolean(v);
    });
    if (refusal) return refusal;
  }
  for (const c of commands) {
    const v = policyVerdict({ role: ctx.role, command: c, guard, handle: ctx.handle, lockOwner: ctx.lockOwner, policy: ctx.policy });
    if (v) return policyToolVerdict(c, v);
  }
  return null;
}

/**
 * The first refusal for one shell call, or null: {tool, code, command, reason, remedy}. `dialect` is the text's shell
 * (PowerShell for Claude's PowerShell tool; bash otherwise, which also reads plain Windows command lines).
 */
// The synchronous per-command refusals, in rule order: env dump, link create, name kill, recursive delete, launch.
const syncCommandVerdict = (c, guard) => envDumpVerdict(c)
  ?? linkVerdict(c.program, c.args, c.word)
  ?? nameKillVerdict(c.program, c.args)
  ?? recursiveDeleteVerdict(c.program, c.args, c.dialect)
  ?? launchVerdict(c.program, c.args, guard);

// push/tag outside an op's workflow tree have no older git-policy refusal. Return the shared role refusal before
// loading the full git policy/dependency stack; inside the workflow tree, WORKFLOW_HISTORY_CHANGE still wins.
const pushTagRoleVerdict = (c, ctx, guard) => {
  let gitCwd = c.cwd;
  for (let i = 0; i < c.args.length; i += 1) {
    if (c.args[i] === '-C' && c.args[i + 1]) { i += 1; gitCwd = path.resolve(gitCwd, c.args[i]); }
  }
  if (guard?.workflowWorktree && insideDir(gitCwd, guard.workflowWorktree)) return null;
  const byPolicy = policyVerdict({ role: ctx.role, command: c, guard, handle: ctx.handle, lockOwner: ctx.lockOwner, policy: ctx.policy });
  return byPolicy ? policyToolVerdict(c, byPolicy) : null;
};

const gitCommandVerdict = async (command, ctx, guard, fullDeps) => {
  if (command.program !== 'git') return null;
  if (['push', 'tag'].includes(gitSubOf(command.args).sub)) {
    const byPolicy = pushTagRoleVerdict(command, ctx, guard);
    if (byPolicy) return byPolicy;
  }
  const loaded = await fullDeps();
  const history = workflowHistoryVerdict({ args: command.args, cwd: command.cwd, guard, parseGitArgv: loaded.policy.parseGitArgv });
  if (history) return history;
  return gitVerdict({ args: command.args, cwd: command.cwd, env: command.env, guard, deps: loaded });
};

const packageManagerCommandVerdict = async (command, guard, fullDeps) => {
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(command.program)) return null;
  const loaded = await fullDeps();
  if (!loaded.npm.PACKAGE_MANAGERS.includes(command.program)) return null;
  return installVerdict({ program: command.program, args: command.args, cwd: command.cwd, guard, deps: loaded });
};

/** The first refusal of one parsed command, in rule order: the synchronous rules, git, the kernel mailbox, the package managers; falsy when none. */
async function commandRefusal(c, ctx, guard, fullDeps) {
  const sync = syncCommandVerdict(c, guard);
  if (sync) return { tool: c.program, ...sync };
  const gitResult = await gitCommandVerdict(c, ctx, guard, fullDeps);
  if (gitResult) return gitResult;
  const mailbox = kernelMailboxVerdict(c.program, c.args, guard);
  if (mailbox) return { tool: c.program, ...mailbox };
  return packageManagerCommandVerdict(c, guard, fullDeps);
}

export async function commandVerdict({ command, cwd, guard, env = process.env, dialect = 'bash', deps = null, rights = null }) {
  let d = deps;
  const fullDeps = async () => { d ??= await loadDeps(); return d; };
  const commands = commandsOf(command, { cwd, env, dialect });
  if (guard?.role !== 'critic' && commands.length && commands.every(intrinsicPolicyRead) && !redirectTargetsOf(command, cwd).length) return null;
  const ctx = rights ?? await rightsContext({ guard, env, text: command });
  const byQuery = queryKillVerdict(commands, command);
  if (byQuery) return { tool: 'process-query', ...byQuery };
  let refusal = null;
  await findInOrder(commands, async (c) => {
    refusal = await commandRefusal(c, ctx, guard, fullDeps);
    return Boolean(refusal);
  });
  if (refusal) return refusal;
  return rightsOfCall({ commands, command, cwd, ctx, guard });
}

/**
 * The rules that hold with no guard file (a terminal no launch bound, a lane, the owner's own session): an install
 * through a linked node_modules only. Loads nothing but deps-guard.mjs.
 */
async function unguardedVerdict({ command, cwd, env = process.env, dialect = 'bash', npm = null }) {
  const deps = npm ?? await import('./deps-guard.mjs');
  for (const c of commandsOf(command, { cwd, env, dialect })) {
    if (!deps.PACKAGE_MANAGERS.includes(c.program)) continue;
    const v = installLinkVerdict({ program: c.program, args: c.args, cwd: c.cwd, npm: deps });
    if (v) return v;
  }
  return null;
}

/** The shell text of one hook input: Claude's Bash/PowerShell, Codex's Bash and Devin's exec all carry `command`. */
function shellCallOf(input) {
  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || !command.trim()) return null;
  const cwd = input.tool_input.workdir || input.cwd || process.cwd();
  return { command, cwd: path.resolve(cwd), dialect: /^powershell$/i.test(String(input.tool_name ?? '')) ? 'powershell' : 'bash' };
}

// A cheap first look for the unguarded case: only a command naming a package manager can be refused without a guard.
const NAMES_PACKAGE_MANAGER = /\b(?:npm|pnpm|yarn)\b/i;

const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);

/** One file-reading tool call of a hook input: {tool, paths}, or null. A call that names no path reaches its working directory. */
function readCallOf(input) {
  const tool = String(input?.tool_name ?? '');
  if (!READ_TOOLS.has(tool)) return null;
  const given = input.tool_input ?? {};
  const cwd = path.resolve(input.cwd || process.cwd());
  const named = [given.file_path, given.path, given.notebook_path].filter((value) => typeof value === 'string' && value);
  const pattern = typeof given.pattern === 'string' && tool === 'Glob' ? [path.join(path.resolve(cwd, named[0] ?? '.'), given.pattern)] : [];
  return { tool, paths: [...(named.length ? named.map((one) => path.resolve(cwd, one)) : [cwd]), ...pattern] };
}

/** One file-writing tool call of a hook input: {tool, filePath, edit: {old, new}, cwd}, or null. */
function fileCallOf(input) {
  const tool = String(input?.tool_name ?? '');
  if (!FILE_TOOLS.has(tool)) return null;
  const given = input.tool_input ?? {};
  const target = given.file_path ?? given.notebook_path ?? given.path;
  if (typeof target !== 'string' || !target) return null;
  const cwd = path.resolve(input.cwd || process.cwd());
  const edits = Array.isArray(given.edits) ? given.edits : [given];
  const joined = (...keys) => edits.map((e) => keys.map((k) => e?.[k]).find((v) => typeof v === 'string') ?? '').join('\n');
  return { tool, filePath: path.resolve(cwd, target), edit: { old: joined('old_string'), new: joined('new_string', 'new_source', 'content') }, cwd };
}

/** The rights-only refusal of a session with a role but no job guard (the Supervisor seat, a STARCI_ROLE session): its commands and the files they write. */
async function rightsOnlyVerdict({ command, cwd, env, dialect, ctx }) {
  const commands = commandsOf(command, { cwd, env, dialect });
  return rightsOfCall({ commands, command, cwd, ctx, guard: null });
}

const unguardedHookVerdict = async (call, { env, deps, ctx }) => {
  if (NAMES_PACKAGE_MANAGER.test(call.command)) {
    const verdict = await unguardedVerdict({ ...call, env, npm: deps?.npm ?? null });
    if (verdict) return { verdict, guard: null, cwd: call.cwd };
  }
  if (!ctx.role) return null;
  const verdict = await rightsOnlyVerdict({ ...call, env, ctx });
  return verdict ? { verdict, guard: null, cwd: call.cwd } : null;
};

/** The hook's decision for one input: {verdict, guard} to refuse (guard null for an unguarded session), else null. */
export async function hookDecision(input, { env = process.env, root = skillRoot, deps = null, bindings = null } = {}) {
  const handle = env.ORCA_TERMINAL_HANDLE;
  const guard = bindings ? bindings.guard : boundGuard(handle, { root, env });
  let seat = null;
  if (bindings) seat = bindings.seat;
  else if (!guard) seat = boundSeat(handle, { root, env });
  const read = readCallOf(input);
  if (read) {
    const role = rightsRoleOf({ guard, seat, env, lockOwner: null });
    const verdict = role === 'critic' ? criticReadVerdict({ paths: read.paths, guard, tool: read.tool }) : null;
    return verdict ? { verdict: { tool: read.tool, ...verdict }, guard, cwd: path.resolve(input.cwd || process.cwd()) } : null;
  }
  const file = fileCallOf(input);
  if (file) {
    // File rights do not consume the command table. A release claim without its lock resolves to owner here; both are
    // unrestricted for files, so no host-lock or YAML import is needed.
    const role = rightsRoleOf({ guard, seat, env, lockOwner: null });
    const verdict = await fileRightsVerdict({ role, filePath: file.filePath, tool: file.tool, edit: file.edit, guard });
    return verdict ? { verdict: { tool: file.tool, ...verdict }, guard, cwd: file.cwd } : null;
  }
  const call = shellCallOf(input);
  if (!call) return null;
  const ctx = await rightsContext({ guard, seat, env, text: call.command });
  if (!guard) return unguardedHookVerdict(call, { env, deps, ctx });
  const verdict = await commandVerdict({ ...call, guard, env, deps, rights: ctx });
  return verdict ? { verdict, guard, cwd: call.cwd } : null;
}

/** The hook entry, exported so the published CLI can dispatch it in-process without a second Node hop. */
export async function main({ stdin = process.stdin, stderr = process.stderr, env = process.env, root = skillRoot } = {}) {
  try {
    const raw = await readInput(stdin);
    // The common case - no guard, no seat, no claimed role and no package manager named - exits before anything heavier than two file reads.
    const handle = readEnv('ORCA_TERMINAL_HANDLE', env);
    const guard = boundGuard(handle, { root, env });
    const seat = guard ? null : boundSeat(handle, { root, env });
    if (!guard && !seat && !readEnv('STARCI_ROLE', env) && !NAMES_PACKAGE_MANAGER.test(raw)) return 0;
    const input = JSON.parse(raw);
    const direct = input?.tool_input?.command;
    // Intrinsically read-only one-program calls cannot meet an older guard rule or write a shell target. Avoid the full
    // shell/environment parse and YAML load on this latency-critical path; compound/substituted/redirection text stays slow.
    if (guard?.role !== 'critic' && typeof direct === 'string' && direct.trim() && !/[;&|(){}<>\n\r`$]/.test(direct) && !/env:/i.test(direct)) {
      const first = direct.trim().split(/\s+/, 1)[0];
      if (intrinsicPolicyRead({ program: programOf(first) })) return 0;
    }
    const decision = await hookDecision(input, { env, root, bindings: { guard, seat } });
    if (!decision) return 0;
    const { refusalLines, logRefusal } = await import('./refusals.mjs');
    const { tool, ...verdict } = decision.verdict;
    stderr.write(`${refusalLines(tool, verdict).join('\n')}\n`);
    logRefusal({ tool, via: 'pre-tool-use', ...verdict, jobId: decision.guard?.jobId ?? null, workflowId: decision.guard?.workflowId ?? null, cwd: decision.cwd });
    return 2;
  } catch (e) {
    stderr.write(`starci guard: guard error (${e?.message ?? e}); passing the command through\n`);
    return 0;
  }
}

if (isMain(import.meta.url)) process.exitCode = await main();
