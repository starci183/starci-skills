import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { applyHost, ensureHostRuntime, main } from '../../scripts/reconciler/start.mjs';
import { healLauncherAndTasks, isLauncherOrTaskRow, registerTask, runtimeLink } from '../../scripts/reconciler/start-heal.mjs';
import { renderBrief } from '../../scripts/reconciler/start-render.mjs';
import { coreDebugRow, kernelSeatItems, seatNeed, supervisorRow } from '../../scripts/reconciler/seat-items.mjs';
import { green, red, warn } from '../../scripts/reconciler/checklist-items.mjs';
import { launcherItem, taskItems } from '../../scripts/reconciler/task-health.mjs';
import { auditTask } from '../../scripts/machine/task-audit.mjs';
import { TASK_DEFINITIONS, registeredAction } from '../../scripts/machine/task-register.mjs';

const SHIM = path.win32.join('fixture-home', '.starci', 'bin', 'starci.cmd');
const ROOT = 'fixture-windows';
const KEYS = Object.keys(TASK_DEFINITIONS);
const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };

/** A host model: the launcher shim and each task (missing | stale | ok) answer through the same seams the heal calls. */
function fakeHost({ shim = true, tasks = {} } = {}) {
  const state = { shim, tasks: Object.fromEntries(KEYS.map((key) => [key, tasks[key] ?? 'ok'])), linked: 0, registered: [], seats: [] };
  const rowOf = (key) => {
    if (state.tasks[key] === 'missing') return null;
    const action = state.tasks[key] === 'stale' ? 'old action' : registeredAction(key, { systemRoot: ROOT, starci: SHIM });
    return { state: 'Ready', action, lastResult: 0 };
  };
  const audits = () => Object.fromEntries(KEYS.map((key) => [key, auditTask(key, rowOf(key), { shim: SHIM, shimExists: state.shim, systemRoot: ROOT })]));
  return {
    state,
    auditTasks: async () => ({ ok: true, audits: audits() }),
    runtimeLink: async () => { state.linked += 1; state.shim = true; return { ok: true, shim: SHIM }; },
    registerTask: async (key) => {
      state.tasks[key] = 'ok';
      state.registered.push(key);
      return { ok: true, taskName: TASK_DEFINITIONS[key].taskName, action: TASK_DEFINITIONS[key].action, scriptSha256: `sha-${key}` };
    },
  };
}

/** The apply seams of a host whose engine runs, with every agent-seat seam recording its call in host.state.seats. */
function applySeams(host, over = {}) {
  const seat = (name, value) => async () => { host.state.seats.push(name); return value; };
  return {
    uiBuildState: () => ({ stale: false, reason: 'current' }), leaderState: () => ({ fresh: true }), reconcilerNumbers: () => NUMBERS,
    crashLoopRecord: () => ({ starts: [] }), status: () => ({ modes: {} }), sleep: async () => {}, loadConfig: () => ({}),
    probeServices: async () => [], auditTasks: host.auditTasks, runtimeLink: host.runtimeLink, registerTask: host.registerTask,
    probeOrcaAsync: seat('orca', { ok: true }),
    supervisorMode: () => { host.state.seats.push('mode'); return 'kernel'; },
    json: seat('supervisor-or-watchdog', { ok: true, action: 'launched' }), kernelSeatItems: seat('kernel', []), ...over,
  };
}

const idleSeat = green('seats', 'supervisor', 'Supervisor seat', 'not running (starts with a workflow)', { required: false, idle: true });

test('the brief is one all-green line for a healthy host and lists an idle seat without calling it a problem', () => {
  const rows = [green('engine', 'engine', 'reconciler engine', 'leader'), green('services', 'harness-ui', 'harness UI', 'up'), idleSeat];
  assert.equal(renderBrief(rows), 'HOST all green: 3 rows\nSEATS\n  [IDLE]  Supervisor seat - not running (starts with a workflow)');
  assert.equal(renderBrief(rows.slice(0, 2)), 'HOST all green: 2 rows');
});

