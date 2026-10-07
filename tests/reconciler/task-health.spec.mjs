import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceItems } from '../../scripts/reconciler/start-items.mjs';
import { startDownServices } from '../../scripts/reconciler/start-apply.mjs';
import { RECONCILER_SERVICE, SERVICE_TASKS, reconcilerTaskItem, reconcilerTaskProbe, serviceTaskNote, startOutcome, taskItems } from '../../scripts/reconciler/task-health.mjs';
import { TASK_DEFINITIONS } from '../../scripts/machine/task-register.mjs';

const audit = (key, over = {}) => ({ name: key, taskName: TASK_DEFINITIONS[key].taskName, ok: true, problem: null, state: 'Ready', lastResult: 0, reason: null, fix: null, ...over });
const stale = (key) => audit(key, { ok: false, problem: 'action-stale', reason: `Windows task '${TASK_DEFINITIONS[key].taskName}' runs "old" but a registration today writes "new"`, fix: `starci task register ${key} --apply` });
const result = (audits) => ({ ok: true, audits });

test('every service that runs through a task maps to a task the runtime can register', () => {
  assert.deepEqual(Object.keys(SERVICE_TASKS).sort(), ['harness-tunnel', 'harness-ui', RECONCILER_SERVICE].sort());
  for (const key of Object.values(SERVICE_TASKS)) assert.ok(TASK_DEFINITIONS[key], key);
  assert.equal(RECONCILER_SERVICE, 'sched-task:StarCi-Reconciler');
});

test('the reconciler task probe is healthy only on a registered, enabled, current task with its shim', async () => {
  const ok = await reconcilerTaskProbe({ audit: async () => result({ reconciler: audit('reconciler') }), allowTaskRepair: false });
  assert.deepEqual([ok.ok, ok.exists, ok.status, ok.unmanaged], [true, true, 'Ready', undefined]);
  const old = await reconcilerTaskProbe({ audit: async () => result({ reconciler: stale('reconciler') }), allowTaskRepair: false });
  assert.deepEqual([old.ok, old.exists, old.unmanaged, old.audit.problem], [false, true, undefined, 'action-stale']);
});

test('a missing reconciler task is unmanaged unless repair is allowed; an unreadable scheduler carries its error', async () => {
  const missing = audit('reconciler', { ok: false, problem: 'missing', state: null });
  assert.equal((await reconcilerTaskProbe({ audit: async () => result({ reconciler: missing }), allowTaskRepair: false })).unmanaged, true);
  assert.equal((await reconcilerTaskProbe({ audit: async () => result({ reconciler: missing }), allowTaskRepair: true })).unmanaged, undefined);
  const unreadable = await reconcilerTaskProbe({ audit: async () => ({ ok: false, error: 'access denied' }), allowTaskRepair: true });
  assert.deepEqual([unreadable.ok, unreadable.error, unreadable.unmanaged], [false, 'access denied', undefined]);
});

test('the reconciler task row says why it is not healthy, with the exact fix', () => {
  const row = (detail, extra = {}) => reconcilerTaskItem({ name: RECONCILER_SERVICE, ok: false, unmanaged: false, detail, ...extra });
  const green = reconcilerTaskItem({ name: RECONCILER_SERVICE, ok: true, detail: { audit: audit('reconciler') } });
  assert.equal(green.status, 'green');
  assert.match(green.detail, /action current, shim present \(state Ready, last result 0x0\)/);
  const old = row({ audit: stale('reconciler') });
  assert.equal(old.status, 'red');
  assert.match(old.detail, /runs "old"/);
  assert.equal(old.fix, 'starci reconciler up --services (or starci task register reconciler --apply)');
  const shim = row({ audit: audit('reconciler', { ok: false, problem: 'shim-missing', reason: 'the per-user shim X does not exist', fix: 'starci runtime link' }) });
  assert.deepEqual([shim.status, shim.fix], ['red', 'starci reconciler up --services (or starci runtime link)']);
  const missing = row({ audit: audit('reconciler', { ok: false, problem: 'missing' }) }, { unmanaged: true });
  assert.deepEqual([missing.status, missing.detail], ['warn', 'missing (unmanaged)']);
  const unreadable = row({ error: 'timeout' });
  assert.equal(unreadable.status, 'warn');
  assert.match(unreadable.detail, /unreadable: timeout/);
});

test('the harness app and tunnel tasks get a readiness row each; a task that cannot work is red but never blocks workflow ingress', () => {
  assert.deepEqual(taskItems(null), []);
  const rows = taskItems(result({ 'harness-app': stale('harness-app'), 'harness-tunnel': audit('harness-tunnel'), reconciler: audit('reconciler') }));
  assert.deepEqual(rows.map((r) => [r.id, r.status, r.required]), [['task:harness-app', 'red', false], ['task:harness-tunnel', 'green', true]]);
  assert.equal(rows[0].name, 'scheduled task StarCi Harness App');
  assert.equal(rows[0].fix, 'starci reconciler up --services (or starci task register harness-app --apply)');
  const unreadable = taskItems({ ok: false, error: 'x' });
  assert.deepEqual(unreadable.map((r) => [r.id, r.status]), [['task:scheduler', 'warn']]);
});

