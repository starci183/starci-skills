import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// R21 cross-app-duplicate (FE_CROSS_APP_DUPLICATE): two TypeScript files under different apps with equal token content (comments
// and whitespace dropped, identifiers kept) are a file copied instead of moved to a package; a thin adapter is exempt.
const APPS = [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }];
const hits = report => findings(report, 'FE_CROSS_APP_DUPLICATE');
const run = (t, files) => runArch(archFixture(t, { profile: 'fe', apps: APPS, files }));
const ERROR_PAGE = "'use client';\nexport default function GlobalError({ reset }: { reset: () => void }) {\n  return <button onClick={reset}>Retry</button>;\n}\n";

test('a route file copied byte for byte, and again with other comments and whitespace, into another app is a finding on every copy', t => {
  const report = run(t, {
    'apps/web/src/app/global-error.tsx': ERROR_PAGE,
    'apps/admin/src/app/global-error.tsx': `// admin copy\n${ERROR_PAGE.replace(/\n/gu, '\n\n')}`,
  });
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/admin/src/app/global-error.tsx', 'apps/web/src/app/global-error.tsx']);
  assert.match(hits(report)[0].message, /Move it to a package \(packages\/<pkg>\)/);
  assert.deepEqual(hits(report).find(item => item.path.startsWith('apps/web')).twins, ['apps/admin/src/app/global-error.tsx']);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_CROSS_APP_DUPLICATE'));
});

test('a two-line helper copied to another app is a finding: any size counts', t => {
  const report = run(t, {
    'apps/web/src/testing/axe.ts': 'export const axeOptions = { rules: { region: { enabled: false } } };\n',
    'apps/admin/src/testing/axe.ts': 'export const axeOptions = { rules: { region: { enabled: false } } };\n',
  });
  assert.equal(hits(report).length, 2);
});

test('thin adapters that only re-export or import a package symbol are the sanctioned per-app route shape and pass', t => {
  const report = run(t, {
    'apps/web/src/app/global-error.tsx': 'export { default } from "@family/ui/global-error";\n',
    'apps/admin/src/app/global-error.tsx': 'export { default } from "@family/ui/global-error";\n',
    'apps/web/src/app/not-found.tsx': 'import NotFound from "@family/ui/not-found";\nexport default NotFound;\n',
    'apps/admin/src/app/not-found.tsx': 'import NotFound from "@family/ui/not-found";\nexport default NotFound;\n',
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('files that differ by an identifier or a literal, two copies inside one app, and non-source files are not findings', t => {
  const report = run(t, {
    'apps/web/src/testing/axe.ts': 'export const axeOptions = { rules: { region: { enabled: false } } };\n',
    'apps/admin/src/testing/axe.ts': 'export const axeOptions = { rules: { region: { enabled: true } } };\n',
    'apps/web/src/testing/one.ts': 'export const counter = () => 1 + 1;\n',
    'apps/web/src/testing/two.ts': 'export const counter = () => 1 + 1;\n',
    'apps/web/src/modules/i18n/messages/en.json': '{"a":"b"}\n',
    'apps/admin/src/modules/i18n/messages/en.json': '{"a":"b"}\n',
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});
