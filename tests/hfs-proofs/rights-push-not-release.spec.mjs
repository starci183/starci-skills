// proves: RIGHTS_PUSH_NOT_RELEASE@lite
// proves: RIGHTS_PUSH_NOT_RELEASE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const guard = path.resolve(import.meta.dirname, '..', '..', 'scripts/guards/release-push-gate.mjs');
const zero = '0'.repeat(40);
const head = 'a'.repeat(40);
const fixture = (t, edition) => {
  const cwd = mkdtemp(t, `starci-push-proof-${edition}-`);
  fs.writeFileSync(path.join(cwd, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } }));
  return cwd;
};
const run = (cwd, input) => spawnSync(process.execPath, [guard], { cwd, input, encoding: 'utf8' });

for (const edition of ['lite', 'full']) {
  test(`${edition}: the executable push guard refuses deleting main`, (t) => {
    const result = run(fixture(t, edition), `(delete) ${zero} refs/heads/main ${head}\n`);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /RIGHTS_PUSH_NOT_RELEASE: refs\/heads\/main is closed: a push never deletes the runtime main/);
  });

  test(`${edition}: the executable push guard permits a coordinator backup ref`, (t) => {
    const result = run(fixture(t, edition), `refs/heads/lane/proof ${head} refs/backup/lane-proof ${zero}\n`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
  });
}