test('the brief of a mixed host lists only the rows that are not green, grouped, each red row with its fix', () => {
  const rows = [
    green('preflight', 'node-sqlite', 'Node bundled SQLite', 'ok'),
    green('engine', 'engine', 'reconciler engine', 'leader'),
    red('services', 'harness-ui', 'harness UI (local /healthz)', 'down: connect ECONNREFUSED', 'starci reconciler up --services'),
    warn('services', 'sched-task:StarCi-Reconciler', 'scheduled task StarCi-Reconciler', 'missing (unmanaged)', 'starci reconciler up --services'),
    green('services', 'ask-gateway', 'ask gateway', 'up'),
    idleSeat,
  ];
  assert.equal(renderBrief(rows, { applied: ['started harness UI'] }), [
    'HOST RED: 1 red, 1 warn, 4 green (1 idle)',
    'SERVICES',
    '  [RED]   harness UI (local /healthz) - down: connect ECONNREFUSED',
    '           fix: starci reconciler up --services',
    '  [WARN]  scheduled task StarCi-Reconciler - missing (unmanaged)',
    '           fix: starci reconciler up --services',
    'SEATS',
    '  [IDLE]  Supervisor seat - not running (starts with a workflow)',
    'APPLIED',
    '  started harness UI',
  ].join('\n'));
  assert.match(renderBrief([red('services', 'x', 'x', 'd', 'run it', { required: false })]), /^HOST RED: 1 red/, 'an optional red row still shows');
});

test('a missing launcher shim is linked, and the tasks that were waiting on it are then checked', async () => {
  const host = fakeHost({ shim: false });
  const applied = [];
  await healLauncherAndTasks(host, { env: {} }, applied);
  assert.equal(host.state.linked, 1);
  assert.deepEqual(host.state.registered, [], 'a current task is not re-registered');
  assert.deepEqual(applied, [`linked launcher ${SHIM}`]);
});

test('a missing task is registered and a stale task action is re-registered, each with the hash of the script applied', async () => {
  const host = fakeHost({ tasks: { 'harness-app': 'missing', reconciler: 'stale' } });
  const applied = [];
  await healLauncherAndTasks(host, { env: {} }, applied);
  assert.deepEqual(host.state.registered, ['harness-app', 'reconciler']);
  assert.deepEqual(applied, [
    'registered task StarCi Harness App (starci harness start; script sha256:sha-harness-app; review with starci task register harness-app)',
    're-registered task StarCi-Reconciler (starci reconciler start; script sha256:sha-reconciler; review with starci task register reconciler)',
  ]);
  const again = [];
  await healLauncherAndTasks(host, { env: {} }, again);
  assert.deepEqual(again, [], 'the heal is idempotent: a current host applies nothing');
});

test('the heal reports a failed registration or link, and says when the scheduler cannot be read', async () => {
  const applied = [];
  await healLauncherAndTasks({ ...fakeHost({ tasks: { reconciler: 'missing' } }), registerTask: async () => ({ ok: false, error: 'access denied' }) }, { env: {} }, applied);
  assert.deepEqual(applied, ['task StarCi-Reconciler registration FAILED: access denied']);
  const failedLink = [];
  await healLauncherAndTasks({ ...fakeHost({ shim: false }), runtimeLink: async () => ({ ok: false, error: 'EPERM' }) }, { env: {} }, failedLink);
  assert.deepEqual(failedLink, ['launcher link FAILED: EPERM']);
  const unreadable = [];
  await healLauncherAndTasks({ auditTasks: async () => ({ ok: false, error: 'timeout' }) }, { env: {} }, unreadable);
  assert.deepEqual(unreadable, ['launcher and tasks not checked: Task Scheduler unreadable (timeout)']);
});

test('the checklist has a launcher row, and the launcher and task rows are the ones the heal repairs', async () => {
  const audit = await fakeHost({ shim: false, tasks: { 'harness-tunnel': 'stale' } }).auditTasks();
  const [row] = launcherItem(audit);
  assert.deepEqual([row.id, row.status, row.required, row.fix], ['launcher-shim', 'red', false, 'starci reconciler up --services (or starci runtime link)']);
  assert.equal(launcherItem(null).length, 0);
  const rows = [row, ...taskItems(audit)];
  assert.deepEqual(rows.filter(isLauncherOrTaskRow).map((r) => r.id), ['launcher-shim', 'task:harness-app', 'task:harness-tunnel']);
  assert.equal(launcherItem(await fakeHost().auditTasks())[0].status, 'green');
});

