// proves: FE_TYPE_ESCAPE@lite
// proves: FE_TYPE_ESCAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { rules } from '../../packages/eslint/fe/type-safety.mjs';
import { why } from '../../packages/eslint/fe/lib/why.mjs';
import { at, fixtureHfs } from '../../packages/eslint/fe/fixtures/typed/tester.mjs';

const cases = [
  ['no-double-cast', 'double', 'const id = value as unknown as string;', 'const id = typeof value === "string" ? value : "";'],
  ['no-type-assertion', 'assertion', 'const id = value as string;', 'const id = typeof value === "string" ? value : "";'],
  ['no-non-null-assertion', 'bang', 'const id = values[0]!;', 'const id = values[0] ?? "";'],
  ['no-explicit-any', 'any', 'const id: any = value;', 'const id: unknown = value;'],
];

for (const edition of ['lite', 'full']) {
  for (const [name, messageId, violating, repaired] of cases) {
    test(`${edition}: ${name} reports a type escape and accepts its checked replacement`, () => {
      const hfs = fixtureHfs(undefined, { lite: edition === 'lite' });
      const linter = new Linter();
      const ruleId = `starci-fe/${name}`;
      const config = [{
        files: ['**/*.ts'],
        languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
        settings: { starci: { hfs } },
        plugins: { 'starci-fe': { rules } },
        rules: { [ruleId]: 'error' },
      }];
      const lint = source => linter.verify(source, config, { filename: at('apps/web/src/modules/api/client.ts') });
      const found = lint(violating);
      assert.deepEqual(found.map(finding => [finding.ruleId, finding.messageId, finding.severity]), [
        [ruleId, messageId, 2],
      ]);
      assert.equal(why[name].code, 'FE_TYPE_ESCAPE');
      assert.deepEqual(lint(repaired), []);
    });
  }
}
