// reconcilerOwns(concern) (scripts/reconciler/owns.mjs; DESIGN §7.9): an old loop yields a duty only while the leader
// heartbeat is fresh AND the owning controller runs active; any error is false. And the yields themselves step aside.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcilerOwns, resetOwnsCache, yieldTo, CONCERN_OWNER, CONCERNS } from '../scripts/reconciler/owns.mjs';
import { tempState } from '../scripts/reconciler/testing.mjs';
import { parseYaml } from '../engine/yaml.mjs';
import { runWatchdogLoop } from '../scripts/kernel/watchdog.mjs';
import { resumeAll } from '../scripts/kernel/resume-all.mjs';
import { runLoop } from '../scripts/supervisor/watchdog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = 5_000_000;

function seed(st, { heartbeatAt = NOW - 1000, modes = {} } = {}) {
  st.db.prepare("INSERT INTO leader(name,holder,pid,epoch,heartbeat_at,expires_at,rev) VALUES('reconciler','h',1,1,?,?,NULL) ON CONFLICT(name) DO UPDATE SET heartbeat_at=excluded.heartbeat_at")
    .run(heartbeatAt, heartbeatAt + 30000);
  st.db.exec('DELETE FROM modes');
  for (const [c, m] of Object.entries(modes)) st.db.prepare('INSERT INTO modes(controller,mode,set_at) VALUES(?,?,?)').run(c, m, NOW);
  resetOwnsCache();
}

test('off and shadow never own; active with a fresh heartbeat owns; a stale heartbeat does not', (t) => {
  const st = tempState();
  t.after(() => st.close());
  const ask = (concern, now = NOW) => reconcilerOwns(concern, { env: st.env, now, staleMs: 60000 });
  seed(st, { modes: { job: 'off', host: 'shadow', gc: 'active' } });
  assert.equal(ask('job.settle'), false, 'off');
  assert.equal(ask('host.kernel-seat'), false, 'shadow');
  assert.equal(ask('gc.sweep'), true, 'active + fresh');
  assert.equal(ask('fleet.push'), false, 'a controller with no mode row');
  assert.equal(ask('no.such-concern'), false);
  seed(st, { heartbeatAt: NOW - 61_000, modes: { gc: 'active' } });
  assert.equal(ask('gc.sweep'), false, 'stale heartbeat: the old loop takes the duty back');
  seed(st, { heartbeatAt: 0, modes: { gc: 'active' } });
  assert.equal(ask('gc.sweep'), false, 'a released leader row');
});

test('the answer is cached 5 s per state file', (t) => {
  const st = tempState();
  t.after(() => st.close());
  seed(st, { modes: { gc: 'active' } });
  let reads = 0;
  const read = (file) => { reads += 1; return { heartbeatAt: NOW - 1000, modes: { gc: 'active' } }; };
  assert.equal(reconcilerOwns('gc.sweep', { env: st.env, now: NOW, staleMs: 60000, read }), true);
  assert.equal(reconcilerOwns('gc.housekeeping', { env: st.env, now: NOW + 4000, staleMs: 60000, read }), true);
  assert.equal(reads, 1);
  reconcilerOwns('gc.sweep', { env: st.env, now: NOW + 5000, staleMs: 60000, read });
  assert.equal(reads, 2);
});

test('a corrupt or missing state DB is false and never throws; the test runner never reads the live host', (t) => {
  const st = tempState();
  t.after(() => st.close());
  const bad = path.join(st.dir, 'corrupt.sqlite');
  fs.writeFileSync(bad, 'this is not a sqlite database at all, just bytes '.repeat(200));
  resetOwnsCache();
  assert.equal(reconcilerOwns('gc.sweep', { env: { ...st.env, STARCI_RECONCILER_STATE: bad }, now: NOW }), false);
  resetOwnsCache();
  assert.equal(reconcilerOwns('gc.sweep', { env: { ...st.env, STARCI_RECONCILER_STATE: path.join(st.dir, 'absent.sqlite') }, now: NOW }), false);
  resetOwnsCache();
  assert.equal(reconcilerOwns('gc.sweep', { env: { NODE_TEST_CONTEXT: 'child' }, now: NOW }), false, 'no explicit state file under the test runner');
  assert.equal(reconcilerOwns('gc.sweep', { env: st.env, now: NOW, read: () => { throw Error('boom'); } }), false);
  const record = [];
  assert.equal(yieldTo('gc.sweep', record, { owns: () => { throw Error('boom'); } }), false);
  assert.equal(yieldTo('gc.sweep', record, { owns: () => true }), true);
  assert.deepEqual(record, [{ concern: 'gc.sweep', action: 'reconciler-owned' }]);
});

test('CONCERN_OWNER is the concerns map of modules/reconciler/reconciler.yaml', () => {
  const contract = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'reconciler', 'reconciler.yaml'), 'utf8'));
  assert.deepEqual(contract.concerns, { ...CONCERN_OWNER });
  assert.equal(CONCERNS.length, 24);
});

test('the yields: the kernel watchdog loop, the supervisor watchdog loop and resume-all step aside for an owned concern', async () => {
  const printed = [];
  const loop = await runWatchdogLoop({ workflow: 'wf-x', tick: () => assert.fail('an owned seat runs no tick'), print: (r) => printed.push(r),
    owns: (c) => c === 'host.kernel-seat', sleep: async () => {} });
  assert.deepEqual(loop, { exitCode: 0, reconcilerOwned: true });
  assert.equal(printed[0].action, 'reconciler-owned');

  let settles = 0, ticks = 0;
  const kept = await runWatchdogLoop({ workflow: 'wf-x', tick: () => { ticks += 1; return { ok: true, action: 'observed' }; }, print: () => {}, maxIterations: 1,
    interval: 20, settle: () => { settles += 1; }, settleEveryMs: 10, owns: (c) => c === 'job.settle', sleep: async () => {} });
  assert.equal(kept.exitCode, 0);
  assert.equal(ticks, 1, 'the seat is not owned: the loop ticks');
  assert.equal(settles, 0, 'job.settle owned: the settler is not started');

  const sup = await runLoop({ claim: () => ({ ok: true, release() {} }), owns: (c) => c === 'host.supervisor-seat', log: () => {}, pass: async () => assert.fail('no pass'),
    standDown: () => null, sleep: async () => {} });
  assert.deepEqual(sup, { exited: 'reconciler-owned' });

  const result = resumeAll({ repos: ['D:/nowhere'], workflowsOf: () => [{ workflowId: 'wf-x', repo: 'D:/nowhere' }], orphansOf: () => [],
    watchdogs: () => assert.fail('the kernel seats are owned'), spawn: () => assert.fail('no watchdog'), ensureBridge: () => assert.fail('services owned'),
    supervisor: () => assert.fail('supervisor seat owned'), stallAlert: () => assert.fail('stall wakes owned'), connectors: { cloudflare: { mode: 'quick' } },
    startOne: () => assert.fail('services owned'), owns: () => true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.reconcilerOwned.map((o) => o.concern).sort(), ['host.kernel-seat', 'host.services', 'host.supervisor-seat', 'workflow.stall-wake']);
  assert.deepEqual(result.started, []);
});
