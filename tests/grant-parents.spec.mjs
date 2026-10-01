import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkGrantParents } from '../scripts/kernel/grant-parents.mjs';
import { loadCatalog } from '../scripts/kernel/why.mjs';

// The fe/ side keeps its app router at fe/apps/app/src/app; there is no fe/src/app. Owned paths are app-relative.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-grant-parents-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), app = path.join(root, 'app'), fe = path.join(app, 'fe');
  fs.mkdirSync(path.join(fe, 'apps', 'app', 'src', 'app'), { recursive: true });
  fs.mkdirSync(path.join(app, 'be'), { recursive: true });
  fs.mkdirSync(path.join(source, '.workspaces', 'projects', 'sample'), { recursive: true });
  fs.writeFileSync(path.join(source, '.workspaces', 'projects', 'sample', 'work.json'), JSON.stringify({
    schema: 'starci/workspace-binding@2', project: 'sample',
    repository: { pathFromSource: '../app', gitRepository: 'https://example.test/app.git' },
    sides: { be: 'be', fe: 'fe' }, work: { pathFromRepository: '.starciwork' },
  }));
  const before = process.env.STARCI_SOURCE_ROOT;
  process.env.STARCI_SOURCE_ROOT = source;
  t.after(() => { if (before === undefined) delete process.env.STARCI_SOURCE_ROOT; else process.env.STARCI_SOURCE_ROOT = before; });
  const check = (ownedPaths, extra = {}) => checkGrantParents({ op: 'interface.implement', payload: { repository: 'fe', ...extra }, ownedPaths, repo: app });
  return { check };
}

test('a grant whose directory is missing is refused, naming the missing and the closest existing directory', (t) => {
  const { check } = fixture(t);
  const out = check(['fe/src/app/**']);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'grant-parent-missing');
  assert.equal(out.violations[0].dir, 'fe/src/app');
  assert.equal(out.violations[0].closest, 'fe');
  assert.match(out.detail, /fe\/src\/app does not exist/);
  const top = check(['nowhere/x/**']);
  assert.equal(top.violations[0].closest, '.');
  assert.match(top.detail, /repository root/);
  const file = check(['fe/apps/app/src/pages/home.tsx']);
  assert.equal(file.ok, false);
  assert.equal(file.violations[0].dir, 'fe/apps/app/src/pages');
  assert.equal(file.violations[0].closest, 'fe/apps/app/src');
});

test('a grant under an existing directory passes, a new file included', (t) => {
  const { check } = fixture(t);
  assert.deepEqual(check(['fe/apps/app/src/app/**']), { ok: true });
  assert.deepEqual(check(['fe/apps/app/src/app/page.tsx']), { ok: true });
  assert.deepEqual(check(['README.md']), { ok: true });
  assert.deepEqual(check(['.starciwork/features/x/index.yaml']), { ok: true });
});

test('a declared create-new-module grant passes when the module root parent exists, and only then', (t) => {
  const { check } = fixture(t);
  assert.deepEqual(check(['fe/apps/app/src/billing/**', 'fe/apps/app/src/billing/x.ts'], { new_modules: ['fe/apps/app/src/billing'] }), { ok: true });
  const orphan = check(['fe/src/app/**'], { new_modules: ['fe/src/app'] });
  assert.equal(orphan.ok, false);
  assert.equal(orphan.violations[0].dir, 'fe/src');
  assert.equal(orphan.violations[0].newModule, 'fe/src/app');
  assert.equal(check(['fe/apps/app/src/other/y.ts'], { new_modules: ['fe/apps/app/src/billing'] }).ok, false);
});

test('the refusal code is in the Vietnamese catalog', () => {
  const entry = loadCatalog()['grant-parent-missing'];
  assert.ok(entry?.title_vi && entry.meaning_vi && entry.nextStep_vi);
  assert.equal(entry.kind, 'input-invalid');
});
