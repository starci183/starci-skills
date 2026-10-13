import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// A workspace package's public entries are every source file its package.json `exports` maps (dist back to src),
// not only src/index.ts: a client entry `.` and server subpaths (./proxy, ./layout, ./request) are all entries.

const files = (extra = {}) => ({
  'package.json': JSON.stringify({ name: 'demo', private: true, workspaces: ['apps/*', 'packages/*'] }),
  'tsconfig.json': `${JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', allowJs: true, skipLibCheck: true, noEmit: true },
    include: ['apps/**/*', 'packages/**/*'],
  })}\n`,
  'packages/demo-i18n/package.json': JSON.stringify({
    name: '@demo/i18n',
    private: true,
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      './proxy': { types: './dist/proxy.d.ts', default: './dist/proxy.js' },
      './layout': { types: './dist/layout.d.ts', default: './dist/layout.js' },
      './request': { types: './dist/request.d.ts', default: './dist/request.js' },
    },
  }),
  'packages/demo-i18n/tsconfig.build.json': JSON.stringify({ compilerOptions: { rootDir: 'src', outDir: 'dist', declaration: true } }),
  'packages/demo-i18n/src/index.ts': 'export const LOCALES = 1;\n',
  'packages/demo-i18n/src/proxy.ts': 'export const proxy = 1;\n',
  'packages/demo-i18n/src/layout.ts': 'export const readLocaleSegment = 1;\n',
  'packages/demo-i18n/src/request.ts': 'export const createRequestConfig = 1;\n',
  'packages/demo-i18n/src/private.ts': 'export const hidden = 1;\n',
  'apps/web/src/app/page.tsx':
    "import { LOCALES } from '@demo/i18n';\nimport { proxy } from '@demo/i18n/proxy';\nimport { readLocaleSegment } from '@demo/i18n/layout';\nimport { createRequestConfig } from '@demo/i18n/request';\nexport default function Page() { return <p>{LOCALES + proxy + readLocaleSegment + createRequestConfig}</p>; }\n",
  ...extra,
});

test('the client entry and every exports-mapped server subpath are public entries: no ARCH_OWNER_EXPORT_BYPASS', t => {
  const report = runArch(archFixture(t, { profile: 'fe', files: files() }));
  assert.deepEqual(findings(report, 'ARCH_OWNER_EXPORT_BYPASS'), []);
});

test('a deep import that no export maps is still refused', t => {
  const report = runArch(archFixture(t, {
    profile: 'fe',
    files: files({ 'apps/web/src/app/deep.tsx': "import { hidden } from '../../../../packages/demo-i18n/src/private';\nexport const deep = hidden;\n" }),
  }));
  assert.equal(findings(report, 'ARCH_OWNER_EXPORT_BYPASS').length, 1, JSON.stringify(report.errors));
});

test('a "use server" module is no owner entry (Server Actions are forbidden on the front end): a direct deep import is refused like any other', t => {
  const report = runArch(archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/components/blocks/Direct/index.tsx': "import { writeOrder } from '../../../modules/orders/write-order';\nexport const Direct = writeOrder;\n",
      'apps/web/src/components/blocks/Entry/index.tsx': "import { orders } from '../../../modules/orders';\nexport const Entry = orders;\n",
      'apps/web/src/modules/orders/index.ts': 'export const orders = true;\n',
      'apps/web/src/modules/orders/write-order.ts': "'use server';\nexport const writeOrder = async () => 1;\n",
    },
  }));
  const found = findings(report, 'ARCH_OWNER_EXPORT_BYPASS');
  assert.deepEqual(found.map(item => [item.path, item.resolvedPath]), [[
    'apps/web/src/components/blocks/Direct/index.tsx',
    'apps/web/src/modules/orders/write-order.ts',
  ]]);
  assert.deepEqual(findings(report, 'FE_SERVER_ACTION_FORBIDDEN').map(item => item.path), ['apps/web/src/modules/orders/write-order.ts']);
});

test('without a slot `entries` field a second file is not an entry: another owner (modules/config) has no browser.ts entry', t => {
  const report = runArch(archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/modules/config/index.ts': 'export const config = 1;\n',
      'apps/web/src/modules/config/browser.ts': 'export const browserConfig = 1;\n',
      'apps/web/src/hooks/orders/useConfig.ts': "import { browserConfig } from '../../modules/config/browser';\nexport const useConfig = browserConfig;\n",
    },
  }));
  assert.deepEqual(findings(report, 'ARCH_OWNER_EXPORT_BYPASS').map(item => item.resolvedPath), ['apps/web/src/modules/config/browser.ts']);
});
