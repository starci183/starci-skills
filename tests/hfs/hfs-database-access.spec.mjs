// proves: DB_BE_ONLY_ACCESS@lite, DB_BE_ONLY_ACCESS@full
// proves: DB_REALTIME_UNLISTED@lite, DB_REALTIME_UNLISTED@full
// proves: DB_APP_ROLE@lite, DB_APP_ROLE@full
// proves: DB_FORCE_RLS_DEFAULT@lite, DB_FORCE_RLS_DEFAULT@full
// proves: DB_POLICY_TAUTOLOGY@lite, DB_POLICY_TAUTOLOGY@full
// proves: DB_VIEW_UNSAFE@lite, DB_VIEW_UNSAFE@full
// proves: DB_RLS_REQUIRED@lite, DB_RLS_REQUIRED@full
// proves: DB_DEFINER_REVOKE@lite, DB_DEFINER_REVOKE@full
// proves: DB_STORAGE_PREFIX@lite, DB_STORAGE_PREFIX@full
// The complete migration set is judged through checkDatabase, using real temporary repositories and its
// production Git runner. Each rule has violating and passing SQL fixtures in both editions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';

const made = [];
const MIGRATION = 'supabase/migrations/20260101120000_access.sql';
const NEXT_MIGRATION = 'supabase/migrations/20260102120000_hardening.sql';

