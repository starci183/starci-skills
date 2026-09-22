import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkSchemaCatalog } from '../scripts/checks/check-schema-catalog.mjs';

const skillRoot = path.resolve(import.meta.dirname, '..');
const checker = path.join(skillRoot, 'scripts', 'checks', 'check-schema-catalog.mjs');

// A disposable tree with the two lists the checker reads and nothing else.
function fixture(t, { catalog, files }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-schema-catalog-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'modules', 'schemas'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'modules', 'schemas', 'index.yaml'), catalog);
  for (const [relative, body] of Object.entries(files)) {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return dir;
}

const CATALOG = `schemas:
  - id: starci/orca-calls@1
    file: modules/host/orca/calls.yaml
moduleLocalDocumentKinds:
  - id: starci/module-thing@1
    governs: "a thing"
    files: [modules/thing/index.yaml]
`;

test('the installed tree has every modules/ schema stamp catalogued exactly once', () => {
  const result = checkSchemaCatalog();
  assert.deepEqual(result.errors, [], result.errors.join('\n'));
  assert.equal(result.ok, true);
  assert.ok(result.stamps.length > 40, `expected the whole tree, saw ${result.stamps.length} stamps`);
});

test('an uncatalogued stamp fails', t => {
  const dir = fixture(t, {
    catalog: CATALOG,
    files: {
      'modules/thing/index.yaml': 'schema: starci/module-thing@1\n',
      'modules/other/index.yaml': 'schema: starci/module-other@1\n',
    },
  });
  const result = checkSchemaCatalog({ root: dir });
  assert.equal(result.ok, false);
  assert.deepEqual(result.uncatalogued, [{ file: 'modules/other/index.yaml', id: 'starci/module-other@1' }]);
});

test('a module-local kind must name every file that stamps it', t => {
  const dir = fixture(t, {
    catalog: CATALOG,
    files: {
      'modules/thing/index.yaml': 'schema: starci/module-thing@1\n',
      'modules/thing/second.yaml': 'schema: starci/module-thing@1  # trailing comments are stamps too\n',
    },
  });
  const result = checkSchemaCatalog({ root: dir });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(e => e.includes('modules/thing/second.yaml') && e.includes('does not list under its files[]')),
    result.errors.join('\n'),
  );
});

test('a module-local kind nothing stamps is a stale entry', t => {
  const dir = fixture(t, { catalog: CATALOG, files: {} });
  const result = checkSchemaCatalog({ root: dir });
  assert.equal(result.ok, false);
  assert.ok(result.unused.includes('starci/module-thing@1'), result.errors.join('\n'));
});

test('one const may not be listed in both lists', t => {
  const dir = fixture(t, {
    catalog: `schemas:
  - id: starci/module-thing@1
    file: modules/thing/index.yaml
moduleLocalDocumentKinds:
  - id: starci/module-thing@1
    files: [modules/thing/index.yaml]
`,
    files: { 'modules/thing/index.yaml': 'schema: starci/module-thing@1\n' },
  });
  const result = checkSchemaCatalog({ root: dir });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('one place only')), result.errors.join('\n'));
});

test('modules/ops/ops manifests are excluded from the inventory', t => {
  const dir = fixture(t, {
    catalog: CATALOG,
    files: {
      'modules/thing/index.yaml': 'schema: starci/module-thing@1\n',
      'modules/ops/ops/task.execute.yaml': 'schema: starci/op@1\n',
    },
  });
  const result = checkSchemaCatalog({ root: dir });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('checker CLI exits 0 on the installed tree', () => {
  const cli = spawnSync(process.execPath, [checker], { cwd: skillRoot, encoding: 'utf8', timeout: 60000 });
  assert.equal(cli.status, 0, cli.stdout || cli.stderr);
  assert.match(cli.stdout, /^OK:/);
});
