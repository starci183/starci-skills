// land-touching-selection.spec.mjs - the land gate's default `touching` selection stays bounded for a hub file (audit 2026-10-07, issue 3d):
// the specs that see the change directly always run, the specs reaching it only through the import graph are a smoke set spread over spec
// directories, not all of them. A hub imported by 60 specs ran about 250 specs in 25-30 minutes before.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { touchingSelection, smokeSpecs, SMOKE_LIMIT } from '../../scripts/supervisor/land-specs.mjs';

function hubTree(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-touching-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put('scripts/hub.mjs', 'export const hub = 1;\n');
  put('scripts/mid.mjs', "import { hub } from './hub.mjs';\nexport const mid = hub;\n");
  put('tests/hub.spec.mjs', "import { hub } from '../scripts/hub.mjs';\n");
  const specs = ['tests/hub.spec.mjs'];
  for (const dir of ['a', 'b', 'c', 'd']) {
    for (let i = 0; i < 20; i += 1) { const rel = `tests/${dir}/via-mid-${String(i).padStart(2, '0')}.spec.mjs`; put(rel, "import { mid } from '../../scripts/mid.mjs';\n"); specs.push(rel); }
  }
  return { root, specs, pool: specs.map((file) => ({ file, text: fs.readFileSync(path.join(root, file), 'utf8') })) };
}

test('a hub change runs its direct specs plus a bounded smoke set, not every spec that reaches it through imports', (t) => {
  const { root, pool } = hubTree(t);
  const picked = touchingSelection(['scripts/hub.mjs'], { specs: pool, root });
  assert.ok(picked.files.includes('tests/hub.spec.mjs'), 'the spec named after the file runs');
  assert.equal(picked.smoke.length, SMOKE_LIMIT, 'the transitive set (80 specs) is cut to the smoke limit');
  assert.equal(picked.files.length, 1 + SMOKE_LIMIT);
  assert.deepEqual([...new Set(picked.smoke.map((f) => path.posix.dirname(f)))].sort(), ['tests/a', 'tests/b', 'tests/c', 'tests/d'], 'every spec directory is represented');
});

test('the smoke set is deterministic, skips chosen specs and takes one per directory per round', () => {
  const dependents = ['tests/b/2.spec.mjs', 'tests/a/1.spec.mjs', 'tests/a/2.spec.mjs', 'tests/b/1.spec.mjs', 'tests/a/0.spec.mjs'];
  const chosen = new Set(['tests/a/0.spec.mjs']);
  assert.deepEqual(smokeSpecs({ dependents, chosen, changed: [], limit: 3 }), ['tests/a/1.spec.mjs', 'tests/b/1.spec.mjs', 'tests/a/2.spec.mjs']);
  assert.deepEqual(smokeSpecs({ dependents: [...dependents].reverse(), chosen, changed: [], limit: 3 }), ['tests/a/1.spec.mjs', 'tests/b/1.spec.mjs', 'tests/a/2.spec.mjs']);
});

test('the spec directory named in a changed path comes first in the smoke set', () => {
  const dependents = ['tests/a/1.spec.mjs', 'tests/supervisor/1.spec.mjs'];
  assert.deepEqual(smokeSpecs({ dependents, chosen: new Set(), changed: ['scripts/supervisor/land.mjs'], limit: 1 }), ['tests/supervisor/1.spec.mjs']);
});

test('without a tree root only the direct selection runs (no smoke set)', (t) => {
  const { pool } = hubTree(t);
  const picked = touchingSelection(['scripts/hub.mjs'], { specs: pool });
  assert.deepEqual([picked.files, picked.smoke], [['tests/hub.spec.mjs'], []]);
});