test('a down harness UI row says why: the task problem and its fix, or the task state and last result', () => {
  const down = { name: 'harness-ui', ok: false, unmanaged: false, detail: { error: 'connect ECONNREFUSED 127.0.0.1:4547' } };
  const [bad] = serviceItems([down], { audits: { 'harness-app': stale('harness-app') } });
  assert.equal(bad.status, 'red');
  assert.match(bad.detail, /^down: connect ECONNREFUSED 127\.0\.0\.1:4547; Windows task 'StarCi Harness App' runs "old"/);
  assert.equal(bad.fix, 'starci reconciler up --services (or starci task register harness-app --apply)');
  const [fine] = serviceItems([down], { audits: { 'harness-app': audit('harness-app', { lastResult: 267011 }) } });
  assert.match(fine.detail, /; task 'StarCi Harness App' state Ready, last result 0x41303$/);
  assert.equal(fine.fix, 'starci reconciler up --services');
  const [plain] = serviceItems([down]);
  assert.equal(plain.detail, 'down: connect ECONNREFUSED 127.0.0.1:4547');
  const [up] = serviceItems([{ name: 'harness-ui', ok: true, detail: { status: 200 } }], { audits: { 'harness-app': stale('harness-app') } });
  assert.equal(up.status, 'green');
  assert.doesNotMatch(up.detail, /task/);
  assert.equal(serviceTaskNote('ask-gateway', { 'harness-app': stale('harness-app') }), null);
});

const api = (over = {}) => {
  const calls = [];
  return { calls, auditTasks: async () => result({ 'harness-app': audit('harness-app', { state: 'Ready', lastResult: 1 }) }), sleep: async () => { calls.push('sleep'); },
    probeServices: async ({ names }) => { calls.push(`probe ${names}`); return [{ name: names[0], ok: false, detail: { error: 'ECONNREFUSED' } }]; }, ...over };
};
const probe = (startTimeoutMs = 1) => ({ name: 'harness-ui', ok: false, detail: {}, entry: { startTimeoutMs } });

test('a requested start whose task cannot work says so at once and does not wait', async () => {
  const fake = api({ auditTasks: async () => result({ 'harness-app': stale('harness-app') }) });
  const line = await startOutcome(fake, probe(60_000));
  assert.match(line, /^start requested, but the task cannot work: Windows task 'StarCi Harness App' runs "old".*; fix: starci task register harness-app --apply$/);
  assert.deepEqual(fake.calls, []);
});

test('a requested start that never becomes healthy within startTimeoutMs reports the cause and the task state and last result', async () => {
  const fake = api({ sleep: () => new Promise((resolve) => { fake.calls.push('sleep'); setTimeout(resolve, 15); }) });
  const line = await startOutcome(fake, probe(30));
  assert.match(line, /^start requested, NOT healthy after \d+s \(ECONNREFUSED\); task 'StarCi Harness App' state Ready, last result 0x1, so its process is not running$/);
  assert.ok(fake.calls.filter((call) => call === 'sleep').length >= 1);
  assert.ok(fake.calls.every((call) => call === 'sleep' || call === 'probe harness-ui'));
});

test('a requested start that answers on a later probe is reported healthy', async () => {
  let probes = 0;
  const fake = api({ probeServices: async ({ names }) => { probes += 1; return [{ name: names[0], ok: probes >= 3, detail: {} }]; } });
  assert.match(await startOutcome(fake, probe(60_000)), /^start requested, healthy after \d+s$/);
  assert.equal(probes, 3);
});

test('a requested start with an unreadable Task Scheduler still waits and then says the scheduler could not be read', async () => {
  const fake = api({ auditTasks: async () => ({ ok: false, error: 'access denied' }) });
  assert.match(await startOutcome(fake, probe(1)), /NOT healthy after \d+s \(ECONNREFUSED\); Task Scheduler unreadable: access denied$/);
});

test('a service that does not run through a task keeps the plain line', async () => {
  assert.equal(await startOutcome(api(), { name: 'ask-gateway', entry: {} }), 'start requested');
});

test('startDownServices records the outcome of each requested task start, and a failed Run request as before', async () => {
  const applied = [];
  const down = (name) => ({ name, ok: false, detail: {}, entry: { restart: true, startTimeoutMs: 1 } });
  const fake = api({
    auditTasks: async () => result({ 'harness-app': stale('harness-app'), 'harness-tunnel': audit('harness-tunnel') }),
    startService: async (name) => (name === 'harness-tunnel' ? { ok: false, error: 'access denied' } : { ok: true }),
    loadConfig: () => ({}),
  });
  fake.probeServices = async (options) => (options ? [{ name: options.names[0], ok: false, detail: {} }] : [down('harness-ui'), down('harness-tunnel')]);
  await startDownServices(fake, { loadConfig: () => ({}), rebuilt: false }, applied);
  assert.equal(applied.length, 2);
  assert.match(applied[0], /^service harness-ui: start requested, but the task cannot work: .*starci task register harness-app --apply$/);
  assert.equal(applied[1], 'service harness-tunnel: start FAILED access denied');
});