test('the services-only heal links the shim, registers the tasks, rebuilds the UI and starts what is down, and never reaches an agent seat', async () => {
  const host = fakeHost({ shim: false, tasks: { 'harness-app': 'missing', 'harness-tunnel': 'stale' } });
  const started = [], builds = [];
  let uiUp = false;
  const down = (name) => ({ name, ok: false, detail: {}, entry: { restart: true, startTimeoutMs: 1 } });
  const seams = applySeams(host, {
    uiBuildState: () => ({ stale: true, reason: 'ui/dist is older than ui/src' }),
    buildUi: async () => { builds.push('build'); return { ok: true }; },
    probeServices: async (options) => {
      if (options?.names) return [{ name: options.names[0], ok: uiUp, detail: {} }];
      return [down('harness-ui'), { name: 'ask-gateway', ok: true, detail: {} }];
    },
    startService: async (name) => { started.push(name); uiUp = true; return { ok: true }; },
  });
  const applied = await applyHost({ scope: 'services', noBuild: false, waitMs: 0, workflowSeats: true, platform: 'win32' }, seams);
  assert.equal(host.state.linked, 1);
  assert.deepEqual(host.state.registered, ['harness-app', 'harness-tunnel']);
  assert.deepEqual(builds, ['build']);
  assert.deepEqual(started, ['harness-ui'], 'the UI was down, so it is started; the build ran before it, so no second restart is needed');
  assert.match(applied[0], /^ui\/dist rebuilt/);
  assert.equal(applied[1], `linked launcher ${SHIM}`);
  assert.match(applied[2], /^registered task StarCi Harness App /);
  assert.match(applied[3], /^re-registered task StarCi Harness Tunnel /);
  assert.match(applied[4], /^service harness-ui: start requested, healthy after/);
  assert.equal(applied.length, 5);
  assert.deepEqual(host.state.seats, [], 'no Orca probe, Supervisor mode read, Supervisor start, Kernel watchdog or core debug call');
});

test('the full path is the one that reaches the Supervisor seat, after the same heal', async () => {
  const host = fakeHost({ tasks: { reconciler: 'stale' } });
  await applyHost({ noBuild: true, waitMs: 0, workflowSeats: false, platform: 'win32' }, applySeams(host));
  assert.deepEqual(host.state.registered, ['reconciler']);
  assert.deepEqual(host.state.seats, ['orca', 'mode', 'supervisor-or-watchdog']);
});

test('workflow start heals a stale task before it proceeds and its receipt lists the action', async () => {
  const host = fakeHost({ tasks: { 'harness-app': 'stale' } });
  const order = [];
  const seams = applySeams(host, {
    registerTask: async (key, options) => { order.push(`register ${key}`); return host.registerTask(key, options); },
    probeServices: async (options) => {
      order.push('probe');
      if (options?.names) return [{ name: 'harness-ui', ok: true, detail: {} }];
      return [{ name: 'harness-ui', ok: false, detail: {}, entry: { restart: true, startTimeoutMs: 1 } }];
    },
    startService: async () => { order.push('start harness-ui'); return { ok: true }; },
  });
  const applied = await applyHost({ noBuild: true, waitMs: 0, workflowSeats: false, platform: 'win32' }, seams);
  assert.deepEqual(order.slice(0, 3), ['register harness-app', 'probe', 'start harness-ui']);
  assert.match(applied[0], /^re-registered task StarCi Harness App /);
  assert.match(applied[1], /^service harness-ui: start requested, healthy/, 'the start no longer reports a task that cannot work');
});

test('a host whose only problem is a stale task or a missing shim is applied, never skipped as green', async () => {
  const rows = [
    red('services', 'task:harness-app', 'scheduled task', 'stale', 'fix', { required: false }),
    red('services', 'launcher-shim', 'launcher shim', 'missing', 'fix', { required: false }),
  ];
  for (const row of rows) {
    let healed = false;
    const result = await ensureHostRuntime({ waitMs: 0, workflowSeats: false }, {
      gather: async () => (healed ? [] : [row]), applyHost: async () => { healed = true; return ['healed']; },
    });
    assert.deepEqual([healed, result.ok, result.applied], [true, true, ['healed']]);
  }
  let calls = 0;
  await ensureHostRuntime({ waitMs: 0 }, { gather: async () => [green('services', 'task:harness-app', 'scheduled task', 'ok')], applyHost: async () => { calls += 1; return []; } });
  assert.equal(calls, 0);
});

