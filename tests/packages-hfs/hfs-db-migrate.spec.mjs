import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildModel, dbMigrateMain, loadDatabase, migrateDatabase, normalizeDatabase, parseMigrationList, pendingVersions, planMigration, resolveTarget, targetArgs,
} from '../../packages/hfs/db/migrate.mjs';
import { byCodeUnit } from '../../packages/hfs/runtime/engine/by-code-unit.mjs';
import { StackError } from '../../packages/hfs/stack/errors.mjs';
import { fakeSops } from '../helpers/stack-fakes.mjs';
import {
  BASELINE, DATABASE_BLOCK, FORWARD_1, FORWARD_2, HELD, NEW_A, OLD_A, OLD_B, PROJECT_REF, STANDARD, bad, makeDbApp, makeSpawn, ok, releaseCtx, supabaseShim,
} from '../helpers/release-fakes.mjs';

const apps = [];
const appWith = (options) => {
  const app = makeDbApp(options);
  apps.push(app);
  return app;
};
after(() => { for (const app of apps) app.cleanup(); });

const DONE = [BASELINE, STANDARD, FORWARD_1, FORWARD_2];
const OLD = [OLD_A, OLD_B];
const SECRET_URL = 'postgres://postgres:sup3rsecret@db.example.com:5432/postgres';

function setup({ remote = OLD, env = {}, overrides, sops, ...appOptions } = {}) {
  const app = appWith(appOptions);
  const shim = supabaseShim({ remote, overrides });
  const spawn = makeSpawn({ supabase: shim.handler });
  const out = releaseCtx(app.root, { spawn, env, sops });
  return { app, shim, spawn, ...out, decl: loadDatabase(app.root) };
}

const refused = (promise, code) => assert.rejects(promise, (error) => error instanceof StackError && error.code === code);
const everything = (result, shim) => JSON.stringify([result.lines, result.data, shim.calls.map((call) => call.args)]);

test('the database block is optional for the app but required by the verbs, judged field by field', () => {
  const bare = appWith({ block: null });
  assert.throws(() => loadDatabase(bare.root), (error) => error.code === 'DB_UNDECLARED');
  const minimal = normalizeDatabase({ baseline: 'start' });
  assert.deepEqual(minimal.config, {
    migrationsDir: 'supabase/migrations', archiveDir: null, standard: null, heldBack: [], projectRef: null, restamp: [], password: null, postCutover: null, baseline: 'start',
  });
  assert.deepEqual(normalizeDatabase(DATABASE_BLOCK).config.restamp, [{ from: OLD_A, to: NEW_A }]);
  assert.deepEqual(normalizeDatabase([]).problems, ['database: must be a mapping']);
  const { problems } = normalizeDatabase({
    other: 1, migrationsDir: '../up', archiveDir: '/abs', standard: 'bad name', heldBack: 'x', projectRef: 'SHORT', restamp: [{ from: '1', to: '2' }],
    password: { env: 'production', member: 'db' }, postCutover: { schema: 'Public', functionPrefixes: ['ok_'], extra: 1 },
  });
  const text = problems.join('\n');
  for (const part of ['database.other', 'migrationsDir', 'archiveDir', 'standard', 'heldBack', 'projectRef', 'restamp', 'password', 'postCutover', 'database.baseline: is required']) assert.match(text, new RegExp(part, 'u'));
  for (const bad of [{ schema: 3 }, { minAgeHours: -1 }, { functions: ['drop table x;'] }, 'text']) assert.equal(normalizeDatabase({ baseline: 'b', postCutover: bad }).config, undefined);
  assert.deepEqual(normalizeDatabase({ baseline: 'b', postCutover: { schema: 'app', minAgeHours: 24, functionNames: ['a_b'], functionPrefixes: ['c_'], functions: ['app.f(int)'] } }).problems, undefined);
  const invalid = appWith({ block: { baseline: 'x', nope: true } });
  assert.throws(() => loadDatabase(invalid.root), (error) => error.code === 'DB_CONFIG_INVALID' && /1 problem\(s\) in database: database\.nope/u.test(error.message));
});

