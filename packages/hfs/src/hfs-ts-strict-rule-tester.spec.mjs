// proves: FE_TYPE_ESCAPE@lite
// proves: FE_TYPE_ESCAPE@full
import test from 'node:test';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { rules } from '../../eslint/fe/type-safety.mjs';
import { at, fixtureHfs } from '../../eslint/fe/fixtures/typed/tester.mjs';

for (const edition of ['lite', 'full']) {
  test(`${edition}: type escape rules reject unsafe expressions and accept checked types`, () => {
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
      settings: { starci: { hfs: fixtureHfs(undefined, { lite: edition === 'lite' }) } },
    });
    const filename = at('apps/web/src/modules/api/client.ts');
    tester.run('no-double-cast', rules['no-double-cast'], {
      valid: [{ filename, code: 'const id = typeof value === "string" ? value : "";' }],
      invalid: [{ filename, code: 'const id = value as unknown as string;', errors: [{ messageId: 'double' }] }],
    });
    tester.run('no-type-assertion', rules['no-type-assertion'], {
      valid: [{ filename, code: 'const id = typeof value === "string" ? value : "";' }],
      invalid: [{ filename, code: 'const id = value as string;', errors: [{ messageId: 'assertion' }] }],
    });
    tester.run('no-non-null-assertion', rules['no-non-null-assertion'], {
      valid: [{ filename, code: 'const id = values[0] ?? "";' }],
      invalid: [{ filename, code: 'const id = values[0]!;', errors: [{ messageId: 'bang' }] }],
    });
    tester.run('no-explicit-any', rules['no-explicit-any'], {
      valid: [{ filename, code: 'const id: unknown = value;' }],
      invalid: [{ filename, code: 'const id: any = value;', errors: [{ messageId: 'any' }] }],
    });
  });
}
