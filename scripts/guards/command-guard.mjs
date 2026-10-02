#!/usr/bin/env node
// command-guard.mjs — the op guard as a PreToolUse hook: the shell command an op or [Worker] agent is about to run is
// checked before it runs, and a refused one never starts (exit 2, the reason on stderr - the block every host speaks:
// Claude Code, Codex and Devin).
//
// Every agent launches through Orca worker-start, which owns the agent's environment, so a guard can no longer ride
// on the agent's PATH. The launch binds the op's guard to its Orca terminal instead (scripts/guards/hook-install.mjs
// bindGuardTerminal -> <guards root>/terminals/<handle>.json) and launch trust registers this hook in the launch
// worktree's PROJECT settings only (scripts/agent/trust.mjs projectTargets: .claude/settings.local.json,
// .codex/config.toml, .devin/config.local.json), never a user-global settings file. The Kernel's launch binds a guard
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
//    consumes deliveries before the ledger records them; the Kernel reads through `api messages` / `api questions`
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
// Before an allowed git command, a stale shared .git/index.lock is recovered (scripts/machine/lock-recovery.mjs preflightIndexLock).
// Fail-open on the guard's OWN faults: a bug here must never take the shell away from a worker.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathKey } from '../lib/path-key.mjs';
import { guardsRoot } from './guards-root.mjs';
import { launchVerdict } from './launch-verdict.mjs';
import { envDumpVerdict } from './env-dump-verdict.mjs';
import { nameKillVerdict, queryKillVerdict } from './process-kill-verdict.mjs';
import { installLinkVerdict, installVerdict, kernelMailboxVerdict } from './install-verdict.mjs';
import { isMain } from '../lib/is-main.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');

/** The guard bound to Orca terminal `handle` (<guards root>/terminals/<handle>.json), or null. */
export function boundGuard(handle, { root = skillRoot } = {}) {
  if (!handle) return null;
  try { return JSON.parse(fs.readFileSync(path.join(guardsRoot(root), 'terminals', `${safeName(handle)}.json`), 'utf8')); }
  catch { return null; }
}

/* ------------------------------------------------------------ command text */

const SEPARATORS = new Set([';', '&', '|', '(', ')', '{', '}', '\n']);

/** The index of the ')' closing the '(' just before `from` in `text` (text.length when none does). */
function closingParenIn(text, from) {
  let depth = 1;
  for (let j = from; j < text.length; j += 1) {
    if (text[j] === '(') depth += 1;
    else if (text[j] === ')' && --depth === 0) return j;
  }
  return text.length;
}

/**
 * The simple commands of one command line, in order: [[word, ...], ...]. Quotes group, separators (; & | && || ( ) { }
 * newline) split, redirections and comments drop, and a command substitution $(...) is a command of its own. Bash
 * and PowerShell text are both read: a backslash is a literal (Windows paths), a backtick splits in bash and escapes
 * in PowerShell. $VAR, ${VAR}, $env:VAR and a leading ~ expand from `env`.
 */
