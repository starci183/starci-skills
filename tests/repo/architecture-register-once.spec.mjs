import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R45 register-once (BE_MODULE_SHAPE), on the module graph from the app roots: a capability's representative module is
// registered once per app with `isGlobal: true` and imported by no other module; a sub-module has exactly one importer and
// is in no app root; `isGlobal: true` appears only in an app root. The feature case: a feature's application module is
// imported by each protocol module of that feature.

const MODULE = (name, imports = '') => `import { Module } from '@nestjs/common';
${imports ? `${imports.split(';')[0]};\n` : ''}@Module({ ${imports ? `imports: [${imports.split(';')[1]}]` : ''} })
export class ${name} {
  static register(options: { isGlobal?: boolean }) { return { module: ${name}, ...options }; }
}
`;
const REPRESENTATIVES = {
  'src/modules/platform/config/index.ts': "export { ConfigModule } from './config.module';\n",
  'src/modules/platform/config/config.module.ts': MODULE('ConfigModule'),
  'src/modules/domain/billing/index.ts': "export { BillingModule } from './billing.module';\n",
  'src/modules/domain/billing/billing.module.ts': MODULE('BillingModule', "import { InvoiceModule } from './invoice.module';InvoiceModule"),
  'src/modules/domain/billing/invoice.module.ts': MODULE('InvoiceModule'),
};
const FEATURE = {
  'src/features/api/a/index.ts': "export { AGraphqlModule } from './transport/graphql/a-graphql.module';\nexport { AHttpModule } from './transport/http/a-http.module';\n",
  'src/features/api/a/a.module.ts': "import { Module } from '@nestjs/common';\n@Module({})\nexport class AModule {}\n",
  'src/features/api/a/transport/graphql/a-graphql.module.ts': "import { Module } from '@nestjs/common';\nimport { AModule } from '../../a.module';\n@Module({ imports: [AModule] })\nexport class AGraphqlModule {}\n",
  'src/features/api/a/transport/http/a-http.module.ts': "import { Module } from '@nestjs/common';\nimport { AModule } from '../../a.module';\n@Module({ imports: [AModule] })\nexport class AHttpModule {}\n",
};
const APP = imports => `import { Module } from '@nestjs/common';
import { ConfigModule } from '../../../src/modules/platform/config';
import { BillingModule } from '../../../src/modules/domain/billing';
import { AGraphqlModule, AHttpModule } from '../../../src/features/api/a';
@Module({ imports: [${imports.join(', ')}] })
export class AppModule {}
`;
const GOOD = ['ConfigModule.register({ isGlobal: true })', 'BillingModule.register({ isGlobal: true })', 'AGraphqlModule', 'AHttpModule'];
const hits = report => findings(report, 'BE_MODULE_SHAPE');
const about = (report, text) => hits(report).filter(item => item.message.includes(text));
const run = (t, files) => runArch(archFixture(t, { files: { ...REPRESENTATIVES, ...FEATURE, ...files } }));

test('BE: representatives registered once with isGlobal true, one sub-module with one importer, and the feature case raise nothing', t => {
  const report = run(t, { 'apps/core/src/app.module.ts': APP(GOOD) });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.registerOnce;
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.apps, 1);
  assert.equal(coverage.rootImports, 4);
  assert.equal(coverage.registrations, 2);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_MODULE_SHAPE'));
});

test('BE: a module listed twice in an app root, directly or through a helper, is refused once', t => {
  const twice = run(t, { 'apps/core/src/app.module.ts': APP([...GOOD, 'ConfigModule.register({ isGlobal: true })']) });
  const found = about(twice, 'registered more than once');
  assert.equal(found.length, 1);
  assert.equal(found[0].app, 'core');
  assert.equal(found[0].module, 'ConfigModule');
  const helper = run(t, {
    'apps/core/src/app.module.ts': `import { Module } from '@nestjs/common';
import { ConfigModule } from '../../../src/modules/platform/config';
import { BillingModule } from '../../../src/modules/domain/billing';
const shared = () => [ConfigModule.register({ isGlobal: true })];
@Module({ imports: [...shared(), ConfigModule.register({ isGlobal: true }), BillingModule.register({ isGlobal: true })] })
export class AppModule {}
`,
  });
  assert.equal(about(helper, 'registered more than once').length, 1);
});

test('BE: a capability module at the app root without the literal isGlobal true, or as a bare class, is refused', t => {
  const noGlobal = run(t, { 'apps/core/src/app.module.ts': APP(['ConfigModule.register({ isGlobal: false })', 'BillingModule.register({})', 'AGraphqlModule', 'AHttpModule']) });
  assert.equal(about(noGlobal, 'without the literal `isGlobal: true`').length, 2);
  const bare = run(t, { 'apps/core/src/app.module.ts': APP(['ConfigModule', 'BillingModule.register({ isGlobal: true })', 'AGraphqlModule', 'AHttpModule']) });
  assert.equal(about(bare, 'listed in imports as a bare class').length, 1);
});

