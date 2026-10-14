// proves: BE_SUPABASE_CLIENT_OWNER@lite BE_SUPABASE_CLIENT_OWNER@full
// proves: FE_SUPABASE_CLIENT_OWNER@lite FE_SUPABASE_CLIENT_OWNER@full
// proves: BE_JWT_ALG_PINNED@lite BE_JWT_ALG_PINNED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';

const declarations = (profile, edition) => {
  const value = appDeclaration(profile, { apps: [{ name: profile === 'fe' ? 'web' : 'core', kind: profile === 'fe' ? 'next' : 'api' }] });
  value.edition = edition;
  value.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  return JSON.stringify(value);
};

const packageFiles = (name, types) => ({
  [`../node_modules/${name}/package.json`]: JSON.stringify({ name, version: '1.0.0', types: 'index.d.ts' }),
  [`../node_modules/${name}/index.d.ts`]: types,
});

const modules = {
  ...packageFiles('@supabase/supabase-js', `
    export interface Query {select(): Query}
    export interface Auth {getUser(): Promise<unknown>}
    export interface Storage {from(name: string): {upload(path: string, value: string): Promise<unknown>}; listBuckets(): Promise<unknown>}
    export interface SupabaseClient<Database> {
      from(table: string): Query; rpc(name: string): Query; schema(name: string): SupabaseClient<Database>;
      functions: {invoke(name: string): Promise<unknown>}; realtime: {connect(): void}; channel(name: string): {subscribe(): void};
      storage: Storage; auth: Auth;
    }
    export declare function createClient<Database>(url: string, key: string): SupabaseClient<Database>;`),
  ...packageFiles('@supabase/postgrest-js', 'export declare class PostgrestClient {constructor(url: string); from(name: string): {select(): unknown}}'),
  ...packageFiles('jose', `
    export declare function createRemoteJWKSet(url: URL): unknown;
    export declare function jwtVerify(token: string, keys: unknown, options: unknown): Promise<{payload: {role: string; sub: string; exp: number}}>;`),
};

const client = `import {createClient} from '@supabase/supabase-js'; interface Database {public: unknown}
export const client = createClient<Database>('https://fixture.invalid', 'public-fixture');`;
const verifier = ({ algorithms = "['ES256']", issuer = 'options.url', guard = "if (payload.role !== 'authenticated') return null" } = {}) => `
  import {jwtVerify, createRemoteJWKSet} from 'jose';
  interface SupabaseOptions {url: string}
  export async function verify(token: string, options: SupabaseOptions) {
    const keys = createRemoteJWKSet(new URL(options.url));
    const {payload} = await jwtVerify(token, keys, {issuer: ${issuer}, audience: 'authenticated', algorithms: ${algorithms}});
    ${guard}
    return {id: payload.sub, role: 'authenticated'};
  }`;

