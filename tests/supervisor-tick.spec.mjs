// The scheduled supervisor tick's decisions over fixtures (modules/supervisor/supervise.yaml scheduledTick): which
// runaway process chains it stops, when Orca timeouts restart Orca, when a watchdog log is a dead kernel, and the
// lock that keeps two ticks apart. No real process is listed or stopped, no Orca or Telegram is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findRunaways, hostVerdict, groupByOwner, isShim } from '../scripts/supervisor/host-health.mjs';
import { orcaVerdict, orcaHealth, watchdogFailStreak, deadKernels, dueAlerts, persisting, tickSettings, TICK_LOCK } from '../scripts/supervisor/tick-duties.mjs';
import { runSupervisorTick, runLocked, recentSamples } from '../scripts/supervisor/tick.mjs';
import { readInbox } from '../scripts/connectors/telegram-bridge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  return dir;
};
const envOf = (t) => { const root = tmp(t, 'starci-sup-tick-'); return { ...process.env, LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_CONNECTORS_OFF: '1' }; };

const NOW = Date.parse('2026-09-27T12:00:00Z');
const SHIM = 'C:\\Repos\\.claude\\scripts\\guards\\shim.mjs';
const GUARD_GIT = 'C:\\Repos\\.claude\\runtime\\guards\\bin\\git.exe';
const HOST = { maxNode: 10, maxGit: 10, chainMin: 20, orphanMinAgeMs: 600_000 };
let nextPid = 1000;
const proc = (over) => ({ pid: nextPid++, ppid: 4, name: 'node.exe', exe: 'C:\\Program Files\\nodejs\\node.exe', cmd: '', ws: 50 * 1048576, created: NOW - 60_000, cpu: 0, ...over });

/** A git call that re-enters the shim `depth` times: launcher git.exe -> node shim.mjs git ... -> launcher git.exe -> ... */
function shimChain({ parent = 4, depth, created = NOW - 60_000, args = 'rev-parse --show-toplevel' }) {
  const out = [];
  let ppid = parent;
  for (let i = 0; i < depth; i += 1) {
    const launcher = proc({ ppid, name: 'git.exe', exe: GUARD_GIT, cmd: `git ${args}`, created: created + i });
    const shim = proc({ ppid: launcher.pid, cmd: `"C:\\Program Files\\nodejs\\node.exe" "${SHIM}" git ${args}`, created: created + i });
    out.push(launcher, shim);
    ppid = shim.pid;
  }
  return out;
}
const noise = (n, over = {}) => Array.from({ length: n }, () => proc({ cmd: 'node server.mjs', ...over }));

test('a guard-shim recursion over the node threshold is stopped; the processes it does not own are not', () => {
  const kernel = proc({ name: 'claude.exe', exe: 'C:\\claude\\claude.exe', cmd: 'claude' });
  const chain = shimChain({ parent: kernel.pid, depth: 15 });
  const procs = [kernel, ...chain, ...noise(5)];
  assert.ok(isShim(chain[0]) && isShim(chain[1]));
  const v = hostVerdict(procs, { ...HOST, now: NOW });
  assert.equal(v.over, true);
  assert.equal(v.runaways.length, 1, JSON.stringify(v.runaways));
  const [r] = v.runaways;
  assert.equal(r.kind, 'guard-shim-recursion');
  assert.equal(r.rootPid, chain[0].pid, 'the chain is stopped at its first shim, never at the agent above it');
  assert.equal(r.size, 30);
  assert.equal(r.safe, true);
  assert.deepEqual(v.stop.map((x) => x.rootPid), [chain[0].pid]);
  assert.equal(v.alert, false);
});

test('a runaway chain that holds a process outside the shim chain is alerted, never stopped', () => {
  const chain = shimChain({ depth: 12 });
  const stranger = proc({ ppid: chain.at(-1).pid, name: 'claude.exe', exe: 'C:\\claude\\claude.exe', cmd: 'claude', created: NOW });
  const v = hostVerdict([...chain, stranger], { ...HOST, now: NOW });
  assert.equal(v.runaways.length, 1);
  assert.equal(v.runaways[0].safe, false);
  assert.deepEqual(v.stop, []);
  assert.equal(v.alert, true);
});

