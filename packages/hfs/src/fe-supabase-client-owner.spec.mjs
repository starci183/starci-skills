// proves: FE_SUPABASE_CLIENT_OWNER@lite
// proves: FE_SUPABASE_CLIENT_OWNER@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch } from './helpers/hfs-arch-fixture.mjs';

const code = 'FE_SUPABASE_CLIENT_OWNER';
const sdk = {
  '../node_modules/@supabase/ssr/package.json': JSON.stringify({ name: '@supabase/ssr', types: 'index.d.ts' }),
  '../node_modules/@supabase/ssr/index.d.ts': `export interface Client {
  auth: { getSession(): Promise<unknown> }; from(table: string): unknown;
}
export declare function createBrowserClient(url: string, key: string): Client;`,
};

function fixture(t, edition, invalid) {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  declaration.edition = edition;
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  return archFixture(t, { profile: 'fe', files: {
    '../hfs.json': JSON.stringify(declaration),
    ...sdk,
    'apps/web/src/modules/auth/client.ts': `import { createBrowserClient } from '@supabase/ssr';
export const client = createBrowserClient('https://fixture.invalid', 'public-anon');
export const session = () => client.auth.getSession();
${invalid ? "export const readRows = () => client.from('rows');" : ''}`,
    ...(invalid ? {
      'apps/web/src/hooks/session/useSession.ts': `import { createBrowserClient } from '@supabase/ssr';
export const useSession = () => createBrowserClient('https://fixture.invalid', 'public-anon').auth.getSession();`,
    } : {}),
  } });
}

for (const edition of ['lite', 'full']) {
  test(`${code} ${edition}: refuses a non-auth owner and data access inside auth`, t => {
    const report = runArch(fixture(t, edition, true));
    const violations = report.violations.filter(item => item.ruleId === code);
    assert.ok(report.coverage.checkedRuleIds.includes(code));
    assert.ok(violations.some(item => item.path.endsWith('useSession.ts') && /imported by/.test(item.message)));
    assert.ok(violations.some(item => item.path.endsWith('client.ts') && item.member === 'from'));
  });

  test(`${code} ${edition}: accepts auth-only access in modules/auth`, t => {
    const report = runArch(fixture(t, edition, false));
    assert.ok(report.coverage.checkedRuleIds.includes(code));
    assert.deepEqual(report.violations.filter(item => item.ruleId === code), []);
  });
}