test('the migration list is read from the JSON form or the older table', () => {
  const json = `${JSON.stringify({ migrations: [{ local: '20260101000000', remote: '20260101000000' }, { local: '20260102000000' }, { remote: '20260103000000' }] })}\nmore text\n`;
  assert.deepEqual([...parseMigrationList(`warming up\n${json}`).remote], ['20260101000000', '20260103000000']);
  assert.deepEqual([...parseMigrationList(`warming up\n${json}`).local], ['20260101000000', '20260102000000']);
  assert.deepEqual([...parseMigrationList('{"migrations":[{"remote":"20260109000000"}]}').remote], ['20260109000000']);
  const table = '  Local          | Remote         | Time\n  20260101000000 | 20260101000000 | 2026-01-01\n  20260102000000 |                | \n                 | 20260103000000 | \n';
  assert.deepEqual([...parseMigrationList(table).remote], ['20260101000000', '20260103000000']);
  assert.deepEqual([...parseMigrationList(table).local], ['20260101000000', '20260102000000']);
  assert.deepEqual([...parseMigrationList('{"migrations": broken}\n20260101000000 | 20260102000000 |\n').remote], ['20260102000000']);
  assert.deepEqual(pendingVersions('Would push:\n * 20260102000000_a.sql\n * 20260102000000_a.sql\n "20260103000000_b-c.sql"'), ['20260102000000', '20260103000000']);
});

test('the repository model classifies baseline, forward, held-back and archive', () => {
  const app = appWith({});
  const model = buildModel(app.root, loadDatabase(app.root));
  assert.equal(model.baseline, BASELINE);
  assert.equal(model.standard, STANDARD);
  assert.deepEqual(model.pushPending, [STANDARD, FORWARD_1, FORWARD_2]);
  assert.deepEqual(model.held, [`${HELD}_drop-legacy.sql`]);
  assert.deepEqual(model.heldVersions, [HELD]);
  assert.equal(model.push.includes(`${HELD}_drop-legacy.sql`), false);
  assert.deepEqual(model.archive.map((item) => item.version), [NEW_A, OLD_B]);
  assert.equal(model.archive[0].name, `${NEW_A}_old-a.sql`);
  assert.equal(model.allowed.has(HELD), true);
  assert.equal(model.pushVersions.has(HELD), false);
  const noArchive = appWith({ block: { baseline: 'baseline', standard: 'baseline-standard', heldBack: ['drop-legacy'], archiveDir: 'supabase/migrations/_missing' } });
  assert.deepEqual(buildModel(noArchive.root, loadDatabase(noArchive.root)).archive, []);
  const noStandard = appWith({ block: { baseline: 'baseline', files: undefined } });
  assert.equal(buildModel(noStandard.root, loadDatabase(noStandard.root)).standard, null);
});

