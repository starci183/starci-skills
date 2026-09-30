import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enqueueRepository } from '../scripts/kernel/target-repo.mjs';

test('bare owned paths bind where they exist and refuse missing or ambiguous paths', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-repo-binding-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), app = path.join(root, 'app'), be = path.join(app, 'be'), fe = path.join(app, 'fe');
  for (const dir of [be, fe, path.join(source, '.workspaces', 'projects', 'sample')]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(source, '.workspaces', 'projects', 'sample', 'work.json'), JSON.stringify({
    schema: 'starci/workspace-binding@2', project: 'sample',
    repository: { pathFromSource: '../app', gitRepository: 'https://example.test/app.git' },
    sides: { be: 'be', fe: 'fe' }, work: { pathFromRepository: '.starciwork' },
  }));
  const before = process.env.STARCI_SOURCE_ROOT;
  process.env.STARCI_SOURCE_ROOT = source;
  t.after(() => { if (before === undefined) delete process.env.STARCI_SOURCE_ROOT; else process.env.STARCI_SOURCE_ROOT = before; });
  fs.mkdirSync(path.join(fe, 'apps', 'app', 'src'), { recursive: true });
  fs.writeFileSync(path.join(fe, 'apps', 'app', 'src', 'main.ts'), 'export {}');
  const bind = (ownedPaths, extras = {}) => enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths, repo: app, ...extras });
  assert.deepEqual(bind(['apps/app/src/main.ts']), { ok: true, repository: 'fe' });
  const missing = bind(['apps/app/src/absent.ts']);
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /path.*repository|repository.*path/);
  assert.match(missing.detail, /be.*fe|fe.*be/);
  assert.deepEqual(bind(['apps/app/src/absent.ts'], { siblingRepositories: ['fe'] }), { ok: true, repository: 'fe' });
  fs.mkdirSync(path.join(be, 'apps', 'app', 'src'), { recursive: true });
  fs.writeFileSync(path.join(be, 'apps', 'app', 'src', 'main.ts'), 'export {}');
  const ambiguous = bind(['apps/app/src/main.ts']);
  assert.equal(ambiguous.ok, false);
  assert.match(ambiguous.detail, /be.*fe|fe.*be/);
});
