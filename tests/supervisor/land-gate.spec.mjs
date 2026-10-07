// land-gate.spec.mjs — the runtime children a seat terminal spawns run without the seat's Orca identity
// (scripts/lib/seat-env.mjs withoutSeatEnv): a caller/guard bound to that identity would admit them as the seat —
// a spec's `cli.mjs` child resolved the seat's custody (kernel-caller-unknown), a staging `npm ci`'s `node install.js`
// postinstall read as a raw supervisor tool call (RIGHTS_RAW_TOOL) once the spawn loop's worker-start had put the PATH
// shim first — so a spec's result depended on which terminal ran it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { specRunEnv, packageProofCheck, PACKAGE_PROOF } from '../../scripts/supervisor/land.mjs';
import { createStaging } from '../../scripts/supervisor/workers.mjs';
import { ci } from '../../scripts/api/npm/ci.mjs';
import { SEAT_ENV_VARS, withoutSeatEnv } from '../../scripts/lib/seat-env.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

const SEATED = { ORCA_TERMINAL_HANDLE: 'term_seat', ORCA_PANE_KEY: 'pane-1', ORCA_TAB_ID: 'tab-1', ORCA_WORKTREE_ID: 'wt-1', ORCA_AGENT_HOOK_TOKEN: 'tok', ORCA_AGENT_HOOK_PORT: '1', STARCI_ROLE: 'supervisor', STARCI_GUARD_FILE: 'g.json', STARCI_CALLER: 'runtime-settler' };
const seatKeys = (env) => Object.keys(env).filter((k) => SEAT_ENV_VARS.includes(k) || k.startsWith('ORCA_AGENT_'));
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

test('withoutSeatEnv takes the env as a parameter: no process.env default (RT_BASE_IMPURE)', () => {
  assert.deepEqual(withoutSeatEnv(), {});
  assert.deepEqual(withoutSeatEnv({ ...SEATED, PATH: '/bin', GIT_AUTHOR_NAME: 'kept' }), { PATH: '/bin', GIT_AUTHOR_NAME: 'kept' });
});

test('the gate spec env carries none of the seat identity when the parent exports it', () => {
  const env = specRunEnv({ PATH: '/bin', NODE_TEST_CONTEXT: 'child', GIT_DIR: '/leaked', GIT_AUTHOR_NAME: 'kept', ...SEATED });
  assert.deepEqual(seatKeys(env), []);
  assert.equal(env.PATH, '/bin');
  assert.equal(env.GIT_AUTHOR_NAME, 'kept');
  assert.equal(env.GIT_DIR, undefined, 'repository-local git vars stay dropped');
  assert.equal(env.NODE_TEST_CONTEXT, undefined);
});

test('the package proof child gets the spec env: no seat identity reaches it', (t) => {
  for (const [key, value] of Object.entries(SEATED)) process.env[key] = value;
  t.after(() => { for (const key of Object.keys(SEATED)) delete process.env[key]; });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-proof-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const script = path.join(dir, PACKAGE_PROOF);
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, '// proof\n');
  let seen;
  const out = packageProofCheck({ dir, base: 'b'.repeat(40), runner: (args, opts) => { seen = opts.env; return { ok: true, status: 0, stdout: '', stderr: '' }; } });
  assert.equal(out.ok, true);
  assert.deepEqual(seatKeys(seen), []);
});

test('both stagings of one spawn install with the seat identity scrubbed from the shared env', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-seat-stage-')));
  t.after(() => { spawnSync('git', ['-C', path.join(base, 'rt'), 'worktree', 'prune'], { windowsHide: true }); fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const root = path.join(base, 'rt');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'spec@starci.test');
  git(root, 'config', 'user.name', 'spec');
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'lock');
  // One env object serves the whole spawn pass, like spawnWorkers' pass.env — the seat identity rides it.
  const env = { ...process.env, ...SEATED, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite'), STARCI_LOCAL_ROOT: path.join(base, 'la') };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  const installs = [];
  const install = (dir, opts) => { installs.push({ dir: path.resolve(dir), env: opts?.env }); return { ok: true, status: 0, stderr: '' }; };
  const first = createStaging({ jobId: 'fix-seat-1', root, env, orca, install });
  const second = createStaging({ jobId: 'fix-seat-2', root, env, orca, install });
  assert.ok(first.ok && second.ok, first.error ?? second.error);
  assert.equal(installs.length, 2, 'both stagings install');
  for (const { env: installed } of installs) {
    assert.ok(installed && typeof installed === 'object', 'the staging install names the env it runs with');
    assert.deepEqual(seatKeys(installed), [], 'the install env has no seat identity');
  }
});

test('npm ci runs its lifecycle scripts without the seat identity (a `node postinstall.js` binds no role)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-seat-ci-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'seat-env-ci', version: '1.0.0', scripts: { postinstall: 'node postinstall.js' } }));
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ name: 'seat-env-ci', version: '1.0.0', lockfileVersion: 3, requires: true, packages: { '': { name: 'seat-env-ci', version: '1.0.0' } } }));
  fs.writeFileSync(path.join(dir, 'postinstall.js'), `require('fs').writeFileSync('installed-env.json', JSON.stringify(process.env));\n`);
  const r = ci(dir, { env: { ...process.env, ...SEATED } });
  assert.ok(r.ok, r.stderr);
  const seen = JSON.parse(fs.readFileSync(path.join(dir, 'installed-env.json'), 'utf8'));
  assert.deepEqual(seatKeys(seen), []);
});
