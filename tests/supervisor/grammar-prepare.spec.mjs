import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeStamp, sourceDigest } from '../../packages/grammar/scripts/build-stamp.mjs';
import { buildGrammar } from '../../scripts/gates/grammar-build.mjs';
import { grammarDistStatus } from '../../scripts/gates/grammar-dist.mjs';
import { hostLockOwner, withHostLock } from '../../scripts/machine/host-lock.mjs';
import { releaseSyncRuntime } from '../../scripts/supervisor/release-sync-runtime.mjs';
import { SRC_CSS } from '../fixtures/grammar-dist.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grammar-prepare-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packageRoot = path.join(root, 'packages', 'grammar');
  const write = (relative, body) => {
    const target = path.join(packageRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  };
  write('package.json', '{"name":"@starci/grammar","version":"0.5.0","type":"module"}\n');
  write('src/core/styles.css', SRC_CSS);
  write('src/core/index.ts', 'export const family = "core"\n');
  write('tsconfig.build.json', '{"compilerOptions":{"outDir":"dist","rootDir":"src"}}\n');
  write('scripts/copy-css.mjs', '// fixture build input\n');
  // Only the injected npm build seam writes this miniature fixture's generated output.
  const build = () => {
    write('dist/core/styles.css', fs.readFileSync(path.join(packageRoot, 'src/core/styles.css'), 'utf8'));
    write('dist/core/index.js', fs.readFileSync(path.join(packageRoot, 'src/core/index.ts'), 'utf8'));
    write('dist/core/index.d.ts', 'export declare const family: string\n');
    writeStamp(packageRoot);
  };
  return { root, packageRoot, write, build };
}

const fresh = () => ({ ok: true, state: 'fresh', knowledge: 'fresh', owed: [] });
const quietDeps = (overrides = {}) => ({ unlink: () => true, ci: () => ({ ok: true, status: 0 }),
  runNpm: () => ({ status: 0 }), grammarDistStatus: () => ({ ok: true, state: 'fresh' }),
  runNode: () => ({ status: 0 }), ...overrides });

test('grammar preparation uses the owned install/build APIs and verifies actual source-bound output', (t) => {
  const f = fixture(t);
  f.build();
  f.write('src/core/index.ts', 'export const family = "changed"\n');
  f.write('node_modules/owned-marker', 'real directory stays owned');
  assert.equal(grammarDistStatus(f.packageRoot).state, 'stale');
  const sourceBefore = sourceDigest(f.packageRoot);
  const calls = [];
  const env = { PREPARE_SPEC: 'fixture' };
  const result = buildGrammar({ root: f.root, env }, {
    ci: (cwd, options) => { calls.push('ci'); assert.equal(cwd, f.packageRoot); assert.ok(options.timeout > 0); return { ok: true, status: 0 }; },
    runNpm: (args, options) => {
      calls.push('build'); assert.deepEqual(args, ['run', 'build']); assert.equal(options.cwd, f.packageRoot); assert.equal(options.env, env);
      f.build(); return { status: 0 };
    },
    grammarDistStatus: (cwd) => { calls.push('freshness'); return grammarDistStatus(cwd); },
    runNode: (args, options) => {
      calls.push('knowledge'); assert.deepEqual(args, [path.join(f.root, 'scripts/work/ui/grammar-knowledge.mjs')]);
      assert.equal(options.cwd, f.root); assert.equal(options.env, env); return { status: 0 };
    },
  });
  assert.deepEqual(calls, ['ci', 'build', 'freshness', 'knowledge']);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'fresh');
  assert.equal(result.knowledge, 'fresh');
  assert.deepEqual(result.owed, []);
  assert.equal(result.dist.stamp.sourceDigest, sourceBefore);
  assert.equal(sourceDigest(f.packageRoot), sourceBefore, 'tracked build inputs are not rewritten');
  assert.equal(fs.readFileSync(path.join(f.packageRoot, 'node_modules/owned-marker'), 'utf8'), 'real directory stays owned');
});

test('grammar preparation stops at unsafe link removal, failed installs and failed builds', () => {
  for (const [step, overrides] of [
    ['npm ci', { unlink: () => false }],
    ['npm ci', { ci: () => ({ ok: false, status: 1, stderr: 'ETARGET unpublished candidate' }) }],
    ['npm run build', { runNpm: () => ({ status: null, error: new Error('build timeout') }) }],
  ]) {
    let knowledgeCalls = 0;
    const result = buildGrammar({ root: '/fixture' }, quietDeps({ runNode: () => { knowledgeCalls += 1; return { status: 0 }; }, ...overrides }));
    assert.equal(result.ok, false);
    assert.equal(result.step, step);
    assert.equal(knowledgeCalls, 0);
    assert.deepEqual(result.owed, ['grammar-dist-rebuild']);
    if (overrides.ci) assert.match(result.detail, /ETARGET unpublished candidate/);
    if (overrides.runNpm) assert.match(result.detail, /build timeout/);
  }
});

