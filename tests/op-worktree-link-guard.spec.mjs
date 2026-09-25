import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyGit } from '../scripts/guards/git-policy.mjs';
import { BASH_ENV_FILE, bashEnvBody, bindGuardTerminal, ensureGuardBin, ensureHistoryHook, guardLaunch, msysPath, writeJobGuard } from '../scripts/guards/install.mjs';
import { footprintTick, scanFootprint } from '../scripts/guards/footprint-scan.mjs';
import { linksUnder } from '../scripts/checks/scoped-lint-baseline.mjs';
import { safeRemoveTree } from '../scripts/lib/safe-remove.mjs';

// nivo-fe inc-c8fbf76aa499 (2026-09-25 05:47): Devin op worker op-interface.implement-2a43f63c6c ran, through Git Bash,
// `git worktree add --detach D:/Repositories/nivo-fe-wt-r4`, junctioned six node_modules of live nivo-fe into it
// (New-Item -ItemType Junction from a -File script, after `cmd //c mklink /J` failed on quoting), and removed it with
// `git worktree remove --force`, which followed the junctions and deleted 674 live files. The shim never saw a
// command: Git Bash puts /mingw64/bin before the launch PATH. This spec proves every layer WITHOUT creating a link:
// each link command aims at a directory that does not exist, so even an unguarded run could not make one.

const ROOT = path.resolve(import.meta.dirname, '..');
const sh = (cwd, args, env = {}) => spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
const initRepo = (t) => {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-wt-repo-')));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false']]) sh(repo, args);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'a\n');
  sh(repo, ['add', '.']); sh(repo, ['commit', '-q', '-m', 'base']);
  fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'b\n');
  sh(repo, ['commit', '-q', '-am', 'second']);
  return repo;
};
const tempDir = (t, prefix) => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('an op worker never creates, moves or removes a worktree: the git policy refuses it with the dispatched-checkout remedy', () => {
  for (const argv of [['worktree', 'add', '--detach', '../x', 'HEAD'], ['worktree', 'add', '-b', 'side', '../x'], ['-C', 'D:/r', 'worktree', 'add', 'x'],
    ['worktree', 'remove', '../x'], ['worktree', 'remove', '--force', '../x'], ['worktree', 'move', '../x', '../y']]) {
    const verdict = classifyGit(argv);
    assert.equal(verdict.allow, false, `expected refusal: git ${argv.join(' ')}`);
    assert.equal(verdict.code, 'WORKTREE_NOT_OPS');
    assert.match(verdict.reason, /works in the checkout it was dispatched to/);
    assert.match(verdict.remedy, /dispatched checkout/);
  }
  for (const argv of [['worktree', 'list'], ['worktree', 'list', '--porcelain'], ['worktree', 'prune']]) assert.equal(classifyGit(argv).allow, true, `git ${argv.join(' ')}`);
});

