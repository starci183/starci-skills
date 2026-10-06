import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { LOCAL_ROOT_ENV, RUNTIME_STATE_DIR, runtimeStateDir, skillRoot, starciLocalRoot } from '../../engine/runtime-root.mjs';
import { ARTIFACT_ROOT_ENV, artifactRoot, ensureExternalRoot } from '../../engine/db/blob.mjs';
import { machineFileFor, projectLedgerFile, starciLocalRoot as machineStarciLocalRoot } from '../../engine/db/machine.mjs';
import { projectsRootFor } from '../../engine/db/ledger-paths.mjs';
import { lanesRoot } from '../../scripts/machine/home.mjs';

const temp = (t, prefix = 'starci-state-root-') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const git = (cwd, ...args) => assert.equal(spawnSync('git', args, { cwd, encoding: 'utf8' }).status, 0, `git ${args.join(' ')}`);

test('with no environment every host-state location derives from <runtime root>/.runtime', () => {
  const base = path.join(skillRoot, RUNTIME_STATE_DIR);
  assert.equal(starciLocalRoot({}), base);
  assert.equal(machineStarciLocalRoot({}), base);
  assert.equal(machineFileFor({}), path.join(base, 'machine.sqlite'));
  assert.equal(projectsRootFor({}), path.join(base, 'projects'));
  assert.equal(projectLedgerFile('12345678-aaaa', {}), path.join(base, 'projects', '12345678-aaaa', 'runtime.sqlite'));
  assert.equal(artifactRoot({}), path.join(base, 'artifacts'));
});

test('a fake host .claude keeps its state at <root>/.runtime', t => {
  const root = path.join(temp(t), 'host', '.claude');
  assert.equal(runtimeStateDir(root), path.join(root, '.runtime'));
  assert.equal(starciLocalRoot({}, root), path.join(root, '.runtime'));
});

test('an installed host keeps its state at <app>/.claude/.runtime, ignored by the app repository', t => {
  const app = temp(t);
  const state = path.join(app, '.claude', '.runtime');
  assert.equal(runtimeStateDir(path.join(app, '.claude')), state);
  fs.mkdirSync(path.join(app, '.git'));
  assert.throws(() => ensureExternalRoot(path.join(state, 'artifacts'), state), /not git-ignored/);
  fs.writeFileSync(path.join(app, '.gitignore'), ['.claude/config.yaml', '.claude/.runtime/', ''].join(os.EOL));
  assert.doesNotThrow(() => ensureExternalRoot(path.join(state, 'artifacts'), state));
});

test('an unset artifact root in a spec run is redirected to the OS temp directory, an explicit one is kept', () => {
  assert.equal(artifactRoot({ NODE_TEST_CONTEXT: 'child-v8' }), path.join(os.tmpdir(), 'starci-test-artifacts'));
  assert.equal(artifactRoot({ NODE_TEST_CONTEXT: 'child-v8', [LOCAL_ROOT_ENV]: path.join(os.tmpdir(), 'lr') }), path.join(os.tmpdir(), 'lr', 'artifacts'));
  assert.equal(artifactRoot({ NODE_TEST_CONTEXT: 'child-v8', [ARTIFACT_ROOT_ENV]: path.join(os.tmpdir(), 'ar') }), path.join(os.tmpdir(), 'ar'));
});

test('environment overrides keep their precedence over the .runtime default', t => {
  const dir = temp(t);
  const local = path.join(dir, 'local');
  const env = { [LOCAL_ROOT_ENV]: local };
  assert.equal(starciLocalRoot(env), local);
  assert.equal(machineFileFor(env), path.join(local, 'machine.sqlite'));
  assert.equal(projectsRootFor(env), path.join(local, 'projects'));
  assert.equal(artifactRoot(env), path.join(local, 'artifacts'));
  assert.equal(artifactRoot({ ...env, [ARTIFACT_ROOT_ENV]: path.join(dir, 'blobs') }), path.join(dir, 'blobs'));
  assert.equal(projectsRootFor({ ...env, STARCI_PROJECTS_ROOT: path.join(dir, 'p') }), path.join(dir, 'p'));
  assert.equal(machineFileFor({ ...env, STARCI_TEST_MACHINE_FILE: path.join(dir, 'm.sqlite') }), path.join(dir, 'm.sqlite'));
});

test('a spec run whose state base is not under the temp directory is still redirected to temp', () => {
  const env = { NODE_TEST_CONTEXT: 'child-v8' };
  assert.equal(machineFileFor(env), path.join(os.tmpdir(), 'starci-test-registry', 'machine.sqlite'));
  assert.equal(projectsRootFor(env), path.join(os.tmpdir(), 'starci-test-projects'));
});

