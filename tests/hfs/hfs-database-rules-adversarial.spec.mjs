// Adversarial coverage for the Supabase database rules. Every case asserts the complete set of finding codes so
// realistic PostgreSQL syntax cannot quietly add a false positive or hide a false negative.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';

const MIGRATIONS = 'supabase/migrations';
const MIGRATION = `${MIGRATIONS}/20260101120000_adversarial.sql`;
const made = [];

test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function repo(contents, supabase) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-adversarial-'));
  made.push(dir);
  const declaration = {
    hfs: 2,
    kind: 'app',
    project: 'adversarial',
    edition: 'lite',
    ...(supabase === undefined ? {} : { supabase }),
    sides: { be: { apps: [] }, fe: { apps: [] } },
  };
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(declaration));
  for (const [file, text] of Object.entries(contents)) {
    const target = path.join(dir, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return dir;
}

const noRemote = () => ({ ok: false, stdout: '' });
const git = (dir, args, env = {}) => execFileSync('git', ['-C', dir, ...args], {
  env: { ...withoutGitLocalEnv(process.env), ...env },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const uniqueCodes = (findings) => [...new Set(findings.map((finding) => finding.code))].sort();
const expectCodes = async ({ contents, files = Object.keys(contents), supabase, codes }) => {
  const dir = repo(contents, supabase);
  const findings = await checkDatabase({ repoRoot: dir, files, git: noRemote });
  assert.deepEqual(uniqueCodes(findings), [...codes].sort(), JSON.stringify(findings, null, 2));
};

const cleanTable = (name = 'items') => `
create table public.${name} (id uuid primary key, user_id uuid not null);
alter table public.${name} enable row level security;
`;

const sqlCases = [
  ['extensions are not tables', 'create extension if not exists pgcrypto with schema extensions;', []],
  ['enums are not tables', "create type public.order_state as enum ('open', 'closed');", []],
  ['composite types are not tables', 'create type public.money_pair as (amount numeric, currency text);', []],
  ['schema creation is not a table', 'create schema if not exists private;', []],
  ['alter default privileges is not a table grant', 'alter default privileges in schema public grant select on tables to authenticated;', []],
  ['alter default privileges cannot grant tables to anon', 'alter default privileges in schema public grant select on tables to anon;', ['DB_POLICY_SHAPE']],
  ['all-tables schema grant to anon is refused', 'grant select on all tables in schema public to anon;', ['DB_POLICY_SHAPE']],
  ['all-tables schema grant to authenticated is refused', 'grant select on all tables in schema public to authenticated;', ['DB_POLICY_SHAPE']],
  ['all-tables schema grant to public is refused', 'grant select on all tables in schema public to public;', ['DB_POLICY_SHAPE']],
  ['default service-role grant is refused', 'alter default privileges in schema public grant select on tables to service_role;', ['DB_POLICY_SHAPE']],
  ['schema usage grants need no table policy', 'grant usage on schema public to anon;', []],
  ['sequence usage grants need no table policy', 'grant usage, select on sequence public.items_id_seq to anon;', []],
  ['safe private security definer function', `
    create function private.lookup(subject uuid) returns boolean language plpgsql security definer
    set search_path = '' as $$ begin return subject is not null; end $$;`, []],
  ['exposed definer revoked from public and anon', `
    create function public.lookup(value uuid) returns boolean language sql security definer
    set search_path = '' as $$ select value is not null $$;
    revoke execute on function public.lookup(uuid) from public, anon;`, []],
  ['unqualified definer name matches qualified revoke', `
    create function lookup(subject uuid) returns boolean language sql security definer
    set search_path = '' as $$ select subject is not null $$;
    revoke execute on function public.lookup(uuid) from public, anon;`, []],
  ['exposed definer revoked only from public is incomplete', `
    create function public.lookup(value uuid) returns boolean language sql security definer
    set search_path = '' as $$ select value is not null $$;
    revoke execute on function public.lookup(uuid) from public;`, ['DB_DEFINER_SAFE']],
  ['ordinary trigger declaration is clean', `
    create function private.touch() returns trigger language plpgsql security invoker as $$ begin return new; end $$;
    create trigger items_touch before update on public.items for each row execute function private.touch();`, []],
  ['Supabase auth uid subquery is a real predicate', `${cleanTable()}
    create policy items_member_select on public.items for select to authenticated
    using ((select auth.uid()) = user_id);`, []],
  ['authenticated select policy is clean', `${cleanTable()}
    create policy items_member_select on public.items for select to authenticated using (user_id = auth.uid());`, []],
  ['for all with real predicates is clean', `${cleanTable()}
    create policy items_member_all on public.items for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());`, []],
  ['insert with a real with-check is clean', `${cleanTable()}
    create policy items_member_insert on public.items for insert to authenticated with check (user_id = auth.uid());`, []],
  ['partitioned parent needs one enable and child inherits', `
    create table public.events (id bigint, occurred_at timestamptz) partition by range (occurred_at);
    alter table public.events enable row level security;
    create table public.events_2026 partition of public.events for values from ('2026-01-01') to ('2027-01-01');`, []],
  ['create table if not exists is recognized', `
    create table if not exists public.items (id bigint);
    alter table public.items enable row level security;`, []],
  ['create table like is recognized', `
    create table public.items (like public.template including all);
    alter table public.items enable row level security;`, []],
  ['create table as select is recognized', `
    create table public.items as select 1 as id;
    alter table public.items enable row level security;`, []],
  ['security invoker view is not a table', 'create view public.item_view with (security_invoker = true) as select 1 as id;', []],
  ['bucket insert with on conflict is recognized', `
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 1024, array['image/png']::text[])
    on conflict (id) do update set name = excluded.name;
    create policy objects_member_select on storage.objects for select to authenticated using (bucket_id = 'avatars');`, []],
  ['multiple unrelated statements remain clean', `
    create schema if not exists private;
    create type public.state as enum ('ready');
    ${cleanTable()}
    grant select on public.items to authenticated;`, []],
  ['dollar body may mention DDL without executing it', `
    create function private.words() returns text language plpgsql security invoker as $body$
    begin return 'create table / execute / security definer'; end $body$;`, []],
  ['comments may contain suspicious SQL', `
    -- create table public.hidden (id int);
    /* execute 'alter table public.hidden enable row level security'; */
    select 1;`, []],
  ['quoted identifiers are matched structurally', `
    create table public."Order" (id bigint);
    alter table only public."Order" enable row level security;
    create policy "Order_member_select" on public."Order" for select to authenticated using (id > 0);`, []],
  ['uppercase SQL is parsed normally', `
    CREATE TABLE PUBLIC.ITEMS (ID BIGINT);
    ALTER TABLE ONLY PUBLIC.ITEMS ENABLE ROW LEVEL SECURITY;`, []],
  ['schema-qualified private table is not exposed', 'create table private.items (id bigint);', []],
  ['unqualified table defaults to public', `
    create table items (id bigint);
    alter table only items enable row level security;`, []],
  ['explicit private search path owns an unqualified table', `
    set search_path = private, public;
    create table items (id bigint);`, []],
  ['alter table only satisfies RLS', `
    create table public.items (id bigint);
    alter table only public.items enable row level security;`, []],
  ['static insert-only DO block is not dynamic DDL', `do $$ begin insert into private.audit_log(message) values ('create table is text'); end $$;`, []],
  ['dynamic insert-only DO block is not dynamic DDL', `do $$ begin execute format('insert into %I(message) values (%L)', 'audit_log', 'ok'); end $$;`, []],
  ['literal dynamic DDL is refused', `do $$ begin execute 'create table public.hidden (id bigint)'; end $$;`, ['DB_DYNAMIC_DDL']],
  ['concatenated literal dynamic DDL is refused', `do $$ begin execute 'create ' || 'table public.hidden (id bigint)'; end $$;`, ['DB_DYNAMIC_DDL']],
  ['format-split dynamic DDL is refused', `do $$ begin execute format('%s table public.hidden (id bigint)', 'create'); end $$;`, ['DB_DYNAMIC_DDL']],
  ['opaque format operand is refused', `do $$ declare query_text text; begin execute format('%s', query_text); end $$;`, ['DB_DYNAMIC_DDL']],
  ['definer format percent-I interpolation is safe', `
    create function private.remove_from(table_name text) returns void language plpgsql security definer
    set search_path = '' as $$ begin execute format('delete from %I', table_name); end $$;`, []],
  ['definer may call set_config after pinning search_path', `
    create function private.configure(subject text) returns void language plpgsql security definer
    set search_path = '' as $$ begin perform set_config('app.subject', subject, true); end $$;`, []],
  ['set-returning definer body parses without a false positive', `
    create function private.ids() returns setof uuid language plpgsql security definer
    set search_path = '' as $$ begin return query select id from public.items; end $$;`, []],
  ['trigger definer body sees NEW and parses cleanly', `
    create function private.touch() returns trigger language plpgsql security definer
    set search_path = '' as $$ begin return new; end $$;`, []],
  ['definer positional percent-I interpolation is safe', `
    create function private.remove_from(table_name text) returns void language plpgsql security definer
    set search_path = '' as $$ begin execute format('delete from %1$I', table_name); end $$;`, []],
  ['definer percent-s interpolation is unsafe', `
    create function private.remove_from(table_name text) returns void language plpgsql security definer
    set search_path = '' as $$ begin execute format('delete from %s', table_name); end $$;`, ['DB_DEFINER_SAFE']],
  ['definer literal concatenated with safe format is safe', `
    create function private.remove_from(table_name text) returns void language plpgsql security definer
    set search_path = '' as $$ begin execute 'delete from ' || format('%I', table_name); end $$;`, []],
  ['definer raw parameter concatenation is unsafe', `
    create function private.remove_from(table_name text) returns void language plpgsql security definer
    set search_path = '' as $$ begin execute 'delete from ' || table_name; end $$;`, ['DB_DEFINER_SAFE']],
  ['private bucket may retain a public-suffixed id', `
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('archive_public', 'archive_public', false, 1024, array['application/zip']::text[]);
    create policy objects_member_select on storage.objects for select to authenticated using (bucket_id = 'archive_public');`, []],
  ['bucket policy must correlate the id with bucket_id', `
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 1024, array['image/png']::text[]);
    create policy objects_member_select on storage.objects for select to authenticated
    using (bucket_id = 'other' and name = 'avatars');`, ['DB_STORAGE_POLICY']],
  ['public bucket with matching suffix is clean', `
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('brand_public', 'brand_public', true, 1024, array['image/svg+xml']::text[]);
    create policy objects_public_read on storage.objects for select to anon using (bucket_id = 'brand_public');`, []],
  ['storage create_bucket call is recognized', `
    select storage.create_bucket('avatars', 'avatars', public := false, file_size_limit := 1024,
      allowed_mime_types := array['image/png']);
    create policy objects_member_select on storage.objects for select to authenticated using (bucket_id = 'avatars');`, []],
  ['storage create_bucket call needs bounds', `
    select storage.create_bucket('avatars', 'avatars', public := false);
    create policy objects_member_select on storage.objects for select to authenticated using (bucket_id = 'avatars');`, ['DB_STORAGE_POLICY']],
  ['storage create_bucket public id must declare public name', `
    select storage.create_bucket('avatars', 'avatars', public := true, file_size_limit := 1024,
      allowed_mime_types := array['image/png']);
    create policy objects_member_select on storage.objects for select to authenticated using (bucket_id = 'avatars');`, ['DB_STORAGE_POLICY']],
  ['service-role grants are refused', 'grant usage on schema private to service_role;', ['DB_POLICY_SHAPE']],
  ['anonymous table grant needs public-read policy', 'grant select on table public.items to anon;', ['DB_POLICY_SHAPE']],
  ['anonymous public-read policy and grant are clean', `${cleanTable()}
    create policy items_public_read on public.items for select to anon using (true);
    grant select on public.items to anon;`, []],
  ['authenticated true read must declare public read', `${cleanTable()}
    create policy items_member_select on public.items for select to authenticated using (true);`, ['DB_POLICY_SHAPE']],
];

for (const [name, sql, codes] of sqlCases) {
  test(`adversarial SQL: ${name}`, () => expectCodes({ contents: { [MIGRATION]: sql }, codes }));
}

test('adversarial SQL: RLS enabled only in a later migration still fails the create migration', () => {
  const contents = {
    [`${MIGRATIONS}/20260101120000_create-items.sql`]: 'create table public.items (id bigint);',
    [`${MIGRATIONS}/20260101120100_enable-items.sql`]: 'alter table public.items enable row level security;',
  };
  return expectCodes({ contents, codes: ['DB_RLS_REQUIRED'] });
});

test('adversarial policy set: a policy in an earlier migration covers a later anonymous grant', () => {
  const contents = {
    [`${MIGRATIONS}/20260101120000_policy.sql`]: 'create policy items_public_read on public.items for select to anon using (true);',
    [`${MIGRATIONS}/20260101120100_grant.sql`]: 'grant select on public.items to anon;',
  };
  return expectCodes({ contents, codes: [] });
});

test('adversarial policy set: a policy in a later migration covers an earlier anonymous grant', () => {
  const contents = {
    [`${MIGRATIONS}/20260101120000_grant.sql`]: 'grant select on public.items to anon;',
    [`${MIGRATIONS}/20260101120100_policy.sql`]: 'create policy items_public_read on public.items for select to anon using (true);',
  };
  return expectCodes({ contents, codes: [] });
});

test('adversarial policy set: a later drop removes public-read coverage', () => {
  const contents = {
    [`${MIGRATIONS}/20260101120000_policy.sql`]: 'create policy items_public_read on public.items for select to anon using (true); grant select on public.items to anon;',
    [`${MIGRATIONS}/20260101120100_drop.sql`]: 'drop policy items_public_read on public.items;',
  };
  return expectCodes({ contents, codes: ['DB_POLICY_SHAPE'] });
});

test('adversarial policy set: authenticated-only public-read name does not cover an anon grant', () => {
  const contents = {
    [`${MIGRATIONS}/20260101120000_policy.sql`]: 'create policy items_public_read on public.items for select to authenticated using (true);',
    [`${MIGRATIONS}/20260101120100_grant.sql`]: 'grant select on public.items to anon;',
  };
  return expectCodes({ contents, codes: ['DB_POLICY_SHAPE'] });
});

test('adversarial policy: omitted TO clause is reported as the implicit public default', async () => {
  const dir = repo({ [MIGRATION]: `${cleanTable()} create policy items_member_insert on public.items for insert with check (id is not null);` });
  const findings = await checkDatabase({ repoRoot: dir, files: [MIGRATION], git: noRemote });
  assert.deepEqual(uniqueCodes(findings), ['DB_POLICY_SHAPE']);
  assert.ok(findings.some((finding) => finding.message.includes('implicit TO public default')), JSON.stringify(findings));
});

const configCases = [
  ['inline table with env credentials', '[auth.external]\ngithub = { client_id = "env(GH_CLIENT_ID)", secret = "env(GH_SECRET)" }\n', undefined, []],
  ['inline table with literal credential', '[auth.external]\ngithub = { client_id = "literal", secret = "env(GH_SECRET)" }\n', undefined, ['DB_CONFIG_POLICY']],
  ['array of tables with env token', '[[auth.hook]]\ntoken = "env(HOOK_TOKEN_2)"\n', undefined, []],
  ['array of tables with literal token', '[[auth.hook]]\ntoken = "literal"\n', undefined, ['DB_CONFIG_POLICY']],
  ['comments do not create credential keys', '# secret = "literal"\n[api]\nschemas = ["public"] # token = "literal"\n', undefined, []],
  ['jwt expiry 3600 is accepted', '[auth]\njwt_expiry = 3600\n', undefined, []],
  ['jwt expiry 7200 is refused', '[auth]\njwt_expiry = 7200\n', undefined, ['DB_CONFIG_POLICY']],
  ['signup settings match declaration', '[auth]\nenable_signup = false\n[auth.email]\nenable_signup = false\n', { enableSignup: false }, []],
  ['signup settings mismatch declaration', '[auth]\nenable_signup = true\n[auth.email]\nenable_signup = true\n', { enableSignup: false }, ['DB_CONFIG_POLICY']],
  ['redirect list exactly matches declaration', '[auth]\nadditional_redirect_urls = ["https://app.example.com/auth/callback"]\n', { redirectUrls: ['https://app.example.com/auth/callback'] }, []],
  ['redirect list missing a declared value is refused', '[auth]\nadditional_redirect_urls = []\n', { redirectUrls: ['https://app.example.com/auth/callback'] }, ['DB_CONFIG_POLICY']],
  ['redirect list with an undeclared value is refused', '[auth]\nadditional_redirect_urls = ["https://evil.example.com"]\n', { redirectUrls: [] }, ['DB_CONFIG_POLICY']],
  ['quoted credential key still needs env', '[auth.external.github]\n"client_id" = "literal"\n', undefined, ['DB_CONFIG_POLICY']],
  ['env reference accepts digits after the first character', '[auth.external.github]\nsecret = "env(GITHUB_SECRET_2)"\n', undefined, []],
  ['credential arrays are not env references', '[auth.external.github]\ntoken = ["env(TOKEN_A)", "env(TOKEN_B)"]\n', undefined, ['DB_CONFIG_POLICY']],
  ['smtp pass is a credential key', '[auth.smtp]\npass = "literal"\n', undefined, ['DB_CONFIG_POLICY']],
  ['smtp pass accepts env reference', '[auth.smtp]\npass = "env(SMTP_PASS)"\n', undefined, []],
];

for (const [name, toml, supabase, codes] of configCases) {
  test(`adversarial config: ${name}`, () => expectCodes({
    contents: { 'supabase/config.toml': toml },
    supabase,
    codes,
  }));
}

const migrationCases = [
  ['valid leap-day UTC timestamp', `${MIGRATIONS}/20240229010203_leap.sql`, []],
  ['invalid leap-day UTC timestamp', `${MIGRATIONS}/20230229010203_bad-leap.sql`, ['DB_MIGRATION_SHAPE']],
  ['uppercase extension is not a valid migration name', `${MIGRATIONS}/20260101120000_upper.SQL`, ['DB_MIGRATION_SHAPE']],
  ['nested migration path is not a migration name', `${MIGRATIONS}/nested/20260101120000_nested.sql`, ['DB_MIGRATION_SHAPE']],
];

for (const [name, file, codes] of migrationCases) {
  test(`adversarial migration: ${name}`, () => expectCodes({ contents: { [file]: 'select 1;' }, codes }));
}

test('adversarial migration: tracked stamp cannot be later than the file commit', async () => {
  const file = `${MIGRATIONS}/20210101000000_after-commit.sql`;
  const dir = repo({ [file]: 'select 1;' });
  git(dir, ['init', '-b', 'main', '-q']);
  git(dir, ['add', '-A', '--', '.']);
  git(dir, ['-c', 'user.email=spec@starci.test', '-c', 'user.name=spec', 'commit', '-qm', 'base'], {
    GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
  });
  const findings = await checkDatabase({ repoRoot: dir, files: [file] });
  assert.deepEqual(uniqueCodes(findings), ['DB_MIGRATION_SHAPE'], JSON.stringify(findings, null, 2));
  assert.ok(findings.some((finding) => finding.tracked === true && finding.message.includes("file's commit time")));
});
