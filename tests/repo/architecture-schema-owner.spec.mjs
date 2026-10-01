import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings, databaseFiles, connectionFiles, TWO_CONNECTIONS } from '../helpers/hfs-arch-be-fixture.mjs';

// R35 schema-owner (BE_SCHEMA_OWNER): entities and migrations only in persistence/{entities,migrations} of the owning
// capability; persistence/connection.ts declares the arrays, and the apps register them under exactly one declared connection (no CONNECTION alias); the owner's index exports <c>Entities and <c>Migrations;
// a migration is <epochMs13>-<kebab>.ts with class <Pascal><epochMs13> and a name property equal to the class name.
const ENTITY = (klass, table) => `import { Column, Entity, PrimaryColumn } from 'typeorm';\n@Entity("${table}")\nexport class ${klass} {\n  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;\n}\n`;
const MIGRATION = (klass, name = klass) => `import { MigrationInterface, QueryRunner } from 'typeorm';\nexport class ${klass} implements MigrationInterface {\n  name = "${name}";\n  async up(queryRunner: QueryRunner): Promise<void> { void queryRunner; }\n  async down(queryRunner: QueryRunner): Promise<void> { void queryRunner; }\n}\n`;
const BILLING = 'src/modules/domain/billing';
const APP = 'apps/core/src/app.module.ts';
const REGISTER = (literal, extra = '') => `import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../src/modules/platform/database';
import { PRIMARY_CONNECTION } from '../../../src/modules/platform/database/primary.connection';
import { AGENTOS_CONNECTION } from '../../../src/modules/platform/database/agentos.connection';
import { billingEntities, billingMigrations } from '../../../src/modules/domain/billing';
${extra}
@Module({ imports: [DatabaseModule.register({ connections: [${literal}] })] })
export class AppModule {}
`;
const PRIMARY_ENTRY = '{ name: PRIMARY_CONNECTION, entities: billingEntities, migrations: billingMigrations }';
const GOOD = {
  ...databaseFiles,
  ...connectionFiles('primary', 'PRIMARY', 'PRIMARY'),
  ...connectionFiles('agentos', 'AGENTOS', 'AGENTOS'),
  [`${BILLING}/index.ts`]: "export { billingEntities, billingMigrations } from './persistence/connection';\n",
  [`${BILLING}/persistence/connection.ts`]: "import { InvoiceEntity } from './entities/invoice.entity';\nimport { CreateInvoices1789800000000 } from './migrations/1789800000000-create-invoices';\nexport const billingEntities = [InvoiceEntity];\nexport const billingMigrations = [CreateInvoices1789800000000];\n",
  [APP]: REGISTER(PRIMARY_ENTRY),
  [`${BILLING}/persistence/entities/invoice.entity.ts`]: ENTITY('InvoiceEntity', 'invoices'),
  [`${BILLING}/persistence/migrations/1789800000000-create-invoices.ts`]: MIGRATION('CreateInvoices1789800000000'),
};
const hits = report => findings(report, 'BE_SCHEMA_OWNER');
const run = (t, files) => runArch(archFixture(t, { ...TWO_CONNECTIONS, files: { ...GOOD, ...files } }));

test('an owning capability with entity, migration, connection and index exports raises no BE_SCHEMA_OWNER', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.schemaOwner;
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.entities, 1);
  assert.equal(coverage.migrations, 1);
  assert.equal(coverage.capabilities, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_SCHEMA_OWNER'));
});

test('an entity or a migration outside a capability persistence folder is BE_SCHEMA_OWNER', t => {
  const report = run(t, {
    'src/features/a/index.ts': 'export const a = 1;\n',
    'src/features/a/application/order.entity.ts': ENTITY('OrderEntity', 'orders'),
    'src/features/a/migrations/1789800000001-orders.ts': MIGRATION('Orders1789800000001'),
    'src/modules/integrations/payos/index.ts': 'export const p = 1;\n',
    'src/modules/integrations/payos/persistence/entities/token.entity.ts': ENTITY('TokenEntity', 'tokens'),
  });
  const paths = hits(report).map(item => item.path);
  assert.ok(paths.includes('src/features/a/application/order.entity.ts'), paths.join());
  assert.ok(paths.includes('src/features/a/migrations/1789800000001-orders.ts'), paths.join());
  assert.ok(paths.includes('src/modules/integrations/payos/persistence/entities/token.entity.ts'), paths.join());
});

test('an entity in the migrations folder and a migration in the entities folder are BE_SCHEMA_OWNER', t => {
  const report = run(t, {
    [`${BILLING}/persistence/migrations/1789800000002-swap.ts`]: ENTITY('SwapEntity', 'swaps'),
    [`${BILLING}/persistence/entities/late.entity.ts`]: MIGRATION('Late1789800000003'),
  });
  assert.equal(hits(report).filter(item => item.path.endsWith('1789800000002-swap.ts') && /Entity SwapEntity/.test(item.message)).length, 1);
  assert.equal(hits(report).filter(item => item.path.endsWith('late.entity.ts') && /Migration Late1789800000003/.test(item.message)).length, 1);
});

