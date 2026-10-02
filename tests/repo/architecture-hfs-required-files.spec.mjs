import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// HFS check 5: the `requires`, `requiredInstances` and `minInstances` of knowledge/hfs/slots.yaml must exist.
// HFS_REQUIRED_FILE_MISSING (backend app, feature, domain, integrations, platform), FE_ERROR_BOUNDARY_MISSING
// (fe.app.next error and loading files) and HFS_REQUIRED_FILE_MISSING (every other file, and the minimums at hfs.json).

const PLATFORM = ['config', 'logging', 'errors', 'primitives', 'clock', 'i18n'];
const platformFiles = (skip = []) => Object.fromEntries(PLATFORM.filter(name => !skip.includes(name))
  .map(name => [`src/modules/platform/${name}/index.ts`, 'export const value = 1;\n']));
const paths = (report, ruleId) => findings(report, ruleId).map(item => item.path).sort();
const FEATURE = {
  'src/features/api/a/index.ts': 'export const a = 1;\n',
  'src/features/api/a/a.module.ts': 'export const AModule = 1;\n',
  'src/features/api/a/application/run.use-case.ts': 'export const run = 1;\n',
};

test('BE: a complete platform set, app module and feature raise nothing', t => {
  const root = archFixture(t, { files: { ...platformFiles(), ...FEATURE } });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'HFS_REQUIRED_FILE_MISSING'), []);
  assert.deepEqual(findings(report, 'HFS_REQUIRED_FILE_MISSING'), []);
  assert.equal(report.coverage.hfsMachine.requiredFiles.status, 'checked');
  assert.equal(report.coverage.hfsMachine.requiredFiles.missing, 0);
  assert.ok(report.coverage.hfsMachine.requiredFiles.instances >= 6);
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_REQUIRED_FILE_MISSING'));
});

test('BE: a missing required platform instance is flagged once', t => {
  const root = archFixture(t, { files: { ...platformFiles(['primitives']), ...FEATURE } });
  const hits = findings(runArch(root), 'HFS_REQUIRED_FILE_MISSING');
  assert.deepEqual(hits.map(item => item.path), ['src/modules/platform/primitives']);
  assert.equal(hits[0].slot, 'be.platform');
});

test('BE: with no platform module at all all six are missing; one lacking index.ts names the file', t => {
  const none = archFixture(t, { files: { ...FEATURE } });
  assert.deepEqual(paths(runArch(none), 'HFS_REQUIRED_FILE_MISSING'), PLATFORM.map(name => `src/modules/platform/${name}`).sort());
  const noIndex = archFixture(t, { files: { ...platformFiles(['logging']), 'src/modules/platform/logging/logger.ts': 'export const l = 1;\n', ...FEATURE } });
  assert.deepEqual(paths(runArch(noIndex), 'HFS_REQUIRED_FILE_MISSING'), ['src/modules/platform/logging/index.ts']);
});

test('BE: a feature missing index.ts and application/ is flagged, a domain without index.ts too', t => {
  const root = archFixture(t, {
    files: {
      ...platformFiles(),
      'src/features/api/a/a.module.ts': 'export const AModule = 1;\n',
      'src/modules/domain/x/x.service.ts': 'export const s = 1;\n',
    },
  });
  assert.deepEqual(paths(runArch(root), 'HFS_REQUIRED_FILE_MISSING'), ['src/features/api/a/application', 'src/features/api/a/index.ts', 'src/modules/domain/x/index.ts']);
});

test('BE: a feature folder without its <feature>.module.ts is flagged', t => {
  const root = archFixture(t, {
    files: { ...platformFiles(), 'src/features/api/a/index.ts': 'export const a = 1;\n', 'src/features/api/a/application/run.use-case.ts': 'export const run = 1;\n' },
  });
  assert.deepEqual(paths(runArch(root), 'HFS_REQUIRED_FILE_MISSING'), ['src/features/api/a/a.module.ts']);
});

test('BE: minInstances - no feature at all is one finding at hfs.json', t => {
  const root = archFixture(t, { files: { ...platformFiles() } });
  const hits = findings(runArch(root), 'HFS_REQUIRED_FILE_MISSING').filter(item => item.path === 'hfs.json');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].slot, 'be.feature');
  assert.equal(hits[0].minimum, 1);
  assert.equal(hits[0].found, 0);
  const withFeature = archFixture(t, { files: { ...platformFiles(), ...FEATURE } });
  assert.deepEqual(findings(runArch(withFeature), 'HFS_REQUIRED_FILE_MISSING').filter(item => item.path === 'hfs.json'), []);
});

