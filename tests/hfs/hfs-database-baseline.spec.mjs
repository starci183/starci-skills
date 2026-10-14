// proves: DB_BASELINE_SHAPE@lite DB_BASELINE_SHAPE@full DB_ARCHIVE_MUTATED@lite DB_ARCHIVE_MUTATED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { baselineMarkers, baselineSourceFindings, databaseBaselineFindings } from '../../scripts/hfs/rules/database-baseline.mjs';
import { dbBaselineMain, dbSqlFiles } from '../../scripts/hfs/db-baseline-verb.mjs';
import { dbRestampMain } from '../../scripts/hfs/db-restamp-verb.mjs';
import { dbPlanMain } from '../../scripts/hfs/db-plan-verb.mjs';
import { a15Findings } from '../../scripts/hfs/rules/a15-findings.mjs';
import { databaseQueuesFindings } from '../../scripts/hfs/rules/database-queues.mjs';

const made = [];
const migrations = 'supabase/migrations';
const archive = `${migrations}/_archive`;
const first = '20260101000000';
const second = '20260102000000';
const replacement = '20260103000000';
const old = `${migrations}/${first}_start.sql`;
const retired = `${archive}/${first}_start.sql`;
const baseline = `${migrations}/${replacement}_baseline.sql`;
const marked = `-- starci:baseline ${first}\nselect 1;\n`;
const noHistory = () => ({ ok: false, stdout: '' });

