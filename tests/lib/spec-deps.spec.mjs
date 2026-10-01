// spec-deps selects specs by IMPORT: a spec runs at land time when any module it reaches through relative imports changed,
// even if the spec file itself did not (the clash class where one lane changes a module another lane's spec relies on).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { specsDependingOn, reachableFrom } from '../../scripts/lib/spec-deps.mjs';

function repo(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-spec-deps-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test('a spec is selected when a module it reaches transitively changed, and not otherwise', (t) => {
  const root = repo(t, {
    'scripts/api/orca/provision.mjs': "export const stamp = () => 'starci:x';\n",
    'scripts/supervisor/workers.mjs': "import { stamp } from '../api/orca/provision.mjs';\nexport const create = () => stamp();\n",
    'scripts/lib/pure.mjs': 'export const add = (a, b) => a + b;\n',
    'tests/workers.spec.mjs': "import { create } from '../scripts/supervisor/workers.mjs';\n",
    'tests/pure.spec.mjs': "import { add } from '../scripts/lib/pure.mjs';\n",
    'tests/dynamic.spec.mjs': "const m = await import('../scripts/supervisor/workers.mjs');\n",
  });
  const specs = ['tests/workers.spec.mjs', 'tests/pure.spec.mjs', 'tests/dynamic.spec.mjs'];
  assert.deepEqual(specsDependingOn(root, ['scripts/api/orca/provision.mjs'], specs), ['tests/workers.spec.mjs', 'tests/dynamic.spec.mjs']);
  assert.deepEqual(specsDependingOn(root, ['scripts/lib/pure.mjs'], specs), ['tests/pure.spec.mjs']);
  assert.deepEqual(specsDependingOn(root, ['tests/pure.spec.mjs'], specs), ['tests/pure.spec.mjs'], 'a changed spec selects itself');
});

test('an import shown in a string or a comment is never followed, and a cycle terminates', (t) => {
  const root = repo(t, {
    'scripts/a.mjs': "import './b.mjs';\nexport const a = 1;\n",
    'scripts/b.mjs': "import './a.mjs';\n// import '../scripts/c.mjs';\nexport const text = \"import './c.mjs'\";\n",
    'scripts/c.mjs': 'export const c = 1;\n',
  });
  assert.deepEqual([...reachableFrom(root, 'scripts/a.mjs')].sort(), ['scripts/a.mjs', 'scripts/b.mjs']);
});
