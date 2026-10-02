import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R45 module-per-transport (BE_MODULE_SHAPE): one <f>-<protocol>.module.ts per transport folder, no module per operation, no
// module-definition in a feature, and apps import only the transport modules their app kind composes (api: graphql, http,
// websocket; worker: schedule, message; cli: cli).
const MODULE = (name, imports = '', importLine = '') => `import { Module } from '@nestjs/common';\n${importLine}@Module({ imports: [${imports}] })\nexport class ${name} {}\n`;
const FEATURE = {
  'src/features/api/a/index.ts': "export { AGraphqlModule } from './transport/graphql/a-graphql.module';\nexport { AScheduleModule } from './transport/schedule/a-schedule.module';\nexport { AModule } from './a.module';\n",
  'src/features/api/a/a.module.ts': MODULE('AModule'),
  'src/features/api/a/transport/graphql/a-graphql.module.ts': MODULE('AGraphqlModule', 'AModule', "import { AModule } from '../../a.module';\n"),
  'src/features/api/a/transport/schedule/a-schedule.module.ts': MODULE('AScheduleModule', 'AModule', "import { AModule } from '../../a.module';\n"),
};
const APP = (imports, names = imports) => `import { Module } from '@nestjs/common';\nimport { ${names} } from '../../../src/features/api/a';\n@Module({ imports: [${imports}] })\nexport class AppModule {}\n`;
const APPS = [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }];
const hits = report => findings(report, 'BE_MODULE_SHAPE').filter(item => item.message.includes('transport') || item.message.includes('module-definition') || item.message.includes('ConfigurableModule') || item.message.includes('Nest module'));
const run = (t, files) => runArch(archFixture(t, {
  apps: APPS,
  files: { ...FEATURE, 'apps/core/src/app.module.ts': APP('AGraphqlModule'), 'apps/jobs/src/main.ts': 'void 0;\n', 'apps/jobs/src/app.module.ts': APP('AScheduleModule'), ...files },
}));

test('one module per transport folder, composed by an app of the right kind, raises no module-per-transport finding', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.modulePerTransport;
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.transportModules, 2);
  assert.equal(coverage.appReferences, 2);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_MODULE_SHAPE'));
});

test('a second module in a transport folder (a module per operation) is BE_MODULE_SHAPE', t => {
  const report = run(t, { 'src/features/api/a/transport/graphql/run.module.ts': MODULE('RunModule') });
  const found = hits(report).filter(item => item.path === 'src/features/api/a/transport/graphql/run.module.ts');
  assert.ok(found.some(item => /second module of the graphql transport/.test(item.message)), JSON.stringify(found));
  assert.ok(found.some(item => /declared in/.test(item.message)));
});

test('a @Module declared in application/, and a module-definition or ConfigurableModuleBuilder in a feature, are BE_MODULE_SHAPE', t => {
  const report = run(t, {
    'src/features/api/a/application/run.handler.ts': MODULE('RunHandlerModule'),
    'src/features/api/a/a.module-definition.ts': "import { ConfigurableModuleBuilder } from '@nestjs/common';\nexport const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<{ x: number }>().build();\n",
  });
  const found = hits(report);
  assert.ok(found.some(item => item.path === 'src/features/api/a/application/run.handler.ts' && /RunHandlerModule/.test(item.message)), JSON.stringify(found));
  assert.ok(found.some(item => item.path === 'src/features/api/a/a.module-definition.ts' && /module-definition inside feature a/.test(item.message)));
  assert.ok(found.some(item => item.path === 'src/features/api/a/a.module-definition.ts' && /ConfigurableModuleBuilder/.test(item.message)));
});

test('an api app composes the schedule module of the service that owns it; a worker app listing a graphql module is BE_MODULE_SHAPE', t => {
  const report = run(t, {
    'apps/core/src/app.module.ts': APP('AGraphqlModule, AScheduleModule'),
    'apps/jobs/src/app.module.ts': APP('AScheduleModule, AGraphqlModule'),
  });
  const found = hits(report);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found.some(item => item.app === 'core'), false, 'an api app composes schedule and message transports (composedBy [api, worker])');
  assert.ok(found.some(item => item.app === 'jobs' && item.protocol === 'graphql' && /composes message, schedule transports only/.test(item.message)));
});

test('an app listing a feature application module instead of its transport modules is BE_MODULE_SHAPE', t => {
  const report = run(t, { 'apps/core/src/app.module.ts': APP('AGraphqlModule, AModule') });
  const found = hits(report);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].module, 'AModule');
  assert.match(found[0].message, /application module of feature a/);
});