test('an orphaned shim git rev-parse chain is stopped only past its minimum age; a live short chain is left alone', () => {
  const old = shimChain({ parent: 99999, depth: 1, created: NOW - 20 * 60_000 });
  const young = shimChain({ parent: 99998, depth: 1, created: NOW - 60_000 });
  const parented = shimChain({ depth: 2, created: NOW - 60 * 60_000 });
  const r = findRunaways([...old, ...young, ...parented, proc({ pid: 4, name: 'explorer.exe', exe: 'C:\\Windows\\explorer.exe', created: NOW - 86_400_000 })], { now: NOW, chainMin: 20, orphanMinAgeMs: 600_000 });
  assert.deepEqual(r.map((x) => [x.kind, x.rootPid]), [['orphaned-shim-rev-parse', old[0].pid]]);
  // Below the process thresholds the tick does not look for chains at all.
  assert.deepEqual(hostVerdict([...old], { ...HOST, now: NOW }).runaways, []);
});

test('a parent pid reused by a younger process does not adopt an orphaned chain', () => {
  const chain = shimChain({ parent: 5555, depth: 1, created: NOW - 30 * 60_000 });
  const reused = proc({ pid: 5555, name: 'notepad.exe', exe: 'C:\\Windows\\notepad.exe', created: NOW - 60_000 });
  const r = findRunaways([reused, ...chain], { now: NOW, chainMin: 20, orphanMinAgeMs: 600_000 });
  assert.equal(r[0]?.kind, 'orphaned-shim-rev-parse');
  assert.equal(r[0].orphaned, true);
});

test('processes group under the op, watchdog or agent their command lines name', () => {
  const agent = proc({ name: 'claude.exe', exe: 'C:\\claude\\claude.exe', cmd: 'claude', ws: 500 * 1048576, cpu: 80 });
  const opTool = proc({ ppid: agent.pid, cmd: 'node C:\\tmp\\op-interface.implement-26e189461a.mjs', cpu: 40 });
  const child = proc({ ppid: opTool.pid, name: 'git.exe', exe: 'C:\\git\\git.exe', cmd: 'git status', cpu: 20 });
  const dog = proc({ cmd: 'node scripts\\kernel\\watchdog.mjs --repo D:\\r --workflow wf-a-123 --repair' });
  const groups = groupByOwner([agent, opTool, child, dog], { cores: 1, limit: 12 });
  const by = Object.fromEntries(groups.map((g) => [g.key, g]));
  assert.equal(by['op:op-interface.implement-26e189461a'].procs, 2);
  assert.equal(by['op:op-interface.implement-26e189461a'].cpuPct, 60);
  assert.equal(by['agent:claude'].procs, 1);
  assert.equal(by['watchdog:wf-a-123'].procs, 1);
});

test('Orca: consecutive probe timeouts decide a restart, then restart-all runs; one answer ends the probing', () => {
  const orca = { probeTimeoutMs: 1, probes: 5, gapMs: 1, closeWaitMs: 7 };
  assert.equal(orcaVerdict(['timeout', 'timeout'], orca), 'probe-again');
  assert.equal(orcaVerdict(['timeout', 'unavailable', 'timeout', 'timeout', 'timeout'], orca), 'restart');
  assert.equal(orcaVerdict(['timeout', 'ok'], orca), 'healthy');
  assert.equal(orcaVerdict(['error'], orca), 'responding-error');

  const calls = [];
  const down = orcaHealth({ orca, probe: () => 'timeout', sleep: (ms) => calls.push(['sleep', ms]),
    restart: (o) => { calls.push(['restart', o.closeWaitMs]); return { ok: true, closed: 1, forced: 0 }; },
    waitReady: () => { calls.push(['wait']); return { ready: true }; }, restartAll: () => { calls.push(['restart-all']); return { ok: true }; } });
  assert.equal(down.verdict, 'restart');
  assert.equal(down.results.length, 5);
  assert.deepEqual(calls.map((c) => c[0]), ['sleep', 'sleep', 'sleep', 'sleep', 'restart', 'wait', 'restart-all']);
  assert.equal(calls.find((c) => c[0] === 'restart')[1], 7);

  const flaky = ['timeout', 'timeout', 'ok'];
  const up = orcaHealth({ orca, probe: () => flaky.shift(), sleep: () => {}, restart: () => assert.fail('an answering Orca is never restarted'),
    waitReady: () => assert.fail('no wait'), restartAll: () => assert.fail('no restart-all') });
  assert.deepEqual([up.verdict, up.results], ['healthy', ['timeout', 'timeout', 'ok']]);

  const noApp = orcaHealth({ orca, probe: () => 'timeout', sleep: () => {}, restart: () => ({ ok: false, error: 'no Orca app' }),
    waitReady: () => assert.fail('a failed restart waits for nothing'), restartAll: () => assert.fail('no restart-all') });
  assert.equal(noApp.ready.ready, false);
  assert.equal(noApp.restartAll, null);
});

