// proves: DB_PGMQ_DECLARED@lite DB_PGMQ_DECLARED@full DB_CRON_OWNED@lite DB_CRON_OWNED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { databaseQueueDeclarations, databaseQueuesFindings } from '../../scripts/hfs/rules/database-queues.mjs';
import { a15Findings, FINDERS } from '../../scripts/hfs/rules/a15-findings.mjs';

const MIGRATION = 'supabase/migrations/20261014010000_queues.sql';
const NEXT = 'supabase/migrations/20261014020000_ticks.sql';
const QUEUE = 'be/src/modules/queues/receipts/receipts.queue.ts';
const CREATE = "select pgmq.create('receipts');";
const CONSTANT = "export const RECEIPTS_QUEUE = 'receipts' as const;";
const SEND = "select pgmq.send('receipts', '{}'::jsonb)";
const SCHEDULE = `select cron.schedule('receipt-tick', '* * * * *', $$${SEND}$$);`;
const TICK = `create function private.receipt_tick() returns bigint language sql as $$${SEND}$$;`;
const CALL_TICK = "select cron.schedule('receipt-tick', '* * * * *', $$select private.receipt_tick()$$);";

function fixture(t, edition, contents, supabase = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-queues-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const repo = { hfs: 3, kind: 'app', project: 'queues', edition, supabase, sides: { be: { apps: [{ name: 'api', kind: 'api' }] } } };
  const files = { 'hfs.json': JSON.stringify(repo), ...contents };
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(repoRoot, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { repoRoot, repo, files: Object.keys(files), all: Object.keys(files), inScope: () => true };
}

function judge(t, edition, contents, supabase) {
  const findings = databaseQueuesFindings(fixture(t, edition, contents, supabase));
  assert.equal(Array.isArray(findings), true, 'the finder is synchronous');
  assert.ok(findings.every((finding) => finding.level === 'error' && finding.path && finding.message));
  return findings;
}

function expectCode(t, edition, contents, code, supabase) {
  const findings = judge(t, edition, contents, supabase);
  assert.ok(findings.some((finding) => finding.code === code), `${code}: ${JSON.stringify(findings)}`);
  return findings;
}

const parityFailures = [
  ['queue constant without create', { [QUEUE]: CONSTANT }],
  ['create without queue constant', { [MIGRATION]: CREATE }],
  ['create in archive cannot own a queue', { [QUEUE]: CONSTANT, 'supabase/migrations/_archive/20261013010000_queue.sql': CREATE }],
  ['dynamic queue constant', { [QUEUE]: "export const RECEIPTS_QUEUE = queueName();", [MIGRATION]: CREATE }],
  ['dynamic pgmq.create name', { [QUEUE]: CONSTANT, [MIGRATION]: "select pgmq.create(current_setting('queue.name'));" }],
  ['pgmq.create in application SQL', { [QUEUE]: CONSTANT, [MIGRATION]: CREATE, 'be/src/modules/platform/queue/persistence/queue.sql.ts': "export const createQueue = sql`select pgmq.create('receipts')`;" }],
  ['pgmq.create in a seed', { [QUEUE]: CONSTANT, [MIGRATION]: CREATE, 'supabase/seed.sql': CREATE }],
  ['deferred SQL function queue creation', { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\ncreate function private.install_queue() returns void language sql as $$select pgmq.create('receipts')$$;` }],
  ['deferred PLpgSQL function queue creation', { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\ncreate function private.install_queue() returns void language plpgsql as $$begin perform pgmq.create('receipts'); end$$;` }],
  ['deferred SQL-standard function queue creation', { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\ncreate function private.install_queue() returns void language sql return pgmq.create('receipts');` }],
  ['dropped queue remains declared', { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\nselect pgmq.drop_queue('receipts');` }],
  ['dynamic SQL cannot own a queue', { [QUEUE]: CONSTANT, [MIGRATION]: "do $$begin execute 'select pgmq.create(''receipts'')'; end$$;" }],
  ['formatted SQL cannot own a queue', { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\ndo $$begin execute format('select pgmq.create(%L)', 'receipts'); end$$;` }],
];

const badGrants = [
  'grant select on pgmq.q_receipts to anon;',
  'grant select on pgmq.q_receipts to authenticated;',
  'grant select on pgmq.q_receipts to public;',
  'grant select on pgmq.q_receipts to app_be, anon;',
  'grant usage on schema pgmq to app_be;',
  'grant select on pgmq.meta to app_be;',
  'grant select on pgmq.q_missing to app_be;',
  'grant execute on function pgmq.send(text, jsonb) to app_be;',
  'grant execute on function pgmq_public.send(text, jsonb) to anon;',
  'grant select on all tables in schema pgmq to app_be;',
  'alter default privileges in schema pgmq grant select on tables to app_be;',
];

const badCommands = [
  "update public.orders set status = 'expired'",
  "select net.http_post('https://host.example/tick', '{}'::jsonb)",
  "select pgmq.send('missing', '{}'::jsonb)",
  "select pgmq.send('receipts', '{}'::jsonb); delete from public.orders",
  "select pgmq.send('receipts', '{}'::jsonb) from public.orders",
  "select pgmq.send('receipts', '{}'::jsonb) order by net.http_post('https://host.example/tick')",
  "select pgmq.send('receipts', '{}'::jsonb) limit net.http_post('https://host.example/tick')",
  "select pgmq.send('receipts', public.expire_orders())",
  "select pgmq.send('receipts', (with expired as (delete from public.orders returning id) select jsonb_build_object('id', id) from expired))",
  'select private.missing_tick()',
];

for (const edition of ['lite', 'full']) {
  test(`${edition}: app-root parity owns migrations while a side scope is not judged twice`, (t) => {
    const context = fixture(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: CREATE });
    assert.deepEqual(databaseQueuesFindings({ ...context, isRoot: true }), []);
    const side = { ...context, files: [QUEUE], all: [QUEUE] };
    assert.deepEqual(databaseQueuesFindings({ ...side, isRoot: false, appSide: true }), []);
    assert.ok(databaseQueuesFindings({ ...side, isRoot: true }).some((finding) => finding.code === 'DB_PGMQ_DECLARED'));
  });

  test(`${edition}: a standalone back-end scope still checks queue migration parity`, (t) => {
    const queue = QUEUE.slice(3);
    const context = fixture(t, edition, { [queue]: CONSTANT, [MIGRATION]: CREATE });
    const standalone = { ...context, repo: { ...context.repo, profile: 'be' }, isRoot: false, appSide: false };
    assert.deepEqual(databaseQueuesFindings(standalone), []);
    const findings = databaseQueuesFindings({ ...standalone, files: [queue], all: [queue] });
    assert.ok(findings.some((finding) => finding.code === 'DB_PGMQ_DECLARED' && finding.path === queue));
  });

  test(`${edition}: DB_PGMQ_DECLARED passing parity, quoted SQL and per-queue app grants`, (t) => {
    assert.deepEqual(judge(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `-- select pgmq.create('inert');\nselect "pgmq"."create"(queue_name => 'receipts'::text);\ngrant select, insert, update, delete on pgmq.q_receipts, pgmq.a_receipts to app_be;`,
    }), []);
  });

  for (const [name, contents] of parityFailures) {
    test(`${edition}: DB_PGMQ_DECLARED ${name}`, (t) => expectCode(t, edition, contents, 'DB_PGMQ_DECLARED'));
  }

  for (const grant of badGrants) {
    test(`${edition}: DB_PGMQ_DECLARED refuses ${grant}`, (t) => expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${grant}` }, 'DB_PGMQ_DECLARED'));
  }

  test(`${edition}: DB_PGMQ_DECLARED uses the declared application role`, (t) => {
    const contents = { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\ngrant select on pgmq.q_receipts, pgmq.a_receipts to receipt_be;` };
    assert.deepEqual(judge(t, edition, contents, { appRole: 'receipt_be' }), []);
    expectCode(t, edition, contents, 'DB_PGMQ_DECLARED');
  });

  test(`${edition}: DB_PGMQ_DECLARED catches grants inside DO, function and dynamic SQL bodies`, (t) => {
    for (const body of [
      'do $$begin grant select on pgmq.q_receipts to authenticated; end$$;',
      'create function private.expose_queue() returns void language sql as $$grant select on pgmq.q_receipts to anon$$;',
      "do $$begin execute 'grant select on pgmq.q_receipts to anon'; end$$;",
    ]) expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${body}` }, 'DB_PGMQ_DECLARED');
  });

  test(`${edition}: static migration DO declaration and non-secret SQL payload strings pass`, (t) => {
    assert.deepEqual(judge(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: "do $$begin perform pgmq.create('receipts'); end$$;",
      [NEXT]: "select cron.schedule('receipt-tick', '* * * * *', $job$select pgmq.send('receipts', jsonb_build_object('text', 'update public.orders; net.http_post'))$job$);",
    }), []);
  });

  test(`${edition}: queue inventory ignores source comments, inert literals and test files`, (t) => {
    assert.deepEqual(judge(t, edition, {
      [QUEUE]: `${CONSTANT}\n// export const MISSING_QUEUE = 'missing';\nexport const documentation = "select pgmq.create('missing'); cron.schedule('bad', '* * * * *', 'update public.x')";`,
      [MIGRATION]: `${CREATE}\nselect 'pgmq.create(''missing'')';`,
      'be/src/modules/queues/receipts/receipts.queue.spec.ts': "const TEST_QUEUE = 'test'; sql`select cron.schedule('bad', 'x', 'x')`;",
    }), []);
  });

  test(`${edition}: DB_CRON_OWNED passing direct enqueue and named arguments`, (t) => {
    assert.deepEqual(judge(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${SCHEDULE}` }), []);
    assert.deepEqual(judge(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\nselect cron.schedule(command => $$${SEND}$$, schedule => '* * * * *', job_name => 'receipt-tick');` }), []);
  });

  for (const command of badCommands) {
    test(`${edition}: DB_CRON_OWNED refuses command ${command}`, (t) => {
      expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\nselect cron.schedule('receipt-tick', '* * * * *', $job$${command}$job$);` }, 'DB_CRON_OWNED');
    });
  }

  test(`${edition}: DB_CRON_OWNED duplicate name across active migrations`, (t) => {
    expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${SCHEDULE}`, [NEXT]: SCHEDULE }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED literal name, cadence and command are required`, (t) => {
    for (const schedule of [
      `select cron.schedule('* * * * *', $$${SEND}$$);`,
      `select cron.schedule(current_setting('job.name'), '* * * * *', $$${SEND}$$);`,
      `select cron.schedule('receipt-tick', current_setting('job.cadence'), $$${SEND}$$);`,
      "select cron.schedule('receipt-tick', '* * * * *', current_setting('job.command'));",
      `select cron.schedule_in_database('receipt-tick', '* * * * *', $$${SEND}$$, 'other');`,
    ]) expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${schedule}` }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED source SQL and deferred functions cannot install jobs`, (t) => {
    for (const contents of [
      { 'be/src/modules/platform/queue/persistence/queue.sql.ts': `export const installTick = sql\`${SCHEDULE}\`;` },
      { 'be/src/modules/platform/queue/queue.client.ts': `manager.query(${JSON.stringify(SCHEDULE)});` },
      { 'supabase/seed.sql': SCHEDULE },
      { [NEXT]: `create function private.install_tick() returns void language sql as $fn$${SCHEDULE}$fn$;` },
      { [NEXT]: `create function private.install_tick() returns void language plpgsql as $fn$begin perform cron.schedule('receipt-tick', '* * * * *', $$${SEND}$$); end$fn$;` },
    ]) expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: CREATE, ...contents }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED one static SQL or PLpgSQL enqueue-only tick passes`, (t) => {
    for (const tick of [
      TICK,
      `create function private.receipt_tick() returns void language plpgsql as $$begin perform pgmq.send('receipts', '{}'::jsonb); end$$;`,
      `create function private.receipt_tick() returns bigint language sql return pgmq.send('receipts', '{}'::jsonb);`,
      `create function private.receipt_tick() returns bigint language sql begin atomic ${SEND}; end;`,
    ]) {
      assert.deepEqual(judge(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${tick}\n${CALL_TICK}` }), []);
    }
  });

  test(`${edition}: DB_CRON_OWNED tick body DML, dynamic SQL and network calls fail`, (t) => {
    for (const tick of [
      "create function private.receipt_tick() returns void language sql as $$update public.orders set status = 'expired'$$;",
      "create function private.receipt_tick() returns bigint language sql as $$select net.http_post('https://host.example/tick')$$;",
      "create function private.receipt_tick() returns void language plpgsql as $$begin update public.orders set status = 'expired'; perform pgmq.send('receipts', '{}'::jsonb); end$$;",
      "create function private.receipt_tick() returns void language plpgsql as $$begin execute 'select pgmq.send(''receipts'', ''{}''::jsonb)'; end$$;",
    ]) expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${tick}\n${CALL_TICK}` }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED tick arguments cannot hide business or network calls`, (t) => {
    expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${TICK}\nselect cron.schedule('receipt-tick', '* * * * *', $$select private.receipt_tick(net.http_post('https://host.example/tick'))$$);` }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED one tick cannot have two migration owners`, (t) => {
    expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}`, [NEXT]: CALL_TICK.replace('receipt-tick', 'second-tick') }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED detects a tick also declared in api schedulers`, (t) => {
    for (const declaration of [
      "export const apiOptions = { schedulers: ['receipt-tick'] };",
      "export const apiOptions = { schedulers: ['private.receipt_tick'] };",
      "export const apiOptions = { schedulers: [{ queue: 'receipts' }] };",
    ]) expectCode(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}`, 'be/apps/api/src/api.options.ts': declaration }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED follows imported scheduler constants`, (t) => {
    expectCode(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}`,
      'be/src/modules/platform/queue/queue.options.ts': "export const API_SCHEDULERS = [{ name: 'receipt-tick' }];",
      'be/apps/api/src/api.options.ts': "import { API_SCHEDULERS as schedules } from '@modules/platform/queue/queue.options'; export const apiOptions = { schedulers: schedules };",
    }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED follows shorthand scheduler options`, (t) => {
    expectCode(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}`,
      'be/apps/api/src/api.options.ts': "const schedulers = [{ name: 'receipt-tick' }]; export const apiOptions = { schedulers };",
    }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED follows barrel exports and namespace scheduler imports`, (t) => {
    for (const options of [
      "import { exportedSchedulers } from '@modules/platform/queue'; export const apiOptions = { schedulers: exportedSchedulers };",
      "import * as queueOptions from '@modules/platform/queue'; export const apiOptions = { schedulers: queueOptions.exportedSchedulers };",
      "import schedules from '../../../src/modules/platform/queue/default.js'; export const apiOptions = { schedulers: schedules };",
    ]) expectCode(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}`,
      'be/src/modules/platform/queue/queue.options.ts': "export const API_SCHEDULERS = [{ name: 'receipt-tick' }];",
      'be/src/modules/platform/queue/index.ts': "export * from './barrel.js';",
      'be/src/modules/platform/queue/barrel.ts': "export { API_SCHEDULERS as exportedSchedulers } from './queue.options.js';",
      'be/src/modules/platform/queue/default.ts': "import { API_SCHEDULERS } from './queue.options.js'; export default API_SCHEDULERS;",
      'be/apps/api/src/api.options.ts': options,
    }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED formatted dynamic SQL cannot install a cron job`, (t) => {
    expectCode(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\ndo $$begin execute format('select cron.schedule(%L, %L, %L)', 'receipt-tick', '* * * * *', '${SEND.replaceAll("'", "''")}'); end$$;`,
    }, 'DB_CRON_OWNED');
  });

  test(`${edition}: DB_CRON_OWNED unrelated scheduler and archived old jobs pass`, (t) => {
    assert.deepEqual(judge(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}`,
      'supabase/migrations/_archive/20261013010000_old.sql': `${CALL_TICK}\n${CALL_TICK}`,
      'be/apps/api/src/api.options.ts': "export const apiOptions = { schedulers: ['other-job'] };",
    }), []);
  });

  test(`${edition}: DB_CRON_OWNED removing a tick requires unschedule in the same migration`, (t) => {
    const base = { [QUEUE]: CONSTANT, [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}` };
    expectCode(t, edition, { ...base, [NEXT]: 'drop function private.receipt_tick();' }, 'DB_CRON_OWNED');
    expectCode(t, edition, { ...base, [NEXT]: "select cron.unschedule('other-job'); drop function private.receipt_tick();" }, 'DB_CRON_OWNED');
    assert.deepEqual(judge(t, edition, { ...base, [NEXT]: "select cron.unschedule('receipt-tick'); drop function private.receipt_tick();" }), []);
  });

  test(`${edition}: finder wiring and scope use all files for cross-file parity`, (t) => {
    assert.ok(FINDERS.includes(databaseQueuesFindings));
    const context = fixture(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: CREATE });
    context.files = [QUEUE];
    assert.deepEqual(databaseQueuesFindings(context), []);
    context.all = ['hfs.json', QUEUE];
    context.inScope = (file) => file === QUEUE;
    assert.ok(a15Findings(context).some((finding) => finding.code === 'DB_PGMQ_DECLARED' && finding.path === QUEUE));
    context.inScope = () => false;
    assert.deepEqual(databaseQueuesFindings(context), []);
  });

  test(`${edition}: baseline metadata preserves final active queue and cron declarations`, (t) => {
    const context = fixture(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\nselect pgmq.create('retired'); select pgmq.drop_queue('retired');\n${SCHEDULE}\ndo $$begin perform cron.unschedule('receipt-tick'); end$$;`,
      [NEXT]: SCHEDULE.replace('receipt-tick', 'current-tick'),
    });
    assert.deepEqual(databaseQueueDeclarations(context), {
      queues: ['receipts'],
      cron: [{ name: 'current-tick', schedule: '* * * * *', command: SEND }],
      grants: [],
      findings: [],
    });
  });

  test(`${edition}: baseline metadata reports invalid ownership before a cutover`, (t) => {
    const metadata = databaseQueueDeclarations(fixture(t, edition, { [QUEUE]: CONSTANT, [MIGRATION]: SCHEDULE }));
    assert.ok(metadata.findings.some((finding) => finding.code === 'DB_PGMQ_DECLARED'));
    assert.ok(metadata.findings.some((finding) => finding.code === 'DB_CRON_OWNED'));
  });

  test(`${edition}: retiring a queue, its grants and its scheduled job passes`, (t) => {
    for (const [install, remove] of [
      [SCHEDULE, ''],
      [`${TICK}\n${CALL_TICK}`, 'drop function private.receipt_tick();'],
    ]) {
      const context = fixture(t, edition, {
        [MIGRATION]: `${CREATE}\ngrant select, insert on pgmq.q_receipts to app_be;\n${install}`,
        [NEXT]: `select cron.unschedule('receipt-tick'); ${remove} select pgmq.drop_queue('receipts');`,
      });
      assert.deepEqual(databaseQueuesFindings(context), []);
      assert.deepEqual(databaseQueueDeclarations(context), { queues: [], cron: [], grants: [], findings: [] });
    }
  });

  test(`${edition}: retiring an unsafe original schedule still reports its unsafe command`, (t) => {
    expectCode(t, edition, {
      [MIGRATION]: `${CREATE}\nselect cron.schedule('receipt-tick', '* * * * *', $$delete from public.orders$$);`,
      [NEXT]: "select cron.unschedule('receipt-tick'); select pgmq.drop_queue('receipts');",
    }, 'DB_CRON_OWNED');
    expectCode(t, edition, {
      [MIGRATION]: `${CREATE}\ncreate function private.receipt_tick() returns void language sql as $$delete from public.orders$$;\n${CALL_TICK}`,
      [NEXT]: "select cron.unschedule('receipt-tick'); drop function private.receipt_tick(); select pgmq.drop_queue('receipts');",
    }, 'DB_CRON_OWNED');
  });

  test(`${edition}: a live job whose queue was removed remains an orphan`, (t) => {
    expectCode(t, edition, { [MIGRATION]: `${CREATE}\n${SCHEDULE}`, [NEXT]: "select pgmq.drop_queue('receipts');" }, 'DB_CRON_OWNED');
  });

  test(`${edition}: an active job validates the latest tick body as well as its original body`, (t) => {
    expectCode(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\n${TICK}\n${CALL_TICK}`,
      [NEXT]: "create or replace function private.receipt_tick() returns bigint language sql as $$delete from public.orders returning 1$$;",
    }, 'DB_CRON_OWNED');
  });

  test(`${edition}: baseline metadata replays queue grants, revokes and grant options`, (t) => {
    const context = fixture(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\ngrant select, insert on pgmq.q_receipts to receipt_be with grant option; grant select on pgmq.a_receipts to receipt_be;`,
      [NEXT]: 'revoke insert on pgmq.q_receipts from receipt_be; revoke grant option for select on pgmq.q_receipts from receipt_be;',
    }, { appRole: 'receipt_be' });
    assert.deepEqual(databaseQueueDeclarations(context), {
      queues: ['receipts'], cron: [],
      grants: [
        { privileges: ['select'], tables: ['pgmq.q_receipts'], roles: ['receipt_be'], grantOption: false },
        { privileges: ['select'], tables: ['pgmq.a_receipts'], roles: ['receipt_be'], grantOption: false },
      ],
      findings: [],
    });
  });

  test(`${edition}: deferred grants do not become baseline operational grants`, (t) => {
    const context = fixture(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\ncreate function private.configure_queue() returns void language sql as $$grant select on pgmq.q_receipts to app_be$$;`,
    });
    assert.deepEqual(databaseQueueDeclarations(context).grants, []);
  });

  test(`${edition}: recreated queues do not retain old grants`, (t) => {
    const context = fixture(t, edition, {
      [QUEUE]: CONSTANT,
      [MIGRATION]: `${CREATE}\ngrant select on pgmq.q_receipts to app_be;`,
      [NEXT]: `select pgmq.drop_queue('receipts'); ${CREATE}\ngrant insert on pgmq.q_receipts to app_be;`,
    });
    assert.deepEqual(databaseQueueDeclarations(context).grants, [
      { privileges: ['insert'], tables: ['pgmq.q_receipts'], roles: ['app_be'], grantOption: false },
    ]);
  });
}

test('full repositories without Supabase stay outside the queue rule', (t) => {
  const context = fixture(t, 'full', { [QUEUE]: CONSTANT });
  context.repo = { ...context.repo, supabase: undefined };
  fs.writeFileSync(path.join(context.repoRoot, 'hfs.json'), JSON.stringify(context.repo));
  assert.deepEqual(databaseQueuesFindings(context), []);
});
