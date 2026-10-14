import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';

// R32 BE_APP_COMPOSITION_ONLY: apps/<app>/src holds its named roles only (main.ts, app.module.ts, <app>.env.ts, <app>.options.ts, compose/<area>.ts);
// any other source file there is business code in the wrong place.
const APP = {
  'apps/core/src/main.ts': "import { AppModule } from './app.module';\nexport const boot = AppModule;\n",
  'apps/core/src/app.module.ts': 'export class AppModule {}\n',
  'src/features/api/a/index.ts': 'export const a = 1;\n',
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
  assert.match(hits[0].message, /<app>\.env\.ts/);
});

test('main.ts may import its app-named environment parser; an environment file named for another app is refused', (t) => {
  const report = runArch(archFixture(t, { files: {
    ...APP,
    'apps/core/src/main.ts': "import { AppModule } from './app.module';\nimport { coreEnvOf } from './core.env';\nexport const boot = { module: AppModule, env: coreEnvOf({ PORT: '3000' }) };\n",
    'apps/core/src/core.env.ts': 'export interface CoreEnv { readonly port: number }\nexport const coreEnvOf = (source: Readonly<Record<string, string | undefined>>): CoreEnv => ({ port: Number(source.PORT) });\n',
    'apps/core/src/other.env.ts': 'export interface OtherEnv { readonly port: number }\n',
  } }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY').map(item => item.path), ['apps/core/src/other.env.ts']);
  assert.deepEqual(findings(report, 'BE_APP_BUSINESS_ROLE'), []);
  assert.deepEqual(findings(report, 'BE_ENTRYPOINT_ONLY_IN_APPS'), []);
});

test('each backend app kind admits its own environment file', (t) => {
  const apps = [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }, { name: 'tools', kind: 'cli' }];
  const files = Object.fromEntries(apps.flatMap(({ name }) => [
    [`apps/${name}/src/main.ts`, 'void 0;\n'],
    [`apps/${name}/src/app.module.ts`, 'export const AppModule = 1;\n'],
    [`apps/${name}/src/${name}.env.ts`, `export const ${name}Env = { port: 3000 };\n`],
  ]));
  const report = runArch(archFixture(t, { apps, files }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY'), []);
});

test('the app environment parser cannot import feature values or types, including non-api feature kinds', (t) => {
  const report = runArch(archFixture(t, { declaration: { optionalSlots: ['be.feature.jobs'] }, files: {
    ...APP,
    'apps/core/src/core.env.ts': "import { a } from '../../../src/features/api/a';\nimport type { JobOptions } from '../../../src/features/jobs/cleanup';\nexport const env = { a };\nexport type Options = JobOptions;\n",
    'src/features/jobs/cleanup/index.ts': 'export interface JobOptions { readonly enabled: boolean }\n',
  } }));
  const hits = findings(report, 'BE_APP_COMPOSITION_ONLY');
  assert.equal(hits.length, 2, JSON.stringify(hits));
  assert.ok(hits.every(item => item.path === 'apps/core/src/core.env.ts'));
  assert.deepEqual(hits.map(item => item.resolvedPath).sort(), ['src/features/api/a/index.ts', 'src/features/jobs/cleanup/index.ts']);
});

test('the app environment parser cannot import a feature transport surface', (t) => {
  const report = runArch(archFixture(t, { files: {
    ...APP,
    'apps/core/src/core.env.ts': "import type { ApiInput } from '../../../src/features/api/a/transport/http/api.input';\nexport type EnvInput = ApiInput;\n",
    'src/features/api/a/transport/http/api.input.ts': 'export interface ApiInput { readonly value: string }\n',
  } }));
  const hits = findings(report, 'BE_APP_COMPOSITION_ONLY');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].resolvedPath, 'src/features/api/a/transport/http/api.input.ts');
});

test('the app environment parser cannot reach a feature through an aliased import and internal re-export', (t) => {
  const report = runArch(archFixture(t, { files: {
    ...APP,
    'apps/core/src/core.env.ts': "import { featureValue as envValue } from './core.options';\nexport const env = { envValue };\n",
    'apps/core/src/core.options.ts': "export { a as featureValue } from '../../../src/features/api/a';\n",
  } }));
  const hits = findings(report, 'BE_APP_COMPOSITION_ONLY');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.deepEqual(hits[0].dependencyChain, ['apps/core/src/core.env.ts', 'apps/core/src/core.options.ts', 'src/features/api/a/index.ts']);
});

test('an admitted environment filename cannot hide a business role', (t) => {
  const report = runArch(archFixture(t, { files: {
    ...APP,
    'apps/core/src/core.env.ts': 'export class PricingService {}\n',
  } }));
  assert.deepEqual(findings(report, 'BE_APP_BUSINESS_ROLE').map(item => item.path), ['apps/core/src/core.env.ts']);
});

test('the <app>.options.ts the api app slot allows is not BE_APP_COMPOSITION_ONLY; another app-named file is', (t) => {
  const report = runArch(archFixture(t, { files: { ...APP, 'apps/core/src/core.options.ts': 'export interface CoreOptions { readonly port: number }\n', 'apps/core/src/other.options.ts': 'export interface OtherOptions { readonly port: number }\n' } }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY').map(item => item.path), ['apps/core/src/other.options.ts']);
});

test('a composition group compose/<area>.ts is an app file; a nested folder under compose/ is not (R245)', (t) => {
  const report = runArch(archFixture(t, { files: {
    ...APP,
    'apps/core/src/compose/platform.ts': 'export const platformModules = (): Array<unknown> => [];\n',
    'apps/core/src/compose/nested/extra.ts': 'export const extra = 1;\n',
  } }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY').map(item => item.path), ['apps/core/src/compose/nested/extra.ts']);
});
