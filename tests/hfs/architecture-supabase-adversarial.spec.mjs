import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch } from '../helpers/hfs-arch-fixture.mjs';

// Supabase on the front end is auth only (owner ruling 2026-10-13): modules/auth (fe.modules.auth) is the one importer of
// @supabase/* and calls only the auth API; FE_SERVICE_ROLE_FORBIDDEN keeps the service role and credentials out of fe/.
const FE_CODES = new Set(['FE_SUPABASE_CLIENT_OWNER', 'FE_SERVICE_ROLE_FORBIDDEN']);
const BE_CODES = new Set(['BE_SUPABASE_CLIENT_OWNER', 'BE_SUPABASE_JWT_VERIFIED']);

const declaration = profile => {
  const value = appDeclaration(profile, { apps: [{ name: profile === 'fe' ? 'web' : 'core', kind: profile === 'fe' ? 'next' : 'api' }] });
  value.edition = 'lite';
  value.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  value.sides.fe.reads = ['supabase/types/'];
  return `${JSON.stringify(value, null, 2)}\n`;
};

const supabaseTypes = `
export interface QueryResult<T=unknown>{data:T;error:Error|null}
export interface QueryBuilder<T=unknown> extends PromiseLike<QueryResult<T>>{
  select(columns?:string):this; insert(value:unknown):this; update(value:unknown):this; upsert(value:unknown):this; delete():this;
  eq(column:string,value:unknown):this; gt(column:string,value:unknown):this; gte(column:string,value:unknown):this;
  lt(column:string,value:unknown):this; lte(column:string,value:unknown):this; limit(rows:number):this; range(from:number,to:number):this;
  single<R=never>():QueryBuilder<R>; maybeSingle<R=never>():QueryBuilder<R>; returns<R>():QueryBuilder<R>;
}
export interface AuthClient{getSession():Promise<QueryResult<{session:unknown}>>;getClaims():Promise<QueryResult<{claims:unknown}>>;getUser():Promise<QueryResult<{user:unknown}>>;signOut():Promise<QueryResult<null>>}
export interface StorageClient{from(bucket:string):{upload(path:string,value:unknown):Promise<QueryResult<unknown>>}}
export interface Channel{on(event:string,handler:()=>void):Channel;subscribe():Channel}
export interface SupabaseClient<Database>{from(table:string):QueryBuilder<unknown>;rpc(name:string,args?:unknown):QueryBuilder<unknown>;auth:AuthClient;storage:StorageClient;channel(name:string):Channel;removeChannel(channel:Channel):Promise<string>}
export declare function createClient<Database>(url:string,key:string):SupabaseClient<Database>;
`;

const moduleFiles = {
  '../node_modules/@supabase/supabase-js/package.json': JSON.stringify({ name: '@supabase/supabase-js', version: '2.0.0', types: 'index.d.ts' }),
  '../node_modules/@supabase/supabase-js/index.d.ts': supabaseTypes,
  '../node_modules/@supabase/ssr/package.json': JSON.stringify({ name: '@supabase/ssr', version: '1.0.0', types: 'index.d.ts' }),
  '../node_modules/@supabase/ssr/index.d.ts': `import type {SupabaseClient} from '@supabase/supabase-js';
export declare function createServerClient<Database>(url:string,key:string):SupabaseClient<Database>;
export declare function createBrowserClient<Database>(url:string,key:string):SupabaseClient<Database>;`,
  '../node_modules/@supabase/realtime-js/package.json': JSON.stringify({ name: '@supabase/realtime-js', version: '2.0.0', types: 'index.d.ts' }),
  '../node_modules/@supabase/realtime-js/index.d.ts': 'export declare class RealtimeClient{constructor(url:string)}\n',
  '../node_modules/other-client/package.json': JSON.stringify({ name: 'other-client', version: '1.0.0', types: 'index.d.ts' }),
  '../node_modules/other-client/index.d.ts': `export interface SupabaseClient<T>{value:T}
export interface SessionClient{auth:{getSession():Promise<{error:Error|null}>};from(table:string):unknown}
export interface Decoder{decode(value:string):unknown}
`,
};

