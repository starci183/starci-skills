#!/usr/bin/env node
// shim.mjs — the op worker's `git` and `npm`, placed first on its PATH by the
// op launch (scripts/guards/install.mjs guardLaunch; api dispatch).
//
//   node shim.mjs git <args...>          git-policy.mjs, then the real git
//   node shim.mjs npm <args...>          deps-guard.mjs, then the real npm
//   node shim.mjs verify-commit <old> <new>   (the history hook) the commits
//                                        the ref update brings touch only the
//                                        job's owned paths
//   node shim.mjs refuse-link <tool> <args...>  (bash-env.sh) refuse and log a link-making command
//
// The job it guards is named by STARCI_GUARD_FILE (runtime/guards/jobs/<job>.json:
// {jobId, workflowId, ledgerRepo, owned:[absolute paths]}). Without it the
// history rules still apply and path-scoped rules refuse what they cannot prove.
// Fail-open on the guard's OWN faults: a bug here must never take git away
// from a worker, so an internal error passes the command through (and says so).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyGit, literalAppRouterArgv } from './git-policy.mjs';
import { classifyNpm, peerLeasedJobs, acquireDepsLock, depsLockWindows } from './deps-guard.mjs';
import { pathKey } from '../lib/path-key.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const norm = pathKey;

export function readGuard(env = process.env) {
  const file = env.STARCI_GUARD_FILE;
  if (!file) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// The first `name` on PATH that is not a shim directory.
export function realBinary(name, env = process.env, exts = isWin ? ['.exe'] : ['']) {
  const cached = env[`STARCI_REAL_${name.toUpperCase()}`];
  if (cached && fs.existsSync(cached)) return cached;
  const shimDirs = new Set([norm(path.join(here, 'bin')), ...String(env.STARCI_GUARD_BIN ?? '').split(path.delimiter).filter(Boolean).map(norm)]);
  for (const dir of String(env.PATH ?? env.Path ?? '').split(path.delimiter)) {
    if (!dir || shimDirs.has(norm(dir))) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${name}${ext}`);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* next */ }
    }
  }
  return null;
}

const say = (line) => process.stderr.write(`${line}\n`);
const refuse = (tool, verdict, guard) => {
  say(`starci guard: refused \`${tool} ${verdict.command ?? ''}\` [${verdict.code}] — ${verdict.reason}.`);
  if (verdict.remedy) say(`starci guard: instead: ${verdict.remedy}.`);
  say('starci guard: this checkout is shared with other workflows (modules/ops/_common.yaml "Evidence, completion and commits"). Report a real need in your report; never work around this guard.');
  logRefusal({ tool, ...verdict, jobId: guard?.jobId ?? null, workflowId: guard?.workflowId ?? null, cwd: process.cwd() });
  return 3;
};
function logRefusal(entry) {
  try {
    const dir = path.join(here, '..', '..', 'runtime', 'guards');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'refusals.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch { /* the refusal stands without its log line */ }
}

const run = (file, args, extraEnv = {}, input = null) => {
  const r = spawnSync(file, args, { stdio: input == null ? 'inherit' : ['pipe', 'inherit', 'inherit'], ...(input == null ? {} : { input }), env: { ...process.env, ...extraEnv }, windowsHide: false });
  if (r.error) { say(`starci guard: could not run ${file}: ${r.error.message}`); return 127; }
  return r.status ?? (r.signal ? 128 : 1);
};

function gitTop(git, cwd) {
  const r = spawnSync(git, ['rev-parse', '--show-toplevel', '--git-common-dir'], { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return null;
  const [top, common] = r.stdout.split(/\r?\n/);
  return { top: top ? path.resolve(top) : null, common: common ? path.resolve(cwd, common) : null };
}

// `--pathspec-from-file=-` (or `--pathspec-from-file -`) before a bare `--`: the list is on stdin.
export function pathspecListOnStdin(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--') return false;
    if (args[i] === '--pathspec-from-file=-' || (args[i] === '--pathspec-from-file' && args[i + 1] === '-')) return true;
  }
  return false;
}

function shimGit(args, guard) {
  const git = realBinary('git');
  if (!git) { say('starci guard: no real git on PATH'); return 127; }
  // A pathspec list on stdin is read here so the policy can scope it, then handed on to git unchanged.
  let stdin = null;
  if (pathspecListOnStdin(args)) {
    try { stdin = fs.readFileSync(0); } catch (e) { say(`starci guard: could not read the pathspec list from stdin (${e?.message ?? e})`); stdin = null; }
  }
  let verdict;
  try {
    const top = guard?.owned?.length ? gitTop(git, process.cwd())?.top ?? null : null;
    const currentConfig = (key) => {
      const r = spawnSync(git, ['config', '--get', key], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
      return r.status === 0 ? r.stdout.trim() : null;
    };
    verdict = classifyGit(args, { cwd: process.cwd(), owned: guard?.owned ?? null, top, stdin: stdin == null ? null : stdin.toString('utf8'), currentConfig });
  } catch (e) {
    say(`starci guard: policy error (${e?.message ?? e}); passing the command through`);
    verdict = { allow: true };
  }
  if (!verdict.allow) return refuse('git', { ...verdict, command: args.join(' ').slice(0, 200) }, guard);
  const literal = literalArgs(args, stdin);
  try { return run(git, literal.argv, { STARCI_REAL_GIT: git }, stdin); }
  finally { if (literal.listFile) fs.rmSync(literal.listFile, { force: true }); }
}

// The guard scoped an App Router pathspec (`src/app/[locale]/x`) as the literal path admission granted; git would
// read its brackets as a character class and reach a peer's sibling (`src/app/l/x`), so git gets it as
// `:(literal)` (git-policy.mjs literalAppRouterArgv; nivo-fe inc-21f76abb6d10). A rewritten pathspec list goes
// to a private NUL-separated file for this one call. The guard's own fault passes the arguments unchanged.
function literalArgs(args, stdin) {
  try {
    const listFile = path.join(os.tmpdir(), `starci-pathspec-${process.pid}-${Date.now()}.nul`);
    const r = literalAppRouterArgv(args, { cwd: process.cwd(), stdin: stdin == null ? null : stdin.toString('utf8'), listFile });
    if (!r.changed) return { argv: args, listFile: null };
    if (r.list != null) fs.writeFileSync(listFile, r.list);
    return { argv: r.argv, listFile: r.list != null ? listFile : null };
  } catch (e) {
    say(`starci guard: literal pathspec error (${e?.message ?? e}); passing the arguments unchanged`);
    return { argv: args, listFile: null };
  }
}

// npm's own CLI script run by this node: beside node, else beside the npm.cmd on PATH (Windows cannot spawn a .cmd
// without a shell), else a native npm.
function npmCli() {
  const cliIn = (dir) => path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const cmd = isWin ? realBinary('npm', process.env, ['.cmd']) : null;
  for (const cli of [cliIn(path.dirname(process.execPath)), ...(cmd ? [cliIn(path.dirname(cmd))] : [])]) if (fs.existsSync(cli)) return { file: process.execPath, pre: [cli] };
  const npm = realBinary('npm');
  return npm ? { file: npm, pre: [] } : null;
}

async function withDepsLock(what, guard, fn) {
  const git = realBinary('git');
  const where = git ? gitTop(git, process.cwd()) : null;
  const lockFile = where?.common ? path.join(where.common, 'starci-deps.lock') : null;
  if (!lockFile) return fn();
  const lock = acquireDepsLock({
    ...(await depsLockWindows()), lockFile, holder: { jobId: guard?.jobId ?? null, workflowId: guard?.workflowId ?? null, command: what, cwd: process.cwd() },
    onWait: (h) => say(`starci guard: waiting for the dependency lock of this repository (held by ${h.jobId ?? `pid ${h.pid}`}: ${h.command}, since ${h.at})`),
  });
  if (!lock.ok) {
    return refuse('npm', { code: 'DEPS_LOCK_TIMEOUT', reason: `the dependency lock is still held by ${lock.holder?.jobId ?? `pid ${lock.holder?.pid}`} (${lock.holder?.command})`, remedy: 'retry after that install finishes, or report blocked environment', command: what }, guard);
  }
  try { return await fn(); } finally { lock.release(); }
}

async function refuseWhilePeersLeased(what, guard) {
  if (!guard?.ledgerRepo) return null;
  let peers;
  try { peers = await peerLeasedJobs({ ledgerRepo: guard.ledgerRepo, workflowId: guard.workflowId }); }
  catch (e) { say(`starci guard: could not read peer leases (${e?.message ?? e})`); return null; }
  if (!peers.jobs.length) return null;
  const names = peers.jobs.slice(0, 5).map((j) => `${j.jobId} (${j.workflowId})`).join(', ');
  return refuse('npm', { code: 'DEPS_DELETE_WHILE_PEER_LEASED', command: what,
    reason: `${what} deletes node_modules while other workflows' jobs run checks from it: ${names}`,
    remedy: 'use `npm install` (serialized by the repository dependency lock), or report blocked environment naming the missing dependency' }, guard);
}

async function shimNpm(args, guard) {
  const npm = npmCli();
  if (!npm) { say('starci guard: no real npm'); return 127; }
  let kind = 'pass';
  try { kind = classifyNpm(args).kind; } catch (e) { say(`starci guard: policy error (${e?.message ?? e}); passing the command through`); }
  const what = `npm ${args.join(' ')}`.slice(0, 200);
  if (kind === 'pass') return run(npm.file, [...npm.pre, ...args]);
  return withDepsLock(what, guard, async () => {
    const refused = kind === 'clean-install' ? await refuseWhilePeersLeased(what, guard) : null;
    return refused ?? run(npm.file, [...npm.pre, ...args]);
  });
}

// The history hook's op half: the commits a protected-branch update brings that no remote-tracking ref already
// holds carry only the job's owned paths. A merge counts with the files it differs from every parent in, and each
// commit it brings from its other side is a commit of its own; a pull or fast-forward of published history brings
// none. (diff-tree of a merge without -c lists nothing, so a merged foreign branch landed unseen.)
export function foreignPathsOf({ git, cwd, oldSha, newSha, owned }) {
  const run = (args) => spawnSync(git, args, { cwd, encoding: 'utf8', windowsHide: true });
  const where = gitTop(git, cwd);
  const brought = run(['rev-list', newSha, '--not', oldSha, '--remotes']);
  if (brought.status !== 0 || !where?.top) return { checked: false, foreign: [] };
  const roots = owned.map(norm);
  const foreign = new Set();
  for (const sha of brought.stdout.split(/\r?\n/).filter(Boolean)) {
    const listed = run(['diff-tree', '-r', '-c', '--root', '--name-only', '--no-commit-id', '-z', sha]);
    if (listed.status !== 0) return { checked: false, foreign: [] };
    for (const rel of listed.stdout.split('\0').filter(Boolean)) {
      const n = norm(path.join(where.top, rel));
      if (!roots.some((r) => n === r || n.startsWith(`${r}/`))) foreign.add(rel);
    }
  }
  return { checked: true, foreign: [...foreign] };
}

function verifyCommit(oldSha, newSha, guard) {
  if (!guard?.owned?.length) return 0;
  const git = realBinary('git');
  if (!git) return 0;
  let result;
  try { result = foreignPathsOf({ git, cwd: process.cwd(), oldSha, newSha, owned: guard.owned }); }
  catch (e) { say(`starci guard: commit check error (${e?.message ?? e}); letting the commit land`); return 0; }
  if (!result.foreign.length) return 0;
  return refuse('git', { code: 'COMMIT_FOREIGN_PATHS', command: `commit ${newSha.slice(0, 10)}`,
    reason: `the commit carries paths outside your owned_paths: ${result.foreign.slice(0, 12).join(', ')} (a hook may have re-staged them, or a merge brought them)`,
    remedy: 'unstage them with `git restore --staged -- <those paths>` and commit your owned paths again with `git commit -m "<msg>" -- <owned paths>`; never merge another branch into the shared one' }, guard);
}

// The op's bash (bash-env.sh, scripts/guards/install.mjs) routes `ln`, `cmd /c mklink` and PowerShell's
// `New-Item -ItemType Junction|SymbolicLink|HardLink` here: an op never creates a link (nivo-fe inc-c8fbf76aa499).
function refuseLink(args, guard) {
  const [tool, ...rest] = args;
  return refuse(tool ?? 'link', { code: 'LINK_CREATE', command: rest.join(' ').slice(0, 200),
    reason: 'an op worker never creates a junction, symlink or hard link - a link from a scratch tree into a live repository is followed by a recursive delete (git worktree remove, rm -rf, Remove-Item) and empties the live repository (nivo-fe lost 674 files, inc-c8fbf76aa499)',
    remedy: 'work in your dispatched checkout with its own node_modules; a need for another tree or a linked dependency is reported (report blocked environment), never made' }, guard);
}

async function main(argv) {
  const [tool, ...args] = argv;
  const guard = readGuard();
  switch (tool) {
    case 'git': return shimGit(args, guard);
    case 'npm': return shimNpm(args, guard);
    case 'verify-commit': return verifyCommit(args[0], args[1], guard);
    case 'refuse-link': return refuseLink(args, guard);
    default: say(`starci guard: unknown tool ${tool}`); return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0), (e) => { say(`starci guard: ${e?.stack ?? e}`); process.exit(1); });
}
