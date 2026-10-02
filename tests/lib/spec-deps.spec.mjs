// spec-deps selects specs by IMPORT: a spec runs at land time when any module it reaches through relative imports changed,
// even if the spec file itself did not (the clash class where one lane changes a module another lane's spec relies on).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dataRefsOf, specsDependingOn, reachableFrom } from '../../scripts/lib/spec-deps.mjs';

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

test('specs in tests/<area>/ import ../../scripts: a direct and a transitive change select them', (t) => {
  const root = repo(t, {
    'scripts/lib/leaf.mjs': 'export const leaf = 1;\n',
    'scripts/kernel/mid.mjs': "import { leaf } from '../lib/leaf.mjs';\nexport const mid = leaf;\n",
    'tests/kernel/mid.spec.mjs': "import { mid } from '../../scripts/kernel/mid.mjs';\n",
    'tests/lib/other.spec.mjs': "import assert from 'node:assert';\n",
  });
  const specs = ['tests/kernel/mid.spec.mjs', 'tests/lib/other.spec.mjs'];
  assert.deepEqual(specsDependingOn(root, ['scripts/kernel/mid.mjs'], specs), ['tests/kernel/mid.spec.mjs']);
  assert.deepEqual(specsDependingOn(root, ['scripts/lib/leaf.mjs'], specs), ['tests/kernel/mid.spec.mjs'], 'transitive');
});

test('a runtime entry a spec starts as a process (path segments or a path string) is a dependency, with its imports', (t) => {
  const root = repo(t, {
    'scripts/lib/leaf.mjs': 'export const leaf = 1;\n',
    'scripts/kernel/cli.mjs': "import { leaf } from '../lib/leaf.mjs';\nconsole.log(leaf);\n",
    'tests/kernel/cli.spec.mjs': "const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');\n",
    'tests/kernel/string.spec.mjs': "spawnSync(process.execPath, ['scripts/kernel/cli.mjs', 'status']);\n",
    'tests/kernel/none.spec.mjs': "const fixture = path.join(ROOT, 'scripts', 'kernel', 'missing.mjs');\n",
  });
  const specs = ['tests/kernel/cli.spec.mjs', 'tests/kernel/string.spec.mjs', 'tests/kernel/none.spec.mjs'];
  assert.deepEqual(specsDependingOn(root, ['scripts/kernel/cli.mjs'], specs), ['tests/kernel/cli.spec.mjs', 'tests/kernel/string.spec.mjs']);
  assert.deepEqual(specsDependingOn(root, ['scripts/lib/leaf.mjs'], specs), ['tests/kernel/cli.spec.mjs', 'tests/kernel/string.spec.mjs'], 'and what the entry imports');
});

test('the CLI reads a large changed list from stdin (`-`): a tree move exceeds the Windows command line', (t) => {
  const root = repo(t, {
    'scripts/lib/leaf.mjs': 'export const leaf = 1;\n',
    'tests/lib/leaf.spec.mjs': "import { leaf } from '../../scripts/lib/leaf.mjs';\n",
  });
  const cli = path.resolve(import.meta.dirname, '..', '..', 'scripts', 'lib', 'spec-deps.mjs');
  const changed = [...Array.from({ length: 3000 }, (_, i) => `scripts/moved/file-number-${i}-with-a-long-name.mjs`), 'scripts/lib/leaf.mjs'];
  const r = spawnSync(process.execPath, [cli, root, '-'], { input: `${changed.join('\n')}\n`, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split(/\r?\n/), ['tests/lib/leaf.spec.mjs']);
});

test('a spec that reads a data tree (a path string or path segments) depends on every file below it, though it imports none', (t) => {
  const root = repo(t, {
    'tests/drift.spec.mjs': "const EXAMPLE = path.join(ROOT, 'examples', 'ecommerce-app', 'be');\nconst TEMPLATES = path.join(ROOT, 'packages/hfs/templates/be/patterns');\n",
    'tests/helpers/reads.mjs': "export const dir = ['knowledge', 'patterns', 'be'].join('/');\nexport const tree = path.join(ROOT, 'knowledge', 'patterns', 'be');\n",
    'tests/uses-helper.spec.mjs': "import { tree } from './helpers/reads.mjs';\n",
    'tests/plain.spec.mjs': "import assert from 'node:assert';\n",
  });
  const specs = ['tests/drift.spec.mjs', 'tests/uses-helper.spec.mjs', 'tests/plain.spec.mjs'];
  assert.deepEqual(dataRefsOf("path.join(ROOT, 'examples', 'ecommerce-app', 'be') 'packages/hfs/templates/be/patterns/' 'node:fs' 'scripts/x'").sort(), ['examples/ecommerce-app/be', 'packages/hfs/templates/be/patterns']);
  assert.deepEqual(specsDependingOn(root, ['examples/ecommerce-app/be/src/modules/platform/jobs/x.ts'], specs), ['tests/drift.spec.mjs']);
  assert.deepEqual(specsDependingOn(root, ['packages/hfs/templates/be/patterns/jobs/a.ts.tpl'], specs), ['tests/drift.spec.mjs']);
  assert.deepEqual(specsDependingOn(root, ['knowledge/patterns/be/jobs.yaml'], specs), ['tests/uses-helper.spec.mjs'], 'a helper under tests/ names the tree for the spec that imports it');
  assert.deepEqual(specsDependingOn(root, ['examples/ecommerce-app/other/x.ts'], specs), [], 'a sibling tree is not below the named one');
});