test('the history hook refuses a worktree an op creates with ANY git binary, and leaves ordinary op git alone', (t) => {
  const repo = initRepo(t);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const guardRoot = tempDir(t, 'guard-wt-root-');
  const file = writeJobGuard({ skillRoot: guardRoot, jobId: 'op-interface.implement-2a43f63c6c', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src')] });
  const op = { STARCI_GUARD_FILE: file };
  const beside = path.join(path.dirname(repo), `${path.basename(repo)}-wt-r4`);
  t.after(() => safeRemoveTree(beside));
  // `git` here is the real binary, not the shim: exactly the Git Bash case.
  for (const args of [['worktree', 'add', '--detach', beside, 'HEAD'], ['worktree', 'add', '-b', 'op-side', beside]]) {
    const added = sh(repo, args, op);
    assert.notEqual(added.status, 0, `git ${args.join(' ')} from an op is refused`);
    assert.match(added.stderr, /an op worker never creates a git worktree/);
    assert.equal(fs.existsSync(beside), false, 'git cleans up the refused worktree directory');
    assert.equal(sh(repo, ['worktree', 'list', '--porcelain']).stdout.split(/\r?\n/).filter((line) => line.startsWith('worktree ')).length, 1, 'no worktree is registered');
  }
  // Ordinary op git that moves HEAD in its own checkout still passes.
  assert.equal(sh(repo, ['checkout', '-q', '--detach', 'HEAD~1'], op).status, 0);
  assert.equal(sh(repo, ['checkout', '-q', 'main'], op).status, 0);
  fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'c\n');
  const commit = sh(repo, ['commit', '-q', '-m', 'op commit', '--', 'src'], op);
  assert.equal(commit.status, 0, commit.stderr);
  // No environment flag overrides the hook; a caller that is no op (the owner, the kernel) adds a worktree freely.
  assert.notEqual(sh(repo, ['worktree', 'add', '--detach', beside, 'HEAD'], { ...op, STARCI_HISTORY_GUARD: 'owner-override' }).status, 0);
  const owner = sh(repo, ['worktree', 'add', '--detach', beside, 'HEAD'], { STARCI_GUARD_FILE: '' });
  assert.equal(owner.status, 0, owner.stderr);
  assert.deepEqual(linksUnder(beside), [], 'a plain worktree, no link');
});

// A managed worker-start agent runs with Orca's environment, never STARCI_GUARD_FILE: the dispatch binds its
// guard to the Orca terminal (runtime/guards/terminals/<handle>.json) and the hook finds it by ORCA_TERMINAL_HANDLE.
test('the history hook applies an op\'s rules to a managed agent found by its bound Orca terminal', (t) => {
  const repo = initRepo(t);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const jobFile = writeJobGuard({ skillRoot: tempDir(t, 'guard-managed-skill-'), jobId: 'op-docs.author-managed', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src')] });
  const handle = 'term_spec:managed-' + process.pid;
  const bound = bindGuardTerminal({ skillRoot: ROOT, handle, jobFile });
  t.after(() => fs.rmSync(bound, { force: true }));
  assert.equal(path.basename(bound), 'term_spec_managed-' + process.pid + '.json');
  assert.equal(JSON.parse(fs.readFileSync(bound, 'utf8')).jobId, 'op-docs.author-managed');
  const managed = { STARCI_GUARD_FILE: '', ORCA_TERMINAL_HANDLE: handle };
  const beside = path.join(path.dirname(repo), path.basename(repo) + '-wt-managed');
  t.after(() => safeRemoveTree(beside));
  const added = sh(repo, ['worktree', 'add', '--detach', beside, 'HEAD'], managed);
  assert.notEqual(added.status, 0, 'a managed op creates no worktree');
  assert.match(added.stderr, /an op worker never creates a git worktree/);
  fs.mkdirSync(path.join(repo, 'peer'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'peer', 'b.txt'), 'peer\n');
  fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'managed\n');
  sh(repo, ['add', '--', 'peer/b.txt', 'src/a.txt']);
  const swept = sh(repo, ['commit', '-q', '-m', 'managed'], managed);
  assert.notEqual(swept.status, 0);
  assert.match(swept.stderr, /COMMIT_FOREIGN_PATHS[\s\S]*peer\/b\.txt/);
  assert.equal(sh(repo, ['commit', '-q', '-m', 'managed', '--', 'src'], managed).status, 0, 'its own paths land');
  // A terminal no op is bound to (the Kernel's, the owner's) is no op.
  const kernel = sh(repo, ['commit', '-q', '-m', 'kernel', '--', 'peer'], { STARCI_GUARD_FILE: '', ORCA_TERMINAL_HANDLE: 'term_kernel' });
  assert.equal(kernel.status, 0, kernel.stderr);
});

test('the op launch names a bash env that puts the guard first again and refuses link commands', (t) => {
  const skillRoot = tempDir(t, 'guard-wt-skill-');
  const repo = initRepo(t);
  const launched = guardLaunch({ skillRoot: ROOT, jobId: 'op-bash-env', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src')], repos: [], config: { guards: { historyHook: false } } });
  if (launched.receipt.shims?.dir) {
    assert.equal(launched.env.BASH_ENV, path.join(launched.receipt.shims.dir, BASH_ENV_FILE).replace(/\\/g, '/'));
    assert.ok(fs.existsSync(launched.env.BASH_ENV));
  }
  const off = guardLaunch({ skillRoot, jobId: 'op-off', workflowId: 'wf-x', ledgerRepo: null, owned: [], repos: [], config: { guards: { shims: false, historyHook: false } } });
  assert.equal(off.env.BASH_ENV, undefined, 'no shims, no bash env');
  const body = bashEnvBody({ dir: 'D:\\R\\.claude\\runtime\\guards\\bin', shim: 'D:\\R\\.claude\\scripts\\guards\\shim.mjs', nodePath: 'C:\\Program Files\\nodejs\\node.exe', platform: 'win32' });
  assert.match(body, /^starci_guard_bin='\/d\/R\/\.claude\/runtime\/guards\/bin'$/m);
  assert.match(body, /'C:\/Program Files\/nodejs\/node\.exe' 'D:\/R\/\.claude\/scripts\/guards\/shim\.mjs' refuse-link/);
  assert.equal(msysPath('C:\\Users\\x'), '/c/Users/x');
});

// Git Bash itself: only on a Windows host with Git for Windows.
const gitRoot = (() => { const r = spawnSync('git', ['--exec-path'], { encoding: 'utf8' }); return r.status === 0 ? path.resolve(r.stdout.trim(), '..', '..', '..') : null; })();
const gitBash = process.platform === 'win32' && gitRoot && fs.existsSync(path.join(gitRoot, 'bin', 'bash.exe')) ? path.join(gitRoot, 'bin', 'bash.exe') : null;
test('in Git Bash the op git is the guard again, and ln / mklink / New-Item links are refused before they run', { skip: gitBash ? false : 'needs Git for Windows bin/bash.exe' }, (t) => {
  const repo = initRepo(t);
  const bin = tempDir(t, 'guard-wt-bin-');
  const built = ensureGuardBin({ skillRoot: ROOT, binDir: bin });
  assert.equal(built.ok, true, JSON.stringify(built));
  const file = writeJobGuard({ skillRoot: bin, jobId: 'op-git-bash', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src')] });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STARCI_GUARD_FILE: file, STARCI_GUARD_BIN: bin, BASH_ENV: path.join(bin, BASH_ENV_FILE).replace(/\\/g, '/') };
  const bash = (script) => spawnSync(gitBash, ['-c', script], { cwd: repo, encoding: 'utf8', env });
  // Without BASH_ENV, Git Bash's own git comes first: the bypass of inc-c8fbf76aa499.
  const bare = spawnSync(gitBash, ['-c', 'command -v git'], { cwd: repo, encoding: 'utf8', env: { ...env, BASH_ENV: '' } });
  assert.match(bare.stdout.trim(), /\/mingw64\/bin\/git$/);
  assert.equal(bash('command -v git').stdout.trim(), `${msysPath(bin)}/git`, 'the guard is first on PATH again');
  const login = spawnSync(gitBash, ['-l', '-c', 'command -v git'], { cwd: repo, encoding: 'utf8', env });
  assert.equal(login.stdout.trim(), `${msysPath(bin)}/git`, 'a login shell too');
  const add = bash(`git worktree add --detach '${msysPath(path.join(path.dirname(repo), 'never-made'))}' HEAD`);
  assert.equal(add.status, 3, add.stderr);
  assert.match(add.stderr, /starci guard: refused `git worktree add .*\[WORKTREE_NOT_OPS\]/);
  const nowhere = path.join(bin, 'no-such-dir');
  const script = path.join(bin, 'junctions.ps1');
  fs.writeFileSync(script, `New-Item -ItemType Junction -Path '${path.join(nowhere, 'a')}' -Target '${path.join(nowhere, 'b')}'\n`);
  for (const [command, tool] of [
    [`ln -s '${msysPath(path.join(nowhere, 'b'))}' '${msysPath(path.join(nowhere, 'a'))}'`, 'ln'],
    [`cmd //c mklink /J "${path.join(nowhere, 'a')}" "${path.join(nowhere, 'b')}"`, 'cmd'],
    [`powershell -NoProfile -Command "New-Item -ItemType Junction -Path '${path.join(nowhere, 'a')}' -Target '${path.join(nowhere, 'b')}'"`, 'powershell'],
    [`powershell -NoProfile -ExecutionPolicy Bypass -File '${script}'`, 'powershell'],
    [`powershell.exe -NoProfile -Command "ni -ItemType SymbolicLink -Path x -Value y"`, 'powershell.exe'],
  ]) {
    const refused = bash(command);
    assert.equal(refused.status, 3, `${command}: ${refused.stderr}`);
    assert.match(refused.stderr, new RegExp(`starci guard: refused \`${tool.replace('.', '\\.')} .*\\[LINK_CREATE\\]`));
  }
  assert.equal(fs.existsSync(nowhere), false, 'nothing was made');
  assert.equal(bash('powershell -NoProfile -Command "Write-Output guarded-ok"').stdout.trim(), 'guarded-ok', 'an ordinary PowerShell command passes');
  assert.equal(bash('git rev-parse --abbrev-ref HEAD').stdout.trim(), 'main', 'ordinary git passes through the guard');
  assert.deepEqual(linksUnder(bin), []);
  assert.deepEqual(linksUnder(repo), []);
});

test('the footprint watch flags a new worktree or cross-repository link under the root, never a workspace link', (t) => {
  const root = tempDir(t, 'footprint-root-');
  for (const name of ['nivo-fe', 'nivo-fe-wt-r4', 'other']) fs.mkdirSync(path.join(root, name, '.git'), { recursive: true });
  const at = (...parts) => path.join(root, ...parts);
  let links = [{ link: at('nivo-fe', 'node_modules', '@nivo', 'ui'), target: null, real: at('nivo-fe', 'packages', 'ui'), mtime: 'x' }];
  let trees = '';
  const git = (cwd) => ({ status: 0, stdout: path.basename(cwd) === 'nivo-fe' ? `worktree ${at('nivo-fe')}\nHEAD 1\n\n${trees}` : `worktree ${cwd}\n` });
  const listLinks = () => links;
  const first = scanFootprint({ root, state: null, git, listLinks, now: 't0' });
  assert.deepEqual([first.links, first.worktrees, first.fresh], [[], [], []], 'a workspace link inside its own repository is not a footprint');
  links = [...links, { link: at('nivo-fe-wt-r4', 'node_modules'), target: null, real: at('nivo-fe', 'node_modules'), mtime: 'y' },
    { link: at('other', 'bin'), target: 'E:\\elsewhere\\bin', real: 'E:\\elsewhere\\bin', mtime: 'z' }];
  trees = `worktree ${at('nivo-fe-wt-r4')}\nHEAD 2\ndetached\n\nworktree ${path.join(os.tmpdir(), 'kernel-scratch')}\nHEAD 3\n`;
  const second = scanFootprint({ root, state: first.state, git, listLinks, now: 't1' });
  assert.deepEqual(second.fresh.map((entry) => [entry.type, entry.link ?? entry.worktree]), [['link', at('nivo-fe-wt-r4', 'node_modules')], ['worktree', at('nivo-fe-wt-r4')]],
    'the junction into another repository and the worktree beside it are fresh; a link out of the root and kernel scratch outside it are not');
  const third = scanFootprint({ root, state: second.state, git, listLinks, now: 't2' });
  assert.deepEqual(third.fresh, [], 'a footprint is flagged once');
  assert.equal(third.state.seen[`link:${process.platform === 'win32' ? at('nivo-fe-wt-r4', 'node_modules').toLowerCase() : at('nivo-fe-wt-r4', 'node_modules')}`], 't1');
  // The state holds what the last scan saw: a footprint removed is dropped, and one made again later is fresh again.
  const saved = links;
  links = links.filter((entry) => !entry.link.includes('nivo-fe-wt-r4'));
  const gone = scanFootprint({ root, state: third.state, git, listLinks, now: 't3' });
  assert.equal(Object.keys(gone.state.seen).some((key) => key.startsWith('link:') && key.includes('nivo-fe-wt-r4')), false, 'a removed link leaves the state');
  links = saved;
  const back = scanFootprint({ root, state: gone.state, git, listLinks, now: 't4' });
  assert.deepEqual(back.fresh.map((entry) => entry.type), ['link'], 'made again: fresh again');
});

test('the watchdog starts a detached footprint scan at most once per period, host-wide', (t) => {
  const skillRoot = tempDir(t, 'footprint-skill-');
  const started = [];
  const start = () => started.push(1);
  assert.deepEqual(footprintTick({ skillRoot, now: 1_000_000, every: 600_000, start }), { started: true });
  assert.deepEqual(footprintTick({ skillRoot, now: Date.now(), every: 600_000, start }), { started: false }, 'claimed: another watchdog does not start a second scan');
  fs.mkdirSync(path.join(skillRoot, 'runtime', 'guards'), { recursive: true });
  fs.writeFileSync(path.join(skillRoot, 'runtime', 'guards', 'footprint.json'), JSON.stringify({ lastScanAt: new Date(Date.now() - 3_600_000).toISOString() }));
  fs.utimesSync(path.join(skillRoot, 'runtime', 'guards', 'footprint.claim'), new Date(Date.now() - 3_600_000), new Date(Date.now() - 3_600_000));
  assert.deepEqual(footprintTick({ skillRoot, every: 600_000, start }), { started: true }, 'due again after the period');
  assert.equal(started.length, 2);
  // Another watchdog is claiming this very moment (its lock is held): this tick leaves the slot to it.
  const guards = path.join(skillRoot, 'runtime', 'guards');
  fs.utimesSync(path.join(guards, 'footprint.claim'), new Date(Date.now() - 3_600_000), new Date(Date.now() - 3_600_000));
  fs.writeFileSync(path.join(guards, 'footprint.claim.lock'), '999');
  assert.deepEqual(footprintTick({ skillRoot, every: 600_000, start }), { started: false }, 'a held claim lock: no second scan');
  fs.utimesSync(path.join(guards, 'footprint.claim.lock'), new Date(Date.now() - 120_000), new Date(Date.now() - 120_000));
  assert.deepEqual(footprintTick({ skillRoot, every: 600_000, start }), { started: false }, 'a crashed tick\'s lock is cleared...');
  assert.deepEqual(footprintTick({ skillRoot, every: 600_000, start }), { started: true }, '...and the next tick claims the slot');
  assert.equal(started.length, 3);
});
