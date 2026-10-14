import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { checkRequiredFiles } from '../../scripts/hfs/architecture/required-files.mjs';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { archFixture } from '../helpers/hfs-arch-fixture.mjs';

const MODULES = 'apps/web/src/modules';

function missingPaths(root, prefix = MODULES) {
  const hfs = openHfs({ repoRoot: root });
  const architecture = checkRequiredFiles({ config: { root, hfs } });
  const slotCheck = checkRepo({ repoRoot: root, tree: false });
  const appCheck = checkRepo({ repoRoot: path.dirname(root), tree: false });
  return [
    architecture.violations.filter(item => item.ruleId === 'HFS_REQUIRED_FILE_MISSING').map(item => item.path),
    slotCheck.findings.filter(item => item.code === 'HFS_SLOT_REQUIRED_MISSING').map(item => item.path),
    appCheck.findings.filter(item => item.code === 'HFS_SLOT_REQUIRED_MISSING').map(item => item.path?.replace(/^fe\//u, '')),
  ].map(paths => paths.filter(file => file?.startsWith(prefix)).sort());
}

test('FE: CSS and nested assets do not require an index.ts in either missing-file check', t => {
  const root = archFixture(t, { profile: 'fe', files: {
    [`${MODULES}/brand/brand.css`]: ':root {}\n',
    [`${MODULES}/assets/icons/mark.svg`]: '<svg/>\n',
    [`${MODULES}/assets/fonts/display.woff2`]: 'fixture font',
    [`${MODULES}/styles/reset.css`]: '@layer base;\n',
    [`${MODULES}/auth/logo.svg`]: '<svg/>\n',
    [`${MODULES}/typed/index.ts`]: 'export {};\n',
  } });
  for (const paths of missingPaths(root)) {
    assert.ok(!paths.some(file => /\/(?:brand|assets|styles|auth)\/index\.ts$/u.test(file)), JSON.stringify(paths));
  }
});

test('FE: a populated required module instance containing only assets also needs no barrel', t => {
  const root = archFixture(t, { profile: 'fe', files: {
    [`${MODULES}/config/settings.json`]: '{}\n',
    [`${MODULES}/routes/assets/map.svg`]: '<svg/>\n',
  } });
  for (const paths of missingPaths(root)) {
    assert.ok(!paths.includes(`${MODULES}/config/index.ts`), JSON.stringify(paths));
    assert.ok(!paths.includes(`${MODULES}/routes/index.ts`), JSON.stringify(paths));
  }
});

test('FE: TypeScript anywhere in a module, including TSX and declarations, still requires its index.ts', t => {
  const root = archFixture(t, { profile: 'fe', files: {
    [`${MODULES}/plain/value.ts`]: 'export const value = 1;\n',
    [`${MODULES}/nested/deep/view.tsx`]: 'export const view = <div/>;\n',
    [`${MODULES}/declarations/types.d.ts`]: 'export interface Value {}\n',
    [`${MODULES}/mixed/style.css`]: '@layer base;\n',
    [`${MODULES}/mixed/deep/value.ts`]: 'export const value = 1;\n',
    [`${MODULES}/sibling/style.css`]: '@layer base;\n',
  } });
  for (const paths of missingPaths(root)) {
    for (const name of ['plain', 'nested', 'declarations', 'mixed']) {
      assert.ok(paths.includes(`${MODULES}/${name}/index.ts`), JSON.stringify(paths));
    }
    assert.ok(!paths.includes(`${MODULES}/sibling/index.ts`), JSON.stringify(paths));
  }
});

test('FE: an absent required module remains missing while an i18n catalog-only module needs no barrel', t => {
  const root = archFixture(t, { profile: 'fe', files: {
    [`${MODULES}/i18n/messages/en.json`]: '{}\n',
  } });
  const [architecture, ...slotChecks] = missingPaths(root);
  for (const name of ['config', 'routes']) {
    assert.ok(architecture.includes(`${MODULES}/${name}`), JSON.stringify(architecture));
    for (const paths of slotChecks) assert.ok(paths.includes(`${MODULES}/${name}/`), JSON.stringify(paths));
  }
  for (const paths of [architecture, ...slotChecks]) {
    assert.ok(!paths.includes(`${MODULES}/i18n/index.ts`), JSON.stringify(paths));
  }
});

test('FE: an asset-only module keeps required files other than index.ts', t => {
  const root = archFixture(t, { profile: 'fe', files: { [`${MODULES}/toast/icon.svg`]: '<svg/>\n' } });
  for (const paths of missingPaths(root, `${MODULES}/toast/`)) {
    assert.deepEqual(paths, ['api.ts', 'hooks.ts', 'toast.tsx'].map(file => `${MODULES}/toast/${file}`));
  }
});

test('BE: asset-only domain modules keep their required index.ts', t => {
  const root = archFixture(t, { files: { 'src/modules/domain/assets/icon.svg': '<svg/>\n' } });
  const hfs = openHfs({ repoRoot: root });
  const architecture = checkRequiredFiles({ config: { root, hfs } });
  assert.ok(architecture.violations.some(item => item.ruleId === 'HFS_REQUIRED_FILE_MISSING' && item.path === 'src/modules/domain/assets/index.ts'));
  const slotCheck = checkRepo({ repoRoot: root, tree: false });
  assert.ok(slotCheck.findings.some(item => item.code === 'HFS_SLOT_REQUIRED_MISSING' && item.path === 'src/modules/domain/assets/index.ts'));
});
