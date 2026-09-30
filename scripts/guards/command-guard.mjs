#!/usr/bin/env node
// command-guard.mjs — the op guard as a PreToolUse hook: the shell command an op or [Worker] agent is about to run is
// checked before it runs, and a refused one never starts (exit 2, the reason on stderr - the block every host speaks:
// Claude Code, Codex and Devin).
//
// Every agent launches through Orca worker-start, which owns the agent's environment, so a guard can no longer ride
// on the agent's PATH. The launch binds the op's guard to its Orca terminal instead (scripts/guards/install.mjs
// bindGuardTerminal -> runtime/guards/terminals/<handle>.json) and launch trust registers this hook with the agent's
// host (scripts/agent/trust.mjs ensureToolGuardHook). A session with no Orca terminal, or whose terminal has no guard
// bound (the Kernel, the [Supervisor], the owner's own sessions), passes untouched.
//
// What it refuses, each from a real incident:
//  - git: the shared-checkout policy (git-policy.mjs classifyGit - history rewrites, sweeping discards, foreign
//    pathspecs, worktrees, hook bypasses); an App Router pathspec whose glob reading reaches another path.
//  - npm: an install-family command through a linked node_modules, which empties the live tree it links to
//    (deps-guard.mjs linkedNodeModulesOf; node-modules-link-wipe), and a clean install while another workflow's job
//    is leased on the ledger (peerLeasedJobs).
//  - links: `ln`, `mklink`, New-Item -ItemType Junction|SymbolicLink|HardLink and [IO.Directory]::Create*Link - an
//    op never creates a link (nivo-fe inc-c8fbf76aa499).
// Before an allowed git command, a stale shared .git/index.lock is recovered (scripts/lib/git-index-lock.mjs).
// Fail-open on the guard's OWN faults: a bug here must never take the shell away from a worker.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');

/** The guard bound to Orca terminal `handle` (runtime/guards/terminals/<handle>.json), or null. */
export function boundGuard(handle, { root = skillRoot } = {}) {
  if (!handle) return null;
  try { return JSON.parse(fs.readFileSync(path.join(root, 'runtime', 'guards', 'terminals', `${safeName(handle)}.json`), 'utf8')); }
  catch { return null; }
}

/* ------------------------------------------------------------ command text */

const SEPARATORS = new Set([';', '&', '|', '(', ')', '{', '}', '\n']);

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
  const closingParen = (from) => {
    let depth = 1;
    for (let j = from; j < s.length; j += 1) {
      if (s[j] === '(') depth += 1;
      else if (s[j] === ')' && --depth === 0) return j;
    }
    return s.length;
  };
  // $NAME, ${NAME}, $env:NAME at s[i] ('$'); returns [value, next index] or null for a lone '$'.
  const variable = (i) => {
    const m = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|env:([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))/i.exec(s.slice(i));
    if (!m) return null;
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
 * The commands one agent shell call runs, flattened: [{program, args, cwd, env}] with wrappers opened (bash -c,
 * powershell -Command/-EncodedCommand/-File, cmd /c, env, xargs, command/exec/...), leading VAR=value and
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
    if (program === 'export' || program === 'set') { for (const a of w.slice(1)) { const m = ASSIGNMENT.exec(a); if (m) scopeEnv[m[1]] = m[2]; } continue; }
    const cmdEnv = { ...scopeEnv, ...local };
    for (let guard = 0; guard < 6; guard += 1) {
      if (PREFIX_PROGRAMS.has(program)) { w = w.slice(1).filter((a, i, all) => !(i === 0 && /^-/.test(a) && all.length > 1)); }
      else if (program === 'env') {
        w = w.slice(1);
        while (w.length && (/^-/.test(w[0]) || ASSIGNMENT.test(w[0]))) { const m = ASSIGNMENT.exec(w[0]); if (m) cmdEnv[m[1]] = m[2]; w.shift(); }
      } else if (program === 'xargs') {
        w = w.slice(1);
        while (w.length && /^-/.test(w[0])) { const takesValue = /^-(?:[IdEnLPs]|-(?:replace|delimiter|eof|max-args|max-lines|max-procs|max-chars|arg-file))$/.test(w[0]); w.shift(); if (takesValue) w.shift(); }
      } else break;
      if (!w.length) break;
      program = programOf(w[0]);
    }
    if (!w.length) continue;
    const args = w.slice(1);
    if (['cd', 'set-location', 'sl', 'chdir', 'pushd', 'push-location'].includes(program)) {
      const target = args.find((a) => !/^-/.test(a));
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
    out.push({ program, args, cwd: dir, env: cmdEnv, word: w[0] });
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
    reason: 'an op worker never creates a junction, symlink or hard link - a link from a scratch tree into a live repository is followed by a recursive delete (git worktree remove, rm -rf, Remove-Item) and empties the live repository (nivo-fe lost 674 files, inc-c8fbf76aa499)',
    remedy: 'work in your dispatched checkout with its own node_modules; a need for another tree or a linked dependency is reported (report blocked environment), never made' };
};

