// proves: BE_TYPE_ESCAPE@lite
// proves: BE_TYPE_ESCAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { noFunctionOrEval } from './type-safety.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';

for (const edition of ['lite', 'full']) {
  test(`Function and eval valid and invalid cases in ${edition}`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    assert.equal(hfs.edition, edition);
    const filename = at('src/modules/domain/plan/plan.service.ts');
    ruleTester({ root: TYPED_ROOT, hfs }).run('no-function-or-eval', noFunctionOrEval, {
      valid: [
        { filename, code: 'const double = (value: number): number => value * 2;' },
        { filename, code: 'function call(Function: (source: string) => number): number { return Function("fixed"); }' },
      ],
      invalid: [
        { filename, code: 'declare const callback: Function;', errors: [{ messageId: 'functionType' }] },
        { filename, code: 'eval("1 + 1");', errors: [{ messageId: 'evaluated' }] },
        { filename, code: 'Function("return 1");', errors: [{ messageId: 'evaluated' }] },
        { filename, code: 'new Function("return 1");', errors: [{ messageId: 'evaluated' }] },
      ],
    });
  });
}