test('a capability has no CONNECTION alias: its connection is the one its arrays are registered on, which hfs.json declares', t => {
  const undeclared = hits(run(t, { [APP]: REGISTER('{ name: "ledger", entities: billingEntities, migrations: billingMigrations }') }));
  assert.equal(undeclared.length, 1);
  assert.equal(undeclared[0].connection, 'ledger');
  assert.match(undeclared[0].message, /does not declare/);
  const unregistered = hits(run(t, { [APP]: REGISTER('{ name: PRIMARY_CONNECTION }') }));
  assert.equal(unregistered.length, 1);
  assert.match(unregistered[0].message, /no app registers them/);
  const missingArrays = hits(run(t, { [`${BILLING}/persistence/connection.ts`]: 'export const OTHER = 1;\n', [`${BILLING}/index.ts`]: 'export const billing = 1;\n', [APP]: REGISTER('{ name: PRIMARY_CONNECTION }').replace(/import \{ billing.*\n/, '') }));
  assert.ok(missingArrays.some(item => /must export billingEntities/.test(item.message)), JSON.stringify(missingArrays));
});

test('the arrays of one capability registered on two connections are BE_SCHEMA_OWNER; the same connection in two apps is fine', t => {
  const split = hits(run(t, { 'apps/core/src/app.module.ts': REGISTER(`${PRIMARY_ENTRY}, { name: AGENTOS_CONNECTION, entities: billingEntities }`) }));
  assert.equal(split.length, 1, JSON.stringify(split));
  assert.equal(split[0].connection, 'agentos');
  assert.match(split[0].message, /agentos and primary.*exactly one connection/);
  const acrossApps = hits(run(t, { 'apps/core/src/app.module.ts': REGISTER(PRIMARY_ENTRY), 'apps/migrate/src/main.ts': REGISTER(PRIMARY_ENTRY) }));
  assert.deepEqual(acrossApps, [], JSON.stringify(acrossApps));
  const splitAcrossApps = hits(run(t, { 'apps/migrate/src/main.ts': REGISTER('{ name: AGENTOS_CONNECTION, entities: billingEntities, migrations: billingMigrations }') }));
  assert.equal(splitAcrossApps.length, 1, JSON.stringify(splitAcrossApps));
});

test('a connection reached through a spread of an options property or a config call is the registered connection', t => {
  const options = 'export interface Options { database: { name: string } }\nexport const options: Options = { database: { name: "primary" } };\n';
  const viaProperty = hits(run(t, {
    'apps/core/src/core.options.ts': options,
    [APP]: REGISTER('{ ...options.database, entities: billingEntities, migrations: billingMigrations }', "import { options } from './core.options';"),
  }));
  assert.deepEqual(viaProperty, [], JSON.stringify(viaProperty));
  const viaCall = hits(run(t, { [APP]: REGISTER(`${PRIMARY_ENTRY}, { ...parse(), entities: billingEntities, migrations: [...billingMigrations] }`, 'const parse = () => ({ name: AGENTOS_CONNECTION });') }));
  assert.equal(viaCall.length, 1, JSON.stringify(viaCall));
  assert.equal(viaCall[0].connection, 'agentos');
});

test('an entity manager injector of another connection inside the capability is BE_SCHEMA_OWNER; its own connection is fine', t => {
  const own = hits(run(t, { [`${BILLING}/invoice.reader.ts`]: "import { InjectPrimaryEntityManager } from '../../platform/database/primary.decorators';\nexport const read = () => InjectPrimaryEntityManager();\n" }));
  assert.deepEqual(own, [], JSON.stringify(own));
  const foreign = hits(run(t, { [`${BILLING}/invoice.reader.ts`]: "import { InjectAgentosEntityManager } from '../../platform/database/agentos.decorators';\nexport const read = () => InjectAgentosEntityManager();\n" }));
  assert.equal(foreign.length, 1, JSON.stringify(foreign));
  assert.equal(foreign[0].connection, 'agentos');
  assert.equal(foreign[0].expected, 'primary');
});

test('the owner index must export <c>Entities and <c>Migrations, and nothing else from persistence', t => {
  const missing = hits(run(t, { [`${BILLING}/index.ts`]: "export { billingEntities } from './persistence/connection';\n" }));
  assert.equal(missing.length, 1);
  assert.equal(missing[0].expected, 'billingMigrations');
  const extra = hits(run(t, { [`${BILLING}/index.ts`]: "export { billingEntities, billingMigrations } from './persistence/connection';\nexport { InvoiceEntity } from './persistence/entities/invoice.entity';\n" }));
  assert.equal(extra.length, 1);
  assert.equal(extra[0].name, 'InvoiceEntity');
});

test('a migration must be <epochMs13>-<kebab>.ts, class <Pascal><epochMs13>, name equal to the class, and has no spec', t => {
  const report = run(t, {
    [`${BILLING}/persistence/migrations/1789800000004-add-column.ts`]: MIGRATION('AddColumn'),
    [`${BILLING}/persistence/migrations/1789800000005-add-index.ts`]: MIGRATION('AddIndex1789800000005', 'AddIndex'),
    [`${BILLING}/persistence/migrations/20260930-late.ts`]: MIGRATION('Late20260930'),
    [`${BILLING}/persistence/migrations/1789800000000-create-invoices.spec.ts`]: 'export {};\n',
  });
  const messages = hits(report).map(item => `${item.path.split('/').pop()}: ${item.message}`);
  assert.ok(messages.some(text => /^1789800000004-add-column\.ts: Migration class AddColumn must be named AddColumn1789800000004/.test(text)), messages.join('\n'));
  assert.ok(messages.some(text => /^1789800000005-add-index\.ts: Migration AddIndex1789800000005 must declare/.test(text)), messages.join('\n'));
  assert.ok(messages.some(text => /^20260930-late\.ts: .*not named <epochMs13>/.test(text)), messages.join('\n'));
  assert.ok(messages.some(text => /create-invoices\.spec\.ts: .*unit spec of a migration/.test(text)), messages.join('\n'));
});
