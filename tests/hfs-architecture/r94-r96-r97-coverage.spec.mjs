// proves: FE_SLOT_FILE_ROLE@lite
// proves: FE_SLOT_FILE_ROLE@full
// proves: HFS_DOC_NOT_ENGLISH@lite
// proves: HFS_DOC_NOT_ENGLISH@full
// proves: FE_NO_TESTS@lite
// proves: FE_NO_TESTS@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appDeclaration, archFixture, DEFAULT_APPS, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';
import { feNoTestsFindings } from '../../scripts/hfs/rules/fe-no-tests.mjs';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
import { loadArchitectureConfig } from '../../scripts/hfs/architecture/config.mjs';
import { checkDocLanguage } from '../../scripts/hfs/architecture/doc-language.mjs';

function architectureFixture(t, edition, files, profile = 'fe') {
  const declaration = { ...appDeclaration(profile, { apps: DEFAULT_APPS[profile] }), edition };
  return archFixture(t, { profile, files: { '../hfs.json': JSON.stringify(declaration), 'apps/web/src/app/.keep': null, 'apps/web/src/modules/config/index.ts': 'export const config = 1;\n', ...files } });
}

function manifestFixture(t, manifest) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-r97-coverage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
  return root;
}

const hookFiles = {
  'apps/web/src/hooks/orders/index.ts': "export { useOrders } from './useOrders';\n",
  'apps/web/src/hooks/orders/useOrders.ts': 'export const useOrders = () => 1;\n',
  'apps/web/src/hooks/orders/orders.shared.ts': 'export const orderKey = 1;\n',
};
const otherLanguage = 'h\u1ea1n cu\u1ed1i \u0111\u00e3 qua';

for (const edition of ['lite', 'full']) {
  test(`${edition} R94 accepts named files inside their owning hook folder`, t => {
    const root = architectureFixture(t, edition, hookFiles);
    assert.deepEqual(findings(runArch(root), 'FE_SLOT_FILE_ROLE'), []);
  });

  test(`${edition} R94 rejects a route role in hooks and a file where a folder belongs`, t => {
    const root = architectureFixture(t, edition, {
      ...hookFiles,
      'apps/web/src/hooks/orders/page.tsx': 'export default () => null;\n',
      'apps/web/src/hooks/useLoose.ts': 'export const useLoose = () => 1;\n',
    });
    assert.deepEqual(findings(runArch(root), 'FE_SLOT_FILE_ROLE').map(item => item.path).sort(byCodeUnit), [
      'apps/web/src/hooks/orders/page.tsx',
      'apps/web/src/hooks/useLoose.ts',
    ]);
  });

  for (const profile of ['be', 'fe']) {
    test(`${edition} ${profile} R96 accepts English prose and applicable localized YAML data`, t => {
      const root = architectureFixture(t, edition, {
        'docs/guide.md': '# Guide\n\nEnglish prose and examples.\n',
        'knowledge/guide.yaml': 'summary: English description.\n',
        'apps/web/src/modules/i18n/messages/vi.yaml': profile === 'fe' ? `greeting: ${otherLanguage}\n` : 'greeting: Hello\n',
      }, profile);
      const config = loadArchitectureConfig(root);
      const report = checkDocLanguage({ config, graph: { resolver: config.hfs } });
      assert.deepEqual(report.violations, []);
    });

    test(`${edition} ${profile} R96 rejects prose, fenced code and decomposed text`, t => {
      const root = architectureFixture(t, edition, {
        'docs/guide.md': `# Guide\n\n${otherLanguage}\n`,
        'docs/example.md': ['# Example', '', '```ts', `const label = '${otherLanguage}';`, '```', ''].join('\n'),
        'knowledge/guide.yaml': `summary: ${otherLanguage.normalize('NFD')}\n`,
        'apps/web/src/modules/i18n/README.md': `${otherLanguage}\n`,
      }, profile);
      const config = loadArchitectureConfig(root);
      const report = checkDocLanguage({ config, graph: { resolver: config.hfs } });
      assert.ok(report.violations.every(item => item.ruleId === 'HFS_DOC_NOT_ENGLISH'));
      assert.deepEqual(report.violations.map(item => item.path).sort(byCodeUnit), [
        'apps/web/src/modules/i18n/README.md',
        'docs/example.md',
        'docs/guide.md',
        'knowledge/guide.yaml',
      ]);
    });
  }

  test(`${edition} R97 accepts production paths and a manifest without test tooling`, t => {
    const root = manifestFixture(t, {
      scripts: { build: 'next build', lint: 'eslint .' },
      dependencies: { next: '16.1.6', react: '19.2.3' },
    });
    assert.deepEqual(feNoTestsFindings({ repoRoot: root, files: [
      'package.json', 'apps/web/src/hooks/orders/useOrders.ts', 'scripts/check-quality.mjs',
    ] }), []);
  });

  test(`${edition} R97 rejects test paths, tooling, scripts and dependencies`, t => {
    const root = manifestFixture(t, {
      scripts: { 'test:unit': 'vitest run', quality: 'node --test scripts/' },
      devDependencies: { vitest: '3.2.7', '@testing-library/react': '16.0.0' },
    });
    const violations = feNoTestsFindings({ repoRoot: root, files: [
      'apps/web/src/hooks/orders/useOrders.spec.ts', 'e2e/sign-in.ts',
      'scripts/check-quality.test.mjs', 'playwright.config.ts', 'package.json',
    ] });
    assert.deepEqual(violations.map(item => item.code), Array(8).fill('FE_NO_TESTS'));
    assert.equal(violations.filter(item => item.path === 'package.json').length, 4);
  });
}