test.after(() => {
  for (const dir of made) {
    assert.ok(path.basename(dir).startsWith('hfs-db-baseline-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function fixture(edition, contents) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-baseline-'));
  made.push(root);
  write(root, { 'hfs.json': JSON.stringify({ kind: 'app', edition, supabase: {} }), ...contents });
  return root;
}

function write(root, contents) {
  for (const [file, text] of Object.entries(contents)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
}

function history(contents) {
  return (args) => {
    if (args[0] === 'merge-base') return { ok: true, stdout: 'base' };
    if (args[0] === 'ls-tree') return { ok: true, stdout: `${Object.keys(contents).join('\0')}\0` };
    const file = args[1]?.split(':./')[1];
    return Object.hasOwn(contents, file) ? { ok: true, stdout: contents[file] } : { ok: false, stdout: '' };
  };
}

function judge(root, edition, contents, git = noHistory, extra = {}) {
  return databaseBaselineFindings({ repoRoot: root, files: Object.keys(contents), all: Object.keys(contents), repo: { kind: 'app', edition }, isRoot: true, inScope: () => true, git, ...extra });
}

function io(root, result) {
  const calls = [];
  const out = [];
  const err = [];
  const committed = Object.fromEntries([...dbSqlFiles(root), ...dbSqlFiles(root, archive)].map((entry) => [entry.file, fs.readFileSync(path.join(root, entry.file), 'utf8')]));
  return { calls, out, err, ports: { cwd: root, git: history(committed), stdout: (text) => out.push(text), stderr: (text) => err.push(text), runSupabase: (cwd, args) => {
    assert.equal(cwd, root);
    calls.push(args);
    if (result !== undefined) return typeof result === 'function' ? result(args) : result;
    if (args[1] !== 'query') return { status: 0, stdout: 'create table public.demo(id integer);\n' };
    const sql = args[2];
    let rows = [];
    if (sql.includes('to_regclass')) rows = [{ migrations: true, cron: true, queues: true, vault: true }];
    else if (sql.includes('schema_migrations')) rows = Object.keys(committed).filter((file) => !file.includes('/_archive/')).map((file) => ({ version: /\/(\d{14})_/.exec(file)[1] }));
    return { status: 0, stdout: JSON.stringify(rows) };
  } } };
}

const command = "select pgmq.send('events', '{}');";
const ownedStateSql = `select pgmq.create('events');\nselect cron.schedule('events-tick', '* * * * *', $job$${command}$job$);\n`;
function remoteInventory(root, overrides = {}) {
  const state = {
    presence: [{ migrations: true, cron: true, queues: true, vault: true }],
    migrations: [{ version: first }],
    cron: [{ name: 'events-tick', schedule: '* * * * *', commandHash: createHash('md5').update(command).digest('hex'), active: true }],
    queues: [{ name: 'events' }],
    vault: [{ name: 'webhook' }],
    ...overrides,
  };
  return io(root, (args) => {
    assert.equal(args[0], 'db');
    assert.equal(args[1], 'query');
    assert.deepEqual(args.slice(4), ['--output', 'json', '--agent', 'no']);
    const sql = args[2];
    assert.ok(/^select\s/i.test(sql));
    assert.equal(/(?:decrypted_secret|\bsecret\s+from|select\s+\*)/i.test(sql), false);
    const kind = sql.includes('to_regclass') ? 'presence' : Object.keys(state).find((key) => sql.includes({ migrations: 'schema_migrations', cron: 'cron.job', queues: 'pgmq.meta', vault: 'vault.secrets' }[key] ?? 'unmatched-inventory'));
    return { status: 0, stdout: JSON.stringify(state[kind]) };
  });
}

for (const edition of ['lite', 'full']) {
  test(`DB_BASELINE_SHAPE passing ${edition}: one valid header baseline and an intact archive`, () => {
    const contents = { [retired]: 'select 1;\n', [baseline]: marked };
    const root = fixture(edition, contents);
    assert.deepEqual(judge(root, edition, contents, history(contents)), []);
    assert.deepEqual(judge(fixture(edition, { [old]: 'select 1;' }), edition, { [old]: 'select 1;' }), []);
  });

  test(`DB_BASELINE_SHAPE violating ${edition}: missing, duplicate, mismatched and invalid baseline markers`, () => {
    for (const text of ['select 1;', `${marked}\n-- starci:baseline ${first}\n`, `-- starci:baseline ${second}\nselect 1;`, '-- starci:baseline 20261301000000\nselect 1;']) {
      // A marker after SQL is deliberately ignored, so duplicate headers are a separate case.
      const contents = { [retired]: 'select 1;', [baseline]: text };
      const findings = judge(fixture(edition, contents), edition, contents);
      const shouldFail = !text.startsWith(marked);
      assert.equal(findings.some((item) => item.code === 'DB_BASELINE_SHAPE'), shouldFail);
    }
    const duplicate = { [retired]: 'select 1;', [baseline]: `-- starci:baseline ${first}\n${marked}` };
    assert.ok(judge(fixture(edition, duplicate), edition, duplicate).some((item) => item.code === 'DB_BASELINE_SHAPE'));
    const invalidFile = { [`${archive}/notes.sql`]: 'select 1;', [baseline]: marked };
    assert.ok(judge(fixture(edition, invalidFile), edition, invalidFile).some((item) => item.code === 'DB_BASELINE_SHAPE'));
  });

  test(`DB_BASELINE_SHAPE ${edition}: backdated baseline needs the exact explicit restamp header`, () => {
    const backdated = `${migrations}/20251201000000_baseline.sql`;
    const contents = { [retired]: 'select 1;', [backdated]: marked };
    const root = fixture(edition, contents);
    assert.ok(judge(root, edition, contents).some((item) => item.code === 'DB_BASELINE_SHAPE'));
    contents[backdated] = `-- starci:restamp ${replacement} 20251201000000\n${marked}`;
    write(root, contents);
    assert.deepEqual(judge(root, edition, contents), []);
    contents[backdated] = `-- starci:restamp ${replacement} 20251202000000\n${marked}`;
    write(root, contents);
    assert.ok(judge(root, edition, contents).some((item) => item.code === 'DB_BASELINE_SHAPE'));
  });

  test(`DB_ARCHIVE_MUTATED passing ${edition}: an unchanged active chain moves with a new baseline`, () => {
    const contents = { [retired]: 'select 1;\n', [baseline]: marked };
    assert.deepEqual(judge(fixture(edition, contents), edition, contents, history({ [old]: 'select 1;\n' })), []);
  });

  test(`DB_ARCHIVE_MUTATED violating ${edition}: archive additions and active moves require the same-diff baseline`, () => {
    const contents = { [retired]: 'select 1;\n', [baseline]: marked };
    assert.ok(judge(fixture(edition, contents), edition, contents, history({})).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    const moved = { [retired]: 'select 1;\n' };
    assert.ok(judge(fixture(edition, moved), edition, moved, history({ [old]: 'select 1;\n' })).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    const edited = { [retired]: 'select 2;\n', [baseline]: marked };
    assert.ok(judge(fixture(edition, edited), edition, edited, history({ [old]: 'select 1;\n' })).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    // An already committed baseline cannot authorize a later move.
    assert.ok(judge(fixture(edition, contents), edition, contents, history({ [old]: 'select 1;\n', [baseline]: marked })).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
  });

  test(`DB_ARCHIVE_MUTATED ${edition}: committed archive content and paths are immutable`, () => {
    const prior = { [retired]: 'select 1;\n', [baseline]: marked };
    const changed = { [retired]: 'select 2;\n', [baseline]: marked };
    assert.ok(judge(fixture(edition, changed), edition, changed, history(prior)).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    const removed = { [baseline]: marked };
    assert.ok(judge(fixture(edition, removed), edition, removed, history(prior)).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    const normalized = { [retired]: 'select 1;\r\n', [baseline]: marked };
    assert.deepEqual(judge(fixture(edition, normalized), edition, normalized, history(prior)), []);
  });

  test(`app db baseline ${edition}: preview only dumps schema; --apply performs the explicit cutover`, () => {
    const root = fixture(edition, { [old]: 'select 1;\n' });
    const preview = io(root);
    assert.equal(dbBaselineMain(['--stamp', replacement], preview.ports), 0);
    assert.deepEqual(preview.calls.filter((args) => args[1] === 'dump'), [['db', 'dump', '--linked']]);
    assert.ok(preview.calls.every((args) => ['query', 'dump'].includes(args[1])));
    assert.ok(fs.existsSync(path.join(root, old)));
    assert.equal(fs.existsSync(path.join(root, baseline)), false);
    assert.ok(preview.out.join('').includes(`migration repair ${first} --status reverted --linked`));
    const apply = io(root);
    assert.equal(dbBaselineMain(['--stamp', replacement, '--apply', '--local'], apply.ports), 0);
    assert.equal(fs.existsSync(path.join(root, old)), false);
    assert.equal(fs.readFileSync(path.join(root, retired), 'utf8'), 'select 1;\n');
    assert.deepEqual(baselineMarkers(fs.readFileSync(path.join(root, baseline), 'utf8')), [first]);
    assert.deepEqual(apply.calls.slice(-3), [['db', 'dump', '--local'], ['migration', 'repair', first, '--status', 'reverted', '--local'], ['migration', 'repair', replacement, '--status', 'applied', '--local']]);
    const contents = { [retired]: 'select 1;\n', [baseline]: fs.readFileSync(path.join(root, baseline), 'utf8') };
    assert.deepEqual(judge(root, edition, contents, history({ [old]: 'select 1;\n' })), []);
  });

  test(`app db baseline ${edition}: invalid cutovers and private CLI failures never mutate files`, () => {
    for (const argv of [['--stamp', first], ['--stamp', '20260230000000'], ['--apply', '--unknown'], ['--apply', '--apply']]) {
      const root = fixture(edition, { [old]: 'select 1;' });
      const ports = io(root);
      assert.equal(dbBaselineMain(argv, ports.ports), 2);
      assert.deepEqual(ports.calls, []);
      assert.ok(fs.existsSync(path.join(root, old)));
    }
    const root = fixture(edition, { [old]: 'select 1;' });
    const failed = io(root, { status: 1, stderr: 'PRIVATE_CLI_DIAGNOSTIC' });
    assert.equal(dbBaselineMain(['--stamp', replacement, '--apply'], failed.ports), 2);
    assert.equal(failed.out.join('').includes('PRIVATE_CLI_DIAGNOSTIC'), false);
    assert.equal(failed.err.join('').includes('PRIVATE_CLI_DIAGNOSTIC'), false);
    assert.ok(fs.existsSync(path.join(root, old)));
    assert.equal(fs.existsSync(path.join(root, baseline)), false);
  });

  test(`DB_ARCHIVE_MUTATED ${edition}: a baseline cutover refuses uncommitted, changed or missing source history`, () => {
    const root = fixture(edition, { [old]: 'select 1;' });
    assert.ok(baselineSourceFindings({ repoRoot: root, files: [old], git: history({}) }).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    assert.ok(baselineSourceFindings({ repoRoot: root, files: [old], git: history({ [old]: 'select 2;' }) }).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    assert.ok(baselineSourceFindings({ repoRoot: root, files: [old], git: history({ [old]: 'select 1;', [`${migrations}/${second}_removed.sql`]: 'select 2;' }) }).some((item) => item.code === 'DB_ARCHIVE_MUTATED'));
    const ports = io(root);
    assert.equal(dbBaselineMain(['--stamp', replacement, '--apply'], { ...ports.ports, git: history({}) }), 2);
    assert.deepEqual(ports.calls, []);
    assert.ok(fs.existsSync(path.join(root, old)));
  });

  test(`app db baseline ${edition}: remote version drift cannot discard an unapplied local migration`, () => {
    const root = fixture(edition, { [old]: 'create table public.pending(id integer);' });
    const ports = remoteInventory(root, { migrations: [], cron: [], queues: [], vault: [] });
    assert.equal(dbBaselineMain(['--stamp', replacement, '--apply'], ports.ports), 2);
    assert.ok(ports.calls.every((args) => args[1] === 'query'));
    assert.ok(fs.existsSync(path.join(root, old)));
    assert.equal(fs.existsSync(path.join(root, baseline)), false);
  });

  test(`app db baseline ${edition}: role, queues, grants and cron ownership survive the cutover and plan comparison`, () => {
    const tickCommand = 'select public.events_tick();';
    const role = 'create role app_be nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole;';
    const tickSql = "create function public.events_tick() returns void language sql as $$select pgmq.send('events', '{}'::jsonb);$$;";
    const initialSql = `${role}\nselect pgmq.create('events');\ngrant select, insert on pgmq.q_events to app_be;\n${tickSql}\nselect cron.schedule('events-tick', '* * * * *', '${tickCommand}');\n`;
    const constant = 'be/src/modules/queues/events.queue.ts';
    const contents = { [old]: initialSql, [constant]: "export const EVENTS_QUEUE_NAME = 'events';\n" };
    const root = fixture(edition, contents);
    const inventories = remoteInventory(root, { cron: [{ name: 'events-tick', schedule: '* * * * *', commandHash: createHash('md5').update(tickCommand).digest('hex'), active: true }], vault: [] });
    const query = inventories.ports.runSupabase;
    inventories.ports.runSupabase = (cwd, args) => args[1] === 'query' ? query(cwd, args) : { status: 0, stdout: args[1] === 'dump' ? tickSql : '' };
    assert.equal(dbBaselineMain(['--stamp', replacement, '--apply'], inventories.ports), 0, inventories.err.join(''));
    const sql = fs.readFileSync(path.join(root, baseline), 'utf8');
    const roleDeclaration = /create role "?app_be"?/i.exec(sql);
    assert.ok(roleDeclaration && roleDeclaration.index < sql.indexOf('create function public.events_tick'));
    assert.match(sql, /pgmq\.create\s*\(\s*'events'/);
    assert.match(sql, /grant\s+(?:select,\s*insert|insert,\s*select)\s+on\s+(?:table\s+)?"?pgmq"?\."?q_events"?\s+to\s+"?app_be"?/i);
    assert.match(sql, /cron\.schedule\s*\(\s*'events-tick'/);
    const all = [baseline, retired, constant];
    assert.deepEqual(databaseQueuesFindings({ repoRoot: root, all, files: all, repo: { kind: 'app', edition }, inScope: () => true }), []);
    assert.deepEqual(judge(root, edition, { [baseline]: sql, [retired]: initialSql }, history({ [old]: initialSql })), []);
    const planned = remoteInventory(root, { migrations: [{ version: replacement }], cron: [{ name: 'events-tick', schedule: '* * * * *', commandHash: createHash('md5').update(tickCommand).digest('hex'), active: true }], vault: [] });
    assert.equal(dbPlanMain(['--json'], planned.ports), 0, planned.err.join(''));
  });

  test(`app db baseline ${edition}: excluded-schema changes and data migrations are refused before repair or archival`, () => {
    for (const initialSql of ['create policy objects_app_be_select on storage.objects for select to app_be using (bucket_id = \'demo\');', "insert into public.settings(name) values ('initial');"]) {
      const root = fixture(edition, { [old]: initialSql });
      const ports = io(root);
      assert.equal(dbBaselineMain(['--stamp', replacement, '--apply'], ports.ports), 2);
      assert.ok(ports.calls.every((args) => args[1] === 'query' || args[1] === 'dump'));
      assert.ok(fs.existsSync(path.join(root, old)));
      assert.equal(fs.existsSync(path.join(root, baseline)), false);
    }
  });

  test(`app db restamp ${edition}: explicit map previews repairs and --apply preserves SQL with a version header`, () => {
    const root = fixture(edition, { [old]: 'select 1;\n', 'restamp.yaml': `"${first}": "${second}"\n` });
    const preview = io(root);
    assert.equal(dbRestampMain(['--map', 'restamp.yaml'], preview.ports), 0);
    assert.deepEqual(preview.calls, []);
    assert.equal(fs.readFileSync(path.join(root, old), 'utf8'), 'select 1;\n');
    const apply = io(root);
    assert.equal(dbRestampMain(['--map=restamp.yaml', '--apply'], apply.ports), 0);
    const renamed = `${migrations}/${second}_start.sql`;
    assert.equal(fs.existsSync(path.join(root, old)), false);
    assert.equal(fs.readFileSync(path.join(root, renamed), 'utf8'), `-- starci:restamp ${first} ${second}\nselect 1;\n`);
    assert.deepEqual(apply.calls, [['migration', 'repair', first, '--status', 'reverted', '--linked'], ['migration', 'repair', second, '--status', 'applied', '--linked']]);
  });

  test(`app db restamp ${edition}: partial maps, collisions, duplicate keys and archive sources are refused before effects`, () => {
    const next = `${migrations}/${second}_next.sql`;
    for (const map of [`"${first}": "${replacement}"`, `"${first}": "${second}"`, `"${first}": "20260230000000"`, `"${first}": "${replacement}"\n"${first}": "20260104000000"`, '"20200101000000": "20210101000000"', '[]']) {
      const root = fixture(edition, { [old]: 'select 1;', [next]: 'select 2;', 'restamp.yaml': map });
      const ports = io(root);
      assert.equal(dbRestampMain(['--map', 'restamp.yaml', '--apply'], ports.ports), 2, map);
      assert.deepEqual(ports.calls, []);
      assert.ok(fs.existsSync(path.join(root, old)));
    }
    const root = fixture(edition, { [retired]: 'select 1;', [baseline]: marked, 'restamp.yaml': `"${first}": "${second}"` });
    const ports = io(root);
    assert.equal(dbRestampMain(['--map', 'restamp.yaml', '--apply'], ports.ports), 2);
    assert.deepEqual(ports.calls, []);
    assert.equal(dbRestampMain([], ports.ports), 2);
  });

  test(`app db plan ${edition}: compares all four inventories using SELECT-only queries and emits counts`, () => {
    const contents = { [old]: ownedStateSql, 'supabase/config.toml': '[db.vault]\nwebhook = "env(WEBHOOK_TOKEN)"\n' };
    const root = fixture(edition, contents);
    const ports = remoteInventory(root);
    assert.equal(dbPlanMain(['--json'], ports.ports), 0);
    const report = JSON.parse(ports.out.join(''));
    assert.equal(report.readOnly, true);
    assert.equal(report.drift, false);
    for (const key of ['migrations', 'cron', 'queues', 'vault']) assert.deepEqual(report[key], { expected: 1, remote: 1, missing: 0, unexpected: 0, changed: 0 });
    assert.equal(ports.calls.length, 5);
    assert.equal(ports.out.join('').includes('WEBHOOK_TOKEN'), false);
    assert.equal(ports.out.join('').includes('events-tick'), false);
    for (const [file, text] of Object.entries(contents)) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), text);
    const applied = remoteInventory(root);
    assert.equal(dbPlanMain(['--apply', '--local'], applied.ports), 0);
    assert.ok(applied.calls.every((args) => args[3] === '--local' && args[1] === 'query'));
  });

  test(`app db plan ${edition}: remote extra jobs, missing queues, cron changes and migration drift fail without exposing data`, () => {
    const root = fixture(edition, { [old]: ownedStateSql });
    const ports = remoteInventory(root, { migrations: [{ version: replacement }], queues: [], cron: [
      { name: 'events-tick', schedule: '0 * * * *', commandHash: createHash('md5').update('PRIVATE_REMOTE_COMMAND').digest('hex'), active: true },
      { name: 'PRIVATE_REMOTE_JOB', schedule: '* * * * *', commandHash: createHash('md5').update('PRIVATE_REMOTE_COMMAND').digest('hex'), active: true },
    ], vault: [{ name: 'PRIVATE_VAULT_NAME' }] });
    assert.equal(dbPlanMain(['--json'], ports.ports), 1);
    const report = JSON.parse(ports.out.join(''));
    assert.equal(report.migrations.missing, 1);
    assert.equal(report.migrations.unexpected, 1);
    assert.equal(report.queues.missing, 1);
    assert.equal(report.cron.changed, 1);
    assert.equal(report.cron.unexpected, 1);
    assert.equal(report.vault.unexpected, 1);
    assert.equal(ports.out.join('').includes('PRIVATE_'), false);
  });

  test(`app db plan ${edition}: absent optional catalogs, archived SQL and inert function declarations are handled read-only`, () => {
    const contents = { [old]: "select 'pgmq.create(''inert'')';\ncreate function public.probe() returns void language sql as $$select pgmq.create('deferred')$$;", [retired]: ownedStateSql };
    const root = fixture(edition, contents);
    const ports = remoteInventory(root, { presence: [{ migrations: true, cron: false, queues: false, vault: false }], cron: [], queues: [], vault: [] });
    assert.equal(dbPlanMain([], ports.ports), 0);
    assert.equal(ports.calls.length, 2);
  });

  test(`app db plan ${edition}: malformed inventory and private failures return a sanitized refusal`, () => {
    const root = fixture(edition, { [old]: 'select 1;' });
    for (const result of [{ status: 1, stderr: 'PRIVATE_CLI_DIAGNOSTIC' }, { status: 0, stdout: 'PRIVATE_DATABASE_OUTPUT' }, { status: 0, stdout: '{}' }]) {
      const ports = io(root, result);
      assert.equal(dbPlanMain([], ports.ports), 2);
      assert.equal(ports.out.join('').includes('PRIVATE_'), false);
      assert.equal(ports.err.join('').includes('PRIVATE_'), false);
    }
  });

  test(`app db plan ${edition}: inert and conditional declarations refuse before querying the database`, () => {
    for (const sql of ["create view public.inert as select pgmq.create('events');", "explain select pgmq.create('events');", "select pgmq.create('events') where false;", "do $$begin if false then perform pgmq.create('events'); end if; end$$;"]) {
      const root = fixture(edition, { [old]: sql });
      const ports = io(root);
      assert.equal(dbPlanMain([], ports.ports), 2, sql);
      assert.deepEqual(ports.calls, []);
    }
  });

  test(`app db plan ${edition}: unconditional migration DO declarations and multiline TOML values are inventoried safely`, () => {
    const sql = `do $$begin perform pgmq.create('events'); end$$;\nselect cron.schedule('events-tick', '* * * * *', $job$${command}$job$);`;
    const config = '[auth]\nlabel = """ignored""""\n[db.vault]\nwebhook = "env(WEBHOOK_TOKEN)"\n';
    const root = fixture(edition, { [old]: sql, 'supabase/config.toml': config });
    const ports = remoteInventory(root);
    assert.equal(dbPlanMain(['--json'], ports.ports), 0, ports.err.join(''));
    assert.equal(JSON.parse(ports.out.join('')).vault.expected, 1);
  });
}

test('DB_BASELINE_SHAPE markers cannot be impersonated by SQL literals or comments after a statement', () => {
  assert.deepEqual(baselineMarkers(`select '-- starci:baseline ${first}';\n-- starci:baseline ${first}`), []);
  assert.deepEqual(baselineMarkers(`/* -- starci:baseline ${first} */\nselect 1;`), []);
});

test('R257 participates in the synchronous alpha.15 finder and fast cross-file inventory', () => {
  const contents = { [retired]: 'select 1;', [baseline]: 'select 1;' };
  const root = fixture('lite', contents);
  const findings = a15Findings({ repoRoot: root, files: [baseline], all: Object.keys(contents), repo: { kind: 'app', edition: 'lite' }, isRoot: true, inScope: (file) => file === baseline, git: noHistory });
  assert.equal(typeof findings.then, 'undefined');
  assert.ok(findings.some((item) => item.code === 'DB_BASELINE_SHAPE'));
});

test('app db plan linked preview refuses before CLI when its existing link cache is absent', () => {
  const root = fixture('lite', { [old]: 'select 1;' });
  const out = [];
  const err = [];
  assert.equal(dbPlanMain([], { cwd: root, env: {}, stdout: (text) => out.push(text), stderr: (text) => err.push(text) }), 2);
  assert.deepEqual(out, []);
  assert.ok(err.join('').includes('link'));
});