// git reads an App Router segment ([locale], [...slug]) in a pathspec as a character class. The policy scopes it as the
// literal path admission granted, so the command is refused only when git's glob reading reaches a path the literal
// reading does not (a sibling like src/app/l/ another workflow owns; nivo-fe inc-21f76abb6d10): the files each reading
// names are compared with git ls-files. The remedy is the same command with :(literal) pathspecs.
function appRouterGlob({ args, cwd, deps }) {
  const { literalAppRouterArgv, parseGitArgv } = deps.policy;
  const listFile = path.join(os.tmpdir(), `starci-pathspec-${process.pid}-${Date.now()}.nul`);
  try {
    const literal = literalAppRouterArgv(args, { cwd, stdin: null, listFile });
    if (!literal.changed) return null;
    const dir = parseGitArgv(args, cwd).cwd;
    const files = (spec) => {
      const r = deps.git.gitSpawn('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z', ...spec], { cwd: dir });
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
      reason: `an App Router segment in a pathspec is a glob to git: it would also reach ${reached.slice(0, 5).join(', ')} (nivo-fe inc-21f76abb6d10)`,
      remedy };
  } finally { fs.rmSync(listFile, { force: true }); }
}

async function gitVerdict({ args, cwd, env, guard, deps }) {
  const { classifyGit, pathspecListOnStdin } = deps.policy;
  const { gitSpawn } = deps.git;
  const top = () => { const r = gitSpawn('git', ['rev-parse', '--show-toplevel'], { cwd }); return r.status === 0 && r.stdout.trim() ? path.resolve(r.stdout.trim()) : null; };
  const currentConfig = (key) => { const r = gitSpawn('git', ['config', '--get', key], { cwd }); return r.status === 0 ? r.stdout.trim() : null; };
  const verdict = classifyGit(args, { cwd, owned: guard?.owned ?? null, top: guard?.owned?.length ? top() : null, env, stdin: null, currentConfig });
  const command = args.join(' ').slice(0, 200);
  if (!verdict.allow) return { tool: 'git', ...verdict, command };
  if (!pathspecListOnStdin(args)) { const glob = appRouterGlob({ args, cwd, deps }); if (glob) return { tool: 'git', ...glob, command }; }
  const dashC = args.indexOf('-C');
  await deps.indexLock.preflightIndexLock({ cwd: dashC >= 0 && args[dashC + 1] ? path.resolve(cwd, args[dashC + 1]) : cwd, guard, env, say: deps.say });
  return null;
}

