import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';

// Supabase on the front end is auth only (owner ruling 2026-10-13): fe.modules.auth imports @supabase/* and calls its auth API;
// data, storage, rpc and realtime go through the back end. The four fe data codes of RETIRED_FE_CODES are removed; the route
// handler ban is provider-independent (server-action.mjs).
const FE_CODES = ['FE_SUPABASE_CLIENT_OWNER', 'FE_SERVICE_ROLE_FORBIDDEN'];
const RETIRED_FE_CODES = ['FE_DB_RESULT_TYPED', 'FE_DB_ERROR_HANDLED', 'FE_AUTH_SESSION_TRUST', 'FE_DB_WRITE_SHAPE']; // removed 2026-10-13
const BE_CODES = ['BE_SUPABASE_CLIENT_OWNER', 'BE_SUPABASE_JWT_VERIFIED'];

const declaration = (profile) => {
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
  lt(column:string,value:unknown):this; lte(column:string,value:unknown):this; limit(rows:number):this;
  single<R=never>():QueryBuilder<R>; maybeSingle<R=never>():QueryBuilder<R>; returns<R>():QueryBuilder<R>;
}
export interface AuthClient{getSession():Promise<QueryResult<{session:unknown}>>;getClaims():Promise<QueryResult<{claims:unknown}>>;getUser():Promise<QueryResult<{user:unknown}>>}
export interface StorageClient{from(bucket:string):{upload(path:string,value:unknown):Promise<QueryResult<unknown>>}}
export interface Channel{on(event:string,handler:()=>void):Channel;subscribe():Channel}
export interface SupabaseClient<Database>{from(table:string):QueryBuilder<unknown>;rpc(name:string,args?:unknown):QueryBuilder<unknown>;auth:AuthClient;storage:StorageClient;channel(name:string):Channel}
export declare function createClient<Database>(url:string,key:string):SupabaseClient<Database>;
`;

const moduleFiles = {
  '../node_modules/@supabase/supabase-js/package.json': JSON.stringify({ name: '@supabase/supabase-js', version: '2.0.0', types: 'index.d.ts' }),
  '../node_modules/@supabase/supabase-js/index.d.ts': supabaseTypes,
  '../node_modules/@supabase/ssr/package.json': JSON.stringify({ name: '@supabase/ssr', version: '1.0.0', types: 'index.d.ts' }),
  '../node_modules/@supabase/ssr/index.d.ts': `import type {SupabaseClient} from '@supabase/supabase-js';
export declare function createServerClient<Database>(url:string,key:string):SupabaseClient<Database>;
export declare function createBrowserClient<Database>(url:string,key:string):SupabaseClient<Database>;`,
  '../node_modules/other-client/package.json': JSON.stringify({ name: 'other-client', version: '1.0.0', types: 'index.d.ts' }),
  '../node_modules/other-client/index.d.ts': 'export interface SupabaseClient<T>{value:T}; export interface Decoder{decode(value:string):unknown}\n',
};

const feClean = (extra = {}) => ({
  '../hfs.json': declaration('fe'),
  ...moduleFiles,
  'apps/web/src/modules/auth/index.ts': `export {accessToken} from './session';\n`,
  'apps/web/src/modules/auth/client.ts': `import {createBrowserClient} from '@supabase/ssr';
export const authClient=createBrowserClient('https://fixture.invalid','public-anon');\n`,
  'apps/web/src/modules/auth/session.ts': `import {authClient} from './client';
export const accessToken=async()=>{const result=await authClient.auth.getSession();return result.error?null:result.data.session};\n`,
  'apps/web/src/hooks/session/useAccessToken.ts': `import {accessToken} from '../../modules/auth';\nexport const useAccessToken=()=>accessToken();\n`,
  'apps/web/src/app/health/live/route.ts': `export const GET=()=>new Response('ok');\n`,
  'apps/web/src/app/auth/callback/route.ts': `export const GET=()=>new Response('ok');\n`,
  'apps/web/src/modules/config/index.ts': `export const analytics=process.env.NEXT_PUBLIC_ANALYTICS_ID;\n`,
  'apps/web/src/modules/types/other.ts': `import type {SupabaseClient,Decoder} from 'other-client';
export const note='client.from(items) and auth.getSession() in a string'; export type Other=SupabaseClient<string>; export const useDecoder=(d:Decoder)=>d.decode('value');
// service_role in a comment is not executable source.\n`,
  ...extra,
});

const freshFe = (t, extra = {}) => archFixture(t, { profile: 'fe', files: feClean(extra) });
const newFindings = report => report.violations.filter(item => FE_CODES.includes(item.ruleId));

test('L10/L13: an auth-only Supabase client inside modules/auth, both permitted routes and unrelated lookalikes are clean', t => {
  const report = runArch(freshFe(t));
  assert.deepEqual(newFindings(report), [], JSON.stringify(newFindings(report), null, 2));
  assert.deepEqual(findings(report, 'FE_ROUTE_HANDLER_FORBIDDEN'), [], 'health/live and the callback slot are the permitted route handlers');
  for (const code of FE_CODES) assert.ok(report.coverage.checkedRuleIds.includes(code), `${code} was not recorded as checked`);
});

