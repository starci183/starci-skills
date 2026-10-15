// proves: BE_ASYNC_NO_AWAIT@lite
// proves: BE_ASYNC_NO_AWAIT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { asyncNeedsAwait } from './async-discipline.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';

for (const edition of ['lite', 'full']) {
  test(`Async await valid and invalid cases in ${edition}`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    assert.equal(hfs.edition, edition);
    const filename = at('src/modules/domain/plan/plan.service.ts');
    ruleTester({ root: TYPED_ROOT, hfs }).run('async-needs-await', asyncNeedsAwait, {
      valid: [
        { filename, code: 'async function load(): Promise<number> { return await Promise.resolve(1); }' },
        { filename, code: 'function load(): number { return 1; }' },
        { filename, code: 'class Port extends Base { async load(): Promise<number> { return 1; } }' },
      ],
      invalid: [
        { filename, code: 'async function load(): Promise<number> { return 1; }', errors: [{ messageId: 'noAwait' }] },
        { filename, code: 'const load = async (): Promise<number> => 1;', errors: [{ messageId: 'noAwait' }] },
        { filename, code: 'async function load(): Promise<number> { const nested = async () => await Promise.resolve(1); return 1; }', errors: [{ messageId: 'noAwait' }] },
      ],
    });
  });
}
