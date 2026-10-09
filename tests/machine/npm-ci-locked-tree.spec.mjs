// The install of a workflow tree does not collide with itself: a tree that is already a finished install is not installed again,
// a stand-in installer that fails EPERM yields a typed file-locked failure naming the path and the holders, and a stopped
// install never reads as done (scripts/machine/npm-ci.mjs, npm-install-state.mjs, npm-install-failure.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { installFailureOf, insideTree, treeHolders } from '../../scripts/machine/npm-install-failure.mjs';
import { npmCi } from '../../scripts/machine/npm-ci.mjs';
import { installStateOf } from '../../scripts/machine/npm-install-state.mjs';
import { installWorkflowTree } from '../../scripts/kernel/workflow-startup.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const EPERM = (file) => ['npm error code EPERM', 'npm error syscall unlink', `npm error path ${file}`, 'npm error errno -4048',
  'npm error [Error: EPERM: operation not permitted, unlink]'].join('\n');

function tree(t) {
  const cwd = mkdtemp(t, 'starci-npm-ci-locked-');
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"fixture"}\n');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}\n');
  return cwd;
}

// A stand-in npm: counts its runs, wipes node_modules like npm ci and installs it again, or stops half way with EPERM.
function standIn(cwd, { fail = null } = {}) {
  const runs = { count: 0 };
  const ci = async () => {
    runs.count += 1;
    await new Promise((resolve) => setImmediate(resolve));
    fs.rmSync(path.join(cwd, 'node_modules'), { recursive: true, force: true });
    fs.mkdirSync(path.join(cwd, 'node_modules', 'next'), { recursive: true });
    if (fail) return { ok: false, status: 1, stderr: fail };
    fs.mkdirSync(path.join(cwd, 'node_modules', 'react'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'node_modules', '.package-lock.json'), '{}');
    return { ok: true, status: 0, stderr: '' };
  };
  return { runs, ci };
}

// The host lock, serial: one install of the runtime at a time.
const serial = () => {
  let tail = Promise.resolve();
  return (_options, fn) => {
    const run = tail.then(fn);
    tail = run.catch(() => {});
    return run.then((value) => ({ ok: true, locked: true, value }));
  };
};
const ctx = (cwd, extra = {}) => ({ cwd, role: 'owner', args: {}, ...extra });
const deps = (installer, extra = {}) => ({ underHostLock: serial(), status: () => ({ ok: true, stdout: '' }), ci: installer.ci, holders: () => null, ...extra });

test('a stand-in installer that fails EPERM gives a typed file-locked failure naming the path and the holders', async (t) => {
  const cwd = tree(t);
  const locked = path.join(cwd, 'node_modules', '@parcel', 'watcher-win32-x64', 'watcher.node');
  const installer = standIn(cwd, { fail: EPERM(locked) });
  const holders = [{ pid: 4242, name: 'node.exe', commandLine: `node ${cwd}/node_modules/next/dist/bin/next dev` }];
  const result = await npmCi(ctx(cwd), deps(installer, { holders: () => holders }));
  assert.equal(result.code, 1);
  assert.equal(result.data.cause, 'file-locked');
  assert.equal(result.data.code, 'EPERM');
  assert.equal(result.data.syscall, 'unlink');
  assert.equal(result.data.path, locked);
  assert.deepEqual(result.data.holders, holders);
  assert.match(result.text, /file-locked \(EPERM unlink .*watcher\.node\); a running process holds a file of this tree/);
});

test('a stopped install leaves a tree that reads as incomplete, never installed, and the next start-up install runs again', async (t) => {
  const cwd = tree(t);
  const failing = standIn(cwd, { fail: EPERM(path.join(cwd, 'node_modules', 'x.node')) });
  await npmCi(ctx(cwd, { ifNeeded: true }), deps(failing));
  assert.equal(fs.existsSync(path.join(cwd, 'node_modules', 'next')), true, 'the half tree is on disk');
  assert.equal(installStateOf(cwd).state, 'incomplete');
  const healthy = standIn(cwd);
  const done = await npmCi(ctx(cwd, { ifNeeded: true }), deps(healthy));
  assert.equal(done.code, 0);
  assert.equal(healthy.runs.count, 1);
  assert.equal(installStateOf(cwd).state, 'installed');
});

test('a finished install is not installed again by a start-up install, but an explicit npm ci still runs', async (t) => {
  const cwd = tree(t);
  const installer = standIn(cwd);
  await npmCi(ctx(cwd, { ifNeeded: true }), deps(installer));
  const again = await npmCi(ctx(cwd, { ifNeeded: true }), deps(installer));
  assert.equal(installer.runs.count, 1);
  assert.equal(again.code, 0);
  assert.equal(again.data.skipped, 'installed');
  await npmCi(ctx(cwd), deps(installer));
  assert.equal(installer.runs.count, 2, 'the explicit npm ci of the owner is a real install');
});

test('a changed lockfile is installed again', async (t) => {
  const cwd = tree(t);
  const installer = standIn(cwd);
  await npmCi(ctx(cwd, { ifNeeded: true }), deps(installer));
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"node_modules/x":{}}}\n');
  await npmCi(ctx(cwd, { ifNeeded: true }), deps(installer));
  assert.equal(installer.runs.count, 2);
});

