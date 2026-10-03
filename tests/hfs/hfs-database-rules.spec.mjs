// The Supabase SQL rules L02-L09 (scripts/hfs/rules/database.mjs over scripts/hfs/sql/pg-parse.mjs, the WASM build of
// libpg-query): DB_MIGRATION_SHAPE, DB_RLS_REQUIRED, DB_DYNAMIC_DDL, DB_POLICY_SHAPE, DB_DEFINER_SAFE,
// DB_STORAGE_POLICY, DB_CONFIG_POLICY and DB_TYPES_DRIFT. Fixtures live in tests/fixtures/hfs-db/: clean.sql and
// tricky.sql must produce no finding (the tricky file exists to prove the AST does not trip on literals, comments,
// quoted identifiers, partitions, `if not exists`, `security invoker` or a later `alter function ... set`), and
// violations.sql carries one case per rule. Each case is a temp directory holding the files under test; the git
// part of L02 runs against a real temporary repository, and the no-remote fallback against a stub runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDatabase, migrationStamp } from '../../scripts/hfs/rules/database.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'hfs-db');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const SUPABASE = { enableSignup: false, siteUrl: 'http://localhost:3000', jwtExpiry: 3600, redirectUrls: ['https://demo.example.com/auth/callback'] };

/** A temp app root holding `contents` ({path: text}) and an hfs.json declaring the lite edition. Pass `supabase: null` for an hfs.json with no supabase block. */
function repo(contents, { supabase = SUPABASE, edition = 'lite' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-'));
  made.push(dir);
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify({ hfs: 2, kind: 'app', project: 'demo', edition, ...(supabase ? { supabase } : {}), sides: { be: { apps: [] }, fe: { apps: [] } } }));
  for (const [file, text] of Object.entries(contents)) {
    const target = path.join(dir, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return dir;
}

const gitOk = { ok: false, stdout: '' };
/** A git runner answering no remote (ordering and immutability are not judged). */
const noRemote = () => gitOk;

/** `git -C dir ...args` with the repository-local env of a hosting worktree stripped. */
const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { env: withoutGitLocalEnv(process.env), stdio: ['ignore', 'pipe', 'pipe'] });
/** A real repository on `main` holding `contents` committed. */
function committedRepo(contents, options) {
  const dir = repo(contents, options);
  git(dir, ['init', '-b', 'main', '-q']);
  git(dir, ['add', '-A', '--', '.']);
  git(dir, ['-c', 'user.email=spec@starci.test', '-c', 'user.name=spec', 'commit', '-qm', 'base']);
  return dir;
}

const MIGRATIONS = 'supabase/migrations';
const migration = (name, sql) => ({ [`${MIGRATIONS}/${name}`]: sql });
const only = (list, code) => list.filter((f) => f.code === code);
const CODES = ['DB_MIGRATION_SHAPE', 'DB_RLS_REQUIRED', 'DB_DYNAMIC_DDL', 'DB_POLICY_SHAPE', 'DB_DEFINER_SAFE', 'DB_STORAGE_POLICY', 'DB_CONFIG_POLICY', 'DB_TYPES_DRIFT'];

test('an app without a supabase tree and without a supabase block is not judged at all', async () => {
  const dir = repo({ 'README.md': 'x\n' }, { supabase: null, edition: 'full' });
  assert.deepEqual(await checkDatabase({ repoRoot: dir, files: ['README.md'], git: noRemote }), []);
});

test('the clean fixture is clean to every rule', async () => {
  const file = `${MIGRATIONS}/20260101120000_baseline.sql`;
  const dir = repo({ [file]: fixture('clean.sql'), 'supabase/config.toml': fixture('config-clean.toml'), 'supabase/types/database.types.ts': 'export type Database = {};\n' });
  const findings = await checkDatabase({ repoRoot: dir, files: [file, 'supabase/config.toml', 'supabase/types/database.types.ts'], git: noRemote, emitTypes: async () => 'export type Database = {};\n' });
  assert.deepEqual(findings, [], JSON.stringify(findings, null, 1));
});

test('the tricky fixture is clean: literals, comments, quoted names, partitions, invoker, later alter function', async () => {
  const file = `${MIGRATIONS}/20260102120000_tricky.sql`;
  const dir = repo({ [file]: fixture('tricky.sql') });
  const findings = await checkDatabase({ repoRoot: dir, files: [file], git: noRemote });
  assert.deepEqual(findings, [], JSON.stringify(findings, null, 1));
});

test('the violations fixture reports one finding for every rule it breaks', async () => {
  const file = `${MIGRATIONS}/20260103120000_violations.sql`;
  const dir = repo({ [file]: fixture('violations.sql') });
  const findings = await checkDatabase({ repoRoot: dir, files: [file], git: noRemote });
  for (const code of ['DB_RLS_REQUIRED', 'DB_DYNAMIC_DDL', 'DB_POLICY_SHAPE', 'DB_DEFINER_SAFE', 'DB_STORAGE_POLICY']) {
    assert.ok(only(findings, code).length > 0, `${code} expected`);
  }
  assert.ok(only(findings, 'DB_RLS_REQUIRED').some((f) => f.message.includes('public.no_rls')));
  assert.ok(only(findings, 'DB_DYNAMIC_DDL').some((f) => f.query?.includes('alter table %I enable row level security')));
});

// ------------------------------------------------------------------------------------------------ L02 DB_MIGRATION_SHAPE

test('DB_MIGRATION_SHAPE: a migration name is <ts14>_<kebab>.sql', async () => {
  for (const name of ['x.sql', '20260101120000.sql', '20260101120000_Mixed_Case.sql', '2026-01-01_broken.sql', '2026010112000_short.sql']) {
    const dir = repo(migration(name, 'select 1;\n'));
    const findings = only(await checkDatabase({ repoRoot: dir, files: [`${MIGRATIONS}/${name}`], git: noRemote }), 'DB_MIGRATION_SHAPE');
    assert.ok(findings.some((f) => f.message.includes('named <ts14>_<kebab>.sql')), name);
  }
  for (const name of ['20260101120000_baseline.sql', '20260101120000_multi-part-name.sql', '20260228235959_edge.sql']) {
    const dir = repo(migration(name, 'select 1;\n'));
    assert.deepEqual(await checkDatabase({ repoRoot: dir, files: [`${MIGRATIONS}/${name}`], git: noRemote }), [], name);
  }
});

test('DB_MIGRATION_SHAPE: the stamp is a real UTC instant and never in the future', async () => {
  assert.equal(migrationStamp('20260101120000') !== null, true);
  assert.equal(migrationStamp('20261301120000'), null);
  assert.equal(migrationStamp('20260230000000'), null);
  const bad = repo(migration('20261301120000_x.sql', 'select 1;\n'));
  assert.ok(only(await checkDatabase({ repoRoot: bad, files: [`${MIGRATIONS}/20261301120000_x.sql`], git: noRemote }), 'DB_MIGRATION_SHAPE').some((f) => f.message.includes('no valid UTC time')));
  const future = repo(migration('29990101120000_x.sql', 'select 1;\n'));
  assert.ok(only(await checkDatabase({ repoRoot: future, files: [`${MIGRATIONS}/29990101120000_x.sql`], git: noRemote }), 'DB_MIGRATION_SHAPE').some((f) => f.message.includes('in the future')));
});

test('DB_MIGRATION_SHAPE: new migrations sort after every migration on the base, which is a real merge-base', async () => {
  const dir = committedRepo(migration('20260101120000_old.sql', 'select 1;\n'));
  fs.writeFileSync(path.join(dir, MIGRATIONS, '20250101000000_backdated.sql'), 'select 1;\n');
  fs.writeFileSync(path.join(dir, MIGRATIONS, '20261001120000_new.sql'), 'select 1;\n');
  const files = ['20260101120000_old.sql', '20250101000000_backdated.sql', '20261001120000_new.sql'].map((n) => `${MIGRATIONS}/${n}`);
  const findings = only(await checkDatabase({ repoRoot: dir, files }), 'DB_MIGRATION_SHAPE');
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.equal(findings[0].path, `${MIGRATIONS}/20250101000000_backdated.sql`);
  assert.match(findings[0].message, /not after every migration/);
});

test('DB_MIGRATION_SHAPE: a migration on the base is immutable - an edit and a removal are both findings', async () => {
  const dir = committedRepo(migration('20260101120000_old.sql', 'select 1;\n'));
  fs.writeFileSync(path.join(dir, MIGRATIONS, '20260101120000_old.sql'), 'select 2;\n');
  const edited = only(await checkDatabase({ repoRoot: dir, files: [`${MIGRATIONS}/20260101120000_old.sql`] }), 'DB_MIGRATION_SHAPE');
  assert.ok(edited.some((f) => f.message.includes('immutable')));
  fs.writeFileSync(path.join(dir, 'supabase', 'config.toml'), '[api]\nenabled = true\n');
  fs.rmSync(path.join(dir, MIGRATIONS, '20260101120000_old.sql'));
  const gone = only(await checkDatabase({ repoRoot: dir, files: ['supabase/config.toml'] }), 'DB_MIGRATION_SHAPE');
  assert.ok(gone.some((f) => f.message.includes('is gone here')));
});

test('DB_MIGRATION_SHAPE: without a base ref ordering and immutability are simply not judged', async () => {
  const dir = repo(migration('20250101000000_first.sql', 'select 1;\n'));
  const findings = only(await checkDatabase({ repoRoot: dir, files: [`${MIGRATIONS}/20250101000000_first.sql`], git: noRemote }), 'DB_MIGRATION_SHAPE');
  assert.deepEqual(findings, []);
});

// ------------------------------------------------------------------------------------------------ L03 DB_RLS_REQUIRED

const RLS = 'DB_RLS_REQUIRED';
const rlsOf = async (sql, config) => {
  const file = `${MIGRATIONS}/20260101120000_t.sql`;
  const contents = { [file]: sql };
  if (config !== undefined) contents['supabase/config.toml'] = config;
  const dir = repo(contents);
  const files = Object.keys(contents);
  return checkDatabase({ repoRoot: dir, files, git: noRemote });
};

test('DB_RLS_REQUIRED: an exposed table needs its enable in the same migration', async () => {
  const missing = await rlsOf('create table public.t (id int);\n');
  assert.equal(only(missing, RLS).length, 1);
  const unqualified = await rlsOf('create table t (id int);\n');
  assert.equal(only(unqualified, RLS).length, 1, 'an unqualified name is the public schema');
  const ifNotExists = await rlsOf('create table if not exists public.t (id int);\n');
  assert.equal(only(ifNotExists, RLS).length, 1);
  const ctas = await rlsOf('create table public.t as select 1;\n');
  assert.equal(only(ctas, RLS).length, 1, 'create table as is a create table');
  const clean = await rlsOf('create table public.t (id int);\nalter table public.t enable row level security;\n');
  assert.deepEqual(only(clean, RLS), []);
});

test('DB_RLS_REQUIRED: a non-exposed schema, a temp table and a partition child are exempt', async () => {
  const findings = await rlsOf('create table private.t (id int);\ncreate temp table tmp_x (id int);\ncreate table public.p (id int) partition by range (id);\nalter table public.p enable row level security;\ncreate table public.p_a partition of public.p for values from (1) to (10);\n');
  assert.deepEqual(only(findings, RLS), [], JSON.stringify(findings));
});

test('DB_RLS_REQUIRED: the enable must follow the create, and a custom exposed schema is read from config.toml [api] schemas', async () => {
  const reversed = await rlsOf('alter table public.t enable row level security;\ncreate table public.t (id int);\n');
  assert.equal(only(reversed, RLS).length, 1);
  const custom = await rlsOf('create table store.t (id int);\n', '[api]\nschemas = ["public", "store"]\n');
  assert.equal(only(custom, RLS).length, 1);
  const notExposed = await rlsOf('create table store.t (id int);\n', '[api]\nschemas = ["public"]\n');
  assert.deepEqual(only(notExposed, RLS), []);
});

test('DB_RLS_REQUIRED: a table hfs.json supabase.forceRls declares must be forced', async () => {
  const file = `${MIGRATIONS}/20260101120000_t.sql`;
  const sql = 'create table public.ledger (id int);\nalter table public.ledger enable row level security;\n';
  const declared = repo({ [file]: sql }, { supabase: { ...SUPABASE, forceRls: ['public.ledger'] } });
  assert.equal(only(await checkDatabase({ repoRoot: declared, files: [file], git: noRemote }), RLS).length, 1);
  const forced = repo({ [file]: `${sql}alter table public.ledger force row level security;\n` }, { supabase: { ...SUPABASE, forceRls: ['ledger'] } });
  assert.deepEqual(only(await checkDatabase({ repoRoot: forced, files: [file], git: noRemote }), RLS), []);
});

// ------------------------------------------------------------------------------------------------ L04 DB_DYNAMIC_DDL

const DDL = 'DB_DYNAMIC_DDL';
const ddlOf = async (sql) => {
  const file = `${MIGRATIONS}/20260101120000_t.sql`;
  const dir = repo({ [file]: sql });
  return checkDatabase({ repoRoot: dir, files: [file], git: noRemote });
};

test('DB_DYNAMIC_DDL: a DO block building DDL through format() or a literal is refused', async () => {
  const loop = await ddlOf(`do $$\ndeclare r record;\nbegin\n  for r in select tablename from pg_catalog.pg_tables loop\n    execute format('alter table %I enable row level security', r.tablename);\n  end loop;\nend $$;\n`);
  assert.equal(only(loop, DDL).length, 1);
  const literal = await ddlOf(`do $$\nbegin\n  execute 'create table sneaky (id int)';\nend $$;\n`);
  assert.equal(only(literal, DDL).length, 1);
  const grant = await ddlOf(`do $$\nbegin\n  execute format('grant select on %I to anon', t);\nend $$;\n`);
  assert.equal(only(grant, DDL).length, 1);
});

test('DB_DYNAMIC_DDL: a query the pass cannot read, and a non-plpgsql DO, are refused; DML is clean', async () => {
  const opaque = await ddlOf(`do $$\ndeclare q text := 'delete from t';\nbegin\n  execute q;\nend $$;\n`);
  assert.equal(only(opaque, DDL).length, 1);
  const dml = await ddlOf(`do $$\nbegin\n  execute format('delete from %I where stale', t);\nend $$;\n`);
  assert.deepEqual(only(dml, DDL), []);
  const staticBody = await ddlOf(`do $$\nbegin\n  raise notice 'migrating';\nend $$;\n`);
  assert.deepEqual(only(staticBody, DDL), []);
});

test('DB_DYNAMIC_DDL: dynamic DDL inside a function body is refused too', async () => {
  const findings = await ddlOf(`create or replace function private.setup()\nreturns void language plpgsql security definer set search_path = '' as $$\nbegin\n  execute format('create table %I (id int)', suffix);\nend $$;\n`);
  assert.ok(only(findings, DDL).some((f) => f.message.includes('function private.setup')));
});

// ------------------------------------------------------------------------------------------------ L05 DB_POLICY_SHAPE

const POLICY = 'DB_POLICY_SHAPE';
const policyOf = async (sql) => {
  const file = `${MIGRATIONS}/20260101120000_t.sql`;
  const dir = repo({ [file]: `create table public.t (id int);\nalter table public.t enable row level security;\n${sql}` });
  return checkDatabase({ repoRoot: dir, files: [file], git: noRemote });
};

test('DB_POLICY_SHAPE: a write or FOR ALL policy never uses (true)', async () => {
  for (const sql of [
    'create policy t_member_all on public.t for all to authenticated using (true) with check (true);',
    'create policy t_member_insert on public.t for insert to authenticated with check (true);',
    'create policy t_member_update on public.t for update to authenticated using (true);',
    'create policy t_member_delete on public.t for delete to authenticated using (1 = 1) with check (true);',
  ]) {
    const findings = only(await policyOf(sql), POLICY);
    assert.ok(findings.length > 0, sql);
  }
  assert.deepEqual(only(await policyOf('create policy t_member_update on public.t for update to authenticated using (1 = 1);'), POLICY).filter((f) => /true/.test(f.message)), []);
});

test('DB_POLICY_SHAPE: to anon (or public) is legal only on FOR SELECT named *_public_read', async () => {
  const good = await policyOf('create policy t_public_read on public.t for select to anon using (true);\ngrant select on public.t to anon;');
  assert.deepEqual(only(good, POLICY), [], JSON.stringify(good));
  const write = await policyOf('create policy t_anon_insert on public.t for insert to anon with check (id > 0);');
  assert.ok(only(write, POLICY).some((f) => f.message.includes('anon')));
  const readNoSuffix = await policyOf('create policy t_member_select on public.t for select to anon using (id = auth.uid());');
  assert.ok(only(readNoSuffix, POLICY).some((f) => f.message.includes('anon')));
  const publicRole = await policyOf('create policy t_member_insert on public.t for insert to public with check (id > 0);');
  assert.ok(only(publicRole, POLICY).some((f) => f.message.includes('public')));
  const noTo = await policyOf('create policy t_member_insert on public.t for insert with check (id > 0);');
  assert.ok(only(noTo, POLICY).some((f) => f.message.includes('public')), 'no TO clause is TO PUBLIC');
  const openRead = await policyOf('create policy t_member_select on public.t for select to authenticated using (true);');
  assert.ok(only(openRead, POLICY).some((f) => f.message.includes('USING (true)')));
});

test('DB_POLICY_SHAPE: every policy is named <table>_<role>_<action>', async () => {
  for (const name of ['loose', 't_read', 't_member', 't_member_upsert']) {
    const findings = only(await policyOf(`create policy ${name} on public.t for select to authenticated using (id > 0);`), POLICY);
    assert.ok(findings.some((f) => f.message.includes('<table>_<role>_<action>')), name);
  }
  for (const name of ['t_member_select', 't_member_insert', 't_member_delete', 't_manager_all', 't_public_read']) {
    const findings = only(await policyOf(`create policy ${name} on public.t for select to authenticated using (id > 0);`), POLICY);
    assert.deepEqual(findings.filter((f) => f.message.includes('<table>_<role>_<action>')), [], name);
  }
});

test('DB_POLICY_SHAPE: service_role is never granted; anon needs its _public_read policy', async () => {
  const service = await policyOf('grant select on public.t to service_role;');
  assert.ok(only(service, POLICY).some((f) => f.message.includes('service_role')));
  const bare = await policyOf('grant select on public.t to anon;');
  assert.ok(only(bare, POLICY).some((f) => f.message.includes('anon')));
  const revoked = await policyOf('revoke delete on public.t from anon;\nrevoke all on public.t from service_role;');
  assert.deepEqual(only(revoked, POLICY), []);
});

// ------------------------------------------------------------------------------------------------ L06 DB_DEFINER_SAFE

const DEFINER = 'DB_DEFINER_SAFE';
const definerOf = async (sql) => {
  const file = `${MIGRATIONS}/20260101120000_t.sql`;
  const dir = repo({ [file]: sql });
  return checkDatabase({ repoRoot: dir, files: [file], git: noRemote });
};

const SAFE_FN = (extra = '') => `create or replace function private.f() returns void language plpgsql security definer set search_path = '' as $$ begin ${extra} end $$;\n`;

test('DB_DEFINER_SAFE: a definer pins its search_path, on the create or a later alter function', async () => {
  const unset = await definerOf('create or replace function private.f() returns void language plpgsql security definer as $$ begin end $$;\n');
  assert.ok(only(unset, DEFINER).some((f) => f.message.includes('search_path')));
  const viaAlter = await definerOf('create or replace function private.f() returns void language plpgsql security definer as $$ begin end $$;\nalter function private.f() set search_path = \'\';\n');
  assert.deepEqual(only(viaAlter, DEFINER).filter((f) => f.message.includes('search_path')), []);
  const fromCurrent = await definerOf('create or replace function private.f() returns void language plpgsql security definer as $$ begin end $$;\nalter function private.f() set search_path from current;\n');
  assert.ok(only(fromCurrent, DEFINER).some((f) => f.message.includes('search_path')), 'from current is not pinned');
  const list = await definerOf('create or replace function private.f() returns void language plpgsql security definer set search_path = private, pg_temp as $$ begin end $$;\n');
  assert.deepEqual(only(list, DEFINER), []);
});

test('DB_DEFINER_SAFE: a definer in an exposed schema needs revoke execute from public; private is clean', async () => {
  const exposed = await definerOf('create or replace function public.f() returns int language sql security definer set search_path = \'\' as $$ select 1 $$;\n');
  assert.ok(only(exposed, DEFINER).some((f) => f.message.includes('exposed schema')));
  const revoked = await definerOf('create or replace function public.f() returns int language sql security definer set search_path = \'\' as $$ select 1 $$;\nrevoke execute on function public.f() from public, anon;\n');
  assert.deepEqual(only(revoked, DEFINER), []);
  const invoker = await definerOf('create or replace function public.f() returns int language sql security invoker as $$ select 1 $$;\n');
  assert.deepEqual(only(invoker, DEFINER), [], 'security invoker is exempt');
});

test('DB_DEFINER_SAFE: dynamic SQL inside a definer interpolates only through format %I/%L', async () => {
  const concat = await definerOf(SAFE_FN("execute 'delete from ' || t;"));
  assert.ok(only(concat, DEFINER).some((f) => f.message.includes('format')));
  const rawS = await definerOf(SAFE_FN("execute format('delete from %s', t);"));
  assert.ok(only(rawS, DEFINER).some((f) => f.message.includes('%I or %L')));
  const good = await definerOf(SAFE_FN("execute format('delete from %I where id = %L', t, id);\nexecute 'vacuum';"));
  assert.deepEqual(only(good, DEFINER), [], JSON.stringify(good));
});

// ------------------------------------------------------------------------------------------------ L07 DB_STORAGE_POLICY

const BUCKET = 'DB_STORAGE_POLICY';
const bucketOf = async (sql) => {
  const file = `${MIGRATIONS}/20260101120000_t.sql`;
  const dir = repo({ [file]: sql });
  return checkDatabase({ repoRoot: dir, files: [file], git: noRemote });
};

const BUCKET_POLICY = `create policy objects_member_select on storage.objects for select to authenticated using (bucket_id = 'avatars');`;

test('DB_STORAGE_POLICY: a bucket declares public, bounds and its objects policy', async () => {
  const bare = await bucketOf(`insert into storage.buckets (id, name) values ('avatars', 'avatars');`);
  const findings = only(bare, BUCKET);
  assert.ok(findings.some((f) => f.message.includes('public')));
  assert.ok(findings.some((f) => f.message.includes('file_size_limit')));
  assert.ok(findings.some((f) => f.message.includes('allowed_mime_types')));
  assert.ok(findings.some((f) => f.message.includes('bucket_id')));
  const publicWrongName = await bucketOf(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', true, 1024, '{image/png}');\n${BUCKET_POLICY}`);
  assert.ok(only(publicWrongName, BUCKET).some((f) => f.message.includes('public')));
  const missingPolicy = await bucketOf(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', false, 1024, '{image/png}');\ncreate policy objects_member_select on storage.objects for select to authenticated using (bucket_id = 'other');`);
  assert.ok(only(missingPolicy, BUCKET).some((f) => f.message.includes('bucket_id')));
  const clean = await bucketOf(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', false, 1024, '{image/png}');\n${BUCKET_POLICY}`);
  assert.deepEqual(only(clean, BUCKET), [], JSON.stringify(clean));
  const pub = await bucketOf(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('brand_public', 'brand_public', true, 1024, '{image/png}');\ncreate policy objects_public_read on storage.objects for select to anon using (bucket_id = 'brand_public');`);
  assert.deepEqual(only(pub, BUCKET), [], JSON.stringify(pub));
});

// ------------------------------------------------------------------------------------------------ L08 DB_CONFIG_POLICY

const CONFIG = 'DB_CONFIG_POLICY';
const configOf = async (toml, supabase = SUPABASE) => {
  const dir = repo({ 'supabase/config.toml': toml }, { supabase });
  return checkDatabase({ repoRoot: dir, files: ['supabase/config.toml'], git: noRemote });
};

test('DB_CONFIG_POLICY: the clean config fixture is clean', async () => {
  assert.deepEqual(only(await configOf(fixture('config-clean.toml')), CONFIG), []);
});

test('DB_CONFIG_POLICY: literal credentials are refused anywhere in the file; env(NAME) is the form', async () => {
  const findings = only(await configOf(fixture('config-bad.toml')), CONFIG);
  const keys = findings.filter((f) => f.message.includes('literal credential')).map((f) => f.key);
  assert.deepEqual(keys.sort(), ['auth.external.github.client_id', 'auth.external.github.secret']);
  assert.ok(findings.some((f) => f.message.includes('jwt_expiry')), 'jwt_expiry over 3600');
  assert.ok(findings.some((f) => f.message.includes('enable_signup')), 'signup not declared');
  assert.ok(findings.some((f) => f.message.includes('site_url')), 'site_url not declared');
  assert.ok(findings.some((f) => f.message.includes('evil.example.com')), 'redirect not declared');
});

test('DB_CONFIG_POLICY: without an hfs.json supabase block only the hard rules judge', async () => {
  const toml = '[auth]\nenable_signup = true\nsite_url = "https://anything.example.com"\njwt_expiry = 3600\n[auth.external.github]\nsecret = "x"\n';
  const findings = only(await configOf(toml, null), CONFIG);
  assert.deepEqual(findings.map((f) => f.key), ['auth.external.github.secret'], JSON.stringify(findings));
});

// ------------------------------------------------------------------------------------------------ L09 DB_TYPES_DRIFT

const TYPES = 'DB_TYPES_DRIFT';
const TYPES_FILE = 'supabase/types/database.types.ts';

test('DB_TYPES_DRIFT: the committed types equal what emitTypes regenerates; without emit the rule is silent', async () => {
  const dir = repo({ [TYPES_FILE]: 'export type Database = { a: 1 };\n' });
  const same = await checkDatabase({ repoRoot: dir, files: [TYPES_FILE], git: noRemote, emitTypes: async () => 'export type Database = { a: 1 };\n' });
  assert.deepEqual(only(same, TYPES), []);
  const stale = await checkDatabase({ repoRoot: dir, files: [TYPES_FILE], git: noRemote, emitTypes: async () => 'export type Database = { b: 2 };\n' });
  assert.equal(only(stale, TYPES).length, 1);
  assert.equal(only(stale, TYPES)[0].drift, 'stale');
  const silent = await checkDatabase({ repoRoot: dir, files: [TYPES_FILE], git: noRemote });
  assert.deepEqual(only(silent, TYPES), []);
});

test('DB_TYPES_DRIFT: an uncommitted types file and a failing emit are findings', async () => {
  const dir = repo({});
  const missing = only(await checkDatabase({ repoRoot: dir, files: [], git: noRemote, emitTypes: async () => 'x\n' }), TYPES);
  assert.equal(missing[0]?.drift, 'not-committed');
  const failed = only(await checkDatabase({ repoRoot: dir, files: [TYPES_FILE], git: noRemote, emitTypes: async () => { throw new Error('supabase start failed'); } }), TYPES);
  assert.equal(failed[0]?.drift, 'emit-failed');
});