test('a successful npm exit cannot waive an unstamped, stale or tampered grammar dist', (t) => {
  const f = fixture(t);
  f.build();
  const stampPath = path.join(f.packageRoot, 'dist/.build-stamp.json');
  const stamp = fs.readFileSync(stampPath);
  const changes = [
    ['unstamped', () => fs.unlinkSync(stampPath)],
    ['stale', () => { fs.writeFileSync(stampPath, stamp); f.write('src/core/index.ts', 'export const family = "new"\n'); }],
    ['tampered', () => { f.build(); f.write('dist/core/index.js', 'export const family = "wrong"\n'); }],
  ];
  for (const [state, change] of changes) {
    change();
    const result = buildGrammar({ root: f.root }, quietDeps({ grammarDistStatus, runNode: () => { assert.fail('knowledge must wait for fresh output'); } }));
    assert.equal(result.ok, false);
    assert.equal(result.step, 'grammar-dist');
    assert.equal(result.dist.state, state);
  }
});

test('land may report owed knowledge after a fresh build, while explicit preparation refuses to copy', async () => {
  const result = buildGrammar({ root: '/fixture' }, quietDeps({ runNode: () => ({ status: 1, stderr: 'knowledge failed' }) }));
  assert.equal(result.ok, true, 'the completed grammar build remains reported for land');
  assert.equal(result.knowledge, 'owed');
  assert.deepEqual(result.owed, ['grammar-knowledge-snapshots']);
  const prepared = await releaseSyncRuntime({ args: { 'prepare-grammar': true }, role: 'owner' }, {
    buildGrammar: () => result, syncRuntime: () => assert.fail('failed knowledge cannot sync copies'),
    underHostLock: async (_options, fn) => ({ ok: true, value: fn() }),
  });
  assert.equal(prepared.code, 1);
  assert.match(prepared.text, /knowledge failed/);
});

test('ordinary sync/check retain copy behavior and reject incompatible flags before side effects', async () => {
  const deps = { syncRuntime: () => 27, driftOfRuntime: () => [],
    buildGrammar: () => assert.fail('ordinary sync/check cannot build'), underHostLock: () => assert.fail('ordinary sync/check cannot acquire the lock') };
  const synced = await releaseSyncRuntime({ args: {} }, deps);
  assert.equal(synced.code, 0);
  assert.match(synced.text, /^runtime copies synced: 27 files in \d+ bundles$/);
  const checked = await releaseSyncRuntime({ args: { check: true } }, deps);
  assert.equal(checked.code, 0);
  assert.deepEqual(checked.data.problems, []);
  const drift = await releaseSyncRuntime({ args: { check: true } }, { ...deps, driftOfRuntime: () => ['stale package/file'] });
  assert.equal(drift.code, 1);
  assert.equal(drift.text, undefined);
  assert.match(drift.stderr, /RT_GENERATED_DRIFT runtime copy drift: stale package\/file/);
  assert.equal((await releaseSyncRuntime({ args: { check: true, 'prepare-grammar': true } }, deps)).code, 2);
  assert.equal((await releaseSyncRuntime({ args: {}, positionals: ['unexpected'] }, deps)).code, 2);
});

test('preparation holds the real isolated host lock through build and copies and releases it', async (t) => {
  const f = fixture(t);
  const env = { STARCI_HOST_LOCK_DIR: path.join(f.root, 'host-lock') };
  const seen = [];
  const owned = () => {
    const owner = hostLockOwner({ env });
    assert.equal(owner.role, 'coordinator');
    assert.equal(owner.purpose, 'prepare-grammar');
  };
  const result = await releaseSyncRuntime({ args: { 'prepare-grammar': true }, env, role: 'owner' }, {
    root: f.root, buildGrammar: () => { owned(); seen.push('build'); return fresh(); },
    syncRuntime: () => { owned(); seen.push('copies'); return 9; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(seen, ['build', 'copies']);
  assert.equal(result.data.grammar.state, 'fresh');
  assert.equal(hostLockOwner({ env }), null);
});

test('preparation cannot run through an existing host lock', async (t) => {
  const f = fixture(t);
  const env = { STARCI_HOST_LOCK_DIR: path.join(f.root, 'host-lock') };
  await withHostLock({ role: 'coordinator', purpose: 'another operation', env }, async () => {
    const result = await releaseSyncRuntime({ args: { 'prepare-grammar': true }, env, role: 'owner' }, {
      buildGrammar: () => assert.fail('held lock cannot build'), syncRuntime: () => assert.fail('held lock cannot sync copies'),
    });
    assert.equal(result.code, 1);
    assert.equal(result.data.owner.purpose, 'another operation');
  });
  assert.equal(hostLockOwner({ env }), null);
});

test('unverified preparation and thrown copy failures fail closed and release the lock', async (t) => {
  const f = fixture(t);
  const env = { STARCI_HOST_LOCK_DIR: path.join(f.root, 'host-lock') };
  const ctx = { args: { 'prepare-grammar': true }, role: 'owner', env };
  for (const grammar of [undefined, { ...fresh(), state: 'unverifiable' }, { ok: false, step: 'npm ci', detail: 'E404 candidate not published' }]) {
    const result = await releaseSyncRuntime(ctx, { buildGrammar: () => grammar, syncRuntime: () => assert.fail('unverified preparation cannot copy') });
    assert.equal(result.code, 1);
    assert.equal(hostLockOwner({ env }), null);
  }
  const failedCopy = await releaseSyncRuntime(ctx, { buildGrammar: fresh, syncRuntime: () => { throw new Error('copy write failed'); } });
  assert.equal(failedCopy.code, 1);
  assert.match(failedCopy.text, /copy write failed/);
  assert.equal(hostLockOwner({ env }), null);
});
