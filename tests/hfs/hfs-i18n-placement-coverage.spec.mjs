// proves: FE_I18N_PLACEMENT@lite
// proves: FE_I18N_PLACEMENT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appFrontendFindings, frontendFindings } from '../../scripts/hfs/rules/frontend-tree.mjs';

function fixture(t, edition) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-i18n-placement-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const manifest = path.join(repoRoot, 'fe/apps/web/package.json');
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, JSON.stringify({ dependencies: { 'next-intl': '4.0.0' } }));
  return { repoRoot, repo: { edition, apps: [{ name: 'web', kind: 'next' }], sides: { fe: { apps: [{ name: 'web', kind: 'next' }], reads: [] } } } };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} placement rejects an absent locale proxy`, (t) => {
    const result = frontendFindings({ ...fixture(t, edition), files: ['apps/web/src/modules/i18n/messages/vi.json'] });
    assert.deepEqual(result.filter((finding) => finding.code === 'FE_I18N_PLACEMENT').map((finding) => finding.path), ['apps/web/src/proxy.ts']);
  });

  test(`${edition} placement accepts the locale proxy, locale routes and default catalog`, (t) => {
    const result = frontendFindings({ ...fixture(t, edition), files: ['apps/web/src/proxy.ts', 'apps/web/src/app/[locale]/page.tsx', 'apps/web/src/modules/i18n/messages/vi.json'] });
    assert.deepEqual(result.filter((finding) => finding.code === 'FE_I18N_PLACEMENT'), []);
  });

  test(`${edition} placement rejects a frontend without a next-intl workspace dependency`, (t) => {
    const result = appFrontendFindings({ ...fixture(t, edition), files: [] });
    assert.equal(result.filter((finding) => finding.code === 'FE_I18N_PLACEMENT').length, 1);
  });

  test(`${edition} placement accepts a workspace that declares next-intl`, (t) => {
    const result = appFrontendFindings({ ...fixture(t, edition), files: ['fe/apps/web/package.json'] });
    assert.deepEqual(result.filter((finding) => finding.code === 'FE_I18N_PLACEMENT'), []);
  });
}
