// proves: BE_SUPABASE_CLIENT_OWNER@lite
// proves: BE_SUPABASE_CLIENT_OWNER@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';

const code = 'BE_SUPABASE_CLIENT_OWNER';
const sdk = {
  '../node_modules/@supabase/supabase-js/package.json': JSON.stringify({ name: '@supabase/supabase-js', types: 'index.d.ts' }),
  '../node_modules/@supabase/supabase-js/index.d.ts': `export interface SupabaseClient<Database> {
  auth: { getUser(): Promise<Database> }; rpc(name: string): unknown;
}
export declare function createClient<Database>(url: string, key: string): SupabaseClient<Database>;`,
};

function fixture(t, edition, invalid) {
  const declaration = appDeclaration('be', { apps: [{ name: 'core', kind: 'api' }] });
  declaration.edition = edition;
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  const files = {
    '../hfs.json': JSON.stringify(declaration),
    ...sdk,
    'src/modules/integrations/supabase/supabase.client.ts': `import { createClient, type SupabaseClient } from '@supabase/supabase-js';
interface Database { public: unknown }
export const client: SupabaseClient<Database> = createClient<Database>('https://fixture.invalid', 'fixture-public-key');
export const user = () => client.auth.getUser();`,
  };
  if (invalid) files['src/features/api/orders/application/leak.service.ts'] = `import { createClient } from '@supabase/supabase-js';
const client = createClient('https://fixture.invalid', 'fixture-public-key');
export const leak = () => client.rpc('admin');`;
  return archFixture(t, { profile: 'be', files });
}

for (const edition of ['lite', 'full']) {
  test(`${code} ${edition}: rejects a feature-owned untyped data client`, t => {
    const violations = findings(runArch(fixture(t, edition, true)), code);
    assert.ok(violations.some(item => item.path.endsWith('leak.service.ts') && /imported by/.test(item.message)));
    assert.ok(violations.some(item => /untyped Supabase client/.test(item.message)));
    assert.ok(violations.some(item => item.member === 'rpc'));
  });

  test(`${code} ${edition}: accepts the typed integration-owned auth client`, t => {
    assert.deepEqual(findings(runArch(fixture(t, edition, false)), code), []);
  });
}
