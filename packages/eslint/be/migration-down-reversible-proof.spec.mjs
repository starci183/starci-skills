// proves: BE_MIGRATION_REVERSIBLE@lite
// proves: BE_MIGRATION_REVERSIBLE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationDownReversible } from './schema-authority.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';

for (const edition of ['lite', 'full']) {
  test(`Migration reversal valid and invalid cases in ${edition}`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    assert.equal(hfs.edition, edition);
    const filename = at('src/modules/domain/order/persistence/migrations/1730000000000-create-plan.ts');
    ruleTester({ root: TYPED_ROOT, hfs }).run('migration-down-reversible', migrationDownReversible, {
      valid: [{
        filename,
        code: 'export class CreatePlan1730000000000 { async up(q) { await q.query("CREATE TABLE plan (id int)"); } async down(q) { await q.query("DROP TABLE plan"); } }',
      }],
      invalid: [
        { filename, code: 'export class CreatePlan1730000000000 { async up(q) { await q.query("CREATE TABLE plan (id int)"); } }', errors: [{ messageId: 'missing' }] },
        { filename, code: 'export class CreatePlan1730000000000 { up() {} down() {} }', errors: [{ messageId: 'empty' }] },
        { filename, code: 'export class CreatePlan1730000000000 { up() {} down() { throw new Error("irreversible"); } }', errors: [{ messageId: 'throws' }] },
      ],
    });
  });
}