export function simpleCommands(text, { dialect = 'bash', env = process.env } = {}) {
  const out = [];
  let words = [];
  let word = null;
  const nested = [];
  const endWord = () => { if (word != null) words.push(word); word = null; };
  const endCommand = () => { endWord(); if (words.length) out.push(words); words = []; };
  const expand = (name) => env?.[name] ?? env?.[Object.keys(env ?? {}).find((k) => k.toLowerCase() === name.toLowerCase())] ?? '';
  const s = String(text ?? '');
  const closingParen = (from) => closingParenIn(s, from);
  const heredocs = [];
  // $NAME, ${NAME}, $env:NAME at s[i] ('$'); returns [value, next index] or null for a lone '$'.
  const variable = (i) => {
    const m = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|env:([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))/i.exec(s.slice(i));
    if (!m) return null;
    // PowerShell's $true, $false and $null are literals, never environment variables.
    if (dialect === 'powershell' && m[3] && /^(?:true|false|null)$/i.test(m[3])) return [m[0], i + m[0].length];
    return [expand(m[1] ?? m[2] ?? m[3]), i + m[0].length];
  };
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '$' && s[i + 1] === '(') {
      const end = closingParen(i + 2);
      nested.push(s.slice(i + 2, end));
      word = (word ?? '') + '$()';
      i = end;
      continue;
    }
    // PowerShell's `$env:NAME = value` is an assignment (NAME=value), not an expansion.
    const assign = c === '$' && word == null ? /^\$env:([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*/i.exec(s.slice(i)) : null;
    if (assign) { word = `${assign[1]}=`; i += assign[0].length - 1; continue; }
    if (c === '$') { const v = variable(i); if (v) { word = (word ?? '') + v[0]; i = v[1] - 1; continue; } }
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      word = (word ?? '') + s.slice(i + 1, end < 0 ? s.length : end);
      i = end < 0 ? s.length : end;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let v = '';
      for (; j < s.length && s[j] !== '"'; j += 1) {
        if ((s[j] === '\\' && dialect !== 'powershell' && (s[j + 1] === '"' || s[j + 1] === '$' || s[j + 1] === '\\')) || (s[j] === '`' && dialect === 'powershell')) { v += s[j + 1] ?? ''; j += 1; continue; }
        if (s[j] === '$' && s[j + 1] === '(') { const end = closingParen(j + 2); nested.push(s.slice(j + 2, end)); v += '$()'; j = end; continue; }
        if (s[j] === '$') { const r = variable(j); if (r) { v += r[0]; j = r[1] - 1; continue; } }
        v += s[j];
      }
      word = (word ?? '') + v;
      i = j;
      continue;
    }
    if (c === '`') {
      if (dialect === 'powershell') { word = (word ?? '') + (s[i + 1] ?? ''); i += 1; continue; }
      endCommand();
      continue;
    }
    if (c === '#' && word == null) { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl - 1; continue; }
    // A bash heredoc (<<WORD, <<-WORD, <<'WORD') is the command's stdin, not commands: its body is skipped at the next
    // newline. An unquoted body still runs its $(...) substitutions.
    const heredoc = dialect !== 'powershell' && c === '<' && s[i + 1] === '<' && s[i + 2] !== '<'
      ? /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s;&|()<>'"]+))/.exec(s.slice(i)) : null;
    if (heredoc) {
      endWord();
      heredocs.push({ strip: heredoc[1] === '-', delimiter: heredoc[2] ?? heredoc[3] ?? heredoc[4], expands: heredoc[4] != null && !heredoc[0].includes('\\') });
      i += heredoc[0].length - 1;
      continue;
    }
    if (c === '\n' && heredocs.length) {
      endCommand();
      let at = i + 1;
      for (const doc of heredocs.splice(0)) {
        while (at < s.length) {
          const nl = s.indexOf('\n', at);
          const line = s.slice(at, nl < 0 ? s.length : nl).replace(/\r$/, '');
          at = nl < 0 ? s.length : nl + 1;
          if ((doc.strip ? line.replace(/^\t+/, '') : line) === doc.delimiter) break;
          if (doc.expands) for (const m of line.matchAll(/\$\(/g)) nested.push(line.slice(m.index + 2, closingParenIn(line, m.index + 2)));
        }
      }
      i = at - 1;
      continue;
    }
    if (c === '>' || c === '<') {
      // A redirection and its target are not arguments: `2>&1`, `>> log`, `*> $null`, `< in`.
      if (word != null && /^(?:\d|\*)$/.test(word)) word = null;
      endWord();
      let j = i + 1;
      while (s[j] === '>' || s[j] === '&') j += 1;
      if (/\d/.test(s[j] ?? '') && s[j - 1] === '&') { i = j; continue; }
      while (s[j] === ' ' || s[j] === '\t') j += 1;
      if (s[j] === '"' || s[j] === "'") { const q = s[j]; const end = s.indexOf(q, j + 1); j = end < 0 ? s.length : end + 1; }
      else while (j < s.length && !/[\s;&|()<>]/.test(s[j])) j += 1;
      i = j - 1;
      continue;
    }
    if (c === '~' && word == null && (s[i + 1] === '/' || s[i + 1] === '\\' || s[i + 1] == null || /\s/.test(s[i + 1]))) { word = os.homedir(); continue; }
    if (c === '\r') continue;
    if (SEPARATORS.has(c)) { endCommand(); continue; }
    if (c === ' ' || c === '\t') { endWord(); continue; }
    word = (word ?? '') + c;
  }
  endCommand();
  for (const inner of nested) out.push(...simpleCommands(inner, { dialect, env }));
  return out;
}

