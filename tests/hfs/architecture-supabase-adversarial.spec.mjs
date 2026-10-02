import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch } from '../helpers/hfs-arch-fixture.mjs';

const FE_CODES = new Set([
  'FE_SUPABASE_CLIENT_OWNER', 'FE_DB_RESULT_TYPED', 'FE_DB_ERROR_HANDLED', 'FE_SERVICE_ROLE_FORBIDDEN',
  'FE_AUTH_SESSION_TRUST', 'FE_DB_WRITE_SHAPE', 'FE_ROUTE_HANDLER_FORBIDDEN',
]);
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
  '../node_modules/other-client/index.d.ts': `export interface SupabaseClient<T>{value:T}
export interface SessionClient{auth:{getSession():Promise<{error:Error|null}>}}
export interface Decoder{decode(value:string):unknown}
`,
};

const uniqueCodes = (report, path, allowed) => [...new Set(report.violations
  .filter(item => item.path === path && allowed.has(item.ruleId))
  .map(item => item.ruleId))].sort();

const queryImports = `import {client} from '../server'; import {toOutcome} from '../outcome';`;

test('L10-L15 adversarial FE matrix has exact findings for 55 realistic call, result, auth, action, env and route cases', t => {
  const cases = [
    { name: 'destructured error is read', path: 'apps/web/src/modules/db/cases/read-01.ts', source: `${queryImports}
export const read=async()=>{const {data,error}=await client.from('items').select().limit(20);if(error)return {kind:'unavailable' as const};return {kind:'ok' as const,data}};`, expected: [] },
    { name: 'renamed destructured error is read', path: 'apps/web/src/modules/db/cases/read-02.ts', source: `${queryImports}
export const read=async()=>{const {data,error:queryError}=await client.from('items').select().limit(20);if(queryError)return {kind:'unavailable' as const};return {kind:'ok' as const,data}};`, expected: [] },
    { name: 'optional error access is read', path: 'apps/web/src/modules/db/cases/read-03.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().limit(20);if(result?.error)return {kind:'unavailable' as const};return {kind:'ok' as const,data:result.data}};`, expected: [] },
    { name: 'element error access is read', path: 'apps/web/src/modules/db/cases/read-04.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().limit(20);if(result['error'])return {kind:'unavailable' as const};return {kind:'ok' as const,data:result.data}};`, expected: [] },
    { name: 'whole variable result reaches toOutcome', path: 'apps/web/src/modules/db/cases/read-05.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().limit(20);return toOutcome(result)};`, expected: [] },
    { name: 'whole awaited result reaches toOutcome', path: 'apps/web/src/modules/db/cases/read-06.ts', source: `${queryImports}
export const read=async()=>toOutcome(await client.from('items').select().limit(20));`, expected: [] },
    { name: 'data-only destructuring is refused', path: 'apps/web/src/modules/db/cases/read-07.ts', source: `${queryImports}
export const read=async()=>{const {data}=await client.from('items').select().limit(20);return data};`, expected: ['FE_DB_ERROR_HANDLED'] },
    { name: 'empty-array collapse is refused after error handling', path: 'apps/web/src/modules/db/cases/read-08.ts', source: `${queryImports}
export const read=async()=>{const {data,error}=await client.from('items').select().limit(20);if(error)return {kind:'unavailable' as const};return data??[]};`, expected: ['FE_DB_ERROR_HANDLED'] },
    { name: 'query builder alias preserves error tracking', path: 'apps/web/src/modules/db/cases/read-09.ts', source: `${queryImports}
export const read=async()=>{const query=client.from('items').select().limit(20);const {data,error}=await query;if(error)return {kind:'unavailable' as const};return {kind:'ok' as const,data}};`, expected: [] },
    { name: 'limit bounds a list', path: 'apps/web/src/modules/db/cases/read-10.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().limit(1);return toOutcome(result)};`, expected: [] },
    { name: 'range bounds a list', path: 'apps/web/src/modules/db/cases/read-11.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().range(0,19);return toOutcome(result)};`, expected: [] },
    { name: 'gt keyset bounds a list', path: 'apps/web/src/modules/db/cases/read-12.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().gt('id','1');return toOutcome(result)};`, expected: [] },
    { name: 'gte keyset bounds a list', path: 'apps/web/src/modules/db/cases/read-13.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().gte('id','1');return toOutcome(result)};`, expected: [] },
    { name: 'lt keyset bounds a list', path: 'apps/web/src/modules/db/cases/read-14.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().lt('id','9');return toOutcome(result)};`, expected: [] },
    { name: 'lte keyset bounds a list', path: 'apps/web/src/modules/db/cases/read-15.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().lte('id','9');return toOutcome(result)};`, expected: [] },
    { name: 'unbounded list is refused', path: 'apps/web/src/modules/db/cases/read-16.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select();return toOutcome(result)};`, expected: ['FE_DB_RESULT_TYPED'] },
    { name: 'single is not a list', path: 'apps/web/src/modules/db/cases/read-17.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().single();return toOutcome(result)};`, expected: [] },
    { name: 'maybeSingle is not a list', path: 'apps/web/src/modules/db/cases/read-18.ts', source: `${queryImports}
export const read=async()=>{const result=await client.from('items').select().maybeSingle();return toOutcome(result)};`, expected: [] },
    { name: 'rpc whole result is handled', path: 'apps/web/src/modules/db/cases/read-19.ts', source: `${queryImports}
export const read=async()=>{const result=await client.rpc('summary');return toOutcome(result)};`, expected: [] },
    { name: 'storage upload whole result is handled', path: 'apps/web/src/modules/db/cases/read-20.ts', source: `${queryImports}
export const read=async()=>{const result=await client.storage.from('docs').upload('a.txt','body');return toOutcome(result)};`, expected: [] },
    { name: 'single result generic is refused', path: 'apps/web/src/modules/db/cases/read-21.ts', source: `${queryImports} type Row={id:string};
export const read=async()=>{const result=await client.from('items').select().single<Row>();return toOutcome(result)};`, expected: ['FE_DB_RESULT_TYPED'] },
    { name: 'maybeSingle result generic is refused', path: 'apps/web/src/modules/db/cases/read-22.ts', source: `${queryImports} type Row={id:string};
export const read=async()=>{const result=await client.from('items').select().maybeSingle<Row>();return toOutcome(result)};`, expected: ['FE_DB_RESULT_TYPED'] },
    { name: 'returns result generic is refused', path: 'apps/web/src/modules/db/cases/read-23.ts', source: `${queryImports} type Row={id:string};
export const read=async()=>{const result=await client.from('items').select().limit(1).returns<Row[]>();return toOutcome(result)};`, expected: ['FE_DB_RESULT_TYPED'] },
    { name: 'rpc outside db owner is refused', path: 'apps/web/src/features/case-rpc.ts', source: `import {client} from '../modules/db/server';export const run=()=>client.rpc('admin');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'storage outside db owner is refused', path: 'apps/web/src/components/case-storage.ts', source: `import {client} from '../modules/db/server';export const run=()=>client.storage.from('docs').upload('x','y');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'server getSession is refused', path: 'apps/web/src/modules/db/cases/read-26.ts', source: `${queryImports}
export const read=async()=>{const result=await client.auth.getSession();if(result.error)throw result.error;return result.data};`, expected: ['FE_AUTH_SESSION_TRUST'] },
    { name: 'getSession comments strings and local object are ignored', path: 'apps/web/src/modules/types/session-lookalikes.ts', source: `const note='auth.getSession()';// auth.getSession()
const local={auth:{getSession:async()=>({error:null})}};export const read=()=>local.auth.getSession();`, expected: [] },
    { name: 'client getSession is allowed', path: 'apps/web/src/modules/db/cases/read-28.ts', source: `'use client';${queryImports}
export const read=async()=>{const result=await client.auth.getSession();if(result.error)throw result.error;return result.data};`, expected: [] },
    { name: 'core public env is allowed', path: 'apps/web/src/features/public-env.ts', source: `export const url=process.env.NEXT_PUBLIC_SUPABASE_URL;`, expected: [] },
    { name: 'service-role comment and unrelated word are ignored', path: 'apps/web/src/features/service-copy.ts', source: `// service_role is named in documentation.
export const label='customer_service_roleplay';`, expected: [] },
    { name: 'exact service role string is refused', path: 'apps/web/src/features/service-leak.ts', source: `export const label='service_role';`, expected: ['FE_SERVICE_ROLE_FORBIDDEN'] },
    { name: 'credential env suffix is refused', path: 'apps/web/src/features/secret-env.ts', source: `export const key=process.env.NEXT_PUBLIC_PROVIDER_SECRET;`, expected: ['FE_SERVICE_ROLE_FORBIDDEN'] },
    { name: 'typed server client is accepted', path: 'apps/web/src/modules/db/typed-client.ts', source: `import {createServerClient} from '@supabase/ssr';import type {Database} from '../../../../../supabase/types/database.types';export const typed=createServerClient<Database>('u','k');`, expected: [] },
    { name: 'untyped server client is refused', path: 'apps/web/src/modules/db/untyped-client.ts', source: `import {createServerClient} from '@supabase/ssr';export const untyped=createServerClient('u','k');`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'other library SupabaseClient is ignored', path: 'apps/web/src/modules/types/other-client.ts', source: `import type {SupabaseClient} from 'other-client';export type Other=SupabaseClient<string>;`, expected: [] },
    { name: 'sensitive action verifies user', path: 'apps/web/src/modules/db/billing/write-get-user.ts', source: `'use server';import {getPrincipal} from '../principal';import {client} from '../server';const schema={parse:(v:unknown)=>String(v)};
export const write=async(input:unknown)=>{const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};const parsed=schema.parse(input);const identity=await client.auth.getUser();if(identity.error)return {kind:'refused' as const};return {kind:'ok' as const,data:{parsed,user:identity.data.user}}};`, expected: [] },
    { name: 'sensitive action without getUser is refused', path: 'apps/web/src/modules/db/role/write-missing-user.ts', source: `'use server';import {getPrincipal} from '../principal';const schema={parse:(v:unknown)=>String(v)};
export const write=async(input:unknown)=>{const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};return {kind:'ok' as const,data:schema.parse(input)}};`, expected: ['FE_AUTH_SESSION_TRUST'] },
    { name: 'file-level server action is accepted', path: 'apps/web/src/modules/db/cases/write-file-level.ts', source: `'use server';import {getPrincipal} from '../principal';const schema={parse:(v:unknown)=>String(v)};
export const write=async(input:unknown)=>{const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};return {kind:'ok' as const,data:schema.parse(input)}};`, expected: [] },
    { name: 'function-level server action is accepted', path: 'apps/web/src/modules/db/cases/write-function-level.ts', source: `import {getPrincipal} from '../principal';const schema={parse:(v:unknown)=>String(v)};
export const write=async(input:unknown)=>{'use server';const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};return {kind:'ok' as const,data:schema.parse(input)}};`, expected: [] },
    { name: 'late principal is refused', path: 'apps/web/src/modules/db/cases/write-late-principal.ts', source: `'use server';import {getPrincipal} from '../principal';const schema={parse:(v:unknown)=>String(v)};
export const write=async(input:unknown)=>{const parsed=schema.parse(input);const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};return {kind:'ok' as const,data:parsed}};`, expected: ['FE_AUTH_SESSION_TRUST'] },
    { name: 'input use before parse is refused', path: 'apps/web/src/modules/db/cases/write-unparsed.ts', source: `'use server';import {getPrincipal} from '../principal';
export const write=async(input:unknown)=>{const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};return {kind:'ok' as const,data:String(input)}};`, expected: ['FE_DB_WRITE_SHAPE'] },
    { name: 'health live route is allowed', path: 'apps/web/src/app/health/live/route.ts', source: `export const GET=()=>new Response('ok');`, expected: [] },
    { name: 'auth callback slot is allowed', path: 'apps/web/src/app/auth/callback/route.ts', source: `export const GET=()=>new Response('ok');`, expected: [] },
    { name: 'api route is refused', path: 'apps/web/src/app/api/export/route.ts', source: `export const GET=()=>new Response('no');`, expected: ['FE_ROUTE_HANDLER_FORBIDDEN'] },
    { name: 'route tsx is not a Next route handler', path: 'apps/web/src/app/api/export/route.tsx', source: `export const Route=()=>null;`, expected: [] },
    { name: 'getPrincipal uses getClaims', path: 'apps/web/src/modules/db/principal.ts', source: `import {client} from './server';export const getPrincipal=async()=>{const result=await client.auth.getClaims();if(result.error)return {kind:'anonymous' as const};return {kind:'member' as const,claims:result.data.claims}};`, expected: [] },
    { name: 'product public config is accepted by config owner', path: 'apps/web/src/modules/config/index.ts', source: `export const analytics=process.env.NEXT_PUBLIC_ANALYTICS_ID;`, expected: [] },
    { name: 'product public config outside config owner is refused', path: 'apps/web/src/features/public-product-env.ts', source: `export const analytics=process.env.NEXT_PUBLIC_ANALYTICS_ID;`, expected: ['FE_SERVICE_ROLE_FORBIDDEN'] },
    { name: 'other library getSession is ignored', path: 'apps/web/src/modules/types/other-session.ts', source: `import type {SessionClient} from 'other-client';export const read=async(client:SessionClient)=>{const result=await client.auth.getSession();if(result.error)throw result.error;return result};`, expected: [] },
    { name: 'contextually typed server client is accepted', path: 'apps/web/src/modules/db/context-client.ts', source: `import {createServerClient} from '@supabase/ssr';import type {SupabaseClient} from '@supabase/supabase-js';import type {Database} from '../../../../../supabase/types/database.types';export const contextual:SupabaseClient<Database>=createServerClient('u','k');`, expected: [] },
    { name: 'auth call outside db owner is refused', path: 'apps/web/src/features/case-auth.ts', source: `import {client} from '../modules/db/server';export const run=()=>client.auth.getClaims();`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'from call outside db owner is refused', path: 'apps/web/src/features/case-from.ts', source: `import {client} from '../modules/db/server';export const run=()=>client.from('items').select();`, expected: ['FE_SUPABASE_CLIENT_OWNER'] },
    { name: 'getPrincipal without getClaims is refused', path: 'apps/web/src/modules/db/principal-missing.ts', source: `export const getPrincipal=async()=>({kind:'member' as const});`, expected: ['FE_AUTH_SESSION_TRUST'] },
    { name: 'write export without a Server Action directive is refused', path: 'apps/web/src/modules/db/cases/write-no-directive.ts', source: `import {getPrincipal} from '../principal';const schema={parse:(v:unknown)=>String(v)};export const write=async(input:unknown)=>{const principal=await getPrincipal();if(principal.kind==='anonymous')return {kind:'refused' as const};return {kind:'ok' as const,data:schema.parse(input)}};`, expected: ['FE_DB_WRITE_SHAPE'] },
    { name: 'unrelated getPrincipal outside db owner is ignored', path: 'apps/web/src/features/local-principal.ts', source: `export const getPrincipal=async()=>({kind:'local' as const});`, expected: [] },
  ];
  assert.equal(cases.length, 55);
  const files = {
    '../hfs.json': declaration('fe'),
    '../supabase/types/database.types.ts': 'export interface Database { public: { Tables: { items: { Row: { id: string } } } } }\n',
    ...moduleFiles,
    'apps/web/src/modules/db/index.ts': `export * from './server';export * from './principal';export * from './outcome';`,
    'apps/web/src/modules/db/server.ts': `import {createServerClient} from '@supabase/ssr';import type {Database} from '../../../../../supabase/types/database.types';export const client=createServerClient<Database>('https://fixture.invalid','public-anon');`,
    'apps/web/src/modules/db/outcome.ts': `export const toOutcome=<T>(result:{data:T;error:Error|null})=>result.error?{kind:'unavailable' as const}:{kind:'ok' as const,data:result.data};`,
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