test('the retired front-end Supabase data codes are refused as unknown: the machine never checks or emits them', t => {
  const report = runArch(freshFe(t, {
    'apps/web/src/modules/auth/read-items.ts': `import {authClient} from './client'; export const readItems=async()=>{const {data}=await authClient.from('items').select().single<{id:string}>();return data??[]};\n`,
  }));
  for (const code of RETIRED_FE_CODES) {
    assert.equal(report.coverage.checkedRuleIds.includes(code), false, `${code} is removed and must not be checked`);
    assert.deepEqual(findings(report, code), [], `${code} is removed and must not be reported`);
  }
});

test('L10 FE_SUPABASE_CLIENT_OWNER: a Supabase import outside modules/auth and an auth call through a re-exported client are findings', t => {
  const root = freshFe(t, {
    'apps/web/src/features/pages/Leak/index.ts': `import {createClient} from '@supabase/supabase-js'; const client=createClient('u','k'); export const leak=()=>client.auth.getClaims();\n`,
    'apps/web/src/hooks/session/useClaims.ts': `import {authClient} from '../../modules/auth/client'; export const useClaims=()=>authClient.auth.getClaims();\n`,
  });
  const owned = findings(runArch(root), 'FE_SUPABASE_CLIENT_OWNER');
  assert.ok(owned.some(item => item.path.endsWith('pages/Leak/index.ts') && /imported by/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.ok(owned.some(item => item.path.endsWith('useClaims.ts') && /auth call is made from/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.equal(owned.some(item => item.path.endsWith('modules/types/other.ts')), false, 'a type named SupabaseClient from another library is not Supabase');
});

test('L10 FE_SUPABASE_CLIENT_OWNER: data, rpc, storage and realtime calls are refused even inside modules/auth', t => {
  const root = freshFe(t, {
    'apps/web/src/modules/auth/read-items.ts': `import {authClient} from './client'; export const readItems=()=>authClient.from('items').select().limit(20);\n`,
    'apps/web/src/modules/auth/run-rpc.ts': `import {authClient} from './client'; export const runRpc=()=>authClient.rpc('summary');\n`,
    'apps/web/src/modules/auth/upload.ts': `import {authClient} from './client'; export const upload=()=>authClient.storage.from('docs').upload('a.txt','body');\n`,
    'apps/web/src/modules/auth/listen.ts': `import {authClient} from './client'; export const listen=()=>authClient.channel('room').subscribe();\n`,
  });
  const owned = findings(runArch(root), 'FE_SUPABASE_CLIENT_OWNER');
  assert.deepEqual(owned.map(item => item.member).sort(), ['channel', 'from', 'rpc', 'storage'], JSON.stringify(owned, null, 2));
  assert.ok(owned.every(item => /auth only/.test(item.message)), JSON.stringify(owned, null, 2));
});

test('L13 FE_SERVICE_ROLE_FORBIDDEN: service-role text and credential env reads are refused, while config-owned public declarations are allowed', t => {
  const root = freshFe(t, {
    'apps/web/src/features/pages/Leak/index.ts': `export const key=process.env.NEXT_PUBLIC_SESSION_TOKEN; export const label='service_role';\n`,
  });
  const secret = findings(runArch(root), 'FE_SERVICE_ROLE_FORBIDDEN');
  assert.ok(secret.some(item => item.name === 'NEXT_PUBLIC_SESSION_TOKEN'), JSON.stringify(secret, null, 2));
  assert.ok(secret.some(item => /service_role string/.test(item.message)), JSON.stringify(secret, null, 2));
  assert.equal(secret.some(item => item.name === 'NEXT_PUBLIC_ANALYTICS_ID'), false, 'the modules/config read declares product public config');
  assert.equal(secret.some(item => /comment/.test(item.path)), false);
});

test('the front-end Supabase machine is not applicable to a full app with no supabase provider', t => {
  const root = archFixture(t, { profile: 'fe', files: {
    'apps/web/src/modules/types/lookalike.ts': `export const serviceRole='service_role';\n`,
  } });
  const report = runArch(root);
  assert.deepEqual(newFindings(report), []);
  assert.equal(report.coverage.hfsMachine.supabaseFrontend.status, 'not-applicable');
  assert.equal(FE_CODES.some(code => report.coverage.checkedRuleIds.includes(code)), false);
});

test('the front-end Supabase machine is enabled by the supabase provider in a full app too', t => {
  const full = JSON.parse(declaration('fe'));
  delete full.edition;
  const report = runArch(freshFe(t, { '../hfs.json': `${JSON.stringify(full, null, 2)}\n` }));
  assert.deepEqual(newFindings(report), [], JSON.stringify(newFindings(report), null, 2));
  assert.equal(report.coverage.hfsMachine.supabaseFrontend.status, 'checked');
  for (const code of FE_CODES) assert.ok(report.coverage.checkedRuleIds.includes(code), `${code} was not recorded as checked`);
});

const joseTypes = `
export type JWKS=ReturnType<typeof createRemoteJWKSet>; export declare function createRemoteJWKSet(url:URL):{kind:'jwks'};
export declare function jwtVerify(token:string,jwks:unknown,options:{issuer:string;audience:string|Array<string>;algorithms:Array<string>}):Promise<{payload:{sub?:string;role?:string;exp?:number}}>;
export declare function decodeJwt(token:string):unknown;
`;

const beClean = (extra = {}) => ({
  '../hfs.json': declaration('be'),
  ...moduleFiles,
  '../node_modules/jose/package.json': JSON.stringify({ name: 'jose', version: '6.0.0', types: 'index.d.ts' }),
  '../node_modules/jose/index.d.ts': joseTypes,
  '../node_modules/jsonwebtoken/package.json': JSON.stringify({ name: 'jsonwebtoken', version: '9.0.0', types: 'index.d.ts' }),
  '../node_modules/jsonwebtoken/index.d.ts': 'export declare function decode(token:string):unknown;\n',
  'src/modules/integrations/supabase/index.ts': `export * from './supabase.client'; export * from './supabase.jwks';\n`,
  'src/modules/integrations/supabase/supabase.config.ts': `export interface SupabaseConfig{issuer:string;url:string;anonKey:string}\n`,
  'src/modules/integrations/supabase/supabase.client.ts': `import {createClient,type SupabaseClient} from '@supabase/supabase-js'; interface Database{public:unknown}
export const client:SupabaseClient<Database>=createClient<Database>('https://fixture.invalid','fixture-public-key');\n`,
  'src/modules/integrations/supabase/supabase.jwks.ts': `import {createRemoteJWKSet,jwtVerify} from 'jose'; const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/.well-known/jwks.json'));
export const verifyToken=(token:string)=>jwtVerify(token,jwks,{issuer:'https://fixture.invalid/auth/v1',audience:'authenticated',algorithms:['ES256']});\n`,
  ...extra,
});

const freshBe = (t, extra = {}) => archFixture(t, { profile: 'be', files: beClean(extra) });

test('L10/L16: the BE Supabase integration alone owns a Database-typed client and verifies JWTs with pinned JWKS constraints', t => {
  const report = runArch(freshBe(t));
  assert.deepEqual(report.violations.filter(item => BE_CODES.includes(item.ruleId)), [], JSON.stringify(report.violations.filter(item => BE_CODES.includes(item.ruleId)), null, 2));
  for (const code of BE_CODES) assert.ok(report.coverage.checkedRuleIds.includes(code), `${code} was not recorded as checked`);
});

test('L10 BE_SUPABASE_CLIENT_OWNER: a Supabase import/call outside the integration and an untyped client are findings; another library type is not', t => {
  const root = freshBe(t, {
    'src/features/api/orders/application/leak.service.ts': `import {createClient} from '@supabase/supabase-js'; import type {SupabaseClient as Other} from 'other-client';
export type Safe=Other<string>; const client=createClient('u','k'); export const leak=()=>client.rpc('admin');\n`,
  });
  const owned = findings(runArch(root), 'BE_SUPABASE_CLIENT_OWNER');
  assert.ok(owned.some(item => /imported by/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.ok(owned.some(item => /untyped Supabase client/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.ok(owned.some(item => /call is made/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.equal(owned.some(item => /Other/.test(item.message)), false);
});

test('L16 BE_SUPABASE_JWT_VERIFIED: decode-only JWTs, unpinned verification and request-body authorization claims are refused; comments and local decoders are ignored', t => {
  const root = freshBe(t, {
    'src/modules/integrations/supabase/supabase.jwks.ts': `import {createRemoteJWKSet,jwtVerify,decodeJwt} from 'jose'; const jwks=createRemoteJWKSet(new URL('https://fixture.invalid/jwks'));
const local={decode:(value:string)=>value}; export const verifyToken=(token:string)=>{local.decode(token);decodeJwt(token);return jwtVerify(token,jwks,{issuer:'x',audience:'wrong',algorithms:[]})};
// jsonwebtoken.decode(token) in a comment is not a call.\n`,
    'src/features/api/orders/transport/http/orders.controller.ts': `export const principal=(request:{body:{role:string}})=>request.body.role;\n`,
  });
  const jwt = findings(runArch(root), 'BE_SUPABASE_JWT_VERIFIED');
  assert.ok(jwt.some(item => /decodes a token without/.test(item.message)), JSON.stringify(jwt, null, 2));
  assert.ok(jwt.some(item => /pin issuer/.test(item.message)), JSON.stringify(jwt, null, 2));
  assert.ok(jwt.some(item => /request body/.test(item.message)), JSON.stringify(jwt, null, 2));
  assert.equal(jwt.filter(item => /decodes a token without/.test(item.message)).length, 1, 'the local decode method and comment are non-matches');
});
