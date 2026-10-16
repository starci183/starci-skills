// proves: FE_SERVER_ACTION_FORBIDDEN@lite FE_SERVER_ACTION_FORBIDDEN@full
// proves: FE_STACK_FORBIDDEN@lite FE_STACK_FORBIDDEN@full
import assert from 'node:assert/strict';
import test from 'node:test';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { appDeclaration } from '../be/fixtures/app.mjs';
import { at, TYPED_ROOT } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';
import { noServerAction } from './client-boundary.mjs';
import { feStackImport } from './fe-stack.mjs';

for (const edition of ['lite', 'full']) {
  test(`no-server-action accepts valid modules and rejects directives in ${edition}`, () => {
    const declaration = { ...appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] }), edition };
    const hfs = hfsFromDeclaration(declaration, TYPED_ROOT);
    assert.equal(hfs.edition, edition);
    const tester = new RuleTester({ languageOptions: { parser: tsParser }, settings: { starci: { hfs } } });
    tester.run('no-server-action', noServerAction, {
      valid: [
        { filename: at('apps/web/src/modules/orders/format.ts'), code: "export const label = 'use server';" },
        { filename: at('apps/web/src/modules/orders/save.ts'), code: "export const save = () => { const text = 'use server'; return text; };" },
      ],
      invalid: [
        { filename: at('apps/web/src/modules/orders/actions.ts'), code: "'use strict'; 'use server'; export const save = async () => 1;", errors: [{ messageId: 'action' }] },
        { filename: at('apps/web/src/modules/orders/save.ts'), code: "export async function save() { 'use server'; return 1; }", errors: [{ messageId: 'action' }] },
        { filename: at('apps/web/src/modules/orders/inline.ts'), code: "export const save = async () => { 'use server'; return 1; };", errors: [{ messageId: 'action' }] },
      ],
    });
  });

  test(`fe-stack-import accepts canonical imports and rejects alternatives in ${edition}`, () => {
    const declaration = { ...appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] }), edition };
    const hfs = hfsFromDeclaration(declaration, TYPED_ROOT);
    assert.equal(hfs.edition, edition);
    const tester = new RuleTester({ languageOptions: { parser: tsParser }, settings: { starci: { hfs } } });
    const filename = at('apps/web/src/components/blocks/Orders/index.tsx');
    tester.run('fe-stack-import', feStackImport, {
      valid: [
        { filename, code: "import { useForm } from 'react-hook-form'; import { z } from 'zod';" },
        { filename, code: "import { format } from './date-fns';" },
      ],
      invalid: [
        { filename, code: "import { format } from 'date-fns/format';", errors: [{ messageId: 'forbidden' }] },
        { filename, code: "export { toast } from 'sonner';", errors: [{ messageId: 'forbidden' }] },
        { filename, code: "const dates = await import('moment');", errors: [{ messageId: 'forbidden' }] },
        { filename, code: "import type { Moment } from 'moment';", errors: [{ messageId: 'forbidden' }] },
      ],
    });
  });
}