test('the services scope and a check read seats as a read-only pass; only a start path requires every seat', async () => {
  const reads = [];
  const gather = async (options) => { reads.push(options); return []; };
  await ensureHostRuntime({ waitMs: 0, scope: 'services' }, { gather, applyHost: async () => [] });
  await ensureHostRuntime({ waitMs: 0, check: true }, { gather, applyHost: async () => { throw new Error('check applied'); } });
  await ensureHostRuntime({ waitMs: 0 }, { gather, applyHost: async () => [] });
  assert.deepEqual(reads.map((o) => [o.seatsRequested, o.coreDebug]), [[false, true], [false, true], [true, false]]);
});

test('a seat that is not running is idle without a running workflow and red once a running workflow needs it', async () => {
  assert.deepEqual(await seatNeed({ seatsRequested: true }), { needed: true, rows: null });
  assert.deepEqual(await seatNeed({ seatsRequested: false }, { running: async () => [] }), { needed: false, rows: [] });
  const busy = [{ repo: 'work/app', workflowId: 'wf-1' }];
  assert.deepEqual(await seatNeed({ seatsRequested: false }, { running: async () => busy }), { needed: true, rows: busy });
  assert.equal((await seatNeed({ seatsRequested: false }, { running: async () => { throw new Error('ledger unreadable'); } })).needed, false);

  const dead = async () => ({ health: { live: false, reason: 'no seat terminal' } });
  const live = async () => ({ health: { live: true, terminal: 'term-1' } });
  const input = { env: {}, config: { supervisor: { mode: 'kernel' } }, orca: true, seats: true, orcaProbe: { ok: true } };
  const idle = await supervisorRow({ ...input, needed: false, read: dead });
  assert.deepEqual([idle.status, idle.required, idle.idle, idle.detail], ['green', false, true, 'not running (starts with a workflow)']);
  const needed = await supervisorRow({ ...input, needed: true, read: dead });
  assert.deepEqual([needed.status, needed.required, needed.detail, needed.fix], ['red', true, 'not live: no seat terminal', 'starci supervisor start --json']);
  assert.equal((await supervisorRow({ ...input, needed: false, read: live })).detail, 'live (term-1)');
  assert.equal((await supervisorRow({ ...input, needed: false, read: async () => null })).status, 'warn');
  const noOrca = { ...input, orcaProbe: { ok: false } };
  assert.equal((await supervisorRow({ ...noOrca, needed: false })).idle, true);
  assert.equal((await supervisorRow({ ...noOrca, needed: true })).status, 'red');
});

test('the core debug seat is idle while nothing needs it and red when a running workflow does', async () => {
  const notReady = () => ({ ready: false, health: { reason: 'no native worker' } });
  const idle = await coreDebugRow({}, { needed: false, status: notReady });
  assert.deepEqual([idle.status, idle.idle, idle.detail], ['green', true, 'not running (starts with a workflow)']);
  const needed = await coreDebugRow({}, { needed: true, status: notReady });
  assert.deepEqual([needed.status, needed.required, needed.detail], ['red', true, 'no native worker']);
  assert.equal((await coreDebugRow({}, { needed: false, status: () => ({ ready: true }) })).idle, undefined);
});

test('Kernel seats are listed per running workflow: none is one green line, an unreachable Orca is red for each', async () => {
  const none = await kernelSeatItems({ rows: [] });
  assert.deepEqual([none.length, none[0].status, none[0].detail, none[0].required], [1, 'green', 'no running workflow', false]);
  const rows = [{ repo: 'work/app', workflowId: 'wf-1' }, { repo: 'work/app', workflowId: 'wf-2' }];
  const down = await kernelSeatItems({ rows, orcaOk: false });
  assert.deepEqual(down.map((r) => [r.id, r.status, r.detail]), [
    ['seat:kernel:app:wf-1', 'red', 'Orca is not reachable'],
    ['seat:kernel:app:wf-2', 'red', 'Orca is not reachable'],
  ]);
});