async function npmVerdict({ args, cwd, guard, deps }) {
  const { classifyNpm, linkedNodeModulesOf, peerLeasedJobs } = deps.npm;
  const kind = classifyNpm(args).kind;
  if (kind === 'pass') return null;
  const command = `npm ${args.join(' ')}`.slice(0, 200);
  const linked = linkedNodeModulesOf(args, cwd);
  if (linked) return { tool: 'npm', code: 'DEPS_THROUGH_LINK', command,
    reason: `${linked.nodeModules} is a link to ${linked.target ?? 'another tree'}: npm would empty that live node_modules`,
    remedy: 'never install here; a dependency change goes to the workflow serial deps unit, or report blocked environment' };
  if (kind !== 'clean-install' || !guard?.ledgerRepo) return null;
  let peers;
  try { peers = await peerLeasedJobs({ ledgerRepo: guard.ledgerRepo, workflowId: guard.workflowId }); }
  catch (e) { deps.say(`starci guard: could not read peer leases (${e?.message ?? e})`); return null; }
  if (!peers.jobs.length) return null;
  const names = peers.jobs.slice(0, 5).map((j) => `${j.jobId} (${j.workflowId})`).join(', ');
  return { tool: 'npm', code: 'DEPS_DELETE_WHILE_PEER_LEASED', command,
    reason: `${command} deletes node_modules while other workflows' jobs run checks from it: ${names}`,
    remedy: 'use `npm install`, or report blocked environment naming the missing dependency' };
}

const loadDeps = async () => {
  const [policy, npm, git, indexLock] = await Promise.all([import('./git-policy.mjs'), import('./deps-guard.mjs'), import('../lib/git.mjs'), import('../lib/git-index-lock.mjs')]);
  return { policy, npm, git, indexLock, say: (line) => process.stderr.write(`${line}\n`) };
};

/**
 * The first refusal for one shell call, or null: {tool, code, command, reason, remedy}. `dialect` is the text's shell
 * (PowerShell for Claude's PowerShell tool; bash otherwise, which also reads plain Windows command lines).
 */
export async function commandVerdict({ command, cwd, guard, env = process.env, dialect = 'bash', deps = null }) {
  const d = deps ?? await loadDeps();
  for (const c of commandsOf(command, { cwd, env, dialect })) {
    const link = linkVerdict(c.program, c.args, c.word);
    if (link) return { tool: c.program, ...link };
    if (c.program === 'git') { const v = await gitVerdict({ args: c.args, cwd: c.cwd, env: c.env, guard, deps: d }); if (v) return v; }
    if (c.program === 'npm') { const v = await npmVerdict({ args: c.args, cwd: c.cwd, guard, deps: d }); if (v) return v; }
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

/** The hook's decision for one input: {verdict, guard} to refuse, else null. */
export async function hookDecision(input, { env = process.env, root = skillRoot, deps = null } = {}) {
  const guard = boundGuard(env.ORCA_TERMINAL_HANDLE, { root });
  if (!guard) return null;
  const call = shellCallOf(input);
  if (!call) return null;
  const verdict = await commandVerdict({ ...call, guard, env, deps });
  return verdict ? { verdict, guard, cwd: call.cwd } : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', async () => {
    try {
      // The common case - no guard bound to this terminal - exits before anything heavier than one file read.
      if (!boundGuard(process.env.ORCA_TERMINAL_HANDLE)) process.exit(0);
      const decision = await hookDecision(JSON.parse(raw));
      if (!decision) process.exit(0);
      const { refusalLines, logRefusal } = await import('./refusals.mjs');
      const { tool, ...verdict } = decision.verdict;
      process.stderr.write(`${refusalLines(tool, verdict).join('\n')}\n`);
      logRefusal({ tool, via: 'pre-tool-use', ...verdict, jobId: decision.guard.jobId ?? null, workflowId: decision.guard.workflowId ?? null, cwd: decision.cwd });
      process.exit(2);
    } catch (e) {
      process.stderr.write(`starci guard: guard error (${e?.message ?? e}); passing the command through\n`);
      process.exit(0);
    }
  });
}
