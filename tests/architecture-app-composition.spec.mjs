import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, findings, runArch } from './_hfs-arch-fixture.mjs';

// R32 BE_APP_COMPOSITION_ONLY: apps/<app>/src holds composition only (main.ts, app.module.ts, <app>.options.ts);
// any other source file there is business code in the wrong place.
const APP = {
  'apps/core/src/main.ts': "import { AppModule } from './app.module';\nexport const boot = AppModule;\n",
  'apps/core/src/app.module.ts': 'export class AppModule {}\n',
  'src/features/a/index.ts': 'export const a = 1;\n',
};

test('an app that holds only its composition files has no BE_APP_COMPOSITION_ONLY finding', (t) => {
  const report = runArch(archFixture(t, { files: APP }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY'), []);
});

test('a helper file in an app root is BE_APP_COMPOSITION_ONLY', (t) => {
  const report = runArch(archFixture(t, { files: { ...APP, 'apps/core/src/pricing.ts': 'export const price = (n: number) => n * 2;\n' } }));
  const hits = findings(report, 'BE_APP_COMPOSITION_ONLY');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'apps/core/src/pricing.ts');
});

test('the <app>.options.ts the api app slot allows is not BE_APP_COMPOSITION_ONLY; another app-named file is', (t) => {
  const report = runArch(archFixture(t, { files: { ...APP, 'apps/core/src/core.options.ts': 'export interface CoreOptions { readonly port: number }\n', 'apps/core/src/other.options.ts': 'export interface OtherOptions { readonly port: number }\n' } }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY').map(item => item.path), ['apps/core/src/other.options.ts']);
});
