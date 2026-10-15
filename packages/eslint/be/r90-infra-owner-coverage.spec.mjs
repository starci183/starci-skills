// proves: BE_INFRA_OWNER@lite
// proves: BE_INFRA_OWNER@full
import test from 'node:test';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { appDeclaration } from './fixtures/app.mjs';
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';
import { httpClientOnlyInIntegrations, infraImportOwner } from './infra-owner.mjs';

const domain = at('src/modules/domain/order/order.service.ts');
const httpOwner = at('src/modules/platform/http/http.client.ts');
const integration = at('src/modules/integrations/payos/payos.client.ts');
const rawHttp = 'import axios from "axios"; export { axios };';
const httpCall = [
  'import { HttpClient } from "@modules/platform/http/http.client";',
  'declare const http: HttpClient;',
  'export const readProvider = () => http.get("https://provider/orders");',
].join('\n');

for (const edition of ['lite', 'full']) {
  test(`R90 ${edition} accepts owning infrastructure and rejects foreign raw clients`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
      settings: { starci: { hfs } },
    });
    tester.run('infra-import-owner', infraImportOwner, {
      valid: [
        { filename: httpOwner, code: rawHttp },
        { filename: domain, code: 'export const readValue = (fetch: () => number) => fetch();' },
      ],
      invalid: [
        { filename: domain, code: rawHttp, errors: [{ messageId: 'foreign' }] },
        { filename: domain, code: 'export const readRemote = () => globalThis.fetch("/");', errors: [{ messageId: 'foreign' }] },
      ],
    });
  });

  test(`R90 ${edition} accepts integration HttpClient calls and rejects domain calls`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    const tester = ruleTester({ root: TYPED_ROOT, hfs });
    tester.run('http-client-only-in-integrations', httpClientOnlyInIntegrations, {
      valid: [
        { filename: integration, code: httpCall },
        { filename: domain, code: 'import type { HttpClient } from "@modules/platform/http/http.client"; export type Door = HttpClient;' },
      ],
      invalid: [{ filename: domain, code: httpCall, errors: [{ messageId: 'foreign' }] }],
    });
  });
}
