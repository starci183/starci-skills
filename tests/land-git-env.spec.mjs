// land-git-env.spec.mjs — the land gate and the spec preload keep a leaked GIT_DIR away from the live repo.
//
// git exports GIT_DIR=<main>/.git/worktrees/<wt> to hooks and aliases run in a linked worktree; a spec process inheriting
// it made fixture gits write the LIVE .claude repo (core.bare=true, 2026-09-29 10:27:39Z). The gate's spec run and the
// shared preload (tests/setup/isolated-registry.mjs) drop git's repository-local variables, and fastForwardLive names a
// live repo left core.bare=true (reason live-repo-bare) instead of the generic live-path-status-failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fastForwardLive, specRunEnv, GIT_LOCAL_ENV_VARS } from '../scripts/supervisor/land.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEAKED = { GIT_DIR: 'C:/live/.git/worktrees/wt', GIT_WORK_TREE: 'C:/live', GIT_INDEX_FILE: 'C:/live/.git/index', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.bare', GIT_CONFIG_VALUE_0: 'true' };
const cleanEnv = () => { const env = { ...process.env }; for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k]; delete env.NODE_TEST_CONTEXT; return env; };
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, env: cleanEnv() });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

test('the gate spec env has no GIT_DIR (nor any repository-local git var) when the parent has one', () => {
  const env = specRunEnv({ PATH: '/bin', NODE_TEST_CONTEXT: 'child', GIT_AUTHOR_NAME: 'kept', ...LEAKED });
  for (const key of Object.keys(LEAKED)) assert.equal(env[key], undefined, key);
  assert.equal(env.NODE_TEST_CONTEXT, undefined);
  assert.equal(env.PATH, '/bin');
  assert.equal(env.GIT_AUTHOR_NAME, 'kept', 'identity vars are not repository-local');
  // The static list covers what this git calls repository-local.
  const local = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8', windowsHide: true, env: cleanEnv() }).stdout.split(/\s+/).filter(Boolean);
  for (const key of local) assert.ok(GIT_LOCAL_ENV_VARS.includes(key), `${key} missing from GIT_LOCAL_ENV_VARS`);
});

test('the shared spec preload drops a leaked GIT_DIR for every spec process', () => {
  const preload = pathToFileURL(path.join(ROOT, 'tests', 'setup', 'isolated-registry.mjs')).href;
  const r = spawnSync(process.execPath, ['--import', preload, '-e', `process.stdout.write(JSON.stringify(Object.keys(process.env).filter((k) => k.startsWith('GIT_'))))`],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, env: { ...cleanEnv(), ...LEAKED, GIT_AUTHOR_NAME: 'kept' } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ['GIT_AUTHOR_NAME']);
});

test('fastForwardLive refuses a live repo left core.bare=true with live-repo-bare and the fix', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'land-git-env-'));
  try {
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'core.bare', 'true');
    const out = fastForwardLive({ root, base: 'b'.repeat(40), head: 'h'.repeat(40), rows: [['M', 'a.txt']] });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'live-repo-bare');
    assert.match(out.detail, /config core\.bare false/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
