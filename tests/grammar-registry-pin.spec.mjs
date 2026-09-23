import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { grammarPinsOf, grammarPinsIn } from '../scripts/checks/grammar-registry-pin.mjs';

// The owner ruled consumers take @starci/grammar from npm: starci-academy-fe's
// file: link and nivo-fe/miamia-fe's stale registry pins both hid 0.5.0.
test('a registry semver range passes; a file:, link or path spec fails', () => {
  assert.deepEqual(grammarPinsOf({ dependencies: { '@starci/grammar': '^0.5.0' } }).map((p) => p.ok), [true]);
  for (const spec of ['file:../starci-academy-backend/.claude/packages/grammar', 'link:../grammar', 'workspace:*', '../grammar', String.raw`D:\grammar`, 'D:/grammar'])
    assert.equal(grammarPinsOf({ devDependencies: { '@starci/grammar': spec } })[0].ok, false, spec);
  assert.deepEqual(grammarPinsOf({ dependencies: { react: '19' } }), []);
});

test('every package.json under a repo is read, node_modules excluded', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-pin-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const write = (rel, manifest) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), JSON.stringify(manifest)); };
  write('package.json', { dependencies: { '@starci/grammar': 'file:../grammar' } });
  write('apps/app/package.json', { dependencies: { '@starci/grammar': '^0.5.0' } });
  write('node_modules/x/package.json', { dependencies: { '@starci/grammar': 'file:../nope' } });
  assert.deepEqual(grammarPinsIn(repo).map((p) => [p.file, p.ok]).sort(), [['apps/app/package.json', true], ['package.json', false]]);
});
