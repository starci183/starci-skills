// proves: FE_PACKAGE_SHAPE@lite
// proves: FE_PACKAGE_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPackageShape } from '../../scripts/hfs/architecture/package-shape.mjs';
import { tempSide, writeFiles } from '../helpers/hfs-arch-fixture.mjs';

const built = {
  name: '@fixture/shared',
  scripts: { build: 'tsc -p tsconfig.build.json' },
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' }, './css': './dist/app.css' },
};

function packageInput(t, edition, manifest) {
  const root = tempSide(t, `a16-package-shape-${edition}-`, 'fe');
  writeFiles(root, {
    'packages/shared/package.json': JSON.stringify(manifest),
    'packages/shared/src/index.ts': 'export const shared = 1;\n',
  });
  // Supply the package owner's resolved slot; the real checker reads and judges its manifest.
  const resolver = {
    ownerOf(file) {
      return file.startsWith('packages/shared/') ? { slot: 'repo.packages', root: 'packages/shared' } : null;
    },
    slot(id) {
      return id === 'repo.packages' ? { tier: 'package' } : null;
    },
  };
  return { config: { root, edition }, graph: { resolver } };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} valid package builds to dist with explicit exports`, t => {
    const report = checkPackageShape(packageInput(t, edition, built));
    assert.deepEqual(report.violations, []);
    assert.equal(report.coverage.packages, 1);
  });

  test(`${edition} invalid package without a build emits FE_PACKAGE_SHAPE`, t => {
    const report = checkPackageShape(packageInput(t, edition, { ...built, scripts: {} }));
    assert.deepEqual(report.violations.map(item => item.ruleId), ['FE_PACKAGE_SHAPE']);
    assert.match(report.violations[0].message, /no scripts.build/);
  });

  test(`${edition} invalid package without exports emits FE_PACKAGE_SHAPE`, t => {
    const report = checkPackageShape(packageInput(t, edition, { scripts: built.scripts }));
    assert.deepEqual(report.violations.map(item => item.ruleId), ['FE_PACKAGE_SHAPE']);
    assert.match(report.violations[0].message, /declares no exports map/);
  });

  test(`${edition} invalid package source targets and wildcard exports emit FE_PACKAGE_SHAPE`, t => {
    const report = checkPackageShape(packageInput(t, edition, {
      ...built,
      main: './src/index.ts',
      exports: { '.': './src/index.ts', './*': './dist/*.js' },
    }));
    assert.deepEqual(report.violations.map(item => item.ruleId), ['FE_PACKAGE_SHAPE', 'FE_PACKAGE_SHAPE', 'FE_PACKAGE_SHAPE']);
  });
}
