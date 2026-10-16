// proves: BE_JSON_PARSE_UNGUARDED@lite
// proves: BE_JSON_PARSE_UNGUARDED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonParseNeedsGuard } from './resilience.mjs';
import { appDeclaration } from './fixtures/app.mjs';
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';

for (const edition of ['lite', 'full']) {
  test(`JSON parsing guards valid and invalid cases in ${edition}`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    assert.equal(hfs.edition, edition);
    const filename = at('src/modules/domain/plan/plan.service.ts');
    ruleTester({ root: TYPED_ROOT, hfs }).run('json-parse-needs-guard', jsonParseNeedsGuard, {
      valid: [
        { filename, code: 'function decode(text: string): unknown { try { return JSON.parse(text); } catch { return null; } }' },
        { filename, code: 'function decode(text: string): unknown { try { if (text) { return JSON.parse(text); } } catch { return null; } return null; }' },
      ],
      invalid: [
        { filename, code: 'function decode(text: string): unknown { return JSON.parse(text); }', errors: [{ messageId: 'unguarded' }] },
        { filename, code: 'function decode(text: string): unknown { try { return null; } catch { return JSON.parse(text); } }', errors: [{ messageId: 'unguarded' }] },
        { filename, code: 'function decode(text: string): unknown { try { return (() => JSON.parse(text))(); } catch { return null; } }', errors: [{ messageId: 'unguarded' }] },
      ],
    });
  });
}
