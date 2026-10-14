import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coverageSources, managedTemplates } from '../../scripts/checks/lib/coverage-inventory.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, write(file) {
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, 'fixture content\n');
  } };
}

for (const edition of ['lite', 'full']) {
  test(`coverage inventory includes managed ${edition} dotfiles and their example witnesses`, (t) => {
    const { root, write } = fixture(t);
    const group = edition === 'lite' ? 'skeleton-lite' : 'skeleton';
    const names = ['.gitattributes', '.editorconfig', '.prettierrc', '.gitignore'];
    for (const name of names) {
      write(`packages/hfs/templates/app/${group}/${name}`);
      write(`examples/${edition}-app/${name}`);
    }
    const files = coverageSources(root);
    for (const name of names) {
      assert.ok(files.has(`packages/hfs/templates/app/${group}/${name}`));
      assert.ok(files.has(`examples/${edition}-app/${name}`));
    }
    const manifest = { editions: ['lite', 'full'], profiles: ['app'], slots: [{
      id: 'app.gitattributes', profiles: ['app'], path: '.gitattributes', presence: 'required',
      tracked: 'tracked', managedBy: 'skeleton', liteManagedBy: 'skeleton-lite',
    }] };
    const templates = managedTemplates({ files, manifest }, edition);
    assert.deepEqual(templates.missing, []);
    assert.deepEqual(templates.templates.get('app.gitattributes'), [`packages/hfs/templates/app/${group}/.gitattributes`]);
  });
}

test('dotfile inventory retains custody exclusions and omits unknown binary names', (t) => {
  const { root, write } = fixture(t);
  for (const file of ['examples/sample/.env', 'examples/sample/.claude/secret.env',
    'examples/sample/secrets/fixture.enc', 'examples/sample/.unknown', 'examples/sample/logo.png']) write(file);
  assert.deepEqual([...coverageSources(root).keys()], []);
});
