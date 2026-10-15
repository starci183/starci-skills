// proves: BE_RETURN_TYPE@lite
// proves: BE_RETURN_TYPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitHandlerReturnType } from './type-safety.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';

for (const edition of ['lite', 'full']) {
  test(`Handler return types valid and invalid cases in ${edition}`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    assert.equal(hfs.edition, edition);
    const filename = at('src/modules/domain/plan/plan.service.ts');
    ruleTester({ root: TYPED_ROOT, hfs }).run('explicit-handler-return-type', explicitHandlerReturnType, {
      valid: [
        { filename, code: 'export class PlanResolver { @Query() plan(): string { return "ready"; } }' },
        { filename, code: '@Injectable() export class PlanService { load(): number { return 1; } private helper() { return 1; } }' },
      ],
      invalid: [
        { filename, code: 'export class PlanResolver { @Query() plan() { return "ready"; } }', errors: [{ messageId: 'handler' }] },
        { filename, code: '@Injectable() export class PlanService { load() { return 1; } }', errors: [{ messageId: 'publicMethod' }] },
      ],
    });
  });
}