const uniqueCodes = (report, path, allowed) => [...new Set(report.violations
  .filter(item => item.path === path && allowed.has(item.ruleId))
  .map(item => item.ruleId))].sort();

test('L10/L13 adversarial FE matrix: Supabase is auth only inside modules/auth, data calls and imports elsewhere are refused, secrets stay out', t => {
  const cases = [
    { name: 'the auth owner creates the browser client', path: 'apps/web/src/modules/auth/client.ts', source: `import {createBrowserClient} from '@supabase/ssr';export const authClient=createBrowserClient('https://fixture.invalid','public-anon');`, expected: [] },
    { name: 'the auth owner reads the session', path: 'apps/web/src/modules/auth/session.ts', source: `import {authClient} from './client';export const accessToken=async()=>{const result=await authClient.auth.getSession();return result.error?null:result.data.session};`, expected: [] },
    { name: 'the auth owner signs out', path: 'apps/web/src/modules/auth/sign-out.ts', source: `import {authClient} from './client';export const signOut=()=>authClient.auth.signOut();`, expected: [] },
    { name: 'the auth owner imports a Supabase type', path: 'apps/web/src/modules/auth/types.ts', source: `import type {SupabaseClient} from '@supabase/supabase-js';export type AuthClient=SupabaseClient<unknown>;`, expected: [] },
    { name: 'from inside the auth owner is refused', path: 'apps/web/src/modules/auth/read-items.ts', source: `import {authClient} from './client';export const read=()=>authClient.from('items').select().limit(20);`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'rpc inside the auth owner is refused', path: 'apps/web/src/modules/auth/rpc.ts', source: `import {authClient} from './client';export const run=()=>authClient.rpc('summary');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'storage inside the auth owner is refused', path: 'apps/web/src/modules/auth/upload.ts', source: `import {authClient} from './client';export const run=()=>authClient.storage.from('docs').upload('a.txt','body');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'a realtime channel inside the auth owner is refused', path: 'apps/web/src/modules/auth/channel.ts', source: `import {authClient} from './client';export const run=()=>authClient.channel('room').on('x',()=>undefined).subscribe();`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'removeChannel inside the auth owner is refused', path: 'apps/web/src/modules/auth/unsubscribe.ts', source: `import {authClient} from './client';export const run=()=>authClient.removeChannel(authClient.channel('room'));`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: '@supabase/supabase-js imported by a hook is refused', path: 'apps/web/src/hooks/session/useSupabase.ts', source: `import {createClient} from '@supabase/supabase-js';export const useSupabase=()=>createClient('u','k');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: '@supabase/ssr imported by modules/api is refused', path: 'apps/web/src/modules/api/graphql/clients/supabase.ts', source: `import {createServerClient} from '@supabase/ssr';export const leak=()=>createServerClient('u','k');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'any other @supabase package outside the owner is refused', path: 'apps/web/src/hooks/realtime/useRealtime.ts', source: `import {RealtimeClient} from '@supabase/realtime-js';export const useRealtime=()=>new RealtimeClient('wss://fixture.invalid');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'a type-only Supabase import outside the owner is refused', path: 'apps/web/src/modules/types/supabase.ts', source: `import type {SupabaseClient} from '@supabase/supabase-js';export type Leak=SupabaseClient<unknown>;`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'an auth call through the re-exported client outside the owner is refused', path: 'apps/web/src/hooks/session/useClaims.ts', source: `import {authClient} from '../../modules/auth/client';export const useClaims=()=>authClient.auth.getClaims();`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'a data call through the re-exported client outside the owner is refused', path: 'apps/web/src/features/pages/Items/index.ts', source: `import {authClient} from '../../../modules/auth/client';export const items=()=>authClient.from('items').select();`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'a hook that calls the owner public function is accepted', path: 'apps/web/src/hooks/session/useAccessToken.ts', source: `import {accessToken} from '../../modules/auth/session';export const useAccessToken=()=>accessToken();`, expected: [] },
    { name: 'another library getSession and from are ignored', path: 'apps/web/src/modules/types/other-session.ts', source: `import type {SessionClient} from 'other-client';export const read=async(client:SessionClient)=>{await client.auth.getSession();return client.from('items')};`, expected: [] },
    { name: 'another library SupabaseClient type is ignored', path: 'apps/web/src/modules/types/other-client.ts', source: `import type {SupabaseClient} from 'other-client';export type Other=SupabaseClient<string>;`, expected: [] },
    { name: 'a local object with from and auth is ignored', path: 'apps/web/src/modules/types/lookalike.ts', source: `const local={from:(t:string)=>t,auth:{getSession:async()=>({error:null})}};export const read=()=>[local.from('items'),local.auth.getSession()];`, expected: [] },
    { name: 'Supabase calls named in strings and comments are ignored', path: 'apps/web/src/modules/types/notes.ts', source: `// client.from('items') in a comment
export const note="client.rpc('x') and supabase.channel('y') in a string";`, expected: [] },
    { name: 'core public env is allowed', path: 'apps/web/src/features/public-env.ts', source: `export const url=process.env.NEXT_PUBLIC_SUPABASE_URL;`, expected: [] },
    { name: 'service-role comment and unrelated word are ignored', path: 'apps/web/src/features/service-copy.ts', source: `// service_role is named in documentation.
export const label='customer_service_roleplay';`, expected: [] },
    { name: 'exact service role string is refused', path: 'apps/web/src/features/service-leak.ts', source: `export const label='service_role';`, expected: ['FE_SERVICE_ROLE_FORBIDDEN'] },
    { name: 'a SERVICE_ROLE identifier is refused', path: 'apps/web/src/features/service-name.ts', source: `const SUPABASE_SERVICE_ROLE='x';export const key=SUPABASE_SERVICE_ROLE;`, expected: ['FE_SERVICE_ROLE_FORBIDDEN'] },
    { name: 'credential env suffix is refused', path: 'apps/web/src/features/secret-env.ts', source: `export const key=process.env.NEXT_PUBLIC_PROVIDER_SECRET;`, expected: ['FE_SERVICE_ROLE_FORBIDDEN'] },
    { name: 'product public config is accepted by config owner', path: 'apps/web/src/modules/config/index.ts', source: `export const analytics=process.env.NEXT_PUBLIC_ANALYTICS_ID;`, expected: [] },
    { name: 'product public config outside config owner is refused', path: 'apps/web/src/features/public-product-env.ts', source: `export const analytics=process.env.NEXT_PUBLIC_ANALYTICS_ID;`, expected: ['FE_SERVICE_ROLE_FORBIDDEN'] },
  ];
  assert.equal(cases.length, 27);
  const files = {
    '../hfs.json': declaration('fe'),
    ...moduleFiles,
    'apps/web/src/modules/auth/index.ts': `export {accessToken} from './session';export {signOut} from './sign-out';`,
    ...Object.fromEntries(cases.map(item => [item.path, item.source])),
  };
  const report = runArch(archFixture(t, { profile: 'fe', files }));
  const mismatches = [];
  for (const item of cases) {
    const actual = uniqueCodes(report, item.path, FE_CODES);
    const expected = [...item.expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push(`${item.name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}\n${JSON.stringify(report.violations.filter(finding => finding.path === item.path), null, 2)}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

const joseTypes = `
export declare function createRemoteJWKSet(url:URL):{kind:'jwks'};
export declare function jwtVerify(token:string,jwks:unknown,options:{issuer:string;audience:string|Array<string>;algorithms:Array<string>}):Promise<{payload:{sub?:string;role?:string;exp?:number}}>;
export declare function decodeJwt(token:string):unknown;
`;

test('L10/L16 adversarial BE matrix has exact findings for 24 ownership, verification, decoder and claim-source cases', t => {
  const cases = [
    { name: 'jose namespace verification is pinned', path: 'src/modules/integrations/supabase/namespace-good.jwks.ts', source: `import * as jose from 'jose';const jwks=jose.createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jose.jwtVerify(token,jwks,{issuer:'https://fixture.invalid/auth/v1',audience:'authenticated',algorithms:['ES256']});`, expected: [] },
    { name: 'issuer is required', path: 'src/modules/integrations/supabase/missing-issuer.jwks.ts', source: `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jwtVerify(token,jwks,{audience:'authenticated',algorithms:['ES256']} as never);`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'audience is required', path: 'src/modules/integrations/supabase/missing-audience.jwks.ts', source: `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jwtVerify(token,jwks,{issuer:'issuer',algorithms:['ES256']} as never);`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'authenticated audience is required', path: 'src/modules/integrations/supabase/wrong-audience.jwks.ts', source: `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jwtVerify(token,jwks,{issuer:'issuer',audience:'anon',algorithms:['ES256']});`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'algorithms is required', path: 'src/modules/integrations/supabase/missing-algorithms.jwks.ts', source: `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jwtVerify(token,jwks,{issuer:'issuer',audience:'authenticated'} as never);`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'algorithms cannot be empty', path: 'src/modules/integrations/supabase/empty-algorithms.jwks.ts', source: `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jwtVerify(token,jwks,{issuer:'issuer',audience:'authenticated',algorithms:[]});`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'remote JWKS is required', path: 'src/modules/integrations/supabase/local-key.jwks.ts', source: `import {jwtVerify} from 'jose';export const verify=(token:string,key:unknown)=>jwtVerify(token,key,{issuer:'issuer',audience:'authenticated',algorithms:['ES256']});`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'jose decodeJwt is refused', path: 'src/modules/integrations/supabase/decode-jose.ts', source: `import {decodeJwt} from 'jose';export const decode=(token:string)=>decodeJwt(token);`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'jsonwebtoken namespace decode is refused', path: 'src/modules/integrations/supabase/decode-namespace.ts', source: `import * as jwt from 'jsonwebtoken';export const decode=(token:string)=>jwt.decode(token);`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'jsonwebtoken default decode is refused', path: 'src/modules/integrations/supabase/decode-default.ts', source: `import jwt from 'jsonwebtoken';export const decode=(token:string)=>jwt.decode(token);`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'jwt-decode default call is refused', path: 'src/modules/integrations/supabase/decode-package.ts', source: `import jwtDecode from 'jwt-decode';export const decode=(token:string)=>jwtDecode(token);`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'local decoder and comments are ignored', path: 'src/modules/integrations/supabase/decode-local.ts', source: `// jsonwebtoken.decode(token)
const local={decode:(value:string)=>value};export const decode=(token:string)=>local.decode(token);`, expected: [] },
    { name: 'request body property claim is refused', path: 'src/features/api/orders/transport/http/body-role.ts', source: `export const role=(request:{body:{role:string}})=>request.body.role;`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'req body membership claim is refused', path: 'src/features/api/orders/transport/http/body-membership.ts', source: `export const membership=(req:{body:{membership:string}})=>req.body.membership;`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'request body destructured claim is refused', path: 'src/features/api/orders/transport/http/body-destructure.ts', source: `export const role=(request:{body:{role:string}})=>{const {role:requestedRole}=request.body;return requestedRole};`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'aliased request body claim is refused', path: 'src/features/api/orders/transport/http/body-alias.ts', source: `export const role=(request:{body:{role:string}})=>{const body=request.body;return body.role};`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
    { name: 'unrelated object body is ignored', path: 'src/features/api/orders/application/body-record.ts', source: `export const role=(record:{body:{role:string}})=>record.body.role;`, expected: [] },
    { name: 'verified payload claim is accepted', path: 'src/modules/integrations/supabase/payload-role.jwks.ts', source: `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const role=async(token:string)=>(await jwtVerify(token,jwks,{issuer:'issuer',audience:'authenticated',algorithms:['ES256']})).payload.role;`, expected: [] },
    { name: 'Database-typed integration client is accepted', path: 'src/modules/integrations/supabase/typed.client.ts', source: `import {createClient,type SupabaseClient} from '@supabase/supabase-js';interface Database{public:unknown}export const client:SupabaseClient<Database>=createClient<Database>('u','k');`, expected: [] },
    { name: 'untyped integration client is refused', path: 'src/modules/integrations/supabase/untyped.client.ts', source: `import {createClient} from '@supabase/supabase-js';export const client=createClient('u','k');`, expected: ['BE_SUPABASE_CLIENT_OWNER'] },
    { name: 'other library SupabaseClient is ignored', path: 'src/features/api/orders/application/other-type.ts', source: `import type {SupabaseClient} from 'other-client';export type Other=SupabaseClient<string>;`, expected: [] },
    { name: 'rpc outside integration is refused', path: 'src/features/api/orders/application/rpc-leak.ts', source: `import {client} from '../../../../modules/integrations/supabase/typed.client';export const run=()=>client.rpc('admin');`, expected: ['BE_SUPABASE_CLIENT_OWNER'] },
    { name: 'Supabase import outside integration is refused', path: 'src/features/api/orders/application/import-leak.ts', source: `import type {SupabaseClient} from '@supabase/supabase-js';interface Database{public:unknown}export type Client=SupabaseClient<Database>;`, expected: ['BE_SUPABASE_CLIENT_OWNER'] },
    { name: 'jwtVerify outside integration is refused', path: 'src/features/api/orders/application/verify-leak.ts', source: `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jwtVerify(token,jwks,{issuer:'issuer',audience:'authenticated',algorithms:['ES256']});`, expected: ['BE_SUPABASE_JWT_VERIFIED'] },
  ];
  assert.equal(cases.length, 24);
  const files = {
    '../hfs.json': declaration('be'),
    ...moduleFiles,
    '../node_modules/jose/package.json': JSON.stringify({ name: 'jose', version: '6.0.0', types: 'index.d.ts' }),
    '../node_modules/jose/index.d.ts': joseTypes,
    '../node_modules/jsonwebtoken/package.json': JSON.stringify({ name: 'jsonwebtoken', version: '9.0.0', types: 'index.d.ts' }),
    '../node_modules/jsonwebtoken/index.d.ts': `declare const jwt:{decode(token:string):unknown};export default jwt;export declare function decode(token:string):unknown;`,
    '../node_modules/jwt-decode/package.json': JSON.stringify({ name: 'jwt-decode', version: '4.0.0', types: 'index.d.ts' }),
    '../node_modules/jwt-decode/index.d.ts': `export default function jwtDecode(token:string):unknown;`,
    'src/modules/integrations/supabase/base.jwks.ts': `import {createRemoteJWKSet,jwtVerify} from 'jose';const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));export const verify=(token:string)=>jwtVerify(token,jwks,{issuer:'https://fixture.invalid/auth/v1',audience:'authenticated',algorithms:['ES256']});`,
    ...Object.fromEntries(cases.map(item => [item.path, item.source])),
  };
  const report = runArch(archFixture(t, { profile: 'be', files }));
  const mismatches = [];
  for (const item of cases) {
    const actual = uniqueCodes(report, item.path, BE_CODES);
    const expected = [...item.expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push(`${item.name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}\n${JSON.stringify(report.violations.filter(finding => finding.path === item.path), null, 2)}`);
    }
  }
  assert.deepEqual(mismatches, []);
});