for (const edition of ['lite', 'full']) {
  test(`R217 BE_SUPABASE_CLIENT_OWNER permits Auth/Storage and refuses data everywhere (${edition})`, t => {
    const owner = 'src/modules/integrations/supabase/';
    const dataCalls = {
      from: "client.from('items').select()", rpc: "client.rpc('items')", schema: "client.schema('public').from('items')",
      functions: "client.functions.invoke('items')", channel: "client.channel('items').subscribe()", realtime: 'client.realtime.connect()',
      computed: "client['from']('items').select()",
      alias: 'client.from',
    };
    const files = {
      '../hfs.json': declarations('be', edition), ...modules,
      [`${owner}supabase.client.ts`]: client,
      [`${owner}supabase.jwks.ts`]: verifier(),
      [`${owner}auth.ts`]: "import {client} from './supabase.client'; export const auth = () => client.auth.getUser();",
      [`${owner}storage.ts`]: "import {client} from './supabase.client'; export const upload = () => client.storage.from('docs').upload('doc', 'body');",
      [`${owner}storage-alias.ts`]: "import {client} from './supabase.client'; const storage = client.storage; export const upload = () => storage.from('docs').upload('doc', 'body');",
      [`${owner}postgrest.ts`]: "import {PostgrestClient as Pipe} from '@supabase/postgrest-js'; export const items = () => new Pipe('url').from('items').select();",
      'src/modules/domain/orders/lookalike.ts': "export const local = {from: (name: string) => name}; export const read = () => local.from('items');",
      'src/modules/domain/orders/postgrest.ts': "import {PostgrestClient} from '@supabase/postgrest-js'; export const data = new PostgrestClient('url');",
      'src/modules/domain/orders/leak.ts': "import {client} from '../../integrations/supabase/supabase.client'; export const read = () => client.from('items').select();",
      ...Object.fromEntries(Object.entries(dataCalls).map(([name, code]) => [`${owner}${name}.ts`, `import {client} from './supabase.client'; export const read = () => ${code};`])),
    };
    const report = runArch(archFixture(t, { profile: 'be', files }));
    const violations = findings(report, 'BE_SUPABASE_CLIENT_OWNER');
    for (const name of Object.keys(dataCalls)) assert.ok(violations.some(item => item.path === `${owner}${name}.ts` && /Auth\/Storage only/.test(item.message)), name);
    assert.ok(violations.some(item => item.path === `${owner}postgrest.ts` && item.member === 'from'));
    assert.ok(violations.some(item => item.path.endsWith('domain/orders/postgrest.ts') && item.module === '@supabase/postgrest-js'));
    assert.ok(violations.some(item => item.path.endsWith('domain/orders/leak.ts') && item.member === 'from'));
    for (const name of ['auth.ts', 'storage.ts', 'storage-alias.ts', 'lookalike.ts']) assert.equal(violations.some(item => item.path.endsWith(`/${name}`)), false, name);
    assert.deepEqual(findings(report, 'BE_JWT_ALG_PINNED'), []);
  });

  test(`R217 BE_SUPABASE_CLIENT_OWNER and FE_SUPABASE_CLIENT_OWNER refuse undeclared-provider SDK imports (${edition})`, t => {
    for (const profile of ['be', 'fe']) {
      const value = appDeclaration(profile, { apps: [{ name: profile === 'fe' ? 'web' : 'core', kind: profile === 'fe' ? 'next' : 'api' }] });
      value.edition = edition;
      const file = profile === 'be' ? 'src/modules/domain/orders/postgrest.ts' : 'apps/web/src/hooks/session/postgrest.ts';
      const report = runArch(archFixture(t, { profile, files: {
        '../hfs.json': JSON.stringify(value), ...modules,
        [file]: "import {PostgrestClient} from '@supabase/postgrest-js'; export const data = new PostgrestClient('url');",
      } }));
      const code = profile === 'be' ? 'BE_SUPABASE_CLIENT_OWNER' : 'FE_SUPABASE_CLIENT_OWNER';
      assert.ok(findings(report, code).some(item => item.path === file && item.module === '@supabase/postgrest-js'));
      assert.deepEqual(findings(report, 'BE_SUPABASE_JWT_VERIFIED'), [], 'JWT verification expectations remain provider-gated');
    }
  });

  test(`R217 FE_SUPABASE_CLIENT_OWNER refuses chained/computed SDK data and recognizes every package (${edition})`, t => {
    const owner = 'apps/web/src/modules/auth/';
    const dataCalls = {
      buckets: 'client.storage.listBuckets()', computed: "client['from']('items').select()",
      computedStorage: "client['storage']['listBuckets']()", functions: "client['functions'].invoke('job')",
      realtime: "client['realtime'].connect()", schema: "client.schema('public')['from']('items').select()",
      alias: 'client.storage',
    };
    const files = {
      '../hfs.json': declarations('fe', edition), ...modules,
      [`${owner}client.ts`]: client,
      [`${owner}session.ts`]: "import {client} from './client'; export const session = () => client.auth.getUser();",
      [`${owner}lookalike.ts`]: "const client = {storage: {listBuckets: () => []}, from: (name: string) => name}; export const list = () => client.storage.listBuckets(); client['from']('local');",
      'apps/web/src/hooks/session/postgrest.ts': "export {PostgrestClient} from '@supabase/postgrest-js';",
      ...Object.fromEntries(Object.entries(dataCalls).map(([name, code]) => [`${owner}${name}.ts`, `import {client} from './client'; export const read = () => ${code};`])),
    };
    const violations = findings(runArch(archFixture(t, { profile: 'fe', files })), 'FE_SUPABASE_CLIENT_OWNER');
    for (const name of Object.keys(dataCalls)) assert.ok(violations.some(item => item.path === `${owner}${name}.ts` && /auth only/.test(item.message)), name);
    assert.ok(violations.some(item => item.module === '@supabase/postgrest-js'));
    for (const name of ['session.ts', 'lookalike.ts']) assert.equal(violations.some(item => item.path === `${owner}${name}`), false, name);
  });

  test(`R260 BE_JWT_ALG_PINNED accepts config-derived issuer and authenticated principal (${edition})`, t => {
    const owner = 'src/modules/integrations/supabase/';
    const report = runArch(archFixture(t, { profile: 'be', files: {
      '../hfs.json': declarations('be', edition), ...modules,
      [`${owner}supabase.jwks.ts`]: verifier({ algorithms: "['ES256', 'RS256', 'EdDSA']", issuer: "`${options.url.replace(/\\/$/, '')}/auth/v1`" }),
    } }));
    assert.deepEqual(findings(report, 'BE_JWT_ALG_PINNED'), []);
    assert.ok(report.coverage.checkedRuleIds.includes('BE_JWT_ALG_PINNED'));
  });

  test(`R260 BE_JWT_ALG_PINNED rejects insecure algorithms, literal issuer and permissive principal (${edition})`, t => {
    const owner = 'src/modules/integrations/supabase/';
    const invalid = {
      none: { algorithms: "['none']" }, shared: { algorithms: "['HS256']" }, dynamic: { algorithms: 'allowedAlgorithms' },
      issuer: { issuer: "'https://literal.invalid'" }, role: { guard: '' }, ignoredRole: { guard: "if (payload.role !== 'authenticated') console.log('ignored')" },
      unrelatedRole: { guard: "if (other.role !== 'authenticated') return null" },
      earlyPrincipal: { guard: "if (payload.role === 'service_role') return {id: payload.sub}; if (payload.role !== 'authenticated') throw new Error('late')" },
    };
    const files = {
      '../hfs.json': declarations('be', edition), ...modules,
      [`${owner}supabase.jwks.ts`]: verifier(),
      [`${owner}secure.ts`]: verifier({ algorithms: "['RS256', 'EdDSA']", issuer: "`${options.url.replace(/\\/$/, '')}/auth/v1`" }),
      ...Object.fromEntries(Object.entries(invalid).map(([name, options]) => [`${owner}${name}.ts`, verifier(options)])),
    };
    const violations = findings(runArch(archFixture(t, { profile: 'be', files })), 'BE_JWT_ALG_PINNED');
    for (const name of Object.keys(invalid)) assert.ok(violations.some(item => item.path === `${owner}${name}.ts`), name);
    assert.equal(violations.some(item => /\/(?:secure|supabase\.jwks)\.ts$/u.test(item.path)), false);
  });
}