test('BE: a module importing another capability\'s registered module is refused at the importer', t => {
  const report = run(t, {
    'apps/core/src/app.module.ts': APP(GOOD),
    'src/modules/domain/invoices/index.ts': "export { InvoicesModule } from './invoices.module';\n",
    'src/modules/domain/invoices/invoices.module.ts': "import { Module } from '@nestjs/common';\nimport { ConfigModule } from '../../platform/config';\nimport { BillingModule } from '../billing';\n@Module({ imports: [ConfigModule, BillingModule.register({})] })\nexport class InvoicesModule {}\n",
  });
  const found = about(report, 'so no other module imports it');
  assert.deepEqual(found.map(item => item.module).sort(), ['BillingModule', 'ConfigModule']);
  assert.ok(found.every(item => item.path === 'src/modules/domain/invoices/invoices.module.ts'));
  assert.match(found[0].message, /root of app core/);
});

test('BE: a sub-module imported by two modules, or also listed in an app root, is refused', t => {
  const two = run(t, {
    'apps/core/src/app.module.ts': APP(GOOD),
    'src/modules/domain/shipping/index.ts': "export { ShippingModule } from './shipping.module';\n",
    'src/modules/domain/shipping/shipping.module.ts': "import { Module } from '@nestjs/common';\nimport { InvoiceModule } from '../billing/invoice.module';\n@Module({ imports: [InvoiceModule] })\nexport class ShippingModule {}\n",
  });
  const found = about(two, 'InvoiceModule is imported by 2 modules');
  assert.equal(found.length, 1);
  assert.equal(found[0].path, 'src/modules/domain/shipping/shipping.module.ts');
  const listed = run(t, { 'apps/core/src/app.module.ts': APP([...GOOD, 'InvoiceModule']).replace("import { BillingModule }", "import { InvoiceModule } from '../../../src/modules/domain/billing/invoice.module';\nimport { BillingModule }") });
  assert.equal(about(listed, 'InvoiceModule is registered in the root of app core, so no other module imports it').length, 1);
});

test('BE: the feature case is bounded to the feature owner: another feature importing the application module is a second importer', t => {
  const report = run(t, {
    'apps/core/src/app.module.ts': APP(GOOD),
    'src/features/api/b/index.ts': "export { BModule } from './b.module';\n",
    'src/features/api/b/b.module.ts': "import { Module } from '@nestjs/common';\nimport { AModule } from '../a/a.module';\n@Module({ imports: [AModule] })\nexport class BModule {}\n",
  });
  assert.equal(about(report, 'AModule is imported by 3 modules').length, 2);
});

test('BE: `isGlobal: true` outside an app root is refused, `isGlobal: false` is not', t => {
  const report = run(t, {
    'apps/core/src/app.module.ts': APP(GOOD),
    'src/modules/platform/config/config.options.ts': 'export const off = { isGlobal: false };\nexport const own = { isGlobal: true };\n',
  });
  const found = about(report, '`isGlobal: true` appears only in the app root');
  assert.equal(found.length, 1);
  assert.equal(found[0].path, 'src/modules/platform/config/config.options.ts');
  assert.equal(found[0].line, 2);
});

// A worker app composes no http/graphql transport module (slots composedBy), so it registers the representatives only.
test('BE: two apps may each register the same representative once', t => {
  const report = runArch(archFixture(t, {
    apps: [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }],
    files: { ...REPRESENTATIVES, ...FEATURE, 'apps/core/src/app.module.ts': APP(GOOD), 'apps/jobs/src/app.module.ts': APP(GOOD.slice(0, 2)) },
  }));
  assert.deepEqual(hits(report), []);
});

test('BE: the test world (be.tests.world) is a composition root: isGlobal true and module imports there raise nothing, the same code in another test folder or a feature does', t => {
  const compose = "import { ConfigModule } from '../../modules/platform/config';\nimport { BillingModule } from '../../modules/domain/billing';\nexport const modules = [ConfigModule.register({ isGlobal: true }), BillingModule.register({ isGlobal: true })];\nexport const own = { imports: [BillingModule], isGlobal: true };\n";
  const world = run(t, { 'apps/core/src/app.module.ts': APP(GOOD), 'src/tests/world/use-test-world.ts': compose });
  assert.deepEqual(hits(world).filter(item => item.path.startsWith('src/tests/')), []);
  const spec = run(t, { 'apps/core/src/app.module.ts': APP(GOOD), 'src/tests/fixtures/compose.ts': compose });
  assert.ok(hits(spec).some(item => item.path === 'src/tests/fixtures/compose.ts' && item.message.includes('isGlobal: true')));
  const feature = run(t, { 'apps/core/src/app.module.ts': APP(GOOD), 'src/features/api/a/compose.ts': compose.replaceAll('../../modules', '../../modules') });
  assert.ok(hits(feature).some(item => item.path === 'src/features/api/a/compose.ts'));
});