test('lane worktrees stay out of the checkout .runtime by default', t => {
  const dir = temp(t);
  const lanes = lanesRoot({ env: { LOCALAPPDATA: dir }, config: null });
  assert.equal(lanes, path.join(dir, 'StarCi', 'lanes'));
  assert.equal(lanes.startsWith(path.join(skillRoot, RUNTIME_STATE_DIR) + path.sep), false);
  assert.equal(lanesRoot({ env: { [LOCAL_ROOT_ENV]: dir }, config: null }), path.join(dir, 'lanes'));
  assert.equal(lanesRoot({ env: { STARCI_LANES_ROOT: path.join(dir, 'x'), LOCALAPPDATA: dir }, config: null }), path.join(dir, 'x'));
});

test('the blob writer accepts the git-ignored .runtime of the runtime root inside a checkout', t => {
  const repo = temp(t);
  git(repo, 'init', '-q', '.');
  fs.writeFileSync(path.join(repo, '.gitignore'), '/.runtime/\n');
  const state = path.join(repo, '.runtime');
  assert.doesNotThrow(() => ensureExternalRoot(path.join(state, 'artifacts'), state));
  assert.doesNotThrow(() => ensureExternalRoot(path.join(state, 'artifacts'), state), 'again');
});

test('the blob writer refuses a root in a checkout that is not git-ignored or not under .runtime (fail closed)', t => {
  const repo = temp(t);
  git(repo, 'init', '-q', '.');
  const state = path.join(repo, '.runtime');
  // under .runtime but .runtime is not ignored: a blob store could be committed
  assert.throws(() => ensureExternalRoot(path.join(state, 'artifacts'), state), /not git-ignored/);
  fs.writeFileSync(path.join(repo, '.gitignore'), '/.runtime/\n/scratch/\n');
  // ignored, but not the runtime's own .runtime directory
  assert.throws(() => ensureExternalRoot(path.join(repo, 'scratch', 'artifacts'), state), /inside a git checkout/);
  assert.throws(() => ensureExternalRoot(path.join(repo, 'artifacts'), state), /inside a git checkout/);
});

test('the ignore line may live in .gitignore or .git/info/exclude, and a worktree .git file counts as a checkout', t => {
  const repo = temp(t);
  const state = path.join(repo, '.runtime');
  fs.writeFileSync(path.join(repo, '.git'), 'gitdir: elsewhere');
  fs.writeFileSync(path.join(repo, '.gitignore'), ['/.runtime-other/', '.runtimes', ''].join(os.EOL));
  assert.throws(() => ensureExternalRoot(path.join(state, 'artifacts'), state), /not git-ignored/);
  fs.writeFileSync(path.join(repo, '.gitignore'), ['# host state', '.runtime/', ''].join(os.EOL));
  assert.doesNotThrow(() => ensureExternalRoot(path.join(state, 'artifacts'), state));
  fs.rmSync(path.join(repo, '.git'));
  fs.mkdirSync(path.join(repo, '.git', 'info'), { recursive: true });
  fs.rmSync(path.join(repo, '.gitignore'));
  assert.throws(() => ensureExternalRoot(path.join(state, 'artifacts'), state), /not git-ignored/);
  fs.writeFileSync(path.join(repo, '.git', 'info', 'exclude'), '/.runtime' + os.EOL);
  assert.doesNotThrow(() => ensureExternalRoot(path.join(state, 'artifacts'), state));
});

test('the last matching ignore rule wins: a later negation refuses, a later re-ignore accepts, CRLF files read the same', t => {
  const repo = temp(t);
  fs.mkdirSync(path.join(repo, '.git'));
  const state = path.join(repo, '.runtime');
  const root = path.join(state, 'artifacts');
  const write = (...lines) => fs.writeFileSync(path.join(repo, '.gitignore'), lines.join('\r\n') + '\r\n');
  write('/.runtime/');
  assert.doesNotThrow(() => ensureExternalRoot(root, state), 'CRLF');
  write('/.runtime/', '!/.runtime/');
  assert.throws(() => ensureExternalRoot(root, state), /not git-ignored/);
  write('/.runtime/', '!.runtime');
  assert.throws(() => ensureExternalRoot(root, state), /not git-ignored/);
  write('/.runtime/', '!/.runtime/', '.runtime/');
  assert.doesNotThrow(() => ensureExternalRoot(root, state));
  // .gitignore outranks .git/info/exclude
  fs.mkdirSync(path.join(repo, '.git', 'info'));
  fs.writeFileSync(path.join(repo, '.git', 'info', 'exclude'), '/.runtime/' + os.EOL);
  write('!/.runtime/');
  assert.throws(() => ensureExternalRoot(root, state), /not git-ignored/);
});
