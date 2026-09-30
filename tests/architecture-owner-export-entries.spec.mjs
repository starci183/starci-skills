import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

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