test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function fixtureRepo(edition, contents, supabase = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-access-'));
  made.push(dir);
  const declaration = {
    hfs: 3, kind: 'app', project: 'access', edition, supabase,
    sides: { be: { apps: [] }, fe: { apps: [] } },
  };
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(declaration));
  for (const [file, text] of Object.entries(contents)) {
    const target = path.join(dir, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  execFileSync('git', ['-C', dir, 'init', '-b', 'main', '-q'], {
    env: withoutGitLocalEnv(process.env), stdio: ['ignore', 'pipe', 'pipe'],
  });
  return dir;
}

async function findingsFor(edition, sql, options = {}) {
  const contents = { [MIGRATION]: sql, ...options.contents };
  const repoRoot = fixtureRepo(edition, contents, options.supabase);
  return checkDatabase({ repoRoot, files: Object.keys(contents) });
}

async function expectCode(edition, code, sql, violates, options) {
  const findings = await findingsFor(edition, sql, options);
  const matching = findings.filter((finding) => finding.code === code);
  assert.equal(matching.length > 0, violates, JSON.stringify(findings, null, 2));
  for (const finding of matching) {
    assert.equal(finding.level, 'error');
    assert.ok(finding.path.startsWith('supabase/migrations/'));
  }
}

const table = `
create table public.items (id uuid primary key, user_id uuid not null, tenant_id uuid);
alter table public.items enable row level security;
`;
const listed = { supabase: { directAccess: ['public.items'] } };
const memberPolicy = (predicate, action = 'select') => `${table}
create policy items_member_${action} on public.items for ${action} to authenticated
  ${action === 'insert' ? 'with check' : 'using'} (${predicate});`;
const publicRead = `${table}
create policy items_public_read on public.items for select to anon using (true);
`;
const definer = `
create function public.identity(subject uuid) returns uuid language sql security definer
set search_path = '' as $$ select subject $$;
`;

const accessCases = [
  ['authenticated table grant', `${table} grant select on public.items to authenticated;`, true],
  ['authenticated policy', memberPolicy('user_id = auth.uid()'), true],
  ['authenticated direct access grant', `${table} grant select on public.items to authenticated;`, false, listed],
  ['authenticated direct access policy', memberPolicy('user_id = auth.uid()'), false, listed],
  ['unqualified listed table', memberPolicy('user_id = auth.uid()'), false, { supabase: { directAccess: ['items'] } }],
  ['unrelated exception', memberPolicy('user_id = auth.uid()'), true, { supabase: { directAccess: ['private.items'] } }],
  ['private authenticated table grant', 'create table private.items (id uuid); grant select on private.items to authenticated;', false],
  ['authenticated sequence grant', 'grant usage, select on sequence public.items_id_seq to authenticated;', true],
  ['anonymous select without a public read policy', `${table} grant select on public.items to anon;`, true],
  ['anonymous select covered by public read', `${publicRead} grant select on public.items to anon;`, false],
  ['anonymous write despite public read', `${publicRead} grant select, insert on public.items to anon;`, true],
  ['anonymous write policy', `${table} create policy items_anon_insert on public.items for insert to anon with check (user_id = auth.uid());`, true],
  ['anonymous listed exception', `${table} grant insert on public.items to anon;`, false, listed],
  ['broad exposed authenticated grant', `${table} grant select on all tables in schema public to authenticated;`, true],
  ['non-table schema usage grant', 'grant usage on schema public to authenticated;', false],
  ['other exposed schema', 'create table api.items (id uuid); alter table api.items enable row level security; grant select on api.items to authenticated;', true,
    { contents: { 'supabase/config.toml': '[api]\nschemas = ["public", "api"]\n' } }],
];

const realtimeCases = [
  ['add an unlisted table', `${table} alter publication supabase_realtime add table public.items;`, true],
  ['set an unlisted table', `${table} alter publication supabase_realtime set table public.items;`, true],
  ['create publication with unlisted table', `${table} create publication supabase_realtime for table public.items;`, true],
  ['create publication for all tables', `${table} create publication supabase_realtime for all tables;`, true],
  ['add a listed table', `${table} alter publication supabase_realtime add table public.items;`, false, listed],
  ['set a listed table', `${table} alter publication supabase_realtime set table public.items;`, false, listed],
  ['another publication', `${table} create publication analytics_feed for table public.items;`, false],
];

const roleCases = [
  ['superuser application role', 'create role app_be login noinherit nobypassrls superuser;', true],
  ['bypassrls application role', 'create role app_be login noinherit bypassrls;', true],
  ['inherited privileges', 'create role app_be login inherit nobypassrls;', true],
  ['least privilege role', 'create role app_be login noinherit nobypassrls nosuperuser;', false],
  ['grant all on a schema', 'grant all on schema public to app_be;', true],
  ['grant all on every table', 'grant all on all tables in schema public to app_be;', true],
  ['grant all on one table', `${table} grant all privileges on public.items to app_be;`, true],
  ['bounded table and schema grants', `${table} grant usage on schema public to app_be; grant select, insert, update, delete on public.items to app_be;`, false],
  ['alter role to bypassrls', 'create role app_be login noinherit nobypassrls; alter role app_be bypassrls;', true],
  ['declared role is checked', 'create role backend login noinherit bypassrls;', true, { supabase: { appRole: 'backend' } }],
  ['another role is independent', 'create role maintenance superuser;', false],
];

const owned = `${table} alter table public.items owner to app_be;`;
const forceCases = [
  ['owner role needs force RLS', owned, true],
  ['owner role enables force RLS', `${owned} alter table public.items force row level security;`, false],
  ['SET ROLE determines the creator', `set role app_be; ${table} reset role;`, true],
  ['SET ROLE with force RLS', `set role app_be; ${table} alter table public.items force row level security; reset role;`, false],
  ['reasoned table exemption', owned, false, { supabase: { forceRlsExemptions: [{ table: 'public.items', reason: 'The documented owner path must bypass its own RLS.' }] } }],
  ['empty exemption reason is refused', owned, true, { supabase: { forceRlsExemptions: [{ table: 'public.items', reason: '' }] } }],
  ['whitespace exemption reason is refused', owned, true, { supabase: { forceRlsExemptions: [{ table: 'public.items', reason: '   ' }] } }],
  ['unrelated exemption cannot cover the table', owned, true, { supabase: { forceRlsExemptions: [{ table: 'public.other', reason: 'Owner maintenance.' }] } }],
  ['another owner has no default-force obligation', `${table} alter table public.items owner to migration_owner;`, false],
];

const policyCases = [
  ['literal true', memberPolicy('true'), true, listed],
  ['non-null column', memberPolicy('id is not null'), true, listed],
  ['self equality', memberPolicy('user_id = user_id'), true, listed],
  ['constant equality', memberPolicy('1 = 1'), true, listed],
  ['OR true bypasses the principal', memberPolicy('user_id = auth.uid() or true'), true, listed],
  ['principal being present does not filter a row', memberPolicy('auth.uid() is not null'), true, listed],
  ['with check is independently judged', `${table} create policy items_member_update on public.items for update to authenticated using (user_id = auth.uid()) with check (id is not null);`, true, listed],
  ['principal identity equality', memberPolicy('user_id = auth.uid()'), false, listed],
  ['JWT claim equality', memberPolicy("tenant_id::text = (auth.jwt() ->> 'tenant_id')"), false, listed],
  ['request claims equality', memberPolicy("tenant_id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')"), false, listed],
  ['SQL helper carries the principal', `create function private.principal_id() returns uuid language sql as $$ select auth.uid() $$; ${memberPolicy('user_id = private.principal_id()')}`, false, listed],
  ['ordinary helper is not a principal source', `create function private.constant_id() returns uuid language sql as $$ select null::uuid $$; ${memberPolicy('user_id = private.constant_id()')}`, true, listed],
  ['trusted application role may accept every row', `${table} create policy items_app_be_all on public.items for all to app_be using (id is not null) with check (id is not null);`, false],
  ['intentional public read', publicRead, false],
  ['public read suffix cannot authorize writes', `${table} create policy items_public_read on public.items for insert to anon with check (true);`, true],
];

const viewCases = [
  ['exposed owner view', `${table} create view public.item_view as select id from public.items;`, true],
  ['exposed materialized view', `${table} create materialized view public.item_view as select id from public.items;`, true],
  ['invoker view', `${table} create view public.item_view with (security_invoker = true) as select id from public.items;`, false],
  ['explicit non-invoker view', `${table} create view public.item_view with (security_invoker = false) as select id from public.items;`, true],
  ['revoke all browser privileges', `${table} create view public.item_view as select id from public.items; revoke all on public.item_view from anon, authenticated;`, false],
  ['revoke SELECT browser privileges', `${table} create materialized view public.item_view as select id from public.items; revoke select on public.item_view from anon, authenticated;`, false],
  ['independent browser revokes', `${table} create view public.item_view as select id from public.items; revoke select on public.item_view from anon; revoke select on public.item_view from authenticated;`, false],
  ['partial browser revoke', `${table} create view public.item_view as select id from public.items; revoke all on public.item_view from anon;`, true],
  ['revoking writes does not revoke reads', `${table} create view public.item_view as select id from public.items; revoke insert on public.item_view from anon, authenticated;`, true],
  ['private owner view', `${table} create view private.item_view as select id from public.items;`, false],
];

const rlsCases = [
  ['disable exposed RLS', `${table} alter table public.items disable row level security;`, true],
  ['remove exposed forced RLS', `${table} alter table public.items force row level security; alter table public.items no force row level security;`, true],
  ['enabled RLS', table, false],
  ['private table moved into exposed schema', 'create table private.items (id uuid); alter table private.items set schema public;', true],
  ['moved table enables RLS at its destination', 'create table private.items (id uuid); alter table private.items set schema public; alter table public.items enable row level security;', false],
  ['private RLS weakening', 'create table private.items (id uuid); alter table private.items disable row level security;', false],
];

const definerCases = [
  ['authenticated revoke is missing', `${definer} revoke execute on function public.identity(uuid) from public, anon;`, true],
  ['all browser roles revoked', `${definer} revoke execute on function public.identity(uuid) from public, anon, authenticated;`, false],
  ['private definer', "create function private.identity(subject uuid) returns uuid language sql security definer set search_path = '' as $$ select subject $$;", false],
  ['ALTER FUNCTION activates the definer rule', "create function public.identity(subject uuid) returns uuid language sql security invoker set search_path = '' as $$ select subject $$; alter function public.identity(uuid) security definer; revoke execute on function public.identity(uuid) from public, anon;", true],
  ['ALTER FUNCTION with complete revocation', "create function public.identity(subject uuid) returns uuid language sql security invoker set search_path = '' as $$ select subject $$; alter function public.identity(uuid) security definer; revoke execute on function public.identity(uuid) from public, anon, authenticated;", false],
  ['invoker function does not need revocation', 'create function public.identity(subject uuid) returns uuid language sql security invoker as $$ select subject $$;', false],
];

const storagePolicy = (predicate, action = 'select') => `create policy objects_member_${action} on storage.objects for ${action} to authenticated ${action === 'insert' ? 'with check' : 'using'} (${predicate});`;
const storageCases = [
  ['private bucket without owner prefix', storagePolicy("bucket_id = 'avatars'"), true],
  ['private bucket ownership prefix', storagePolicy("bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text"), false],
  ['insert with ownership prefix', storagePolicy("bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text", 'insert'), false],
  ['insert without ownership prefix', storagePolicy("bucket_id = 'avatars'", 'insert'), true],
  ['public bucket exemption', storagePolicy("bucket_id = 'brand_public'"), false],
  ['wrong path component', storagePolicy("bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text"), true],
  ['constant owner prefix', storagePolicy("bucket_id = 'avatars' and (storage.foldername(name))[1] = 'everyone'"), true],
  ['OR true bypasses prefix', storagePolicy("(bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) or true"), true],
  ['OR private bucket bypasses prefix', storagePolicy("(bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) or bucket_id = 'documents'"), true],
  ['every OR branch enforces ownership or public bucket', storagePolicy("(bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) or bucket_id = 'brand_public'"), false],
];

const ruleCases = [
  ['DB_BE_ONLY_ACCESS', accessCases], ['DB_REALTIME_UNLISTED', realtimeCases],
  ['DB_APP_ROLE', roleCases], ['DB_FORCE_RLS_DEFAULT', forceCases],
  ['DB_POLICY_TAUTOLOGY', policyCases], ['DB_VIEW_UNSAFE', viewCases],
  ['DB_RLS_REQUIRED', rlsCases], ['DB_DEFINER_REVOKE', definerCases],
  ['DB_STORAGE_PREFIX', storageCases],
];

const historicalCases = [
  ['grant revoked by the next migration', 'DB_BE_ONLY_ACCESS', `${table} grant select, update on public.items to authenticated;`, 'revoke all on public.items from authenticated;'],
  ['authenticated policy dropped by the next migration', 'DB_BE_ONLY_ACCESS', memberPolicy('user_id = auth.uid()'), 'drop policy items_member_select on public.items;'],
  ['authenticated policy reassigned by the next migration', 'DB_BE_ONLY_ACCESS', memberPolicy('user_id = auth.uid()'), 'alter policy items_member_select on public.items to app_be;'],
  ['view access revoked by the next migration', 'DB_VIEW_UNSAFE', `${table} create view public.item_view as select id from public.items;`, 'revoke select on public.item_view from anon, authenticated;'],
  ['definer revoke completed by the next migration', 'DB_DEFINER_REVOKE', `${definer} revoke execute on function public.identity(uuid) from public, anon;`, 'revoke execute on function public.identity(uuid) from authenticated;'],
  ['definer schema revoke completed by the next migration', 'DB_DEFINER_REVOKE', `${definer} revoke execute on function public.identity(uuid) from public, anon;`, 'revoke all on all functions in schema public from authenticated;'],
  ['later grant reopens definer execution', 'DB_DEFINER_REVOKE', `${definer} revoke execute on function public.identity(uuid) from public, anon, authenticated;`, 'grant execute on function public.identity(uuid) to authenticated;', true],
  ['later revoke of another overload does not close definer execution', 'DB_DEFINER_REVOKE', `${definer} revoke execute on function public.identity(uuid) from public, anon;`, 'revoke execute on function public.identity(text) from authenticated;', true],
  ['later invoker declaration retires definer execution obligation', 'DB_DEFINER_REVOKE', `${definer} revoke execute on function public.identity(uuid) from public, anon;`, 'alter function public.identity(uuid) security invoker;'],
  ['later function drop retires definer execution obligation', 'DB_DEFINER_REVOKE', `${definer} revoke execute on function public.identity(uuid) from public, anon;`, 'drop function public.identity(uuid);'],
  ['later promotion checks previously created function', 'DB_DEFINER_REVOKE', "create function public.identity(subject uuid) returns uuid language sql security invoker set search_path = '' as $$ select subject $$;", "alter function public.identity(uuid) security definer; alter function public.identity(uuid) set search_path = ''; revoke execute on function public.identity(uuid) from public, anon;", true],
  ['promotion preserves earlier authenticated revocation', 'DB_DEFINER_REVOKE', "create function public.identity(subject uuid) returns uuid language sql security invoker set search_path = '' as $$ select subject $$; revoke execute on function public.identity(uuid) from authenticated;", "alter function public.identity(uuid) security definer; alter function public.identity(uuid) set search_path = ''; revoke execute on function public.identity(uuid) from public, anon;"],
];

const cleanSql = `
create role app_be login noinherit nobypassrls nosuperuser;
${owned}
alter table public.items force row level security;
create policy items_app_be_all on public.items for all to app_be
using (id is not null) with check (id is not null);
grant usage on schema public to app_be;
grant select, insert, update, delete on public.items to app_be;
create view public.item_view with (security_invoker = true) as select id from public.items;
${definer}
revoke execute on function public.identity(uuid) from public, anon, authenticated;
create table public.countries (code text primary key);
alter table public.countries enable row level security;
create policy countries_public_read on public.countries for select to anon using (true);
grant select on public.countries to anon;
${storagePolicy("bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text")}
`;

for (const edition of ['lite', 'full']) {
  for (const [code, cases] of ruleCases) {
    for (const [name, sql, violates, options] of cases) {
      test(`${code}@${edition}: ${name}`, () => expectCode(edition, code, sql, violates, options));
    }
  }
  for (const [name, code, initial, hardening, violates = false] of historicalCases) {
    test(`${code}@${edition}: ${name}`, () => expectCode(edition, code, initial, violates, {
      contents: { [NEXT_MIGRATION]: hardening },
    }));
  }
  test(`database access@${edition}: a complete hardened migration has no findings`, async () => {
    assert.deepEqual(await findingsFor(edition, cleanSql), []);
  });
}

// The catalog's proof discovery reads literal test blocks: one violating and one passing block name each R255 code.
for (const edition of ['lite', 'full']) {
  test(`DB_APP_ROLE@${edition}: a superuser application role is refused and a least-privilege one passes`, async () => {
    await expectCode(edition, 'DB_APP_ROLE', 'create role app_be login noinherit nobypassrls superuser;', true);
    await expectCode(edition, 'DB_APP_ROLE', 'create role app_be login noinherit nobypassrls nosuperuser;', false);
  });
  test(`DB_FORCE_RLS_DEFAULT@${edition}: an app-role-owned table without force RLS is refused and with it passes`, async () => {
    await expectCode(edition, 'DB_FORCE_RLS_DEFAULT', owned, true);
    await expectCode(edition, 'DB_FORCE_RLS_DEFAULT', `${owned} alter table public.items force row level security;`, false);
  });
}
