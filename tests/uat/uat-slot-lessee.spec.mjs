// A UAT slot is a lease with a lessee: the Host pass, `starci uat slots collect`, the run itself and the install of a workflow tree end a slot
// whose lessee is gone, by recorded identity, and record each stop (scripts/uat/slot-lessee.mjs, slot-collect.mjs, slot-store.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { collectSlots, stopOrphanChild, stopSlotsInTree } from '../../scripts/uat/slot-collect.mjs';
import { identityLive, identityOf, lesseeVerdict } from '../../scripts/uat/slot-lessee.mjs';
import { reapSlotServers } from '../../scripts/reconciler/host-slot-servers.mjs';
import { installWorkflowTree } from '../../scripts/kernel/workflow-startup.mjs';

const SLOTS = fileURLToPath(new URL('../../scripts/uat/uat-slots.mjs', import.meta.url));
const MACHINE_URL = new URL('../../engine/db/machine.mjs', import.meta.url).href;
const tempMachine = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-uat-lessee-spec-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return { dir, env: { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') } };
};
const HOUR = 3_600_000;
const proc = (pid, cmd, created = 1000 + pid) => ({ pid, ppid: 1, name: 'node.exe', cmd, created });
const RUN_CMD = 'node /rt/scripts/uat/uat-slots.mjs run -- next start -p 3919';
const lesseeOf = (over = {}) => ({ self: { pid: 100, created: 1100, cmd: RUN_CMD }, owner: { pid: 50, created: 1050, cmd: 'node agent' },
  child: { pid: 101, created: 1101, cmd: 'next start -p 3919' }, scratchDir: '/scratch/a1', terminal: 't1', cwd: '/trees/wf-1/apps/web', ...over });
const table = (...extra) => [proc(100, RUN_CMD, 1100), proc(101, 'next start -p 3919', 1101), proc(50, 'node agent', 1050), ...extra];
const putSlot = (env, slot, { pid = 100, startedAt = Date.now(), lessee = lesseeOf(), runId = `run-${pid}` } = {}) => withMachine((m) => {
  m.upsert('host_locks', { name: `uat-slot-${slot}`, holder_pid: pid, holder: JSON.stringify({ runId, token: 'x', ...(lessee ? { lessee } : {}) }),
    started_at: startedAt, heartbeat_at: startedAt, expires_at: Date.now() + 600000, state: 'held' }, ['name']);
  m.upsertUatSlot({ slotId: `slot-${slot}`, jobId: runId, acquiredAt: startedAt, expiresAt: null, releasedAt: null });
}, { env });
const locks = (env) => readMachine((m) => m.db.prepare("SELECT name FROM host_locks WHERE name LIKE 'uat-slot-%' AND state<>'released'").all().map((r) => r.name), [], { env });
const events = (env) => readMachine((m) => m.supEvents({ kind: 'uat-slot-collected', order: 'asc' }).map((e) => JSON.parse(e.payload_json ?? 'null')), [], { env });
const fakeStop = (dead) => ({ stop: (pid) => { dead.add(pid); return true; }, alive: (pid) => !dead.has(pid) });
const ended = { ended: true, endState: 'worker-dead' };

test('a slot whose attempt ended is ended: the held command and the holder stop, the lease is released and one event records it', (t) => {
  const { env } = tempMachine(t);
  putSlot(env, 1);
  const dead = new Set();
  const ends = collectSlots({ env, rows: table(), attemptOf: () => ended, ...fakeStop(dead) });
  assert.deepEqual(ends.map((e) => [e.slot, e.state, e.released, e.stopped]), [[1, 'ended', true, [101, 100]]]);
  assert.deepEqual(locks(env), []);
  assert.equal(readMachine((m) => m.uatSlots().length, -1, { env }), 0);
  const [event] = events(env);
  assert.deepEqual([event.slot, event.state, event.stopped, event.scratchDir], [1, 'ended', [101, 100], '/scratch/a1']);
});

test('a slot whose launching process is gone is ended, and a live lessee is left alone', (t) => {
  const { env } = tempMachine(t);
  putSlot(env, 1);
  const alive = collectSlots({ env, rows: table(), attemptOf: () => null, dryRun: true });
  assert.deepEqual(alive, [], 'the owner lives and its attempt is open: nothing to end');
  const gone = table().filter((p) => p.pid !== 50);
  const ends = collectSlots({ env, rows: gone, attemptOf: () => null, ...fakeStop(new Set()) });
  assert.deepEqual(ends.map((e) => [e.state, e.stopped]), [['owner-gone', [101, 100]]]);
});

test('a pid reused by another program is never stopped: the recorded creation time and command line must match', (t) => {
  const { env } = tempMachine(t);
  putSlot(env, 1);
  const reused = [proc(100, 'chrome.exe --type=gpu', 5000), proc(101, 'next start -p 3919', 1101)];
  const dead = new Set();
  const ends = collectSlots({ env, rows: reused, attemptOf: () => ended, ...fakeStop(dead) });
  assert.deepEqual([...dead], [101], 'only the held command, whose identity still matches, is stopped; the reused holder pid is not');
  assert.deepEqual(ends.map((e) => e.state), ['holder-gone']);
});

test('a lease that recorded no lessee is judged by its age, and stopped only while its holder is a uat-slots run', (t) => {
  const { env } = tempMachine(t);
  const now = Date.now();
  putSlot(env, 1, { lessee: null, startedAt: now - HOUR });
  assert.deepEqual(collectSlots({ env, rows: table(), now, unknownHoldMs: 3 * HOUR, attemptOf: () => null }), []);
  const dead = new Set();
  const ends = collectSlots({ env, rows: table(), now, unknownHoldMs: HOUR / 2, attemptOf: () => null, ...fakeStop(dead) });
  assert.deepEqual(ends.map((e) => [e.state, e.stopped]), [['unknown-overdue', [100]]]);
  putSlot(env, 2, { pid: 77, lessee: null, startedAt: now - 5 * HOUR });
  const other = collectSlots({ env, rows: [proc(77, 'notepad.exe')], now, unknownHoldMs: HOUR, attemptOf: () => null, ...fakeStop(dead) });
  assert.deepEqual(other, [], 'a holder pid that is not a uat-slots run is not touched');
});

test('a holder that died while its held command lives on has the command stopped', (t) => {
  const { env } = tempMachine(t);
  putSlot(env, 1);
  const ends = collectSlots({ env, rows: [proc(101, 'next start -p 3919', 1101)], attemptOf: () => null, ...fakeStop(new Set()) });
  assert.deepEqual(ends.map((e) => [e.state, e.stopped, e.released]), [['holder-gone', [101], true]]);
  const row = { name: 'uat-slot-3', holder: JSON.stringify({ runId: 'r', lessee: lesseeOf() }) };
  const sent = [];
  const stopped = stopOrphanChild({ supEvent: (event) => sent.push(event) }, row, { rows: [proc(101, 'next start -p 3919', 1101)], stop: () => true, alive: () => true });
  assert.deepEqual([stopped, sent[0]?.kind, sent[0]?.payload.by], [[101], 'uat-slot-collected', 'reclaim']);
  assert.deepEqual(stopOrphanChild({ supEvent: () => assert.fail('no event for a child that is gone') }, row, { rows: [], stop: () => assert.fail('nothing to stop'), alive: () => true }), []);
});

test('dry run lists what would end and touches nothing', (t) => {
  const { env } = tempMachine(t);
  putSlot(env, 1);
  const ends = collectSlots({ env, rows: table(), attemptOf: () => ended, dryRun: true, stop: () => assert.fail('dry run stops nothing') });
  assert.deepEqual(ends.map((e) => [e.state, e.pids, e.released, e.dryRun]), [['ended', [101, 100], false, true]]);
  assert.deepEqual(locks(env), ['uat-slot-1']);
  assert.deepEqual(events(env), []);
});

test('the slots run from a workflow tree are ended before its install, and a sibling tree is not', (t) => {
  const { env } = tempMachine(t);
  putSlot(env, 1);
  putSlot(env, 2, { pid: 200, lessee: lesseeOf({ self: { pid: 200, created: 1200, cmd: RUN_CMD }, child: null, cwd: '/trees/wf-10/apps/web' }) });
  const ends = stopSlotsInTree('/trees/wf-1', { env, rows: table(proc(200, RUN_CMD, 1200)), ...fakeStop(new Set()) });
  assert.deepEqual(ends.map((e) => [e.slot, e.state, e.released]), [[1, 'tree-install', true]]);
  assert.deepEqual(locks(env), ['uat-slot-2']);
});

test('the install of a workflow tree stops its slot servers first and refuses, naming the lease, when one cannot be stopped', async () => {
  const record = { path: '/trees/wf-1' };
  const order = [];
  const ok = await installWorkflowTree({ record, env: {} }, {
    stopSlots: () => { order.push('slots'); return [{ slot: 1, name: 'uat-slot-1', pids: [101, 100], stopped: [101, 100], survivors: [], released: true }]; },
    npmCi: async () => { order.push('npm'); return { code: 0, data: { ok: true } }; } });
  assert.deepEqual(order, ['slots', 'npm']);
  assert.equal(ok.ok, true);
  assert.equal(ok.stoppedSlots[0].name, 'uat-slot-1');
  let ran = false;
  const held = await installWorkflowTree({ record, env: {} }, {
    stopSlots: () => [{ slot: 2, name: 'uat-slot-2', pids: [200], stopped: [], survivors: [200], released: false }],
    npmCi: async () => { ran = true; return { code: 0, data: { ok: true } }; } });
  assert.equal(held.reason, 'workflow-worktree-install-slot-held');
  assert.match(held.error, /uat-slot-2 \(pid 200\).*starci uat slots collect/);
  assert.equal(ran, false, 'npm ci is not attempted while a slot server holds the tree');
});

test('the Host pass collects in active mode and only lists in shadow', async () => {
  const logged = [];
  const calls = [];
  const collect = (input) => { calls.push(input.dryRun); return [{ slot: 1, state: 'ended', pids: [100] }]; };
  for (const mode of ['active', 'shadow']) {
    const ctx = { mode, now: () => 5, env: {}, log: async (kind, text, data) => { logged.push([mode, kind, data.ends.length]); } };
    assert.equal((await reapSlotServers(ctx, [], { collect })).length, 1);
  }
  assert.deepEqual(calls, [false, true]);
  assert.deepEqual(logged, [['active', 'reconciler.host.slot-servers', 1], ['shadow', 'reconciler.would', 1]]);
  const failing = await reapSlotServers({ mode: 'active', now: () => 1, env: {}, log: async () => {} }, [], { collect: () => { throw new Error('store busy'); } });
  assert.deepEqual(failing, []);
});

test('the verdict reads the attempt first, then the launching process, then the age', () => {
  const rows = [proc(50, 'node agent', 1050)];
  const base = { lessee: lesseeOf(), rows, heldMs: 0, unknownHoldMs: HOUR };
  assert.equal(lesseeVerdict({ ...base }).state, 'live');
  assert.equal(lesseeVerdict({ ...base, attempt: ended }).state, 'ended');
  assert.equal(lesseeVerdict({ ...base, rows: [] }).state, 'owner-gone');
  assert.equal(lesseeVerdict({ ...base, lessee: lesseeOf({ owner: null }), heldMs: 2 * HOUR }).state, 'unknown-overdue');
  assert.equal(identityLive(identityOf(50, rows), rows), true);
  assert.equal(identityLive({ pid: 50, created: 1, cmd: 'node agent' }, rows), false);
});

// The whole path with real processes: the run records its lessee, its launcher exits, and within the watch interval the held command is
// stopped, the slot is released and the event is recorded.
test('a held run ends with the process that launched it', async (t) => {
  const { env } = tempMachine(t);
  const launcher = [
    "import {spawn} from 'node:child_process';",
    `import {readMachine} from ${JSON.stringify(MACHINE_URL)};`,
    `const run=spawn(process.execPath,[${JSON.stringify(SLOTS)},'run','--','node','-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true,detached:true});run.unref();`,
    "const bound=()=>readMachine(m=>{const row=m.hostLock('uat-slot-1');return JSON.parse(row?.holder??'null')?.lessee?.child?.pid??null;},null);",
    'for(let i=0;i<240;i++){const pid=bound();if(pid){console.log(pid);process.exit(0);}await new Promise(r=>setTimeout(r,250));}',
    'process.exit(3);'].join('\n');
  const launcherProcess = spawn(process.execPath, ['--input-type=module', '-e', launcher], { env, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  let out = '';
  launcherProcess.stdout.on('data', (chunk) => { out += chunk; });
  await new Promise((resolve) => launcherProcess.once('exit', resolve));
  const childPid = Number(out.trim());
  assert.ok(childPid > 0, `the run bound its child: ${out}`);
  t.after(() => { try { process.kill(childPid); } catch { /* gone */ } });
  const alive = () => { try { process.kill(childPid, 0); return true; } catch { return false; } };
  const deadline = Date.now() + 60_000;
  while ((alive() || locks(env).length) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(alive(), false, 'the held command ended with its launcher');
  assert.deepEqual(locks(env), [], 'the slot is released');
  assert.equal(events(env).some((e) => e.state === 'owner-gone' && e.by === 'run'), true);
});
