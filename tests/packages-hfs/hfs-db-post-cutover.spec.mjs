import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { loadDatabase } from '../../packages/hfs/db/migrate.mjs';
import { dbPostCutoverMain, dropSignatures, normalizeSignature, postCutoverDatabase, preflightSql } from '../../packages/hfs/db/post-cutover.mjs';
import { StackError } from '../../packages/hfs/stack/errors.mjs';
import {
  BASELINE, DATABASE_BLOCK, DROPS, FORWARD_1, FORWARD_2, HELD, STANDARD, bad, makeDbApp, makeSpawn, ok, releaseCtx, supabaseShim,
} from '../helpers/release-fakes.mjs';

const apps = [];
after(() => { for (const app of apps) app.cleanup(); });

const DONE = [BASELINE, STANDARD, FORWARD_1, FORWARD_2];
const COVERED = [{ signature: 'legacy_claim(integer,text)' }, { signature: 'legacy_tick()' }, { signature: 'other_tick()' }];
const SECRET_URL = 'postgres://postgres:sup3rsecret@db.example.com:5432/postgres';
const NOW = Date.parse('2026-10-20T00:00:00Z');
const hoursAgo = (hours) => new Date(NOW - hours * 3.6e6).toISOString();
const ARMED = { STARCI_DB_ARMED: '1' };

function setup({ remote = DONE, env = {}, overrides, rows, block, ...rest } = {}) {
  const app = makeDbApp({ block: block ?? DATABASE_BLOCK, ...rest });
  apps.push(app);
  const shim = supabaseShim({ remote, overrides, rows });
  const spawn = makeSpawn({ supabase: shim.handler });
  const out = releaseCtx(app.root, { spawn, env, now: () => NOW });
  const queries = [];
  const query = async (sql) => { queries.push(sql); return COVERED; };
  return { app, shim, spawn, queries, query, ...out, decl: loadDatabase(app.root) };
}

const refused = (promise, code) => assert.rejects(promise, (error) => error instanceof StackError && error.code === code);
const noMutation = (shim) => assert.deepEqual(shim.mutations(), []);

test('signatures are made comparable and read from the DROP statements of the migration', () => {
  assert.equal(normalizeSignature('  Public.Legacy_Claim( INT , timestamptz )', 'public'), 'legacy_claim(integer,timestamp with time zone)');
  assert.equal(normalizeSignature('app.f(text)', 'public'), 'app.f(text)');
  assert.equal(normalizeSignature('f(a   text)', 'public'), 'f(a text)');
  assert.deepEqual(dropSignatures(DROPS, 'public'), ['legacy_claim(integer,text)', 'legacy_tick()']);
  assert.deepEqual(dropSignatures('DROP FUNCTION f(int);\ndrop\nfunction if exists   public.g(text, int) ;\nselect 1;', 'public'), ['f(integer)', 'g(text,integer)']);
  assert.deepEqual(dropSignatures('', 'public'), []);
});

test('the preflight query is read-only and built from validated identifiers only', () => {
  const sql = preflightSql({ schema: 'public', prefixes: ['legacy_', 'old_'], names: ['other_tick'] });
  assert.equal(sql, String.raw`select oid::regprocedure::text as signature from pg_proc where pronamespace = 'public'::regnamespace and (proname = 'other_tick' or proname like 'legacy\_%' or proname like 'old\_%')`);
  assert.equal(/\b(insert|update|delete|drop|alter|create)\b/iu.test(sql), false);
});

test('no held-back migration in the repository: nothing to do', async () => {
  const { ctx, decl, shim } = setup({ block: { baseline: 'baseline', standard: 'baseline-standard', postCutover: {} } });
  const result = await postCutoverDatabase(ctx, decl, { execute: true });
  assert.equal(result.ok, true);
  assert.match(result.lines[0], /Nothing to do\./u);
  assert.deepEqual(result.data, { held: [], done: true, executed: false });
  assert.deepEqual(shim.calls, []);
});

test('a held-back migration needs a declared postCutover block', async () => {
  const { ctx, decl } = setup({ block: { ...DATABASE_BLOCK, postCutover: undefined } });
  await refused(postCutoverDatabase(ctx, decl, {}), 'DB_POSTCUTOVER_UNDECLARED');
});