test('an inconsistent repository is refused before anything is read from the database', () => {
  const model = (files, block = DATABASE_BLOCK) => {
    const app = appWith({ files, block });
    return () => buildModel(app.root, loadDatabase(app.root));
  };
  const base = { [`${BASELINE}_baseline.sql`]: '', [`${STANDARD}_baseline-standard.sql`]: '' };
  assert.throws(() => buildModel('/no/such/app', normalizeDatabase({ baseline: 'b' }).config), (error) => error.code === 'DB_MIGRATIONS_MISSING');
  assert.throws(model({ 'notes.sql': '' }), (error) => error.code === 'DB_MIGRATION_NAME');
  assert.throws(model({ [`${STANDARD}_baseline-standard.sql`]: '' }), (error) => error.code === 'DB_BASELINE_MISSING' && /baseline/u.test(error.message));
  assert.throws(model({ [`${BASELINE}_baseline.sql`]: '' }), (error) => error.code === 'DB_BASELINE_MISSING' && /baseline-standard/u.test(error.message));
  assert.throws(model({ ...base, '20260301000100_other.sql': '' }), (error) => error.code === 'DB_STAMP_DUPLICATE');
  assert.throws(model({ ...base, '20260101000000_early.sql': '' }), (error) => error.code === 'DB_STAMP_ORDER' && /before the baseline/u.test(error.message));
  assert.throws(model({ ...base, '20260301000050_between.sql': '' }), (error) => error.code === 'DB_STAMP_ORDER' && /second baseline/u.test(error.message));
  assert.throws(model({ ...base, [`${NEW_A}_collides.sql`]: '' }, { ...DATABASE_BLOCK }), (error) => error.code === 'DB_STAMP_ORDER');
  const late = { ...DATABASE_BLOCK, restamp: [{ from: OLD_A, to: FORWARD_1 }] };
  assert.throws(model({ ...base, [`${FORWARD_1}_collides.sql`]: '' }, late), (error) => error.code === 'DB_STAMP_COLLISION');
  const plain = { baseline: 'baseline', restamp: [{ from: OLD_A, to: '20260301000050' }] };
  assert.throws(model({ [`${BASELINE}_baseline.sql`]: '', '20260301000050_x.sql': '' }, plain), (error) => error.code === 'DB_STAMP_COLLISION');
});

test('planMigration is pure set arithmetic over the remote history', () => {
  const app = appWith({});
  const model = buildModel(app.root, loadDatabase(app.root));
  const done = planMigration(model, new Set(DONE));
  assert.equal(done.done, true);
  assert.equal(planMigration(model, new Set([...DONE, HELD])).done, true);
  const old = planMigration(model, new Set(OLD));
  assert.equal(old.done, false);
  assert.deepEqual(old.repairs, [{ from: OLD_A, to: NEW_A }]);
  assert.deepEqual(old.reverts, [NEW_A, OLD_B]);
  assert.equal(old.mark, true);
  assert.deepEqual(old.push, [STANDARD, FORWARD_1, FORWARD_2]);
  assert.deepEqual(old.unexpected, []);
  assert.equal(old.final, 4);
  const partial = planMigration(model, new Set([BASELINE, STANDARD, OLD_B]));
  assert.deepEqual(partial.reverts, []);
  assert.equal(partial.mark, false);
  assert.deepEqual(partial.push, [FORWARD_1, FORWARD_2]);
  assert.deepEqual(partial.unexpected, [OLD_B]);
  const unknown = planMigration(model, new Set(['20250999000000']));
  assert.deepEqual(unknown.unexpected, ['20250999000000']);
  const lonely = buildModel(app.root, { ...loadDatabase(app.root), restamp: [{ from: '20240101000000', to: '20240202000000' }] });
  assert.deepEqual(planMigration(lonely, new Set(['20240101000000'])).missingFiles, ['20240202000000']);
});

test('already baseline plus forward: nothing to do, zero mutating calls, held-back may or may not be applied', async () => {
  await Promise.all([DONE, [...DONE, HELD]].map(async (remote) => {
    const { shim, ctx, decl } = setup({ remote });
    const result = await migrateDatabase(ctx, decl, { execute: true });
    assert.equal(result.ok, true);
    assert.match(result.lines.join('\n'), /Nothing to do\./u);
    assert.equal(result.data.done, true);
    assert.equal(result.data.executed, false);
    assert.deepEqual(shim.calls.map((call) => call.words), ['migration list']);
    assert.deepEqual(shim.mutations(), []);
  }));
});