const line = (wf, action) => `[Kernel watchdog] ${wf} phase=running action=${action}`;

test('a dead kernel is a watchdog whose trailing ticks failed for deadKernelMs; one good tick or a silent log clears it', () => {
  assert.deepEqual(watchdogFailStreak([line('wf-a', 'active'), line('wf-a', 'restart-failed'), '[Kernel watchdog] wf-a phase=? action=reloaded pid=1',
    line('wf-a', 'tick-failed'), line('wf-a', 'restart-failed')].join('\n')), { count: 3, action: 'restart-failed' });
  assert.deepEqual(watchdogFailStreak([line('wf-a', 'restart-failed'), line('wf-a', 'active')].join('\n')), { count: 0, action: null });
  assert.equal(watchdogFailStreak('{"ok":false,"workflowId":"wf-a","action":"tick-failed"}').count, 1);

  const logs = {
    'wf-dead': [line('wf-dead', 'observed'), ...Array(3).fill(line('wf-dead', 'restart-failed'))].join('\n'),
    'wf-young': [line('wf-young', 'active'), ...Array(2).fill(line('wf-young', 'tick-failed'))].join('\n'),
    'wf-well': [line('wf-well', 'restart-failed'), line('wf-well', 'active')].join('\n'),
    'wf-silent': Array(9).fill(line('wf-silent', 'restart-failed')).join('\n'),
  };
  const mtimes = { 'wf-dead': NOW - 60_000, 'wf-young': NOW, 'wf-well': NOW, 'wf-silent': NOW - 4 * 300_000 };
  const workflows = Object.keys(logs).map((workflowId) => ({ workflowId, repo: 'D:/r' }));
  const dead = deadKernels({ workflows, deadKernelMs: 900_000, now: NOW, cadenceMs: 300_000, logOf: (wf) => wf, tail: (wf) => logs[wf], mtime: (wf) => mtimes[wf] });
  assert.deepEqual(dead.map((d) => [d.workflowId, d.count, d.failingMs]), [['wf-dead', 3, 900_000]]);
});

test('an alert key repeats only after alertRepeatMs; a state is alerted only once it held for its window', () => {
  const a = [{ key: 'dead-kernel|wf-a', text: 'x' }, { key: 'status-app', text: 'y' }];
  const first = dueAlerts(a, {}, { now: NOW, repeatMs: 1000 });
  assert.equal(first.due.length, 2);
  assert.equal(dueAlerts(a, first.sent, { now: NOW + 999, repeatMs: 1000 }).due.length, 0);
  assert.equal(dueAlerts(a, first.sent, { now: NOW + 1000, repeatMs: 1000 }).due.length, 2);
  const once = persisting(['wf-a'], {}, { now: NOW, minMs: 1000 });
  assert.deepEqual(once.persisting, []);
  assert.deepEqual(persisting(['wf-a', 'wf-b'], once.seen, { now: NOW + 999, minMs: 1000 }).persisting, [], 'a tick soon after is not enough');
  assert.deepEqual(persisting(['wf-a', 'wf-b'], once.seen, { now: NOW + 1000, minMs: 1000 }).persisting, ['wf-a']);
  assert.deepEqual(persisting([], once.seen, { now: NOW + 2000, minMs: 1000 }).seen, {}, 'a state that cleared starts over');
});

