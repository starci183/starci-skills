import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSlotManifest, RUNTIME_MANIFEST_FILE, ruleParams } from '../../scripts/hfs/slots.mjs';
import { BUNDLES, CATALOG, driftOfRuntime, syncRuntime } from '../../scripts/hfs/sync-runtime.mjs';
import { catalogFiles } from '../../scripts/lib/i18n.mjs';
import { releaseSyncRuntime } from '../../scripts/supervisor/release-sync-runtime.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

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
  const stray = path.join(root, bundle, 'stray.txt');
  fs.writeFileSync(stray, 'x');
  syncRuntime(root);
  assert.equal(fs.statSync(kept).mtimeMs, old.getTime(), 'a current copy is not rewritten, so a concurrent reader never sees it cut');
  assert.equal(fs.existsSync(stray), false);
  assert.deepEqual(driftOfRuntime(root), []);
});
