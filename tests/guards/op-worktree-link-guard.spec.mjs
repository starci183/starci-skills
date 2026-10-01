import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyGit } from '../../scripts/guards/git-policy.mjs';
import { bindGuardTerminal, ensureHistoryHook, writeJobGuard } from '../../scripts/guards/hook-install.mjs';
import { scanFootprint } from '../../scripts/guards/footprint-scan.mjs';
import { linksUnder, safeRemoveTree } from '../../scripts/api/fs/safe-remove.mjs';
import { guardsRoot } from '../../scripts/guards/guards-root.mjs';

// nivo-fe inc-c8fbf76aa499 (2026-09-25 05:47): Devin op worker op-interface.implement-2a43f63c6c ran, through Git Bash,
// `git worktree add --detach D:/Repositories/nivo-fe-wt-r4`, junctioned six node_modules of live nivo-fe into it
// (New-Item -ItemType Junction from a -File script, after `cmd //c mklink /J` failed on quoting), and removed it with
// `git worktree remove --force`, which followed the junctions and deleted 674 live files. A guard on the worker's PATH
// never saw it: Git Bash puts /mingw64/bin first. The guard now sees the agent's command itself (a PreToolUse hook)
// and the history hook backs it for any git binary. This spec proves every layer WITHOUT creating a link:
// each link command aims at a directory that does not exist, so even an unguarded run could not make one.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
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
  const handle = `term_spec-any-git-${process.pid}`;
  const bound = bindGuardTerminal({ skillRoot: ROOT, handle, jobFile: file });
  t.after(() => fs.rmSync(bound, { force: true }));
  const op = { ORCA_TERMINAL_HANDLE: handle };
  const beside = path.join(path.dirname(repo), `${path.basename(repo)}-wt-r4`);
  t.after(() => safeRemoveTree(beside));
  // `git` here is the real binary, run by nothing that checks it first: exactly the Git Bash case.
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
  const owner = sh(repo, ['worktree', 'add', '--detach', beside, 'HEAD'], { ORCA_TERMINAL_HANDLE: '' });
  assert.equal(owner.status, 0, owner.stderr);
  assert.deepEqual(linksUnder(beside), [], 'a plain worktree, no link');
});

// A worker-start agent runs with Orca's environment: the dispatch binds its guard to the Orca terminal
// (<guards root>/terminals/<handle>.json) and the hook finds it by ORCA_TERMINAL_HANDLE.
test('the history hook applies an op\'s rules to a managed agent found by its bound Orca terminal', (t) => {
  const repo = initRepo(t);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const jobFile = writeJobGuard({ skillRoot: tempDir(t, 'guard-managed-skill-'), jobId: 'op-docs.author-managed', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src')] });
  const handle = 'term_spec:managed-' + process.pid;
  const bound = bindGuardTerminal({ skillRoot: ROOT, handle, jobFile });
  t.after(() => fs.rmSync(bound, { force: true }));
  assert.equal(path.basename(bound), 'term_spec_managed-' + process.pid + '.json');
  assert.equal(JSON.parse(fs.readFileSync(bound, 'utf8')).jobId, 'op-docs.author-managed');
  const managed = { ORCA_TERMINAL_HANDLE: handle };
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
  const kernel = sh(repo, ['commit', '-q', '-m', 'kernel', '--', 'peer'], { ORCA_TERMINAL_HANDLE: 'term_kernel' });
  assert.equal(kernel.status, 0, kernel.stderr);
});

// The command guard runs the way an agent's host runs it: a PreToolUse hook process, the tool input on stdin, the
// agent's Orca terminal in ORCA_TERMINAL_HANDLE. Exit 2 blocks the command before it runs (Claude Code, Codex, Devin).
const HOOK = path.join(ROOT, 'scripts', 'guards', 'command-guard.mjs');
const hook = (input, handle) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ORCA_TERMINAL_HANDLE: handle } });