test('already applied: nothing to do, no preflight query and no mutation', async () => {
  const { ctx, decl, shim, queries, query } = setup({ remote: [...DONE, HELD], env: ARMED });
  const result = await postCutoverDatabase(ctx, decl, { execute: true, ownerConfirms: true, query });
  assert.equal(result.ok, true);
  assert.match(result.lines[0], /already applied\. Nothing to do\./u);
  assert.equal(result.data.done, true);
  assert.deepEqual(queries, []);
  assert.deepEqual(shim.calls.map((call) => call.words), ['migration list']);
});

test('the dry run runs the read-only pg_proc preflight and reports the gate, applying nothing', async () => {
  const { ctx, decl, shim, queries, query } = setup({});
  const result = await postCutoverDatabase(ctx, decl, { query });
  assert.equal(result.ok, true);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /pronamespace = 'public'::regnamespace/u);
  assert.match(queries[0], /proname = 'other_tick'/u);
  const text = result.lines.join('\n');
  assert.match(text, /held-back migrations: 20260310000000_drop-legacy\.sql/u);
  assert.match(text, /read-only function preflight: 3 signature\(s\), all covered by the held-back migration/u);
  assert.match(text, /gate: CLOSED/u);
  assert.match(text, /rollback to the old app needs a database restore/u);
  assert.match(text, /dry run: only read-only calls were made; nothing applied\./u);
  assert.deepEqual(result.data, { held: [HELD], done: false, executed: false, gateOpen: false, signatures: 3 });
  assert.deepEqual(shim.calls.map((call) => call.words), ['migration list']);
});

test('the default preflight query goes through supabase db query of the linked project', async () => {
  const { ctx, decl, shim } = setup({ rows: COVERED });
  const result = await postCutoverDatabase(ctx, decl, {});
  assert.equal(result.ok, true);
  const query = shim.calls.find((call) => call.words === 'db query');
  assert.equal(query.args[2].startsWith('select oid::regprocedure::text'), true);
  assert.deepEqual(query.args.slice(3, 7), ['--output', 'json', '--agent', 'no']);
  assert.equal(query.args.includes('--linked'), true);
  noMutation(shim);
});

test('a function nobody drops blocks the migration, in the dry run and in --execute', async () => {
  const { ctx, decl, shim } = setup({ env: ARMED });
  const query = async () => [...COVERED, { signature: 'legacy_extra(uuid)' }, { signature: 'legacy_more()' }];
  await Promise.all([false, true].map(async (execute) => {
    await assert.rejects(postCutoverDatabase(ctx, decl, { execute, ownerConfirms: true, query }), (error) => error.code === 'DB_PREFLIGHT_UNCOVERED' && error.exit === 2 && /legacy_extra\(uuid\)\nlegacy_more\(\)/u.test(error.message));
  }));
  noMutation(shim);
});

test('a preflight that cannot read the database withholds the cause', async () => {
  const { ctx, decl, shim } = setup({});
  const leaks = async () => { throw new Error(`connect failed for ${SECRET_URL}`); };
  await Promise.all([leaks, async () => 'not rows', async () => [{ signature: 5 }], async () => [null]].map(async (query) => {
    await assert.rejects(postCutoverDatabase(ctx, decl, { query }), (error) => error.code === 'DB_PREFLIGHT_UNREADABLE' && error.exit === 1 && !error.message.includes('sup3rsecret') && /nothing applied/u.test(error.message));
  }));
  noMutation(shim);
});

test('no declared function family means nothing to check and no query', async () => {
  const { ctx, decl } = setup({ block: { ...DATABASE_BLOCK, postCutover: {} } });
  const query = async () => { throw new Error('must not be called'); };
  const result = await postCutoverDatabase(ctx, decl, { query });
  assert.match(result.lines.join('\n'), /function preflight: no function family declared; nothing to check/u);
  assert.equal(result.data.signatures, 0);
});

test('the declared schema, names and extra signatures are honoured', async () => {
  const block = { ...DATABASE_BLOCK, postCutover: { schema: 'app', functionNames: ['old_tick'], functions: ['app.old_tick(int)'] } };
  const { ctx, decl, queries } = setup({ block });
  const query = async (sql) => { queries.push(sql); return [{ signature: 'old_tick(integer)' }]; };
  const result = await postCutoverDatabase(ctx, decl, { query });
  assert.equal(result.ok, true);
  assert.match(queries[0], /pronamespace = 'app'::regnamespace and \(proname = 'old_tick'\)/u);
});

