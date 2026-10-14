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

test('main.ts may import its app-named typed environment reader; an environment file named for another app is refused', (t) => {
  const report = runArch(archFixture(t, { files: {
    ...APP,
    'apps/core/src/main.ts': "import { AppModule } from './app.module';\nimport { readCoreEnv } from './core.env';\nexport const boot = { module: AppModule, env: readCoreEnv({ PORT: '3000' }) };\n",
    'apps/core/src/core.env.ts': 'export interface CoreEnv { readonly port: number }\nexport const readCoreEnv = (source: Readonly<Record<string, string | undefined>>): CoreEnv => ({ port: Number(source.PORT) });\n',
    'apps/core/src/other.env.ts': 'export interface OtherEnv { readonly port: number }\n',
  } }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY').map(item => item.path), ['apps/core/src/other.env.ts']);
  assert.deepEqual(findings(report, 'BE_APP_BUSINESS_ROLE'), []);
  assert.deepEqual(findings(report, 'BE_ENTRYPOINT_ONLY_IN_APPS'), []);
});

const CONFIG_IMPORT = '../../../src/modules/platform/config';
const ENVIRONMENT = {
  'src/modules/platform/config/env-source.config.ts': `export class EnvSource {
    static fromProcess(): EnvSource { return new EnvSource(); }
    string(key: string): string { return key; }
    secret(key: string): string { return key; }
    int(key: string): number { return Number(key); }
  }\n`,
  'src/modules/platform/config/platform.config.ts': "import { EnvSource } from './env-source.config';\nexport const parsePlatformConfig = (env: EnvSource) => ({ port: env.int('PORT') });\n",
  'src/modules/platform/config/index.ts': "export { EnvSource } from './env-source.config';\nexport { parsePlatformConfig } from './platform.config';\n",
  'apps/core/src/core.env.ts': `import { EnvSource, parsePlatformConfig } from '${CONFIG_IMPORT}';
    export interface CoreEnv { readonly port: number }
    export const readCoreEnv = (env: EnvSource): CoreEnv => parsePlatformConfig(env);\n`,
};

test('process environment reads are accepted in main.ts and its matching typed app environment reader', (t) => {
  const reads = `const direct = process.env.PORT;
    const bracket = process['env'].PORT;
    const { env: values } = process;
    import { env as importedEnv } from 'node:process';
    import proc from 'node:process';
    const imported = proc.env.PORT;
    const reflected = Reflect.get(process, 'env');\n`;
  const report = runArch(archFixture(t, { files: {
    ...APP,
    ...ENVIRONMENT,
    'apps/core/src/main.ts': `${reads}import { EnvSource } from '${CONFIG_IMPORT}';\nimport { readCoreEnv } from './core.env';\nexport const options = readCoreEnv(EnvSource.fromProcess());\n`,
    'apps/core/src/core.env.ts': `${ENVIRONMENT['apps/core/src/core.env.ts']}${reads}export const source = EnvSource.fromProcess();\n`,
  } }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY'), []);
});

test('options and composition groups refuse direct, bracket, destructured, imported and reflected process environment reads', (t) => {
  const reads = `export const direct = process.env.PORT;
    export const bracket = () => process['env'].PORT;
    const { ['env']: values } = process;
    import { env as importedEnv } from 'node:process';
    import { default as proc } from 'node:process';
    export const imported = proc.env.PORT;
    import * as processNamespace from 'process';
    export const namespaced = processNamespace['env'].PORT;
    export const reflected = Reflect.get(process, 'env');
    export const global = globalThis.process.env.PORT;\n`;
  const paths = ['apps/core/src/core.options.ts', 'apps/core/src/compose/platform.ts'];
  const report = runArch(archFixture(t, { files: { ...APP, ...Object.fromEntries(paths.map(file => [file, reads])) } }));
  const hits = findings(report, 'BE_APP_COMPOSITION_ONLY');
  for (const file of paths) assert.equal(hits.filter(item => item.path === file).length, 8, JSON.stringify(hits));
  assert.ok(hits.every(item => /matching <app>\.env\.ts/.test(item.message)));
});

test('options and composition groups refuse owned EnvSource readers and aliased app or capability readers', (t) => {
  const paths = ['apps/core/src/core.options.ts', 'apps/core/src/compose/platform.ts'];
  const readCalls = (configImport, envImport) => `import { EnvSource, parsePlatformConfig as readPlatform } from '${configImport}';
    import { readCoreEnv as readApp } from '${envImport}';
    declare const env: EnvSource;
    export const direct = env.string('PORT');
    export const bracket = () => env['secret']('API_KEY');
    const { int: readInt } = env;
    export const destructured = readInt('PORT');
    export const source = EnvSource['fromProcess']();
    export const capability = readPlatform(env);
    export const app = readApp(env);\n`;
  const report = runArch(archFixture(t, { files: {
    ...APP,
    ...ENVIRONMENT,
    [paths[0]]: readCalls(CONFIG_IMPORT, './core.env'),
    [paths[1]]: readCalls(`../${CONFIG_IMPORT}`, '../core.env'),
  } }));
  const hits = findings(report, 'BE_APP_COMPOSITION_ONLY');
  for (const file of paths) assert.equal(hits.filter(item => item.path === file).length, 6, JSON.stringify(hits));
});

test('lookalike process and EnvSource objects in composition groups are ordinary options data', (t) => {
  const report = runArch(archFixture(t, { files: {
    ...APP,
    'apps/core/src/compose/platform.ts': `const process = { env: { PORT: '3000' } };
      class EnvSource { string(key: string): string { return key; } }
      export const port = process.env.PORT;
      export const value = new EnvSource().string('PORT');
      import proc from 'node:process';
      export const local = (proc: { env: { PORT: string } }) => proc.env.PORT;\n`,
  } }));
  assert.deepEqual(findings(report, 'BE_APP_COMPOSITION_ONLY'), []);
});

test('each backend app kind admits its own environment file', (t) => {
  const apps = [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }, { name: 'tools', kind: 'cli' }];
  const files = Object.fromEntries(apps.flatMap(({ name }) => [
    [`apps/${name}/src/main.ts`, 'void 0;\n'],
    [`apps/${name}/src/app.module.ts`, 'export const AppModule = 1;\n'],
    [`apps/${name}/src/${name}.env.ts`, `export interface ${name[0].toUpperCase()}${name.slice(1)}Env { readonly port: number }\nexport const read${name[0].toUpperCase()}${name.slice(1)}Env = (): ${name[0].toUpperCase()}${name.slice(1)}Env => ({ port: Number(process.env.PORT) });\n`],
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
