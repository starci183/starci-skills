import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RT_EXAMPLE_COUPLING, RT_PRODUCT_NAME_IN_SOURCE, RT_HOST_PATH_IN_TEMPLATE,
  checkExampleCoupling, checkExampleCouplingMain, couplingHits, exampleCouplingScan,
} from '../../scripts/checks/check-example-coupling.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const CHECK = path.join(repoRoot, 'scripts/checks/check-example-coupling.mjs');

const fixtureTree = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-example-coupling-'));
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  return root;
};

const codesAt = (report, file) => report.hits.filter((h) => h.file === file).map((h) => `${h.line}:${h.code}:${h.token}`);

// Host paths the fixtures carry are built from parts: an absolute-path literal never sits in a live file.
const DRIVE_PATH = 'C' + ':/work/serve';
const USER_PATH = '/' + 'Users/x/src';
const WIN_PATH = 'C' + ':' + '\\work';
const REGEX_LINE = 'const ok = /' + 'n' + ':/i.test(name);';

test('the real runtime tree carries no example or product coupling', () => {
  const report = checkExampleCoupling(repoRoot);
  assert.ok(report.filesScanned > 1000, 'a real scan covers the runtime sources');
  assert.deepEqual(report.hits.map((h) => `${h.file}:${h.line}`), [], JSON.stringify(report.hits.slice(0, 10)));
  const run = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('RT_EXAMPLE_COUPLING: a literal examples/<name> in source, comments and a template', () => {
  const root = fixtureTree({
    'scripts/run.mjs': '// reads examples/acme-app\nconst at = "examples/acme-app/hfs.json";\n',
    'engine/note.txt': 'examples/acme-app\n',
    'packages/hfs/templates/app.yaml': 'source: examples/acme-app\n',
  });
  try {
    const report = checkExampleCoupling(root);
    assert.ok(!report.ok);
    assert.deepEqual(codesAt(report, 'scripts/run.mjs'), [
      `1:${RT_EXAMPLE_COUPLING}:examples/acme-app`,
      `2:${RT_EXAMPLE_COUPLING}:examples/acme-app`,
    ]);
    assert.deepEqual(codesAt(report, 'engine/note.txt'), [`1:${RT_EXAMPLE_COUPLING}:examples/acme-app`]);
    assert.deepEqual(codesAt(report, 'packages/hfs/templates/app.yaml'), [`1:${RT_EXAMPLE_COUPLING}:examples/acme-app`]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('RT_PRODUCT_NAME_IN_SOURCE: a product name and a product-prefixed inc-<hash>', () => {
  const root = fixtureTree({
    'scripts/run.mjs': [
      '// the nivo ledger stalled',
      'const slug = "mia-mia-fe";',
      '// nivo-inc-a1b2c3d4 re-ran it',
      '// a bare inc-deadbeef12 stays generic',
      'export const label = "Nivo: the app";',
    ].join('\n'),
  });
  try {
    const hits = codesAt(checkExampleCoupling(root), 'scripts/run.mjs');
    assert.deepEqual(hits, [
      `1:${RT_PRODUCT_NAME_IN_SOURCE}:nivo`,
      `2:${RT_PRODUCT_NAME_IN_SOURCE}:mia-mia`,
      `3:${RT_PRODUCT_NAME_IN_SOURCE}:nivo`,
      `3:${RT_PRODUCT_NAME_IN_SOURCE}:nivo-inc-a1b2c3d4`,
      `5:${RT_PRODUCT_NAME_IN_SOURCE}:Nivo`,
    ]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('RT_HOST_PATH_IN_TEMPLATE: a drive path in a template; a regex literal is never one', () => {
  const root = fixtureTree({
    'packages/hfs/templates/serve.yaml': `watch: ${DRIVE_PATH}\n`,
    'scripts/run.mjs': [
      REGEX_LINE,                             // a regex literal is not a drive path
      `const win = "${DRIVE_PATH}";`,          // a string literal is
      `const mac = "${USER_PATH}";`,
    ].join('\n'),
  });
  try {
    const hits = codesAt(checkExampleCoupling(root), 'packages/hfs/templates/serve.yaml')
      .concat(codesAt(checkExampleCoupling(root), 'scripts/run.mjs')).sort();
    assert.deepEqual(hits, [
      `1:${RT_HOST_PATH_IN_TEMPLATE}:${DRIVE_PATH}`,
      `2:${RT_HOST_PATH_IN_TEMPLATE}:${DRIVE_PATH}`,
      `3:${RT_HOST_PATH_IN_TEMPLATE}:${USER_PATH}`,
    ]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('out of scope: specs, tests, generated runtime copies, a nested examples/ segment and the declared-refs file', () => {
  const root = fixtureTree({
    'tests/run.spec.mjs': '// nivo and examples/acme-app are fine in a spec\n',
    'scripts/run.spec.mjs': '// nivo\n',
    'scripts/fixtures/data.txt': 'examples/acme-app\n',
    'packages/eslint/fe/runtime/x.mjs': '// nivo\n',
    'scripts/lib/example-refs.mjs': 'export const APP = "examples/acme-app"; // nivo\n',
    'scripts/doc.mjs': [
      '// knowledge/ui/examples/brand-direction.example.yaml is a nested examples tree',
      '// examples/ alone and examples/${app} stay generic',
      'const rel = `examples/${app}`;',
      `// ${WIN_PATH} flags as comment text too`,
    ].join('\n'),
  });
  try {
    const report = checkExampleCoupling(root);
    assert.deepEqual(codesAt(report, 'tests/run.spec.mjs'), []);
    assert.deepEqual(codesAt(report, 'scripts/run.spec.mjs'), []);
    assert.deepEqual(codesAt(report, 'scripts/fixtures/data.txt'), []);
    assert.deepEqual(codesAt(report, 'packages/eslint/fe/runtime/x.mjs'), []);
    assert.deepEqual(codesAt(report, 'scripts/lib/example-refs.mjs'), []);
    assert.deepEqual(codesAt(report, 'scripts/doc.mjs'), [`4:${RT_HOST_PATH_IN_TEMPLATE}:${WIN_PATH}`]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the scan covers the declared roots and the managed templates', () => {
  const root = fixtureTree({
    'scripts/a.mjs': 'export {};\n',
    'engine/b.mjs': 'export {};\n',
    'ui/src/c.ts': 'export {};\n',
    'ui/api/d.ts': 'export {};\n',
    'packages/hfs/templates/e.yaml': 'x: 1\n',
    'knowledge/f.yaml': 'x: 1\n',
    'docs/g.md': 'x\n',
  });
  try {
    const files = exampleCouplingScan(root);
    for (const rel of ['scripts/a.mjs', 'engine/b.mjs', 'ui/src/c.ts', 'ui/api/d.ts', 'packages/hfs/templates/e.yaml'])
      assert.ok(files.includes(rel), `${rel} scanned`);
    for (const rel of ['knowledge/f.yaml', 'docs/g.md'])
      assert.ok(!files.includes(rel), `${rel} not scanned`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the CLI exits 1 on hits, 2 on a bad argument and prints usage', () => {
  const root = fixtureTree({ 'scripts/run.mjs': '// nivo\n' });
  try {
    const bad = checkExampleCouplingMain(['--root', root]);
    assert.equal(bad.exitCode, 1);
    assert.match(bad.text, /RT_PRODUCT_NAME_IN_SOURCE/);
    const json = checkExampleCouplingMain(['--root', root, '--json']);
    assert.equal(JSON.parse(json.text).ok, false);
    const usage = checkExampleCouplingMain(['--bogus']);
    assert.equal(usage.exitCode, 2);
    assert.equal(checkExampleCouplingMain(['--help']).exitCode, 0);
    const direct = couplingHits('scripts/x.mjs', 'const a = "examples/acme-app";\n');
    assert.equal(direct.length, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
