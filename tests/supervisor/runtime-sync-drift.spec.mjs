import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRuleCatalog, loadSlotManifest, RUNTIME_MANIFEST_FILE, ruleParams } from '../../scripts/hfs/slots.mjs';
import { BUNDLES, CATALOG, driftOfRuntime, syncRuntime } from '../../scripts/hfs/sync-runtime.mjs';
import { readWhy } from '../../scripts/hfs/check.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { catalogFiles } from '../../scripts/lib/i18n.mjs';
import { releaseSyncRuntime } from '../../scripts/supervisor/release-sync-runtime.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function runtimeInputs(t, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inputs = new Set([CATALOG, ...catalogFiles(ROOT), ...Object.values(BUNDLES).flatMap(bundle => bundle.files)]);
  for (const file of inputs) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), target);
  }
  return root;
}

test('the generated failure-code slice loads every owned rule code while pruning unrelated runtime codes', (t) => {
  const root = runtimeInputs(t, 'starci-runtime-sync-catalog-');
  fs.appendFileSync(path.join(root, CATALOG), '\nUNUSED_RUNTIME_FIXTURE:\n  title: Unrelated runtime code\n');
  syncRuntime(root);
  const bundle = path.join(root, 'packages/hfs/runtime');
  const owned = loadRuleCatalog({ root: bundle }).rules.flatMap(rule => rule.failureCodes);
  const labels = readWhy(bundle, owned);
  assert.equal(typeof labels.DB_BE_ONLY_ACCESS.whyVi, 'string', 'async database rules retain their catalog explanations');
  for (const code of owned) assert.equal(typeof labels[code].whyVi, 'string', code);
  const slice = parseYaml(fs.readFileSync(path.join(bundle, CATALOG), 'utf8'));
  assert.equal(slice.UNUSED_RUNTIME_FIXTURE, undefined, 'unowned, unreported codes remain outside the package');
  assert.deepEqual(driftOfRuntime(root), []);
});

test('the real generator and public check detect absent/stale UI output without rewriting it', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-sync-drift-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inputs = new Set([CATALOG, ...catalogFiles(ROOT), ...Object.values(BUNDLES).flatMap((b) => b.files)]);
  for (const rel of inputs) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), target);
  }
  const files = syncRuntime(root);
  assert.equal(files, Object.values(BUNDLES).reduce((sum, b) => sum + new Set([...b.files, ...(b.catalog ? [CATALOG] : [])]).size, 0));
  assert.deepEqual(driftOfRuntime(root), []);
  const params = ruleParams(loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) }), 'runtime');
  const uiRoot = params.generated.find((g) => g.root.startsWith('ui/')).root;
  const generated = fs.readdirSync(path.join(root, uiRoot));
  assert.equal(generated.length, 1);
  const rel = `${uiRoot}/${generated[0]}`;
  const target = path.join(root, rel);
  const original = fs.readFileSync(target);
  const ctx = { args: { check: true } };
  assert.equal((await releaseSyncRuntime(ctx, { root })).code, 0);

  fs.unlinkSync(target);
  const missing = await releaseSyncRuntime(ctx, { root });
  assert.equal(missing.code, 1);
  assert.deepEqual(missing.data.problems, [`missing ${rel}`]);
  assert.equal(fs.existsSync(target), false, '--check does not prepare missing ignored outputs');

  fs.writeFileSync(target, 'export default {} as Record<string, string>;\n');
  const staleBefore = fs.readFileSync(target);
  const stale = await releaseSyncRuntime(ctx, { root });
  assert.equal(stale.code, 1);
  assert.deepEqual(stale.data.problems, [`stale ${rel}`]);
  assert.deepEqual(fs.readFileSync(target), staleBefore, '--check preserves the actual stale bytes');

  fs.writeFileSync(target, original);
  assert.equal((await releaseSyncRuntime(ctx, { root })).code, 0);
  const messageFile = catalogFiles(root).find((file) => /scope:\s*ui\b/.test(fs.readFileSync(path.join(root, file), 'utf8')));
  assert.ok(messageFile);
  const input = path.join(root, messageFile);
  fs.appendFileSync(input, '\n  - en: Generated fixture message\n    vi: Fixture translation\n');
  assert.deepEqual(driftOfRuntime(root), [`stale ${rel}`], 'fresh comparison includes changed canonical UI inputs');
  assert.deepEqual(fs.readFileSync(target), original);
});

test('a regeneration over current copies touches no file, and removes only the file no bundle lists', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-sync-idle-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const rel of new Set([CATALOG, ...catalogFiles(ROOT), ...Object.values(BUNDLES).flatMap((b) => b.files)])) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), target);
  }
  syncRuntime(root);
  const bundle = Object.keys(BUNDLES)[0];
  const first = BUNDLES[bundle].files[0];
  const kept = path.join(root, bundle, first);
  const old = new Date(Date.now() - 3600_000);
  fs.utimesSync(kept, old, old);
  const stamped = fs.statSync(kept).mtimeMs; // the file system's own rounding of that time
  const stray = path.join(root, bundle, 'stray.txt');
  fs.writeFileSync(stray, 'x');
  syncRuntime(root);
  assert.equal(fs.statSync(kept).mtimeMs, stamped, 'a current copy is not rewritten, so a concurrent reader never sees it cut');
  assert.equal(fs.existsSync(stray), false);
  assert.deepEqual(driftOfRuntime(root), []);
});
