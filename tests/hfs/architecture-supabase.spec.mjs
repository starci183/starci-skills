import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, findings, runArch } from '../helpers/hfs-arch-fixture.mjs';

const FE_CODES = [
  'FE_SUPABASE_CLIENT_OWNER', 'FE_DB_RESULT_TYPED', 'FE_DB_ERROR_HANDLED', 'FE_SERVICE_ROLE_FORBIDDEN',
  'FE_AUTH_SESSION_TRUST', 'FE_DB_WRITE_SHAPE', 'FE_ROUTE_HANDLER_FORBIDDEN',
];
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
export interface SupabaseClient<Database>{from(table:string):QueryBuilder<unknown>;rpc(name:string,args?:unknown):QueryBuilder<unknown>;auth:AuthClient;storage:StorageClient}
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
  '../supabase/types/database.types.ts': 'export interface Database { public: { Tables: { items: { Row: { id: string } } } } }\n',
  ...moduleFiles,
  'apps/web/src/modules/db/index.ts': `export * from './server'; export * from './browser'; export * from './principal'; export * from './outcome';\n`,
  'apps/web/src/modules/db/server.ts': `import {createServerClient} from '@supabase/ssr'; import type {Database} from '../../../../../supabase/types/database.types';
export const client=createServerClient<Database>('https://fixture.invalid','public-anon');\n`,
  'apps/web/src/modules/db/browser.ts': `import {createBrowserClient} from '@supabase/ssr'; import type {Database} from '../../../../../supabase/types/database.types';
export const browserClient=createBrowserClient<Database>('https://fixture.invalid','public-anon');\n`,
  'apps/web/src/modules/db/principal.ts': `export const getPrincipal=async()=>({kind:'member' as const});\n`,
  'apps/web/src/modules/db/outcome.ts': `export const toOutcome=<T>(result:{data:T;error:Error|null})=>result.error?{kind:'unavailable' as const}:{kind:'ok' as const,data:result.data};\n`,
  'apps/web/src/modules/db/items/read-items.ts': `import {client} from '../server'; import {toOutcome} from '../outcome';
export const readItems=async()=>{const result=await client.from('items').select().limit(20);return toOutcome(result)};\n`,
  'apps/web/src/modules/db/items/write-item.ts': `'use server'; import {client} from '../server'; import {getPrincipal} from '../principal'; import {toOutcome} from '../outcome';
const schema={parse:(value:unknown)=>({id:String(value)})}; export const writeItem=async(input:unknown)=>{const principal=await getPrincipal();
if(principal.kind==='anonymous')return {kind:'refused' as const};const parsed=schema.parse(input);const result=await client.from('items').update(parsed).eq('id',parsed.id).select().single();return toOutcome(result)};\n`,
  'apps/web/src/app/health/live/route.ts': `export const GET=()=>new Response('ok');\n`,
  'apps/web/src/app/auth/callback/route.ts': `export const GET=()=>new Response('ok');\n`,
  'apps/web/src/modules/config/index.ts': `export const analytics=process.env.NEXT_PUBLIC_ANALYTICS_ID;\n`,
  'apps/web/src/modules/types/other.ts': `import type {SupabaseClient,Decoder} from 'other-client';
export const note='.single<Row>() and auth.getSession() in a string'; export type Other=SupabaseClient<string>; export const useDecoder=(d:Decoder)=>d.decode('value');
// service_role in a comment is not executable source.\n`,
  ...extra,
});

const freshFe = (t, extra = {}) => archFixture(t, { profile: 'fe', files: feClean(extra) });
const newFindings = report => report.violations.filter(item => FE_CODES.includes(item.ruleId));

test('L10-L15: a slot-owned, typed and bounded FE Supabase path is clean, including both permitted routes and unrelated lookalikes', t => {
  const report = runArch(freshFe(t));
  assert.deepEqual(newFindings(report), [], JSON.stringify(newFindings(report), null, 2));
  for (const code of FE_CODES) assert.ok(report.coverage.checkedRuleIds.includes(code), `${code} was not recorded as checked`);
});

