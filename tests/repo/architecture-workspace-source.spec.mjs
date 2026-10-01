import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// A workspace package is read at its source: an app importing @demo/shared resolves to packages/shared/src whether or
// not packages/shared was built, so no build is needed before `hfs check` and the exports apps consume count as used.

const DECLARED_TSCONFIG = `${JSON.stringify({
  compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', allowJs: true, skipLibCheck: true, noEmit: true },
  include: ['apps/**/*', 'packages/**/*'],
})}\n`;

const unbuilt = (extra = {}) => ({
  // The app root's one package.json: npm workspaces only for the fe side's packages.
  '../../package.json': JSON.stringify({ name: 'demo', private: true, workspaces: ['fe/packages/*'] }),
  'tsconfig.json': DECLARED_TSCONFIG,
  'packages/shared/package.json': JSON.stringify({
    name: '@demo/shared',
    private: true,
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' }, './sub': { types: './dist/sub/index.d.ts', default: './dist/sub/index.js' } },
  }),
  'packages/shared/tsconfig.build.json': JSON.stringify({ compilerOptions: { rootDir: 'src', outDir: 'dist', declaration: true } }),
  'packages/shared/src/index.ts': 'export const root = 1;\nexport const rootUnused = 2;\n',
  'packages/shared/src/sub/index.ts': 'export const leaf = 1;\nexport const leafUnused = 2;\n',
  'apps/web/src/app/page.tsx': "import { root } from '@demo/shared';\nimport { leaf } from '@demo/shared/sub';\nexport default function Page() { return <p>{root + leaf}</p>; }\n",
  ...extra,
});

test('an unbuilt workspace package resolves to source: nothing unresolved, consumed exports are used, an unused export is still reported', t => {
  const root = archFixture(t, { profile: 'fe', files: unbuilt() });
  const report = runArch(root);
  assert.deepEqual(report.errors.filter(item => item.ruleId === 'ARCH_INTERNAL_IMPORT_UNRESOLVED'), [], JSON.stringify(report.errors));
  assert.deepEqual(findings(report, 'ARCH_PACKAGE_EXPORT_BYPASS'), []);
  const dead = findings(report, 'HFS_UNUSED_EXPORT').map(item => `${item.path}:${item.name}`).sort();
  assert.deepEqual(dead, ['packages/shared/src/index.ts:rootUnused']);
});

test('a built workspace package resolves to the same source, not to dist', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: unbuilt({
      'packages/shared/dist/index.js': 'export const root = 1;\n',
      'packages/shared/dist/index.d.ts': 'export declare const root = 1;\n',
      'packages/shared/dist/sub/index.js': 'export const leaf = 1;\n',
      'packages/shared/dist/sub/index.d.ts': 'export declare const leaf = 1;\n',
    }),
  });
  const report = runArch(root);
  const dead = findings(report, 'HFS_UNUSED_EXPORT').map(item => `${item.path}:${item.name}`).sort();
  assert.deepEqual(dead, ['packages/shared/src/index.ts:rootUnused']);
});