test('BE: a package without src/index.ts is an HFS_REQUIRED_FILE_MISSING', t => {
  const root = archFixture(t, {
    files: { ...platformFiles(), ...FEATURE, 'packages/kit/package.json': '{"name":"@x/kit"}', 'packages/kit/tsconfig.json': '{}', 'packages/kit/src/util.ts': 'export const u = 1;\n' },
    declaration: { optionalSlots: ['repo.packages'] },
  });
  assert.deepEqual(paths(runArch(root), 'HFS_REQUIRED_FILE_MISSING').filter(item => item.startsWith('packages/')), ['packages/kit/src/index.ts']);
});

const NEXT = {
  'apps/web/next.config.ts': 'export default {};\n',
  'apps/web/tsconfig.json': '{"extends":"../../tsconfig.json","include":["src/**/*"]}',
  'apps/web/postcss.config.mjs': 'export default {};\n',
  'apps/web/src/app/global-error.tsx': 'export {};\n',
  'apps/web/src/app/[locale]/layout.tsx': 'export {};\n',
  'apps/web/src/modules/api/index.ts': 'export const api = 1;\n',
  'apps/web/src/modules/api/client.ts': 'export const client = 1;\n',
  'apps/web/src/modules/api/outcome.ts': 'export const outcome = 1;\n',
  'apps/web/src/modules/i18n/index.ts': 'export const i18n = 1;\n',
  'apps/web/src/modules/i18n/config.ts': 'export const c = 1;\n',
  'apps/web/src/modules/i18n/routing.ts': 'export const r = 1;\n',
  'apps/web/src/modules/i18n/navigation.ts': 'export const n = 1;\n',
  'apps/web/src/modules/i18n/request.ts': 'export const q = 1;\n',
  'apps/web/src/modules/i18n/messages/en.json': '{}',
  'apps/web/src/modules/config/index.ts': 'export const config = 1;\n',
  'apps/web/src/modules/routes/index.ts': 'export const routes = 1;\n',
};
const BOUNDARIES = {
  'apps/web/src/app/[locale]/error.tsx': 'export {};\n',
  'apps/web/src/app/[locale]/not-found.tsx': 'export {};\n',
  'apps/web/src/app/[locale]/loading.tsx': 'export {};\n',
};

test('FE: a Next app missing error.tsx, not-found.tsx and loading.tsx is flagged FE_ERROR_BOUNDARY_MISSING', t => {
  const report = runArch(archFixture(t, { profile: 'fe', files: NEXT }));
  assert.deepEqual(paths(report, 'FE_ERROR_BOUNDARY_MISSING'), [
    'apps/web/src/app/[locale]/error.tsx', 'apps/web/src/app/[locale]/loading.tsx', 'apps/web/src/app/[locale]/not-found.tsx',
  ]);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_ERROR_BOUNDARY_MISSING'));
});

test('FE: a complete Next app raises no required-file finding', t => {
  const report = runArch(archFixture(t, { profile: 'fe', files: { ...NEXT, ...BOUNDARIES } }));
  assert.deepEqual(findings(report, 'FE_ERROR_BOUNDARY_MISSING'), []);
  assert.deepEqual(findings(report, 'HFS_REQUIRED_FILE_MISSING'), []);
  assert.deepEqual(findings(report, 'HFS_REQUIRED_FILE_MISSING'), []);
});

test('FE: a missing layout.tsx is HFS_REQUIRED_FILE_MISSING; api client.ts and i18n request.ts are optional (shared by a package) and raise nothing', t => {
  const files = { ...NEXT, ...BOUNDARIES, 'apps/web/src/app/[locale]/layout.tsx': null, 'apps/web/src/modules/api/client.ts': null, 'apps/web/src/modules/i18n/request.ts': null };
  const report = runArch(archFixture(t, { profile: 'fe', files }));
  assert.deepEqual(paths(report, 'HFS_REQUIRED_FILE_MISSING'), ['apps/web/src/app/[locale]/layout.tsx']);
  assert.deepEqual(findings(report, 'FE_ERROR_BOUNDARY_MISSING'), []);
});

test('FE: a required module instance that does not exist is one finding', t => {
  const files = Object.fromEntries(Object.entries({ ...NEXT, ...BOUNDARIES }).filter(([file]) => !file.startsWith('apps/web/src/modules/routes/')));
  const hits = findings(runArch(archFixture(t, { profile: 'fe', files })), 'HFS_REQUIRED_FILE_MISSING');
  assert.deepEqual(hits.map(item => item.path), ['apps/web/src/modules/routes']);
});
