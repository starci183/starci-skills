import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings, databaseFiles, connectionFiles, TWO_CONNECTIONS } from './_hfs-arch-be-fixture.mjs';

// R35 schema-owner (BE_SCHEMA_OWNER): entities and migrations only in persistence/{entities,migrations} of the owning
// capability; persistence/connection.ts names an hfs.json connection; the owner's index exports <c>Entities and <c>Migrations;
// a migration is <epochMs13>-<kebab>.ts with class <Pascal><epochMs13> and a name property equal to the class name.
const ENTITY = (klass, table) => `import { Column, Entity, PrimaryColumn } from 'typeorm';\n@Entity("${table}")\nexport class ${klass} {\n  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;\n}\n`;
const MIGRATION = (klass, name = klass) => `import { MigrationInterface, QueryRunner } from 'typeorm';\nexport class ${klass} implements MigrationInterface {\n  name = "${name}";\n  async up(queryRunner: QueryRunner): Promise<void> { void queryRunner; }\n  async down(queryRunner: QueryRunner): Promise<void> { void queryRunner; }\n}\n`;
const BILLING = 'src/modules/domain/billing';
const GOOD = {
  ...databaseFiles,
  ...connectionFiles('primary', 'PRIMARY', 'PRIMARY'),
  [`${BILLING}/index.ts`]: "export { billingEntities, billingMigrations } from './billing.contracts';\n",
  [`${BILLING}/billing.contracts.ts`]: "import { InvoiceEntity } from './persistence/entities/invoice.entity';\nimport { CreateInvoices1789800000000 } from './persistence/migrations/1789800000000-create-invoices';\nexport const billingEntities = [InvoiceEntity];\nexport const billingMigrations = [CreateInvoices1789800000000];\n",
  [`${BILLING}/persistence/connection.ts`]: "import { PRIMARY_CONNECTION } from '../../../platform/database/primary.connection';\nexport const CONNECTION = PRIMARY_CONNECTION;\n",
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

test('persistence/connection.ts must resolve to a connection declared in hfs.json', t => {
  const undeclared = hits(run(t, { [`${BILLING}/persistence/connection.ts`]: 'export const CONNECTION = "ledger";\n' }));
  assert.equal(undeclared.length, 1);
  assert.equal(undeclared[0].connection, 'ledger');
  const unresolved = hits(run(t, { [`${BILLING}/persistence/connection.ts`]: 'export const CONNECTION = process.env.CONNECTION as string;\n' }));
  assert.match(unresolved[0].message, /does not resolve/);
  const absent = hits(run(t, { [`${BILLING}/persistence/connection.ts`]: 'export const OTHER = "primary";\n' }));
  assert.match(absent[0].message, /must export `CONNECTION`/);
});

test('the owner index must export <c>Entities and <c>Migrations, and nothing else from persistence', t => {
  const missing = hits(run(t, { [`${BILLING}/index.ts`]: "export { billingEntities } from './billing.contracts';\n" }));
  assert.equal(missing.length, 1);
  assert.equal(missing[0].expected, 'billingMigrations');
  const extra = hits(run(t, { [`${BILLING}/index.ts`]: "export { billingEntities, billingMigrations } from './billing.contracts';\nexport { InvoiceEntity } from './persistence/entities/invoice.entity';\n" }));
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