test('two installs of one tree at the same time run npm once', async (t) => {
  const cwd = tree(t);
  const installer = standIn(cwd);
  const shared = deps(installer);
  const [first, second] = await Promise.all([npmCi(ctx(cwd, { ifNeeded: true }), shared), npmCi(ctx(cwd, { ifNeeded: true }), shared)]);
  assert.equal(installer.runs.count, 1);
  assert.deepEqual([first.code, second.code], [0, 0]);
});

test('a workspace install is partial: it neither skips nor marks the tree installed', async (t) => {
  const cwd = tree(t);
  const installer = standIn(cwd);
  await npmCi(ctx(cwd, { ifNeeded: true, args: { workspace: ['a'] } }), deps(installer));
  assert.equal(installStateOf(cwd).state, 'incomplete');
});

test('the workflow install types a locked tree and a plain failure apart', async () => {
  const record = { path: '/owned/workflow' };
  const lockedReceipt = { ok: false, cause: 'file-locked', code: 'EPERM', path: '/owned/workflow/node_modules/a.node' };
  const locked = await installWorkflowTree({ record }, { npmCi: async () => ({ code: 1, text: 'failed: file-locked', data: lockedReceipt }) });
  assert.equal(locked.reason, 'workflow-worktree-install-locked');
  assert.equal(locked.receipt.path, lockedReceipt.path);
  const plain = await installWorkflowTree({ record }, { npmCi: async () => ({ code: 1, text: 'registry unavailable', data: { ok: false, cause: 'other' } }) });
  assert.equal(plain.reason, 'workflow-worktree-install-failed');
});

test('the stderr of npm is read for its code, syscall and path, and only a lock code is a file lock', () => {
  const file = path.join(os.tmpdir(), 'starci-wf', 'node_modules', 'a.node');
  const read = installFailureOf(EPERM(file));
  assert.deepEqual(read, { cause: 'file-locked', code: 'EPERM', syscall: 'unlink', path: file });
  assert.equal(installFailureOf('npm error code E404\nnpm error 404 Not Found').cause, 'other');
  assert.equal(installFailureOf('').cause, 'other');
});

test('the holders of a tree are the processes whose command line is inside it, on either slash style', () => {
  const tree = path.resolve('/orca/wf-1');
  const forward = tree.split(path.sep).join('/');
  const rows = [
    { pid: 10, name: 'node.exe', cmd: `${tree}${path.sep}node_modules${path.sep}next dev` },
    { pid: 11, name: 'node.exe', cmd: `node "${forward}/server.js"` },
    { pid: 12, name: 'node.exe', cmd: `node ${forward}0/server.js` },
    { pid: 13, name: 'node.exe', cmd: 'node unrelated.js' },
    { pid: 99, name: 'node.exe', cmd: `node ${forward}/self.js` },
  ];
  const holders = treeHolders(tree, { list: () => rows, env: {}, self: 99 });
  assert.deepEqual(holders.map((p) => p.pid), [10, 11]);
  assert.equal(treeHolders(tree, { list: () => null, env: {} }), null, 'an unreadable table is null, not no holders');
  assert.equal(insideTree(`node ${forward}/a.js`, tree), true);
});

// A tree whose node_modules holds the lockfile's install but carries no completion marker (built by an older runtime) is marked, not wiped.
function unmarkedInstall(t, installed) {
  const cwd = mkdtemp(t, 'starci-npm-ci-adopt-');
  const lock = { lockfileVersion: 3, packages: { '': {}, 'node_modules/a': { version: '1.0.0' } } };
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"fixture"}\n');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), JSON.stringify(lock));
  fs.mkdirSync(path.join(cwd, 'node_modules', 'a'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'node_modules', '.package-lock.json'), JSON.stringify({ packages: { 'node_modules/a': { version: installed } } }));
  return cwd;
}

test('a tree that holds the lockfile install without a marker is marked finished and npm ci never runs', async (t) => {
  const cwd = unmarkedInstall(t, '1.0.0');
  assert.equal(installStateOf(cwd).state, 'incomplete');
  const installer = standIn(cwd);
  const result = await npmCi(ctx(cwd, { ifNeeded: true }), deps(installer));
  assert.equal(result.code, 0);
  assert.equal(result.data.skipped, 'adopted');
  assert.equal(installer.runs.count, 0, 'no wipe of node_modules, so no loaded native file can fail it');
  assert.equal(installStateOf(cwd).state, 'installed');
});

test('a tree whose install differs from the lockfile is a real npm ci, and an explicit npm ci never adopts', async (t) => {
  const drifted = unmarkedInstall(t, '0.9.0');
  const installer = standIn(drifted);
  await npmCi(ctx(drifted, { ifNeeded: true }), deps(installer));
  assert.equal(installer.runs.count, 1);
  const whole = unmarkedInstall(t, '1.0.0');
  const explicit = standIn(whole);
  await npmCi(ctx(whole), deps(explicit));
  assert.equal(explicit.runs.count, 1);
});