test('up --services takes no check, profile or retirement, heals the services scope only and never launches maintenance', async () => {
  const previousExit = process.exitCode, requests = [], printed = [], errors = [];
  const original = console.error;
  console.error = (text) => errors.push(text);
  try {
    for (const argv of [['--services', '--check'], ['--services', '--set-profile', 'operational'], ['--services', '--retire-stale-ledgers']]) {
      await main(argv, { ensureHostRuntime: async () => { throw new Error('ran'); } });
      assert.equal(process.exitCode, 2, argv.join(' '));
    }
    assert.equal(errors.length, 3);
    process.exitCode = undefined;
    const deps = {
      loadConfig: () => ({ debug: true }), print: (text) => printed.push(text),
      ensureDebug: async () => { throw new Error('the services heal launched maintenance'); },
      ensureHostRuntime: async (input) => {
        requests.push(input);
        return { ok: true, summary: { ok: true }, applied: ['linked launcher'], items: [green('engine', 'engine', 'reconciler engine', 'up')] };
      },
    };
    await main(['--services', '--brief'], deps);
    assert.deepEqual([requests[0].scope, requests[0].check], ['services', false]);
    assert.equal(printed[0], 'HOST all green: 1 rows\nAPPLIED\n  linked launcher');
    await main(['--check', '--brief', '--json'], deps);
    assert.equal(JSON.parse(printed[1]).ok, true, 'JSON wins over --brief and keeps its shape');
    assert.equal(requests[1].scope, 'full');
    assert.equal(process.exitCode, 0);
  } finally { console.error = original; process.exitCode = previousExit; }
});

test('the default registration is task register --apply with no review step, and the default link is runtime link for this runtime', async () => {
  const seen = [];
  const register = async (ctx) => { seen.push(ctx); return { code: 0, data: { taskName: 'StarCi-Reconciler', action: 'starci reconciler start', scriptSha256: 'abc' } }; };
  assert.deepEqual(await registerTask('reconciler', { env: { A: '1' } }, { register }), { ok: true, taskName: 'StarCi-Reconciler', action: 'starci reconciler start', scriptSha256: 'abc' });
  assert.deepEqual(seen[0], { positionals: ['reconciler'], args: { apply: true }, env: { A: '1' } });
  const failed = await registerTask('reconciler', {}, { register: async () => ({ code: 1, stderr: 'denied', data: { taskName: 'StarCi-Reconciler' } }) });
  assert.deepEqual([failed.ok, failed.error], [false, 'denied']);
  const calls = [];
  const run = async (args, options) => { calls.push({ args, options }); return { error: null, stdout: JSON.stringify({ shim: SHIM, runtimeJson: 'r' }), stderr: '' }; };
  assert.deepEqual(await runtimeLink({ env: {} }, { run }), { ok: true, shim: SHIM });
  assert.deepEqual(calls[0].args.slice(1), ['runtime', 'link', '--root', calls[0].args[4], '--json']);
  assert.equal(calls[0].args[0].endsWith('starci.mjs'), true);
  assert.deepEqual(await runtimeLink({}, { run: async () => ({ error: new Error('exit 1'), stdout: '', stderr: 'no runtime root' }) }), { ok: false, error: 'no runtime root' });
});

test('both entry points are quiet and effect-free on a healthy host, so an interval can call them', async () => {
  const healthy = [green('engine', 'engine', 'reconciler engine', 'up'), green('services', 'task:harness-app', 'scheduled task', 'ok'), idleSeat];
  let effects = 0;
  const deps = { gather: async () => healthy, applyHost: async () => { effects += 1; return ['x']; } };
  const heal = await ensureHostRuntime({ waitMs: 0, scope: 'services' }, deps);
  const check = await ensureHostRuntime({ waitMs: 0, check: true }, deps);
  assert.deepEqual([effects, heal.applied, check.applied], [0, [], []]);
  assert.equal(renderBrief(heal.items, { applied: heal.applied }), renderBrief(check.items, { applied: check.applied }), 'the same state renders the same text');
});