test('the command guard hook refuses the incident\'s worktree and link commands before they run, and passes ordinary ones', (t) => {
  const repo = initRepo(t);
  const scratch = tempDir(t, 'guard-hook-');
  const jobFile = writeJobGuard({ skillRoot: scratch, jobId: 'op-interface.implement-2a43f63c6c', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src')] });
  const handle = `term_spec-link-hook-${process.pid}`;
  const bound = bindGuardTerminal({ skillRoot: ROOT, handle, jobFile });
  t.after(() => fs.rmSync(bound, { force: true }));
  const nowhere = path.join(scratch, 'no-such-dir');
  const script = path.join(scratch, 'junctions.ps1');
  fs.writeFileSync(script, `New-Item -ItemType Junction -Path '${path.join(nowhere, 'a')}' -Target '${path.join(nowhere, 'b')}'\n`);
  const refusedCases = [
    ['Bash', `git worktree add --detach '${path.join(path.dirname(repo), 'never-made').replace(/\\/g, '/')}' HEAD`, 'WORKTREE_NOT_OPS'],
    ['Bash', `ln -s '${path.join(nowhere, 'b')}' '${path.join(nowhere, 'a')}'`, 'LINK_CREATE'],
    ['Bash', `cmd //c mklink /J "${path.join(nowhere, 'a')}" "${path.join(nowhere, 'b')}"`, 'LINK_CREATE'],
    ['Bash', `powershell -NoProfile -Command "New-Item -ItemType Junction -Path '${path.join(nowhere, 'a')}' -Target '${path.join(nowhere, 'b')}'"`, 'LINK_CREATE'],
    ['Bash', `powershell -NoProfile -ExecutionPolicy Bypass -File '${script}'`, 'LINK_CREATE'],
    ['Bash', 'powershell.exe -NoProfile -Command "ni -ItemType SymbolicLink -Path x -Value y"', 'LINK_CREATE'],
    ['PowerShell', `New-Item -Path '${path.join(nowhere, 'a')}' -ItemType Junction -Target '${path.join(nowhere, 'b')}'`, 'LINK_CREATE'],
    ['PowerShell', `[System.IO.Directory]::CreateSymbolicLink('${path.join(nowhere, 'a')}', '${path.join(nowhere, 'b')}')`, 'LINK_CREATE'],
    ['Bash', 'git reset --hard HEAD~1', 'HISTORY_REWRITE'],
  ];
  for (const [tool, command, code] of refusedCases) {
    const r = hook({ tool_name: tool, tool_input: { command }, cwd: repo }, handle);
    assert.equal(r.status, 2, `${command}: ${r.stderr}`);
    assert.match(r.stderr, new RegExp(`starci guard: refused .*\\[${code}\\]`), command);
  }
  // Devin's exec tool carries its own workdir.
  assert.equal(hook({ tool_name: 'exec', tool_input: { command: 'git clean -fd', workdir: repo }, cwd: scratch }, handle).status, 2);
  assert.equal(fs.existsSync(nowhere), false, 'nothing was made');
  for (const [tool, command] of [['Bash', 'git status --short'], ['Bash', 'echo "never ln -s or git reset --hard"'], ['PowerShell', 'Write-Output guarded-ok'],
    ['PowerShell', `New-Item -ItemType Directory -Path '${path.join(scratch, 'plain')}'`], ['Bash', 'grep -rn mklink docs'], ['Bash', 'git commit -q -m "a; b" -- src/a.txt']]) {
    const r = hook({ tool_name: tool, tool_input: { command }, cwd: repo }, handle);
    assert.equal(r.status, 0, `${command}: ${r.stderr}`);
  }
  // A terminal with no guard bound (the Kernel, the owner) is never refused; neither is a tool that runs no command.
  assert.equal(hook({ tool_name: 'Bash', tool_input: { command: 'git reset --hard HEAD~1' }, cwd: repo }, 'term_kernel-unbound').status, 0);
  assert.equal(hook({ tool_name: 'Read', tool_input: { file_path: 'x' }, cwd: repo }, handle).status, 0);
  const logged = fs.readFileSync(path.join(guardsRoot(ROOT), 'refusals.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l)).filter((e) => e.jobId === 'op-interface.implement-2a43f63c6c' && e.via === 'pre-tool-use');
  assert.ok(logged.some((e) => e.code === 'LINK_CREATE') && logged.some((e) => e.code === 'WORKTREE_NOT_OPS'), 'every refusal is logged');
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