test('the time gate: owner confirmation, an old enough green smoke, a young one, a bad time and none', async () => {
  const { ctx, decl, query } = setup({});
  const gate = async (options) => (await postCutoverDatabase(ctx, decl, { query, ...options })).lines.find((line) => line.startsWith('gate:'));
  assert.match(await gate({ ownerConfirms: true }), /the owner confirms the old app is gone: OPEN/u);
  assert.match(await gate({ greenAt: hoursAgo(49) }), /\(49\.0 h ago, 48 h needed\): OPEN/u);
  assert.match(await gate({ greenAt: hoursAgo(47) }), /\(47\.0 h ago, 48 h needed\): CLOSED/u);
  assert.match(await gate({}), /CLOSED \(needs --green-at <ISO> old enough, or --owner-confirms-old-app-gone\)/u);
  await refused(postCutoverDatabase(ctx, decl, { query, greenAt: 'yesterday-ish' }), 'DB_USAGE');
  const short = setup({ block: { ...DATABASE_BLOCK, postCutover: { ...DATABASE_BLOCK.postCutover, minAgeHours: 1 } } });
  const result = await postCutoverDatabase(short.ctx, short.decl, { query: short.query, greenAt: hoursAgo(2) });
  assert.match(result.lines.join('\n'), /\(2\.0 h ago, 1 h needed\): OPEN/u);
  assert.equal(result.data.gateOpen, true);
});

test('--execute is refused while the gate is closed or the run is not armed, before any mutating call', async () => {
  const closed = setup({ env: ARMED });
  await refused(postCutoverDatabase(closed.ctx, closed.decl, { execute: true, greenAt: hoursAgo(1), query: closed.query }), 'DB_POSTCUTOVER_GATE_CLOSED');
  noMutation(closed.shim);
  const unarmed = setup({});
  await assert.rejects(postCutoverDatabase(unarmed.ctx, unarmed.decl, { execute: true, ownerConfirms: true, query: unarmed.query }), (error) => error.code === 'DB_NOT_ARMED' && error.exit === 3);
  noMutation(unarmed.shim);
});

test('the baseline and forward migrations must be on the remote first', async () => {
  const { ctx, decl, shim, query } = setup({ remote: [BASELINE], env: ARMED });
  await assert.rejects(postCutoverDatabase(ctx, decl, { execute: true, ownerConfirms: true, query }), (error) => error.code === 'DB_BASELINE_NOT_APPLIED' && error.message.includes(FORWARD_1) && /db migrate/u.test(error.message));
  noMutation(shim);
});

test('armed with an open gate, exactly the held-back version is pushed with --include-all', async () => {
  const { ctx, decl, shim, query } = setup({ env: ARMED });
  const result = await postCutoverDatabase(ctx, decl, { execute: true, greenAt: hoursAgo(50), query });
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.deepEqual(shim.calls.map((call) => call.words), ['migration list', 'db push', 'db push', 'migration list']);
  const [, dry, push] = shim.calls;
  assert.deepEqual(dry.args.slice(0, 4), ['db', 'push', '--include-all', '--dry-run']);
  assert.deepEqual(push.args.slice(0, 4), ['db', 'push', '--include-all', '--yes']);
  assert.equal(shim.history.has(HELD), true);
  assert.deepEqual(result.data.pushed, [HELD]);
  assert.equal(result.data.executed, true);
  assert.match(result.lines.at(-1), /^applied: 20260310000000$/u);
  const again = await postCutoverDatabase(ctx, decl, { execute: true, greenAt: hoursAgo(50), query });
  assert.match(again.lines[0], /Nothing to do\./u);
  assert.equal(shim.mutations().length, 1);
});

test('a dry run that lists more than the held-back migrations stops before pushing', async () => {
  const stray = () => ok(`Would push:\n * ${HELD}_drop-legacy.sql\n * 20269999000000_surprise.sql\n`);
  const { ctx, decl, shim, query } = setup({ env: ARMED, overrides: { 'db push': stray } });
  await assert.rejects(postCutoverDatabase(ctx, decl, { execute: true, ownerConfirms: true, query }), (error) => error.code === 'DB_PUSH_STRAY' && error.message.includes('20269999000000'));
  noMutation(shim);
});