/** A command word as the program it names: basename, lowercase, without .exe/.cmd/.bat/.ps1. */
export const programOf = (word) => path.basename(String(word ?? '').replace(/\\/g, '/')).toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, '');

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
const PREFIX_PROGRAMS = new Set(['command', 'exec', 'time', 'nohup', 'sudo', 'builtin']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const POWERSHELLS = new Set(['powershell', 'pwsh']);

/**
 * The commands one agent shell call runs, flattened: [{program, args, cwd, env, word, dialect}] with wrappers opened
 * (bash -c, powershell -Command/-EncodedCommand/-File, cmd /c, env, xargs, npx/bunx, command/exec/...), leading VAR=value and
 * export/$env: assignments applied to the commands after them, and cd/Set-Location/pushd moving the cwd.
 */
export function commandsOf(text, { cwd, env = process.env, dialect = 'bash', depth = 0 } = {}) {
  const out = [];
  if (depth > 4) return out;
  let dir = cwd;
  const scopeEnv = { ...env };
  for (const words of simpleCommands(text, { dialect, env: scopeEnv })) {
    let w = [...words];
    const local = {};
    while (w.length && ASSIGNMENT.test(w[0])) { const [, k, v] = ASSIGNMENT.exec(w[0]); local[k] = v; w.shift(); }
    if (!w.length) { Object.assign(scopeEnv, local); continue; }
    let program = programOf(w[0]);
    if (program === 'export' || program === 'set') {
      if (w.length === 1 || (w.length === 2 && w[1] === '-p')) out.push({ program, args: w.slice(1), cwd: dir, env: scopeEnv, word: w[0], dialect });
      for (const a of w.slice(1)) { const m = ASSIGNMENT.exec(a); if (m) scopeEnv[m[1]] = m[2]; } continue; }
    const cmdEnv = { ...scopeEnv, ...local };
    for (let guard = 0; guard < 6; guard += 1) {
      if (PREFIX_PROGRAMS.has(program)) { w = w.slice(1).filter((a, i, all) => !(i === 0 && /^-/.test(a) && all.length > 1)); }
      else if (program === 'env') {
        const envWord = w[0];
        w = w.slice(1);
        while (w.length && (/^-/.test(w[0]) || ASSIGNMENT.test(w[0]))) { const m = ASSIGNMENT.exec(w[0]); if (m) cmdEnv[m[1]] = m[2]; if (/^-[uCS]$/.test(w[0])) w.shift(); w.shift(); }
        // `env` and `env -u NAME` with no command to run print the whole environment: they stay a command for ENV_DUMP.
        if (!w.length) out.push({ program: 'env', args: [], cwd: dir, env: cmdEnv, word: envWord, dialect });
      } else if (program === 'xargs') {
        w = w.slice(1);
        while (w.length && /^-/.test(w[0])) { const takesValue = /^-(?:[IdEnLPs]|-(?:replace|delimiter|eof|max-args|max-lines|max-procs|max-chars|arg-file))$/.test(w[0]); w.shift(); if (takesValue) w.shift(); }
      } else if (program === 'npx' || program === 'bunx' || program === 'corepack') {
        // npx [-y] [--package <pkg>] <bin> args: the package's bin is the program (@openai/codex -> codex); corepack
        // <pnpm|yarn> args runs that package manager.
        w = w.slice(1);
        while (w.length && /^-/.test(w[0])) { const takesValue = /^(?:-p|--package)$/.test(w[0]); w.shift(); if (takesValue) w.shift(); }
      } else break;
      if (!w.length) break;
      program = programOf(w[0]);
    }
    if (!w.length) continue;
    const args = w.slice(1);
    if (['cd', 'set-location', 'sl', 'chdir', 'pushd', 'push-location'].includes(program)) {
      // cmd's `cd /d <dir>` switches the drive too: /d is a switch there, not the target.
      const target = args.find((a) => !/^-/.test(a) && !(dialect === 'cmd' && /^\/d$/i.test(a)));
      if (target) dir = path.resolve(dir, target);
      continue;
    }
    const nestedOf = (inner, innerDialect) => out.push(...commandsOf(inner, { cwd: dir, env: cmdEnv, dialect: innerDialect, depth: depth + 1 }));
    if (SHELLS.has(program)) {
      const at = args.findIndex((a) => /^-[a-z]*c[a-z]*$/.test(a));
      if (at >= 0 && args[at + 1] != null) { nestedOf(args[at + 1], 'bash'); continue; }
    }
    if (POWERSHELLS.has(program)) {
      const flagAt = (re) => args.findIndex((a) => re.test(a));
      const enc = flagAt(/^-(?:e|ec|enc|encodedcommand)$/i);
      if (enc >= 0 && args[enc + 1]) { nestedOf(Buffer.from(args[enc + 1], 'base64').toString('utf16le'), 'powershell'); continue; }
      const file = flagAt(/^-(?:f|file)$/i);
      if (file >= 0 && args[file + 1]) {
        let body = null;
        try { body = fs.readFileSync(path.resolve(dir, args[file + 1]), 'utf8'); } catch { /* an unreadable script runs nothing we can see */ }
        if (body != null) nestedOf(body, 'powershell');
        continue;
      }
      const c = flagAt(/^-(?:c|command)$/i);
      if (c >= 0) { nestedOf(args.slice(c + 1).join(' '), 'powershell'); continue; }
      const bare = args.filter((a) => !/^-/.test(a));
      if (bare.length) { nestedOf(bare.join(' '), 'powershell'); continue; }
    }
    if (program === 'cmd') {
      // Git Bash spells cmd's switch //c (MSYS would rewrite a single /c as a path).
      const at = args.findIndex((a) => /^\/\/?[ck]$/i.test(a));
      if (at >= 0) { nestedOf(args.slice(at + 1).join(' '), 'cmd'); continue; }
    }
    out.push({ program, args, cwd: dir, env: cmdEnv, word: w[0], dialect });
  }
  return out;
}

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
const POWERSHELL_RECURSE = /^-r(?:e(?:c(?:u(?:r(?:se?)?)?)?)?)?(?::(?!\$?false$).*)?$/i;
const cmdSwitches = (arg) => (/^\/\/?[a-z](?:\/[a-z])*$/i.test(arg) ? arg.toLowerCase().split('/').filter(Boolean) : []);
const hasCmdSwitch = (args, letter) => args.some((a) => cmdSwitches(a).includes(letter));
const recursiveDeleteVerdict = (program, args, dialect) => {
  const options = args.includes('--') ? args.slice(0, args.indexOf('--')) : args;
  let how = null;
  if (dialect === 'powershell' && REMOVE_ITEM.has(program)) {
    if (options.some((a) => POWERSHELL_RECURSE.test(a) || /^-(?:rf|fr)$/i.test(a))) how = `${program} -Recurse`;
  } else if (program === 'remove-item' || program === 'ri') {
    if (options.some((a) => POWERSHELL_RECURSE.test(a))) how = `${program} -Recurse`;
  } else if (program === 'rm') {
    if (options.some((a) => a === '--recursive' || (/^-[A-Za-z]+$/.test(a) && /r/i.test(a)))) how = 'rm -r';
  } else if (['rmdir', 'rd', 'del', 'erase'].includes(program)) {
    if (hasCmdSwitch(options, 's')) how = `${program} /s`;
  } else if (program === 'robocopy') {
    const flag = options.find((a) => /^(?:\/\/?|-)(?:mir|purge)$/i.test(a));
    if (flag) how = `robocopy ${flag.replace(/^\/\/|^-/, '/').toUpperCase()}`;
  }
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
const BRANCH_WRITES = /^(?:-[dDmMcCfu]|--delete|--move|--copy|--force|--set-upstream-to(?:=.*)?|--unset-upstream|--edit-description|--track(?:=.*)?|--no-track)$/;
const BRANCH_READS = /^(?:-[avrl]+|--list|--all|--remotes|--show-current|--contains|--no-contains|--merged|--no-merged|--points-at|--sort(?:=.*)?|--format(?:=.*)?|--color(?:=.*)?|--no-color|--column(?:=.*)?|--no-column|-vv|--verbose)$/;
const insideDir = (dir, root) => { const d = pathKey(dir); const r = pathKey(root); return d === r || d.startsWith(`${r}/`); };

/** Why `git <sub> <rest>` changes history, a ref or tracked work, or null when it only reads. */
export function workflowHistoryChange(sub, rest) {
  const dd = rest.indexOf('--');
  const before = dd === -1 ? rest : rest.slice(0, dd);
  const options = before.filter((a) => a.startsWith('-'));
  const words = before.filter((a) => !a.startsWith('-'));
  if (WORKFLOW_HISTORY_VERBS.has(sub)) return `git ${sub} writes history or a ref`;
  if (sub === 'reset') {
    if (options.some((o) => RESET_MODES.has(o)) || words.length) return 'git reset to a revision or with a mode moves HEAD or discards tracked work';
    return null;
  }
  if (sub === 'checkout') return before.length || dd !== -1 ? 'git checkout switches the branch or discards tracked work' : null;
  if (sub === 'restore') return options.some((o) => o === '--worktree' || o === '-W') || !options.some((o) => o === '--staged' || o === '-S') ? 'git restore discards tracked work in the working tree' : null;
  if (sub === 'stash') return ['list', 'show'].includes(words[0]) ? null : 'git stash takes tracked work out of the tree';
  if (sub === 'tag') return words.length && !options.some((o) => o === '-l' || o === '--list') ? 'git tag writes a ref' : options.some((o) => o === '-d' || o === '--delete' || o === '-f' || o === '--force') ? 'git tag writes a ref' : null;
  if (sub === 'branch') {
    if (options.some((o) => BRANCH_WRITES.test(o))) return 'git branch writes a ref';
    return words.length && !options.some((o) => BRANCH_READS.test(o)) ? 'git branch creates a ref' : null;
  }
  if (sub === 'reflog') return ['expire', 'delete'].includes(words[0]) ? `git reflog ${words[0]} rewrites ref history` : null;
  if (sub === 'notes') return !words[0] || ['list', 'show'].includes(words[0]) ? null : 'git notes writes a ref';
  return null;
}

/** The WORKFLOW_HISTORY_CHANGE refusal for one git call inside the guard's workflow worktree, or null. */
export function workflowHistoryVerdict({ args, cwd, guard, parseGitArgv }) {
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
  const listFile = path.join(os.tmpdir(), `starci-pathspec-${process.pid}-${Date.now()}.nul`);
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

/**
 * The first refusal for one shell call, or null: {tool, code, command, reason, remedy}. `dialect` is the text's shell
 * (PowerShell for Claude's PowerShell tool; bash otherwise, which also reads plain Windows command lines).
 */
export async function commandVerdict({ command, cwd, guard, env = process.env, dialect = 'bash', deps = null }) {
  const d = deps ?? await loadDeps();
  const commands = commandsOf(command, { cwd, env, dialect });
  const byQuery = queryKillVerdict(commands, command);
  if (byQuery) return { tool: 'process-query', ...byQuery };
  for (const c of commands) {
    const dump = envDumpVerdict(c);
    if (dump) return { tool: c.program, ...dump };
    const link = linkVerdict(c.program, c.args, c.word);
    if (link) return { tool: c.program, ...link };
    const kill = nameKillVerdict(c.program, c.args);
    if (kill) return { tool: c.program, ...kill };
    const del = recursiveDeleteVerdict(c.program, c.args, c.dialect);
    if (del) return { tool: c.program, ...del };
    const launch = launchVerdict(c.program, c.args, guard);
    if (launch) return { tool: c.program, ...launch };
    if (c.program === 'git') { const h = workflowHistoryVerdict({ args: c.args, cwd: c.cwd, guard, parseGitArgv: d.policy.parseGitArgv }); if (h) return h; }
    if (c.program === 'git') { const v = await gitVerdict({ args: c.args, cwd: c.cwd, env: c.env, guard, deps: d }); if (v) return v; }
    const mailbox = kernelMailboxVerdict(c.program, c.args, guard);
    if (mailbox) return { tool: c.program, ...mailbox };
    if (d.npm.PACKAGE_MANAGERS.includes(c.program)) { const v = await installVerdict({ program: c.program, args: c.args, cwd: c.cwd, guard, deps: d }); if (v) return v; }
  }
  return null;
}

/**
 * The rules that hold with no guard file (a terminal no launch bound, a lane, the owner's own session): an install
 * through a linked node_modules only. Loads nothing but deps-guard.mjs.
 */
export async function unguardedVerdict({ command, cwd, env = process.env, dialect = 'bash', npm = null }) {
  const deps = npm ?? await import('./deps-guard.mjs');
  for (const c of commandsOf(command, { cwd, env, dialect })) {
    if (!deps.PACKAGE_MANAGERS.includes(c.program)) continue;
    const v = installLinkVerdict({ program: c.program, args: c.args, cwd: c.cwd, npm: deps });
    if (v) return v;
  }
  return null;
}

/** The shell text of one hook input: Claude's Bash/PowerShell, Codex's Bash and Devin's exec all carry `command`. */
export function shellCallOf(input) {
  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || !command.trim()) return null;
  const cwd = input.tool_input.workdir || input.cwd || process.cwd();
  return { command, cwd: path.resolve(cwd), dialect: /^powershell$/i.test(String(input.tool_name ?? '')) ? 'powershell' : 'bash' };
}

// A cheap first look for the unguarded case: only a command naming a package manager can be refused without a guard.
const NAMES_PACKAGE_MANAGER = /\b(?:npm|pnpm|yarn)\b/i;

/** The hook's decision for one input: {verdict, guard} to refuse (guard null for an unguarded session), else null. */
export async function hookDecision(input, { env = process.env, root = skillRoot, deps = null } = {}) {
  const guard = boundGuard(env.ORCA_TERMINAL_HANDLE, { root });
  const call = shellCallOf(input);
  if (!call) return null;
  if (!guard) {
    if (!NAMES_PACKAGE_MANAGER.test(call.command)) return null;
    const verdict = await unguardedVerdict({ ...call, env, npm: deps?.npm ?? null });
    return verdict ? { verdict, guard: null, cwd: call.cwd } : null;
  }
  const verdict = await commandVerdict({ ...call, guard, env, deps });
  return verdict ? { verdict, guard, cwd: call.cwd } : null;
}

const readInput = (stream) => new Promise((resolve, reject) => {
  let raw = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => { raw += chunk; });
  stream.on('end', () => resolve(raw));
  stream.on('error', reject);
});

/** The hook entry, exported so the published CLI can dispatch it in-process without a second Node hop. */
export async function main({ stdin = process.stdin, stderr = process.stderr, env = process.env, root = skillRoot } = {}) {
  try {
    const raw = await readInput(stdin);
    // The common case - no guard bound and no package manager named - exits before anything heavier than one file read.
    if (!boundGuard(env.ORCA_TERMINAL_HANDLE, { root }) && !NAMES_PACKAGE_MANAGER.test(raw)) return 0;
    const decision = await hookDecision(JSON.parse(raw), { env, root });
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
