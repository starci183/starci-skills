// proves: FE_I18N_CATALOG@lite
// proves: FE_I18N_CATALOG@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { frontendFindings } from '../../scripts/hfs/rules/frontend-tree.mjs';

function catalogFixture(t, edition, english) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-i18n-catalog-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const messages = 'apps/web/src/modules/i18n/messages/';
  const catalogs = { vi: { home: { title: 'Trang chu', action: 'Mo' } }, en: english };
  for (const [locale, catalog] of Object.entries(catalogs)) {
    const file = path.join(repoRoot, messages, `${locale}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(catalog));
  }
  return {
    repoRoot,
    files: ['apps/web/src/proxy.ts', `${messages}vi.json`, `${messages}en.json`],
    repo: { edition, apps: [{ name: 'web', kind: 'next' }] },
  };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} catalog parity rejects a missing nested translation key`, (t) => {
    const result = frontendFindings(catalogFixture(t, edition, { home: { title: 'Home' } }));
    const findings = result.filter((finding) => finding.code === 'FE_I18N_CATALOG');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, 'apps/web/src/modules/i18n/messages/en.json');
    assert.deepEqual(findings[0].missing, ['home.action']);
  });

  test(`${edition} catalog parity accepts translated values with identical nested keys`, (t) => {
    const result = frontendFindings(catalogFixture(t, edition, { home: { title: 'Home', action: 'Open' } }));
    assert.deepEqual(result.filter((finding) => finding.code === 'FE_I18N_CATALOG'), []);
  });
}