test('L10 FE_SUPABASE_CLIENT_OWNER: imports, untyped clients and calls outside the db slots are findings', t => {
  const root = freshFe(t, {
    'apps/web/src/features/pages/Leak/index.ts': `import {createClient} from '@supabase/supabase-js'; const client=createClient('u','k'); export const leak=()=>client.from('items').select();\n`,
    'apps/web/src/modules/db/server.ts': `import {createServerClient} from '@supabase/ssr'; export const client=createServerClient('u','k');\n`,
  });
  const owned = findings(runArch(root), 'FE_SUPABASE_CLIENT_OWNER');
  assert.ok(owned.some(item => /imported by/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.ok(owned.some(item => /untyped Supabase client/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.ok(owned.some(item => /call is made/.test(item.message)), JSON.stringify(owned, null, 2));
  assert.equal(owned.some(item => item.path.endsWith('modules/types/other.ts')), false, 'a type named SupabaseClient from another library is not Supabase');
});

test('L11 FE_DB_RESULT_TYPED: explicit result generics, result casts and unbounded list reads are refused while unrelated generics are ignored', t => {
  const root = freshFe(t, {
    'apps/web/src/modules/db/items/read-items.ts': `import {client} from '../server'; import {toOutcome} from '../outcome'; type Row={id:string};
const unrelated={single:<T>()=>null as T|null}; export const local=()=>unrelated.single<Row>();
export const readItems=async()=>{const one=await client.from('items').select().single<Row>();if(one.error)return toOutcome(one);
const list=(await client.from('items').select()) as {data:Array<Row>;error:Error|null};return toOutcome(list)};\n`,
  });
  const typed = findings(runArch(root), 'FE_DB_RESULT_TYPED');
  assert.ok(typed.some(item => /single<T>/.test(item.message)), JSON.stringify(typed, null, 2));
  assert.ok(typed.some(item => /cast or non-null/.test(item.message)), JSON.stringify(typed, null, 2));
  assert.ok(typed.some(item => /list read/.test(item.message)), JSON.stringify(typed, null, 2));
  assert.equal(typed.some(item => item.line === 2 && /single<T>/.test(item.message)), false, 'the unrelated generic method is not Supabase');
});

test('L12 FE_DB_ERROR_HANDLED: data-only destructuring and ?? [] cannot erase a Supabase refusal', t => {
  const root = freshFe(t, {
    'apps/web/src/modules/db/items/read-items.ts': `import {client} from '../server'; export const readItems=async()=>{const {data}=await client.from('items').select().limit(20);return data??[]};\n`,
  });
  const handled = findings(runArch(root), 'FE_DB_ERROR_HANDLED');
  assert.ok(handled.some(item => /does not read its error/.test(item.message)), JSON.stringify(handled, null, 2));
  assert.ok(handled.some(item => /collapsed with \?\? \[\]/.test(item.message)), JSON.stringify(handled, null, 2));
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

test('L14 auth trust and write shape: server getSession, missing principal/refusal, unparsed input and sensitive writes without getUser are findings', t => {
  const root = freshFe(t, {
    'apps/web/src/modules/db/items/read-session.ts': `import {client} from '../server'; export const readSession=async()=>{const result=await client.auth.getSession();if(result.error)throw result.error;return result.data};\n`,
    'apps/web/src/modules/db/items/write-item.ts': `'use server'; import {client} from '../server'; export const writeItem=async(input:unknown)=>{const value=String(input);const result=await client.from('items').update({value}).select().single();if(result.error)return {kind:'unavailable' as const};return {kind:'ok' as const,data:result.data}};\n`,
    'apps/web/src/modules/db/role/write-role.ts': `'use server'; import {getPrincipal} from '../principal'; const schema={parse:(v:unknown)=>v};
export const writeRole=async(input:unknown)=>{const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};return {kind:'ok' as const,data:schema.parse(input)}};\n`,
  });
  const report = runArch(root);
  const auth = findings(report, 'FE_AUTH_SESSION_TRUST');
  assert.ok(auth.some(item => /getSession/.test(item.message)), JSON.stringify(auth, null, 2));
  assert.ok(auth.some(item => /begin with/.test(item.message)), JSON.stringify(auth, null, 2));
  assert.ok(auth.some(item => /must call auth\.getUser/.test(item.message)), JSON.stringify(auth, null, 2));
  assert.ok(findings(report, 'FE_DB_WRITE_SHAPE').some(item => /used before schema/.test(item.message)), JSON.stringify(report.violations, null, 2));
});

test('L14 permits only auth/write-sign-in.ts to authenticate anonymous after principal-first and schema-first checks', t => {
  const root = freshFe(t, {
    'apps/web/src/modules/db/auth/write-sign-in.ts': `'use server'; import {getPrincipal} from '../principal'; const schema={parse:(value:unknown)=>String(value)};
export const writeSignIn=async(input:unknown)=>{const principal=await getPrincipal();const parsed=schema.parse(input);return {kind:'ok' as const,data:{principal,parsed}}};\n`,
    'apps/web/src/modules/db/items/write-without-refusal.ts': `'use server'; import {getPrincipal} from '../principal'; const schema={parse:(value:unknown)=>String(value)};
export const writeItem=async(input:unknown)=>{const principal=await getPrincipal();const parsed=schema.parse(input);return {kind:'ok' as const,data:{principal,parsed}}};\n`,
  });
  const report = runArch(root);
  const trust = findings(report, 'FE_AUTH_SESSION_TRUST');
  assert.equal(trust.some(item => item.path.endsWith('/auth/write-sign-in.ts')), false, JSON.stringify(trust, null, 2));
  assert.ok(trust.some(item => item.path.endsWith('/items/write-without-refusal.ts') && /refuse an anonymous/.test(item.message)), JSON.stringify(trust, null, 2));
  const shape = findings(report, 'FE_DB_WRITE_SHAPE');
  assert.equal(shape.some(item => item.path.endsWith('/auth/write-sign-in.ts')), false, JSON.stringify(shape, null, 2));
});

test('L15 FE_ROUTE_HANDLER_FORBIDDEN: any FE route beyond health/live and the callback slot is refused', t => {
  const root = freshFe(t, { 'apps/web/src/app/api/export/route.ts': `export const POST=()=>new Response('no');\n` });
  const routes = findings(runArch(root), 'FE_ROUTE_HANDLER_FORBIDDEN');
  assert.deepEqual(routes.map(item => item.path), ['apps/web/src/app/api/export/route.ts']);
});

test('the new Supabase machine is not applicable to a full app with no supabase provider', t => {
  const root = archFixture(t, { profile: 'fe', files: {
    'apps/web/src/app/api/existing/route.ts': `export const GET=()=>new Response('existing full route');\n`,
    'apps/web/src/modules/types/lookalike.ts': `export const serviceRole='service_role';\n`,
  } });
  const report = runArch(root);
  assert.deepEqual(newFindings(report), []);
  assert.equal(report.coverage.hfsMachine.supabaseFrontend.status, 'not-applicable');
  assert.equal(FE_CODES.some(code => report.coverage.checkedRuleIds.includes(code)), false);
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