test('a dry run prints the plan from one read-only call', async () => {
  const { shim, ctx, decl } = setup({});
  const result = await migrateDatabase(ctx, decl, {});
  assert.equal(result.ok, true);
  const text = result.lines.join('\n');
  assert.match(text, /target +linked project abcdefghijklmnopqrst/u);
  assert.match(text, /remote history 2 version\(s\)/u);
  assert.match(text, new RegExp(`${OLD_A} -> ${NEW_A}`, 'u'));
  assert.match(text, /archive revert 2 archived version\(s\)/u);
  assert.match(text, /baseline +20260301000000 will be marked applied \(not run\)/u);
  assert.match(text, /forward push +3 migration\(s\): 20260301000100_baseline-standard\.sql, 20260302000000_add-orders\.sql, 20260303000000_add-jobs\.sql/u);
  assert.match(text, /held back +20260310000000_drop-legacy\.sql \(never applied here/u);
  assert.match(text, /the final history would be 4 version\(s\)/u);
  assert.deepEqual(shim.calls.map((call) => call.words), ['migration list']);
  assert.equal(result.data.executed, false);
  assert.deepEqual(result.data.push, [STANDARD, FORWARD_1, FORWARD_2]);
  const applied = await migrateDatabase(setup({ remote: [BASELINE] }).ctx, setup({ remote: [BASELINE] }).decl, {});
  assert.match(applied.lines.join('\n'), /baseline +20260301000000 already applied/u);
  assert.match(applied.lines.join('\n'), /forward push +3 migration/u);
});

test('--execute without STARCI_DB_ARMED=1 is refused before any mutating call', async () => {
  const { shim, ctx, decl } = setup({});
  await assert.rejects(migrateDatabase(ctx, decl, { execute: true }), (error) => error.code === 'DB_NOT_ARMED' && error.exit === 3);
  assert.deepEqual(shim.mutations(), []);
  const wrong = setup({ env: { STARCI_DB_ARMED: 'yes' } });
  await refused(migrateDatabase(wrong.ctx, wrong.decl, { execute: true }), 'DB_NOT_ARMED');
});

test('armed, the old history is repaired, the baseline marked, the forward migrations pushed and the held-back one never copied', async () => {
  const { shim, ctx, decl } = setup({ env: { STARCI_DB_ARMED: '1' } });
  const result = await migrateDatabase(ctx, decl, { execute: true });
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.deepEqual([...shim.history].sort(byCodeUnit), DONE);
  assert.deepEqual(shim.calls.map((call) => call.words), [
    'migration list', 'migration repair', 'migration repair', 'migration list', 'migration repair', 'migration repair', 'db push', 'db push', 'migration list',
  ]);
  const [, revertOld, applyNew, , revertArchive, markBaseline, dry, push] = shim.calls;
  assert.deepEqual(revertOld.args.slice(0, 5), ['migration', 'repair', '--status', 'reverted', OLD_A]);
  assert.deepEqual(applyNew.args.slice(0, 5), ['migration', 'repair', '--status', 'applied', NEW_A]);
  assert.deepEqual(revertArchive.args.slice(4, 6), [NEW_A, OLD_B]);
  assert.deepEqual(markBaseline.args.slice(4, 5), [BASELINE]);
  assert.equal(dry.args.includes('--dry-run'), true);
  assert.equal(push.args.includes('--yes'), true);
  assert.equal(push.args.includes('--include-all'), false);
  for (const call of shim.calls.filter((item) => item.dir && item.dir !== ctx.cwd)) assert.equal(call.files.some((file) => file.includes('drop-legacy')), false, `${call.words} ${call.files}`);
  assert.deepEqual(shim.calls.at(-3).files, [`${BASELINE}_baseline.sql`, `${STANDARD}_baseline-standard.sql`, `${FORWARD_1}_add-orders.sql`, `${FORWARD_2}_add-jobs.sql`]);
  assert.equal(result.data.executed, true);
  assert.deepEqual(result.data.pushed, [STANDARD, FORWARD_1, FORWARD_2]);
  assert.match(result.lines.at(-1), /applied: 3 forward migration\(s\) pushed; the remote history now holds 4 version\(s\)\. Held back: 20260310000000_drop-legacy\.sql\./u);
  // the scratch projects are gone and a second run is a no-op
  for (const call of shim.calls.filter((item) => item.dir && item.dir !== ctx.cwd)) assert.equal(fs.existsSync(call.dir), false);
  const mutations = shim.mutations().length;
  const again = await migrateDatabase(ctx, decl, { execute: true });
  assert.match(again.lines.join('\n'), /Nothing to do\./u);
  assert.equal(shim.mutations().length, mutations);
});

test('without a held-back declaration every other migration is forward', async () => {
  const { shim, ctx, decl } = setup({ remote: [BASELINE, STANDARD, FORWARD_1, FORWARD_2], block: { baseline: 'baseline', standard: 'baseline-standard' }, env: { STARCI_DB_ARMED: '1' } });
  const result = await migrateDatabase(ctx, decl, { execute: true });
  assert.deepEqual(result.data.pushed, [HELD]);
  assert.deepEqual(result.data.heldBack, []);
  assert.match(result.lines.join('\n'), /held back +none/u);
  assert.match(result.lines.at(-1), /Held back: nothing./u);
  assert.equal(shim.history.has(HELD), true);
});

test('a half-done history pushes only what is missing', async () => {
  const { shim, ctx, decl } = setup({ remote: [BASELINE, STANDARD, FORWARD_1], env: { STARCI_DB_ARMED: '1' } });
  const result = await migrateDatabase(ctx, decl, { execute: true });
  assert.equal(result.ok, true);
  assert.deepEqual(shim.mutations().map((call) => call.words), ['db push']);
  assert.deepEqual(result.data.pushed, [FORWARD_2]);
  assert.deepEqual(result.data.reverts, []);
});

test('a history with nothing to push still ends at baseline plus forward', async () => {
  const { shim, ctx, decl } = setup({ remote: [BASELINE, STANDARD, FORWARD_1, FORWARD_2, OLD_B], env: { STARCI_DB_ARMED: '1' } });
  const result = await migrateDatabase(ctx, decl, { execute: true });
  assert.equal(result.ok, false);
  assert.match(result.lines.join('\n'), new RegExp(`RED: remote version ${OLD_B} is outside baseline`, 'u'));
  assert.deepEqual(shim.mutations(), []);
});

test('unknown remote versions and missing archive files are red and nothing is applied, armed or not', async () => {
  const { shim, ctx, decl } = setup({ remote: ['20250999000000', ...OLD], env: { STARCI_DB_ARMED: '1' } });
  await Promise.all([false, true].map(async (execute) => {
    const result = await migrateDatabase(ctx, decl, { execute });
    assert.equal(result.ok, false);
    assert.match(result.lines.join('\n'), /RED: remote version 20250999000000 is outside baseline \+ forward \+ held-back/u);
    assert.equal(result.lines.at(-1), 'nothing applied.');
    assert.equal(result.data.executed, false);
  }));
  assert.deepEqual(shim.mutations(), []);
  const lonely = setup({ remote: ['20240101000000'], block: { ...DATABASE_BLOCK, restamp: [{ from: '20240101000000', to: '20240202000000' }] } });
  const result = await migrateDatabase(lonely.ctx, lonely.decl, {});
  assert.match(result.lines.join('\n'), /RED: no archived migration file for the restamped version 20240202000000/u);
});

test('a dry run that lists versions outside the push list stops before pushing', async () => {
  const stray = (args, dir) => ok(`Would push:\n * 20269999000000_surprise.sql\n * ${FORWARD_1}_add-orders.sql\n`);
  const { shim, ctx, decl } = setup({ remote: [BASELINE], env: { STARCI_DB_ARMED: '1' }, overrides: { 'db push': (args, dir) => (args.includes('--dry-run') ? stray(args, dir) : ok()) } });
  await assert.rejects(migrateDatabase(ctx, decl, { execute: true }), (error) => error.code === 'DB_PUSH_STRAY' && /20269999000000/u.test(error.message));
  assert.equal(shim.calls.some((call) => call.args.includes('--yes')), false);
});

test('a push that leaves the history wrong is a failure, and a dry run with nothing pending pushes nothing', async () => {
  const lazy = setup({ remote: [BASELINE], env: { STARCI_DB_ARMED: '1' }, overrides: { 'db push': () => ok('Would push:\n') } });
  await assert.rejects(migrateDatabase(lazy.ctx, lazy.decl, { execute: true }), (error) => error.code === 'DB_FINAL_MISMATCH' && error.exit === 1);
  assert.equal(lazy.shim.calls.some((call) => call.args.includes('--yes')), false);
});

test('CLI failures name only a scrubbed first line', async () => {
  const failing = setup({ overrides: { 'migration list': () => bad('line one mentions secret-from-env\nline two') }, env: { SUPABASE_DB_PASSWORD: 'secret-from-env' } });
  await assert.rejects(migrateDatabase(failing.ctx, failing.decl, {}), (error) => error.code === 'DB_CLI_FAILED' && error.message.includes('[value]') && !error.message.includes('secret-from-env') && !error.message.includes('line two'));
  const missing = setup({ overrides: { 'migration list': () => ({ status: null, error: new Error('spawn supabase ENOENT') }) } });
  await assert.rejects(migrateDatabase(missing.ctx, missing.decl, {}), (error) => error.code === 'DB_CLI_MISSING' && /ENOENT/u.test(error.message));
  const silent = setup({ overrides: { 'migration list': () => ({ status: 1 }) } });
  await assert.rejects(migrateDatabase(silent.ctx, silent.decl, {}), (error) => error.code === 'DB_CLI_FAILED');
  const bare = setup({ overrides: { 'migration list': () => ({ status: 0 }) }, remote: [] });
  assert.equal((await migrateDatabase(bare.ctx, bare.decl, {})).data.remoteCount, 0);
});

test('the pinned supabase script of the app is preferred over a binary on the path', async () => {
  const { app, shim, decl } = setup({ remote: DONE });
  app.write('node_modules/supabase/dist/supabase.js', '');
  const spawn = makeSpawn({ [process.execPath]: (args, options) => shim.handler(args.slice(1), options) });
  const { ctx } = releaseCtx(app.root, { spawn });
  await migrateDatabase(ctx, decl, {});
  assert.equal(spawn.calls[0].command, process.execPath);
  assert.equal(spawn.calls[0].args[0], path.join(app.root, 'node_modules', 'supabase', 'dist', 'supabase.js'));
  assert.equal(shim.calls[0].words, 'migration list');
});

test('the linked project: the declared ref is enforced and the link state is required', () => {
  const linked = setup({});
  const target = resolveTarget(linked.ctx, linked.decl, {});
  assert.equal(target.kind, 'linked');
  assert.equal(target.ref, PROJECT_REF);
  assert.deepEqual(targetArgs(target, '/w'), ['--linked', '--workdir', '/w']);
  const free = setup({ block: { ...DATABASE_BLOCK, projectRef: undefined } });
  assert.equal(resolveTarget(free.ctx, free.decl, { linked: true }).kind, 'linked');
  const other = setup({ block: { ...DATABASE_BLOCK, projectRef: 'zzzzzzzzzzzzzzzzzzzz' } });
  assert.throws(() => resolveTarget(other.ctx, other.decl, {}), (error) => error.code === 'DB_WRONG_PROJECT' && error.message.includes(PROJECT_REF));
  const unlinked = setup({ linked: false });
  assert.throws(() => resolveTarget(unlinked.ctx, unlinked.decl, {}), (error) => error.code === 'DB_NOT_LINKED');
  assert.throws(() => resolveTarget(linked.ctx, linked.decl, { linked: true, urlEnv: 'DB_URL' }), (error) => error.code === 'DB_USAGE');
});

test('the linked password comes from the environment or the sealed custody and travels only in the child environment', async () => {
  const sealedBlock = { ...DATABASE_BLOCK, password: { env: 'production', member: 'db', key: 'SUPABASE_DB_PASSWORD' } };
  const sealed = setup({ remote: DONE, block: sealedBlock, password: sealedBlock.password, sops: fakeSops({ members: { db: { SUPABASE_DB_PASSWORD: 'sealed-pw-1' } } }) });
  const result = await migrateDatabase(sealed.ctx, sealed.decl, {});
  assert.equal(sealed.shim.calls[0].env.SUPABASE_DB_PASSWORD, 'sealed-pw-1');
  assert.equal(everything(result, sealed.shim).includes('sealed-pw-1'), false);
  const fromEnv = setup({ remote: DONE, block: sealedBlock, env: { SUPABASE_DB_PASSWORD: 'env-pw-2' }, sops: fakeSops({}) });
  const second = await migrateDatabase(fromEnv.ctx, fromEnv.decl, {});
  assert.equal(fromEnv.shim.calls[0].env.SUPABASE_DB_PASSWORD, 'env-pw-2');
  assert.equal(everything(second, fromEnv.shim).includes('env-pw-2'), false);
  const none = setup({ remote: DONE });
  await migrateDatabase(none.ctx, none.decl, {});
  assert.equal(Object.hasOwn(none.shim.calls[0].env, 'SUPABASE_DB_PASSWORD'), false);
  const emptyEnv = setup({ remote: DONE, env: { SUPABASE_DB_PASSWORD: '' } });
  await migrateDatabase(emptyEnv.ctx, emptyEnv.decl, {});
  assert.equal(emptyEnv.shim.calls[0].env.SUPABASE_DB_PASSWORD, '');
});

test('an unreadable or incomplete sealed password is refused without naming a value', () => {
  const block = { ...DATABASE_BLOCK, password: { env: 'production', member: 'db', key: 'SUPABASE_DB_PASSWORD' } };
  const unreadable = setup({ block, sops: fakeSops({}) });
  assert.throws(() => resolveTarget(unreadable.ctx, unreadable.decl, {}), (error) => error.code === 'DB_PASSWORD_UNREADABLE' && /cannot be opened/u.test(error.message));
  const absent = setup({ block, password: block.password, sops: fakeSops({ members: { db: { OTHER: 'x' } } }) });
  assert.throws(() => resolveTarget(absent.ctx, absent.decl, {}), (error) => error.code === 'DB_PASSWORD_UNREADABLE' && /no value for SUPABASE_DB_PASSWORD/u.test(error.message));
  const empty = setup({ block, password: block.password, sops: fakeSops({ members: { db: { SUPABASE_DB_PASSWORD: '' } } }) });
  assert.throws(() => resolveTarget(empty.ctx, empty.decl, {}), (error) => error.code === 'DB_PASSWORD_UNREADABLE');
});

test('--url-env: the connection string is split so the password never reaches argv, a line, the data or an error', async () => {
  const { shim, ctx, decl } = setup({ remote: OLD, env: { DB_URL: SECRET_URL, STARCI_DB_ARMED: '1' } });
  const dry = await migrateDatabase(ctx, decl, { urlEnv: 'DB_URL' });
  const applied = await migrateDatabase(ctx, decl, { urlEnv: 'DB_URL', execute: true });
  assert.equal(applied.ok, true, applied.lines.join('\n'));
  assert.match(dry.lines[0], /^target +connection string from DB_URL$/u);
  for (const call of shim.calls) {
    assert.equal(call.args.includes('--db-url'), true);
    assert.equal(call.args[call.args.indexOf('--db-url') + 1], 'postgres://postgres@db.example.com:5432/postgres');
    assert.equal(call.env.PGPASSWORD, 'sup3rsecret');
    assert.equal(call.args.includes('--linked'), false);
  }
  assert.equal(`${everything(dry, shim)}${everything(applied, shim)}`.includes('sup3rsecret'), false);
  const leaking = setup({ env: { DB_URL: SECRET_URL }, overrides: { 'migration list': () => bad(`could not connect with ${SECRET_URL}`) } });
  await assert.rejects(migrateDatabase(leaking.ctx, leaking.decl, { urlEnv: 'DB_URL' }), (error) => !error.message.includes('sup3rsecret') && error.message.includes('[value]'));
  const noPassword = setup({ remote: DONE, env: { DB_URL: 'postgresql://postgres@db.example.com/postgres' } });
  await migrateDatabase(noPassword.ctx, noPassword.decl, { urlEnv: 'DB_URL' });
  assert.equal(Object.hasOwn(noPassword.shim.calls[0].env, 'PGPASSWORD'), false);
});

test('--url-env is validated', () => {
  const { ctx, decl } = setup({ env: { DB_URL: 'not a url', HTTP_URL: 'https://example.com/x', BAD_ESCAPE: 'postgres://u:%E0%A4%A@h/db', EMPTY_URL: '' } });
  assert.throws(() => resolveTarget(ctx, decl, { urlEnv: 'lower' }), (error) => error.code === 'DB_USAGE');
  assert.throws(() => resolveTarget(ctx, decl, { urlEnv: 'MISSING_URL' }), (error) => error.code === 'DB_URL_ENV_MISSING');
  assert.throws(() => resolveTarget(ctx, decl, { urlEnv: 'EMPTY_URL' }), (error) => error.code === 'DB_URL_ENV_MISSING');
  for (const name of ['DB_URL', 'HTTP_URL', 'BAD_ESCAPE']) assert.throws(() => resolveTarget(ctx, decl, { urlEnv: name }), (error) => error.code === 'DB_URL_INVALID' && !error.message.includes('example.com'), name);
});

test('dbMigrateMain: flags, text and JSON, exit codes', async () => {
  const run = async (argv, { remote = DONE, env = {} } = {}) => {
    const app = appWith({});
    const shim = supabaseShim({ remote });
    const out = [];
    const err = [];
    const code = await dbMigrateMain(argv, { cwd: app.root, stdout: (t) => out.push(t), stderr: (t) => err.push(t), env, stackIo: { spawn: makeSpawn({ supabase: shim.handler }) } });
    return { code, out: out.join(''), err: err.join(''), shim };
  };
  const text = await run([]);
  assert.equal(text.code, 0);
  assert.match(text.out, /Nothing to do\./u);
  const json = JSON.parse((await run(['--json', '--linked'])).out);
  assert.deepEqual([json.verb, json.ok, json.done], ['db migrate', true, true]);
  assert.equal((await run(['--url-env', 'DB_URL'], { env: { DB_URL: SECRET_URL } })).code, 0);
  const red = await run([], { remote: ['20250999000000'] });
  assert.equal(red.code, 1);
  const unarmed = await run(['--execute'], { remote: OLD });
  assert.equal(unarmed.code, 3);
  assert.match(unarmed.err, /^starci app db migrate: DB_NOT_ARMED: /u);
  assert.equal((await run(['--linked', '--url-env', 'DB_URL'], { env: { DB_URL: SECRET_URL } })).code, 2);
  await Promise.all([['--wat'], ['--url-env']].map(async (argv) => {
    const bad = await run(argv);
    assert.equal(bad.code, 2);
    assert.match(bad.err, /DB_USAGE/u);
  }));
  const noBlock = makeDbApp({ block: null });
  apps.push(noBlock);
  const err = [];
  assert.equal(await dbMigrateMain([], { cwd: noBlock.root, stdout: () => {}, stderr: (t) => err.push(t), env: {} }), 2);
  assert.match(err.join(''), /DB_UNDECLARED/u);
  assert.equal(fs.existsSync(path.join(noBlock.root, 'supabase', 'migrations', `${HELD}_drop-legacy.sql`)), true);
});