test('nothing pending but still missing afterwards is a failure; pending that appears applied is reported', async () => {
  const missing = setup({ env: ARMED, overrides: { 'db push': () => ok('Would push:\n') } });
  await assert.rejects(postCutoverDatabase(missing.ctx, missing.decl, { execute: true, ownerConfirms: true, query: missing.query }), (error) => error.code === 'DB_HELD_MISSING' && error.exit === 1);
  let reads = 0;
  const listing = (versions) => ok(`${JSON.stringify({ migrations: versions.map((remote) => ({ remote })) })}\n`);
  const raced = setup({ env: ARMED, overrides: { 'migration list': () => { reads += 1; return listing(reads <= 1 ? DONE : [...DONE, HELD]); }, 'db push': () => ok('Would push:\n') } });
  const result = await postCutoverDatabase(raced.ctx, raced.decl, { execute: true, ownerConfirms: true, query: raced.query });
  assert.equal(result.ok, true);
  assert.equal(result.lines.at(-1), 'nothing pending: already applied.');
  noMutation(raced.shim);
});

test('through --url-env the password stays out of argv, lines, data and errors', async () => {
  const { ctx, decl, shim, query } = setup({ env: { ...ARMED, DB_URL: SECRET_URL } });
  const dry = await postCutoverDatabase(ctx, decl, { urlEnv: 'DB_URL', query });
  const applied = await postCutoverDatabase(ctx, decl, { urlEnv: 'DB_URL', execute: true, ownerConfirms: true, query });
  assert.equal(applied.ok, true);
  for (const call of shim.calls) {
    assert.equal(call.env.PGPASSWORD, 'sup3rsecret');
    assert.equal(call.args[call.args.indexOf('--db-url') + 1], 'postgres://postgres@db.example.com:5432/postgres');
  }
  assert.equal(JSON.stringify([dry, applied, shim.calls.map((call) => call.args)]).includes('sup3rsecret'), false);
  const failing = setup({ env: { DB_URL: SECRET_URL }, overrides: { 'migration list': () => bad(`refused for ${SECRET_URL}`) } });
  await assert.rejects(postCutoverDatabase(failing.ctx, failing.decl, { urlEnv: 'DB_URL', query }), (error) => !error.message.includes('sup3rsecret'));
});

test('dbPostCutoverMain: flags, JSON, exit codes', async () => {
  const run = async (argv, { remote = DONE, env = {} } = {}) => {
    const { app, shim } = setup({ remote });
    const out = [];
    const err = [];
    const code = await dbPostCutoverMain(argv, { cwd: app.root, stdout: (t) => out.push(t), stderr: (t) => err.push(t), env, stackIo: { spawn: makeSpawn({ supabase: shim.handler }), now: () => NOW } });
    return { code, out: out.join(''), err: err.join(''), shim };
  };
  const done = await run(['--json'], { remote: [...DONE, HELD] });
  assert.equal(done.code, 0);
  assert.deepEqual([JSON.parse(done.out).verb, JSON.parse(done.out).done], ['db post-cutover', true]);
  assert.equal((await run(['--linked', '--url-env', 'DB_URL'], { env: { DB_URL: SECRET_URL }, remote: [...DONE, HELD] })).code, 2);
  const closed = await run(['--execute', '--green-at', hoursAgo(1)], { env: ARMED });
  assert.equal(closed.code, 2);
  assert.match(closed.err, /^starci app db post-cutover: /u);
  await Promise.all([['--wat'], ['--green-at']].map(async (argv) => {
    const result = await run(argv);
    assert.equal(result.code, 2);
    assert.match(result.err, /DB_USAGE/u);
  }));
});

test('dbPostCutoverMain end to end with the default query and the owner flag', async () => {
  const app = makeDbApp({});
  apps.push(app);
  const shim = supabaseShim({ remote: DONE, rows: COVERED });
  const out = [];
  const code = await dbPostCutoverMain(['--execute', '--owner-confirms-old-app-gone', '--url-env', 'DB_URL'], {
    cwd: app.root, stdout: (t) => out.push(t), stderr: (t) => out.push(t), env: { ...ARMED, DB_URL: SECRET_URL }, stackIo: { spawn: makeSpawn({ supabase: shim.handler }) },
  });
  assert.equal(code, 0, out.join(''));
  assert.match(out.join(''), /applied: 20260310000000/u);
  assert.equal(out.join('').includes('sup3rsecret'), false);
  assert.equal(shim.history.has(HELD), true);
});
