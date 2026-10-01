import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enqueueRepository } from '../../scripts/kernel/target-repo.mjs';

// One form (owner 2026-10-01): an owned path of a bound app is app-relative - the spelling gate.mjs --root <app> --changed,
// the knowledge and every finding use. Its first segment names its side; any other spelling is refused path-not-app-relative.
function app(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-repo-binding-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), appRoot = path.join(root, 'app'), be = path.join(appRoot, 'be'), fe = path.join(appRoot, 'fe');
  for (const dir of [path.join(be, 'src'), path.join(fe, 'apps', 'app', 'src'), path.join(appRoot, 'scripts'), path.join(source, '.workspaces', 'projects', 'sample')]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(fe, 'apps', 'app', 'src', 'main.ts'), 'export {}');
  fs.writeFileSync(path.join(source, '.workspaces', 'projects', 'sample', 'work.json'), JSON.stringify({
    schema: 'starci/workspace-binding@2', project: 'sample',
    repository: { pathFromSource: '../app', gitRepository: 'https://example.test/app.git' },
    sides: { be: 'be', fe: 'fe' }, work: { pathFromRepository: '.starciwork' },
  }));
  const before = process.env.STARCI_SOURCE_ROOT;
  process.env.STARCI_SOURCE_ROOT = source;
  t.after(() => { if (before === undefined) delete process.env.STARCI_SOURCE_ROOT; else process.env.STARCI_SOURCE_ROOT = before; });
  return { appRoot, bind: (ownedPaths, extras = {}) => enqueueRepository({ op: 'code.refactor', repository: null, ownedPaths, repo: appRoot, ...extras }) };
}

test('an app-relative owned path names its side by its first segment, a new file included', (t) => {
  const { bind } = app(t);
  assert.deepEqual(bind(['fe/apps/app/src/main.ts']), { ok: true, repository: 'fe' });
  assert.deepEqual(bind(['fe/apps/app/src/absent.ts']), { ok: true, repository: 'fe' }, 'a file not created yet is still app-relative');
  assert.deepEqual(bind(['be/src/new.service.ts', '.starciwork/features/a']), { ok: true, repository: 'be' });
  assert.deepEqual(bind(['be/src', 'fe/apps/app/src']), { ok: true, repository: 'app' });
  assert.deepEqual(bind(['scripts/codegen.mjs']), { ok: true, repository: 'app' }, 'a path of the app root');
  assert.deepEqual(bind(['.starciwork/features/a'], { repository: 'fe' }), { ok: true, repository: 'fe' }, 'Work paths alone take --repository');
});

test('every other spelling is refused path-not-app-relative, a side-relative path naming its app-relative form', (t) => {
  const { appRoot, bind } = app(t);
  const sideRelative = bind(['apps/app/src/main.ts']);
  assert.equal(sideRelative.ok, false);
  assert.equal(sideRelative.reason, 'path-not-app-relative');
  assert.ok(sideRelative.detail.includes('side-relative (it means fe/apps/app/src/main.ts)'), sideRelative.detail);
  for (const owned of ['repository:fe/apps/app/src/main.ts', path.join(appRoot, 'fe', 'apps'), '../app/fe/apps', `${path.basename(appRoot)}/fe/apps`]) {
    const refused = bind([owned]);
    assert.deepEqual([refused.ok, refused.reason], [false, 'path-not-app-relative'], owned);
  }
});