test('the tick: a runaway is stopped, Orca is restarted, a dead kernel is alerted, and one bottleneck sample is kept', async (t) => {
  const env = envOf(t);
  const chain = shimChain({ depth: 12 });
  const stopped = [];
  const sent = [];
  const settings = { ...tickSettings(), host: HOST };
  const r = await runSupervisorTick({ repos: ['D:/r'], push: false, heartbeat: false, env, now: () => NOW, settings, deps: {
    listProcesses: () => [...chain, ...noise(3)],
    stopTree: (pid) => { stopped.push(pid); return { ok: true, output: 'killed' }; },
    orca: { probe: () => 'timeout', sleep: () => {}, restart: () => ({ ok: true, closed: 1, forced: 1 }), waitReady: () => ({ ready: true }), restartAll: () => ({ ok: true, summary: 'ok' }) },
    statusApp: { up: async () => true },
    runTick: async () => ({ digests: [{ stalls: [{ type: 'STALLED', workflowId: 'wf-b', idleMinutes: 400, alert: true, line: 'STALLED wf-b idle 400m' }] }], owed: [], pushes: [], lines: ['digest'] }),
    frontiers: { runningOf: () => [{ workflowId: 'wf-a' }, { workflowId: 'wf-b' }], frontierOf: (repo, wf) => ({ ok: true, frontier: { state: wf === 'wf-a' ? 'orphaned-frontier' : 'queued', queuedCauses: wf === 'wf-b' ? { 'max-ops': 2, 'path-lease': 1 } : {} } }) },
    deadKernels: ({ workflows }) => workflows.filter((w) => w.workflowId === 'wf-a').map((w) => ({ ...w, count: 3, action: 'restart-failed', failingMs: 900_000 })),
    load: () => ({ cpuBusy: 0.5, freeMem: 0.25, totalRamBytes: 64e9 }),
    sendAlerts: async (due) => { sent.push(...due); return { inbox: { ok: true }, telegram: { ok: true, skipped: 'spec' } }; },
  } });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(stopped, [chain[0].pid]);
  assert.equal(r.orca.verdict, 'restart');
  const keys = sent.map((a) => a.key).sort();
  assert.deepEqual(keys, [`runaway|guard-shim-recursion|${chain[0].pid}`, 'dead-kernel|wf-a', 'no-progress|wf-b', 'orca-restarted'].sort());
  assert.ok(!keys.includes('orphaned-frontier|wf-a'), 'one sighting of orphaned-frontier is not alerted');
  const samples = recentSamples(5, { env });
  assert.equal(samples.length, 1);
  assert.deepEqual(samples[0].waits, { 'max-ops': 2, 'path-lease': 1 });
  assert.equal(samples[0].cpuBusy, 0.5);
  assert.equal(samples[0].freeRamPct, 25);
  assert.ok(samples[0].owners.length > 0);
});

test('the tick files its alerts in the supervisor inbox', async (t) => {
  const env = envOf(t);
  const settings = { ...tickSettings(), host: HOST };
  const r = await runSupervisorTick({ repos: [], push: false, heartbeat: false, env, now: () => NOW, settings, deps: {
    listProcesses: () => noise(2), orca: { probe: () => 'ok' }, statusApp: { up: async () => false, platform: 'spec', run: () => assert.fail('no real schtasks') }, runTick: async () => ({ digests: [], lines: [] }),
    frontiers: { runningOf: () => [] }, deadKernels: () => [], load: () => ({ cpuBusy: 0, freeMem: 1, totalRamBytes: 1 }),
  } });
  // The status UI is down and cannot be restarted off Windows, so it is alerted.
  assert.ok(r.alerts.some((a) => a.key === 'status-app' && a.sent));
  const inbox = readInbox('main', env);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].from, 'supervisor-tick');
  assert.match(inbox[0].text, /STATUS-UI/);
  assert.equal(r.alerted.telegram.skipped, 'STARCI_CONNECTORS_OFF');
});

test('the lock: a tick while another process holds it is skipped and never runs; a dead holder frees it', async (t) => {
  const env = envOf(t);
  const lib = JSON.stringify(new URL('../scripts/connectors/lib.mjs', import.meta.url).href);
  const holder = spawn(process.execPath, ['--input-type=module', '-e',
    `const { claimManager } = await import(${lib}); const l = claimManager(${JSON.stringify(TICK_LOCK)}); console.log(l.ok ? 'held' : 'refused'); setInterval(() => {}, 1000);`],
  { env, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  t.after(() => holder.kill());
  const said = await new Promise((resolve) => holder.stdout.once('data', (d) => resolve(String(d).trim())));
  assert.equal(said, 'held');
  const skipped = await runLocked(() => assert.fail('a second tick never runs while another holds the lock'), { env });
  assert.deepEqual([skipped.ran, skipped.skipped, skipped.holder?.pid], [false, 'tick-running', holder.pid]);
  const exited = new Promise((resolve) => holder.once('exit', resolve));
  holder.kill();
  await exited;
  assert.deepEqual(await runLocked(() => 'ran', { env }), { ran: true, value: 'ran' }, 'a dead holder does not keep the lock');
  await assert.rejects(runLocked(() => { throw Error('boom'); }, { env }));
  assert.equal((await runLocked(() => 'freed', { env })).value, 'freed', 'a tick that throws releases the lock');
});

test('the task spec reads its interval from runtimes.yaml', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'supervisor', 'tick.mjs'), '--task-spec'], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(r.stdout.trim());
  assert.equal(spec.name, 'StarCi-Supervisor-Every30m');
  assert.equal(spec.everyMinutes * 60_000, tickSettings().everyMs);
  assert.deepEqual(spec.args, ['--scheduled', '--json']);
});
