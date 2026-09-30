import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// R63 package-shape (FE_PACKAGE_SHAPE): a shared package builds to dist (scripts.build) and lists explicit exports, every
// target and main/module/types inside ./dist/.
const PACKAGE = manifest => JSON.stringify({ name: '@fixture/shared', version: '1.0.0', ...manifest });
const FILES = manifest => ({
  'apps/web/src/modules/config/index.ts': 'export const config = 1;\n',
  'packages/shared/package.json': PACKAGE(manifest),
  'packages/shared/tsconfig.json': '{}\n',
  'packages/shared/src/index.ts': 'export const shared = 1;\n',
});
const BUILT = { scripts: { build: 'tsc -p tsconfig.build.json' }, main: './dist/index.js', types: './dist/index.d.ts', exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' }, './css': './dist/app.css' } };
const hits = report => findings(report, 'FE_PACKAGE_SHAPE');
const run = (t, manifest) => runArch(archFixture(t, { profile: 'fe', files: FILES(manifest) }));

test('a package that builds to dist with explicit exports raises no FE_PACKAGE_SHAPE', t => {
  const report = run(t, BUILT);
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.packageShape.status, 'checked');
  assert.equal(report.coverage.hfsMachine.packageShape.packages, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_PACKAGE_SHAPE'));
});

test('a package without scripts.build or without an exports map is FE_PACKAGE_SHAPE', t => {
  const noBuild = hits(run(t, { ...BUILT, scripts: {} }));
  assert.equal(noBuild.length, 1);
  assert.match(noBuild[0].message, /no scripts\.build/);
  const noExports = hits(run(t, { scripts: BUILT.scripts, main: './dist/index.js' }));
  assert.equal(noExports.length, 1);
  assert.match(noExports[0].message, /declares no exports map/);
});

test('exports and main that point into src, or a wildcard subpath, are FE_PACKAGE_SHAPE', t => {
  const source = hits(run(t, { scripts: BUILT.scripts, main: './src/index.ts', exports: { '.': './src/index.ts' } }));
  assert.deepEqual(source.map(item => item.export ?? item.field).sort(), ['./src/index.ts', 'main']);
  const wildcard = hits(run(t, { ...BUILT, exports: { '.': './dist/index.js', './*': './dist/*.js' } }));
  assert.equal(wildcard.filter(item => item.export === './*').length, 1);
});
