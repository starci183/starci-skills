// The one [Supervisor] kernel, its [Worker] fix agents, the land gate and the chat relay
// (modules/supervisor/supervise.yaml kernelSeat/workers/landGate/chat, docs/supervisor.md).
// Every spec runs on a temp supervisor home, a temp LOCALAPPDATA and, for git, a temp repository:
// no Orca, no agent, no network, never the live runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { launchSupervisor, stopSupervisor, planSupervisorDedupe, ensureSupervisor, doctrineOf, seatCommand } from '../scripts/supervisor/start-supervisor.mjs';
import { openSupervisorLedger, seatOf, enabledOf, withSupervisorRead, SUPERVISOR_ID, SUPERVISOR_WF } from '../scripts/supervisor/home.mjs';
import {
  adaptiveCap, createJob, spawnWorkers, createStaging, removeStaging, fileReport, jobOf, stagingPathOf, leaseConflicts, pickWorkerPool, cancelJob,
  stageSelf, workerLaunchCommand, READINESS_FAILS_PER_HOUR,
} from '../scripts/supervisor/workers.mjs';
import { landCommits, land, contractCoverage, governedPaths, specsTouching, runChecks } from '../scripts/supervisor/land.mjs';
import { scanDiff } from '../scripts/supervisor/push-mains.mjs';
import { tell, replies, sinceMs } from '../scripts/supervisor/tell.mjs';
import { replyToOwner, registrationRefusal } from '../scripts/supervisor/channel.mjs';
import { appendInbox, readInbox, registerSupervisor, readOutbox, createBridge } from '../scripts/connectors/telegram-bridge.mjs';
import { planWake, busyScreen, watchdogPass } from '../scripts/supervisor/watchdog.mjs';
import { clusterOwed } from '../scripts/supervisor/cluster.mjs';
import { renderSupervisorBlock, supervisorSnapshot } from '../scripts/supervisor/status-block.mjs';
import { parseYaml } from '../engine/yaml.mjs';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* an open ledger handle closes after this hook */ } });
  return dir;
};
const envOf = (t) => { const root = tmp(t, 'sup-k-'); return { LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home') }; };

/* ------------------------------------------------------------ fake Orca */

function fakeHost({ terminals = [], live = new Set(), screens = {}, spawnOk = true, hostDown = false } = {}) {
  const calls = { spawn: [], close: [], quit: [] };
  let n = 0;
  return {
    calls, live,
    list: () => (hostDown ? { ok: false, hostUnavailable: true } : { ok: true, terminals, visualLayouts: [] }),
    tabTitles: (_layouts, rows) => new Map(rows.map((r) => [r.handle, r.tab ?? null])),
    verdict: (h) => (hostDown ? { verdict: 'host-unavailable', reason: 'down' } : live.has(h) ? { verdict: 'live', reason: 'ok' } : { verdict: 'gone', reason: 'gone' }),
    screen: (h) => screens[h] ?? '> ',
    exitedRow: (s) => (/PS [A-Z]:\\[^>]*>\s*$/.test(s) ? s.trim() : null),
    close: (h) => { calls.close.push(h); live.delete(h); return { ok: true }; },
    quit: (h) => { calls.quit.push(h); return { sent: true, exited: false }; },
    spawn: (opts) => {
      calls.spawn.push(opts);
      if (!spawnOk) return { ok: false, step: 'readiness', error: 'refused' };
      const h = `term_new${++n}`; live.add(h); return { ok: true, terminal: h, modelAttested: opts.model };
    },
  };
}
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } };
const launch = (env, host, extra = {}) => launchSupervisor({ env, deps: host, settings, template: '{launchAuthority}\n{doctrine}', doc: { kernelSeat: { does: ['x'] } }, ...extra });

test('singleton: one launch boots the seat; a second start with the seat live launches nothing', async (t) => {
  const env = envOf(t);
  const host = fakeHost();
  const first = await launch(env, host);
  assert.equal(first.action, 'booted');
  assert.equal(host.calls.spawn.length, 1);
  assert.equal(host.calls.spawn[0].title, '[Supervisor] main');
  const again = await launch(env, host);
  assert.equal(again.action, 'already-live');
  assert.equal(host.calls.spawn.length, 1, 'never a second [Supervisor]');
  assert.equal(withSupervisorRead((db) => seatOf(db).value.terminal, null, { env }), first.terminal);
  assert.equal(withSupervisorRead((db) => enabledOf(db), null, { env }), true);
});

test('singleton: a live startup reservation, a host outage and a disabled seat all launch nothing', async (t) => {
  const env = envOf(t);
  const ledger = openSupervisorLedger({ env });
  ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('supervisor-seat','main',1,'tok',?,?,?)")
    .run(JSON.stringify({ state: 'starting' }), Date.now(), Date.now() + 60_000);
  ledger.close();
  const host = fakeHost();
  assert.equal((await launch(env, host)).action, 'starting');
  const down = fakeHost({ hostDown: true });
  const env2 = envOf(t);
  const seeded = await launch(env2, fakeHost());
  assert.equal(seeded.action, 'booted');
  const out = await launch(env2, down);
  assert.equal(out.action, 'host-unavailable');
  assert.equal(out.exit, 75);
  assert.equal(down.calls.spawn.length, 0);
  const stopped = await stopSupervisor({ env: env2, deps: fakeHost() });
  assert.equal(stopped.action, 'stopped');
  const replace = await launch(env2, fakeHost(), { mode: 'replace' });
  assert.equal(replace.action, 'disabled', 'the watchdog never relaunches a stopped seat');
  assert.deepEqual(ensureSupervisor({ env: env2, ensure: () => assert.fail('never') }), { ok: true, skipped: 'disabled' });
});

test('singleton dedupe: with the seat dead a live [Supervisor] session is adopted, extra ones and bare shells are closed', async (t) => {
  const env = envOf(t);
  const terminals = [
    { handle: 'term_a', title: '✳ supervisor tick', tab: '[Supervisor] main' },
    { handle: 'term_b', title: 'x', tab: '[Supervisor] main' },
    { handle: 'term_c', title: 'shell', tab: '[Supervisor] main' },
    { handle: 'term_k', title: 'kernel', tab: '[Kernel] wf-x' },
  ];
  const host = fakeHost({ terminals, live: new Set(['term_a', 'term_b', 'term_c', 'term_k']), screens: { term_c: 'PS D:\\x> ' } });
  const out = await launch(env, host);
  assert.equal(out.action, 'adopted');
  assert.equal(out.terminal, 'term_a');
  assert.equal(host.calls.spawn.length, 0, 'adopting replaces a launch');
  assert.deepEqual(out.closedDuplicates.map((c) => c.handle).sort(), ['term_b', 'term_c']);
  assert.ok(!host.calls.close.includes('term_k'), 'a kernel terminal is never touched');
  const plan = planSupervisorDedupe({ marked: [{ handle: 's' }, { handle: 'd' }], seatTerminal: 's', seatLive: true, screenOf: () => '> ', exitedRow: () => null });
  assert.deepEqual(plan.close.map((c) => c.handle), ['d']);
  assert.equal(plan.adopt, null, 'a live seat never adopts');
});

test('the prompt doctrine is built from supervise.yaml kernelSeat', () => {
  const doc = parseYaml(fs.readFileSync(new URL('../modules/supervisor/supervise.yaml', import.meta.url), 'utf8'));
  const text = doctrineOf(doc);
  assert.match(text, /single brain/);
  assert.match(text, /never answers|answers an owner ask/);
  assert.ok(doc.guardrails.some((g) => g.id === 'one-supervisor-seat'));
  assert.ok(!doc.guardrails.some((g) => g.id === 'chat-only-debug-mode'), 'the chat-only rule is replaced');
  for (const key of ['kernelSeat', 'workers', 'landGate', 'chat']) assert.ok(doc[key], key);
});

/* ------------------------------------------------------------ workers */

test('worker cap: adaptive with the queue, halved under load, never above 10', () => {
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 0 }).cap, 4);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 5 }).cap, 7);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 40 }).cap, 10);
  assert.equal(adaptiveCap({ base: 4, max: 99, queued: 99 }).cap, 10, 'the hard ceiling is 10');
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 5, load: { cpuBusy: 0.9, freeMem: 0.5 } }).cap, 3);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 5, load: { cpuBusy: 0.99, freeMem: 0.5 } }).cap, 1);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 0, running: 3 }).free, 1);
});

test('workers: one job per cluster, launches stop at the cap, a leased file waits', async (t) => {
  const env = envOf(t);
  const ledger = openSupervisorLedger({ env });
  t.after(() => ledger.close());
  const a = createJob(ledger, { cluster: 'c1', files: ['scripts/a.mjs'] });
  assert.equal(createJob(ledger, { cluster: 'c1', files: ['scripts/z.mjs'] }).created, false, 'one worker per cluster');
  createJob(ledger, { cluster: 'c2', files: ['scripts/a.mjs'] });
  createJob(ledger, { cluster: 'c3', files: ['scripts/b.mjs'] });
  createJob(ledger, { cluster: 'c4', files: ['scripts/c.mjs'] });
  const spawned = [];
  const deps = {
    load: () => ({ cpuBusy: 0.99, freeMem: 0.5 }),
    route: async () => ({ pool: 'qwen-agent', agent: 'qwen', model: 'm', effort: null }),
    staging: ({ jobId }) => ({ ok: true, path: `/tmp/${jobId}`, branch: `sup/${jobId}`, base: 'abc' }),
    unstage: () => ({}),
    spawn: (opts) => { spawned.push(opts); return { ok: true, terminal: `term_${spawned.length}` }; },
  };
  const r = await spawnWorkers(ledger, { settings, deps, env });
  assert.equal(r.cap.cap, 1, 'a saturated machine runs one worker');
  assert.equal(r.launched.length, 1);
  assert.equal(spawned[0].title, '[Worker] c1');
  assert.equal(jobOf(ledger.db, a.job.job_id).status, 'running');
  deps.load = () => ({ cpuBusy: 0.1, freeMem: 0.9 });
  const r2 = await spawnWorkers(ledger, { settings, deps, env });
  assert.ok(r2.skipped.some((s) => /files leased by/.test(s.reason)), 'c2 waits for the lease on scripts/a.mjs');
  assert.equal(r2.launched.length, 2);
  assert.deepEqual(leaseConflicts(ledger.db, ['scripts/a.mjs']).map((c) => c.jobId), [a.job.job_id]);
});

test('worker routing: the balanced pick skips an unavailable provider and prefers the furthest below its share', async () => {
  const runtimes = parseYaml(fs.readFileSync(new URL('../modules/models/runtimes.yaml', import.meta.url), 'utf8'));
  const shares = { 'claude-agent': 25, 'codex-agent': 25, 'devin-agent': 25, 'qwen-agent': 25 };
  const pick = await pickWorkerPool({ shares, runtimes, recent: { 'claude-agent': 5, 'codex-agent': 5, 'devin-agent': 5, 'qwen-agent': 0 } });
  assert.equal(pick.agent, 'qwen');
  const skip = await pickWorkerPool({ shares, runtimes, recent: { 'qwen-agent': 0, 'claude-agent': 9, 'codex-agent': 9, 'devin-agent': 1 },
    availabilityOf: (p) => (p === 'qwen' ? { state: 'unavailable', reason: 'circuit open' } : { state: 'available' }) });
  assert.equal(skip.agent, 'devin');
  assert.ok(skip.skipped.some((s) => s.pool === 'qwen-agent'));
});

test('worker readiness: a qwen worker launches its profile command (routed --model), and a readiness failure excludes the provider', async (t) => {
  const qwen = workerLaunchCommand({ pool: 'qwen-agent', provider: 'qwen', model: 'deepseek-v4.1-flash' });
  assert.match(qwen ?? '', /^qwen --model deepseek-v4\.1-flash .*--yolo/, 'a bare `qwen` starts on the host default model and never shows the card identity');
  assert.equal(workerLaunchCommand({ pool: 'claude-agent', provider: 'claude', model: 'm' }), null, 'a card with terminalFallback pins the model itself');
  const env = envOf(t);
  const ledger = openSupervisorLedger({ env });
  t.after(() => ledger.close());
  const runtimes = parseYaml(fs.readFileSync(new URL('../modules/models/runtimes.yaml', import.meta.url), 'utf8'));
  const shares = { 'claude-agent': 25, 'codex-agent': 25, 'qwen-agent': 25 };
  const recent = { 'claude-agent': 9, 'codex-agent': 5, 'qwen-agent': 0 };
  const a = createJob(ledger, { cluster: 'r1', files: ['scripts/r1.mjs'] });
  const b = createJob(ledger, { cluster: 'r2', files: ['scripts/r2.mjs'] });
  const routed = [], spawned = [];
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async ({ prefer, avoid }) => { routed.push({ prefer, avoid }); return pickWorkerPool({ shares, runtimes, recent, prefer, avoid }); },
    staging: ({ jobId }) => ({ ok: true, path: `/tmp/${jobId}`, branch: `sup/${jobId}`, base: 'abc' }),
    unstage: () => ({}),
    spawn: (opts) => { spawned.push(opts); return opts.provider === 'qwen' ? { ok: false, step: 'readiness', error: 'terminal readiness timeout after 120000ms' } : { ok: true, terminal: `term_${spawned.length}` }; },
  };
  const r = await spawnWorkers(ledger, { settings, deps, env });
  assert.equal(spawned[0].provider, 'qwen', 'qwen is furthest below its share');
  assert.match(spawned[0].command ?? '', /--model deepseek-v4\.1-flash/);
  assert.equal(spawned[1].provider, 'codex', 'the rest of the pass skips the provider that just failed readiness');
  assert.deepEqual(r.failed.map((f) => f.jobId), [a.job.job_id]);
  const requeued = jobOf(ledger.db, a.job.job_id);
  assert.equal(requeued.status, 'queued');
  assert.deepEqual(requeued.payload.avoidAgents, ['qwen']);
  assert.equal(requeued.payload.agent, null, 'the requeued job keeps its own agent request, not the provider routed to it');
  const r2 = await spawnWorkers(ledger, { settings, deps, env });
  assert.equal(r2.launched[0].jobId, a.job.job_id);
  assert.notEqual(r2.launched[0].agent, 'qwen', 'a requeued job is never re-routed to the provider that failed it');
  assert.ok(routed.at(-1).avoid.includes('qwen'));
  assert.equal(jobOf(ledger.db, b.job.job_id).status, 'running');
  // READINESS_FAILS_PER_HOUR failures in the hour exclude the provider for every job, fresh ones included.
  for (let i = 0; i < READINESS_FAILS_PER_HOUR; i += 1) ledger.transaction(() => ledger.appendEvent({ workflowId: SUPERVISOR_WF, entityType: 'job', entityId: `x${i}`, kind: 'worker-spawn-failed', payload: { agent: 'devin', step: 'readiness' } }));
  createJob(ledger, { cluster: 'r3', files: ['scripts/r3.mjs'] });
  await spawnWorkers(ledger, { settings, deps, env });
  assert.ok(routed.at(-1).avoid.includes('devin'), JSON.stringify(routed.at(-1)));
});

/* ------------------------------------------------------------ git fixtures */

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
function repoFixture(t) {
  const root = tmp(t, 'sup-repo-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'modules', 'kernel'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'modules', 'kernel', 'contract-changes.yaml'), 'schema: starci/contract-changes@1\nchanges:\n  - id: old\n    summary: x\n');
  fs.writeFileSync(path.join(root, 'modules', 'kernel', 'rules.yaml'), 'rule: one\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}
/** A commit on a side branch `name` off main that writes `files` ({path: content}); returns its sha. */
function sideCommit(root, name, files, base = 'main') {
  const wt = path.join(root, '..', `${path.basename(root)}-${name}`);
  git(root, 'worktree', 'add', '-q', '-b', name, wt, base);
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(wt, f)), { recursive: true }); fs.writeFileSync(path.join(wt, f), c); }
  git(wt, 'add', '-A');
  git(wt, 'commit', '-q', '-m', name);
  const sha = git(wt, 'rev-parse', 'HEAD');
  git(root, 'worktree', 'remove', '--force', wt);
  return sha;
}

test('staging lifecycle: a worktree on a temp branch; removal after a land deletes both and never the live node_modules', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  fs.mkdirSync(path.join(root, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'dep', 'index.js'), 'keep');
  const s = createStaging({ jobId: 'fix-x-1', root, env });
  assert.ok(s.ok, s.error);
  assert.ok(fs.existsSync(path.join(s.path, 'scripts', 'a.mjs')));
  assert.ok(git(root, 'branch', '--list', 'sup/fix-x-1'));
  fs.writeFileSync(path.join(s.path, 'scripts', 'a.mjs'), 'export const a = 2;\n');
  git(s.path, 'commit', '-q', '-am', 'work');
  const kept = removeStaging({ jobId: 'fix-x-1', root, env, base: s.base });
  assert.ok(kept.removed && !fs.existsSync(s.path));
  assert.equal(kept.branchKept, 'sup/fix-x-1', 'unlanded commits keep their branch');
  assert.ok(fs.existsSync(path.join(root, 'node_modules', 'dep', 'index.js')), 'the junction removal never walks into the live node_modules');
  const s2 = createStaging({ jobId: 'fix-y-2', root, env });
  const landed = removeStaging({ jobId: 'fix-y-2', root, env, landed: true, base: s2.base });
  assert.ok(landed.removed && landed.branchDeleted);
  assert.equal(git(root, 'branch', '--list', 'sup/fix-y-2'), '');
});

/* ------------------------------------------------------------ land gate */

const lightChecks = (opts) => runChecks({ ...opts, runSpecs: false });

test('land gate pass: cherry-picked onto current main, live main fast-forwards and the working tree follows', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const sha = sideCommit(root, 'w1', { 'scripts/a.mjs': 'export const a = 42;\n', 'scripts/new.mjs': 'export const n = 1;\n' });
  sideCommit(root, 'other', { 'scripts/b.mjs': 'export const b = 1;\n' });
  git(root, 'merge', '-q', '--ff-only', 'other');   // main moved after the worker branched: rebase-free apply still lands
  const r = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(git(root, 'rev-parse', 'main'), r.landed);
  assert.equal(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), 'export const a = 42;\n');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'new.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'b.mjs')));
  assert.equal(git(root, 'status', '--porcelain'), '', 'index and tree match the new main');
});

test('land gate fail: a red check, a conflict or a dirty live path lands nothing', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const before = git(root, 'rev-parse', 'main');
  const bad = sideCommit(root, 'bad', { 'scripts/a.mjs': 'export const a = ;\n' });
  const red = landCommits({ commits: [bad], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(red.reason, 'checks-red');
  assert.ok(red.checks.some((c) => c.name === 'node --check scripts/a.mjs' && !c.ok));
  assert.equal(git(root, 'rev-parse', 'main'), before);
  assert.equal(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), 'export const a = 1;\n');

  const good = sideCommit(root, 'good', { 'scripts/a.mjs': 'export const a = 3;\n' });
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 99; // another lane is editing\n');
  const dirty = landCommits({ commits: [good], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(dirty.reason, 'live-paths-dirty');
  assert.equal(git(root, 'rev-parse', 'main'), before, 'nothing half-lands');
  assert.match(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), /another lane/, 'the lane edit is untouched');
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 1;\n');

  const onMain = sideCommit(root, 'mainedit', { 'scripts/a.mjs': 'export const a = 5;\n' });
  git(root, 'merge', '-q', '--ff-only', 'mainedit');
  const moved = git(root, 'rev-parse', 'main');
  const conflict = landCommits({ commits: [good], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(conflict.reason, 'conflict');
  assert.equal(git(root, 'rev-parse', 'main'), moved);
  assert.ok(onMain);
});

test('land gate: main moving under the checks reruns the gate on the new main', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const sha = sideCommit(root, 'w', { 'scripts/c.mjs': 'export const c = 1;\n' });
  const lane = sideCommit(root, 'lane', { 'scripts/d.mjs': 'export const d = 1;\n' });
  let calls = 0;
  const r = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: (o) => {
    calls += 1;
    if (calls === 1) git(root, 'merge', '-q', '--ff-only', lane);   // a lane commits directly meanwhile
    return lightChecks(o);
  } } });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(calls, 2);
  assert.equal(r.attempts[0].reason, 'main-moved');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'd.mjs')) && fs.existsSync(path.join(root, 'scripts', 'c.mjs')));
  assert.equal(git(root, 'rev-parse', 'main~1'), git(root, 'rev-parse', lane), 'the land sits on top of the lane commit');
});

test('contract-change enforcement: a contract file change needs an added or edited entry whose paths cover it', (t) => {
  assert.deepEqual(governedPaths(['knowledge/a.yaml', 'scripts/x.mjs', 'modules/kernel/contract-changes.yaml', 'modules/ops/o.yaml']), ['knowledge/a.yaml', 'modules/ops/o.yaml']);
  const before = { changes: [{ id: 'old', paths: ['knowledge/'] }] };
  assert.equal(contractCoverage({ changed: ['knowledge/a.yaml'], before, after: before }).ok, false, 'an old entry does not cover a new edit');
  assert.equal(contractCoverage({ changed: ['knowledge/a.yaml'], before, after: { changes: [...before.changes, { id: 'new', paths: ['knowledge'] }] } }).ok, true, 'a directory covers what is inside it');
  assert.equal(contractCoverage({ changed: ['scripts/x.mjs'], before, after: before }).ok, true);
  const env = envOf(t);
  const root = repoFixture(t);
  const bare = sideCommit(root, 'c1', { 'modules/kernel/rules.yaml': 'rule: two\n' });
  const red = landCommits({ commits: [bare], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(red.reason, 'checks-red');
  assert.ok(red.checks.some((c) => c.name === 'contract-changes paths' && !c.ok && c.uncovered.includes('modules/kernel/rules.yaml')));
  const registered = sideCommit(root, 'c2', { 'modules/kernel/rules.yaml': 'rule: two\n',
    'modules/kernel/contract-changes.yaml': 'schema: starci/contract-changes@1\nchanges:\n  - id: rules-two\n    summary: y\n    paths: [modules/kernel/rules.yaml]\n    reach: new-legs\n  - id: old\n    summary: x\n' });
  const ok = landCommits({ commits: [registered], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(ok.ok, JSON.stringify(ok.checks));
  const broken = sideCommit(root, 'c3', { 'modules/kernel/x.yaml': 'a: [unclosed\n', 'modules/kernel/contract-changes.yaml': 'schema: starci/contract-changes@1\nchanges:\n  - id: x\n    paths: [modules/kernel/x.yaml]\n' });
  const unparsable = landCommits({ commits: [broken], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(unparsable.checks.some((c) => c.name === 'parse modules/kernel/x.yaml' && !c.ok));
  assert.deepEqual(specsTouching(['scripts/supervisor/land.mjs', 'tests/x.spec.mjs'], { specs: [{ file: 'tests/a.spec.mjs', text: "import '../scripts/supervisor/land.mjs'" }, { file: 'tests/b.spec.mjs', text: 'nothing' }] }), ['tests/x.spec.mjs', 'tests/a.spec.mjs']);
});

test('a worker job lands end to end: report -> gate -> succeeded, leases released, checkout and branch removed', async (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const ledger = openSupervisorLedger({ env });
  const { job } = createJob(ledger, { cluster: 'e2e', files: ['scripts/a.mjs'] });
  const r = await spawnWorkers(ledger, { settings, env, root, deps: {
    load: () => ({ cpuBusy: 0, freeMem: 1 }), route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
    spawn: () => ({ ok: true, terminal: 'term_w' }) } });
  assert.equal(r.launched.length, 1);
  const staging = jobOf(ledger.db, job.job_id).payload.staging;
  fs.writeFileSync(path.join(staging.path, 'scripts', 'a.mjs'), 'export const a = 7;\n');
  git(staging.path, 'commit', '-q', '-am', 'fix');
  const sha = git(staging.path, 'rev-parse', 'HEAD');
  assert.equal(fileReport(ledger, { jobId: job.job_id, outcome: 'done', root }).ok, false, 'a done report names its commit');
  const rep = fileReport(ledger, { jobId: job.job_id, outcome: 'done', commit: sha, root });
  assert.ok(rep.ok, rep.error);
  ledger.close();
  const out = await land({ jobId: job.job_id, root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), 'export const a = 7;\n');
  const after = openSupervisorLedger({ env });
  t.after(() => after.close());
  assert.equal(jobOf(after.db, job.job_id).status, 'succeeded');
  assert.equal(leaseConflicts(after.db, ['scripts/a.mjs']).length, 0);
  assert.ok(!fs.existsSync(stagingPathOf(job.job_id, env)), 'the checkout lives only until it lands');
  assert.equal(git(root, 'branch', '--list', `sup/${job.job_id}`), '');
  const other = createJob(after, { cluster: 'cancel-me', files: ['scripts/q.mjs'] });
  assert.equal(cancelJob(after, { jobId: other.job.job_id, root, env }).ok, true);
});

test('a self checkout landed with --commit closes its job: succeeded, leases released, checkout and branch removed', async (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const ledger = openSupervisorLedger({ env });
  const one = stageSelf(ledger, { name: 'tooling', files: ['scripts/a.mjs'], root, env });
  const two = stageSelf(ledger, { name: 'rules', files: ['scripts/b.mjs'], root, env });
  assert.ok(one.ok && two.ok, JSON.stringify({ one, two }));
  fs.writeFileSync(path.join(one.path, 'scripts', 'a.mjs'), 'export const a = 9;\n');
  git(one.path, 'commit', '-q', '-am', 'self fix');
  const sha = git(one.path, 'rev-parse', 'HEAD');
  // A two-commit self branch landed one commit at a time stays open until its last commit lands.
  fs.writeFileSync(path.join(two.path, 'scripts', 'b.mjs'), 'export const b = 2;\n');
  git(two.path, 'add', '-A');
  git(two.path, 'commit', '-q', '-m', 'r2');
  const r2 = git(two.path, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(two.path, 'scripts', 'b.mjs'), 'export const b = 3;\n');
  git(two.path, 'commit', '-q', '-am', 'r3');
  const r3 = git(two.path, 'rev-parse', 'HEAD');
  ledger.close();
  const out = await land({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(out.ok, JSON.stringify(out));
  let db = openSupervisorLedger({ env });
  assert.equal(jobOf(db.db, one.jobId).status, 'succeeded', 'land --commit of a self branch never leaves its job running');
  assert.equal(leaseConflicts(db.db, ['scripts/a.mjs']).length, 0, 'its leases no longer block a worker');
  assert.ok(!fs.existsSync(one.path));
  assert.equal(git(root, 'branch', '--list', `sup/${one.jobId}`), '');
  assert.equal(jobOf(db.db, two.jobId).status, 'running', 'an untouched self job stays open');
  db.close();
  const half = await land({ commits: [r2], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(half.ok, JSON.stringify(half));
  assert.deepEqual(half.selfPending.map((p) => p.jobId), [two.jobId]);
  db = openSupervisorLedger({ env });
  assert.equal(jobOf(db.db, two.jobId).status, 'running', 'a partly landed self branch keeps its checkout');
  db.close();
  const rest = await land({ commits: [r3], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(rest.ok, JSON.stringify(rest));
  db = openSupervisorLedger({ env });
  t.after(() => db.close());
  assert.equal(jobOf(db.db, two.jobId).status, 'succeeded');
  assert.equal(leaseConflicts(db.db, ['scripts/b.mjs']).length, 0);
});

/* ------------------------------------------------------------ secret scan */

test('the push secret scan names file, line and pattern, never the value', () => {
  const token = ['1234567890', ':AA', 'b'.repeat(33)].join('');
  const diff = `+++ b/src/x.ts\n@@ -1,0 +1,2 @@\n+const ok = 1;\n+const t = '${token}';\n`;
  const found = scanDiff({ diff, files: ['src/x.ts', '.env', '.env.example', 'keys/id_rsa'] });
  assert.deepEqual(found.map((f) => `${f.file}:${f.line}:${f.pattern}`).sort(), ['.env:null:env-file', 'keys/id_rsa:null:private-key-file', 'src/x.ts:2:telegram-bot-token'].sort());
  assert.ok(!JSON.stringify(found).includes(token));
});

test('the push secret scan skips a keyword-assigned value that names itself a fixture, never a token-shaped one', () => {
  const opaque = ['q8Zr', 'Lw3v', 'Tn7x', 'Kp2m'].join('');
  const bot = ['1234567890', ':AA', 'b'.repeat(33)].join('');
  const diff = ['+++ b/tools/stub-server.mjs', '@@ -1,0 +1,3 @@',
    '+  return ENVELOPE({ accessToken: "fixture-access-1" });',
    `+  const cfg = { accessToken: "${opaque}" };`,
    `+  const k = { password: "stub-xxxxxxxx", t: '${bot}' };`].join('\n');
  const found = scanDiff({ diff, files: ['tools/stub-server.mjs'] });
  assert.deepEqual(found.map((f) => `${f.line}:${f.pattern}`), ['2:assigned-secret', '3:telegram-bot-token']);
});

/* ------------------------------------------------------------ chat relay */

test('relay CLI: tell files a desktop message; its reply is recorded locally, never sent to Telegram', async (t) => {
  const env = envOf(t);
  const sent = tell('  what is blocking nivo?  ', { env });
  assert.ok(sent.ok);
  const item = readInbox(SUPERVISOR_ID, env).find((m) => m.id === sent.id);
  assert.equal(item.from, 'desktop');
  assert.equal(item.text, 'what is blocking nivo?');
  const r = await replyToOwner({ id: SUPERVISOR_ID, text: 'nivo waits on inc-x', to: sent.id }, { env, settings: { ready: false }, fetchImpl: () => assert.fail('no Telegram call') });
  assert.equal(r.via, 'desktop');
  assert.ok(readInbox(SUPERVISOR_ID, env).find((m) => m.id === sent.id).read, 'answered means read');
  const list = replies({ since: 0, env });
  assert.equal(list.length, 1);
  assert.equal(list[0].question, 'what is blocking nivo?');
  assert.equal(readOutbox(SUPERVISOR_ID, env)[0].via, 'desktop');
  assert.equal(tell('   ', { env }).ok, false);
  const now = Date.parse('2026-09-24T12:00:00Z');
  assert.equal(sinceMs('30m', now), now - 30 * 60_000);
  assert.equal(sinceMs('2026-09-24T11:00:00Z', now), Date.parse('2026-09-24T11:00:00Z'));
});

test('Telegram routing: owner text lands in the Supervisor kernel inbox; channel main belongs to the kernel terminal', async (t) => {
  const env = envOf(t);
  assert.match(registrationRefusal({ id: 'main', terminal: null, env }), /\[Supervisor\] kernel/);
  assert.equal(registrationRefusal({ id: 'main', terminal: 'term_s', seatTerminal: 'term_s', env }), null);
  assert.match(registrationRefusal({ id: 'main', terminal: 'term_other', seatTerminal: 'term_s', env }), /belongs to the \[Supervisor\] seat/);
  assert.equal(registrationRefusal({ id: 'sup-a', terminal: null, env }), null, 'other ids keep the old rules');
  registerSupervisor({ id: SUPERVISOR_ID, label: 'Supervisor', terminal: 'term_s' }, { env });
  const sentMessages = [];
  const bridge = createBridge({ env, sleepImpl: async () => {}, settings: () => ({ ready: true, token: 't', chatId: '42', language: 'en' }),
    fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); sentMessages.push(body); return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 9 } }) }; },
    statusMessages: () => ['progress'], supervisorStatus: async () => 'SUPERVISOR BLOCK' });
  await bridge.handleUpdate({ update_id: 1, message: { message_id: 5, date: 1, chat: { id: 42 }, from: { id: 42 }, text: 'restart nivo please' } });
  const inbox = readInbox(SUPERVISOR_ID, env);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].text, 'restart nivo please');
  await bridge.handleUpdate({ update_id: 2, message: { message_id: 6, date: 1, chat: { id: 42 }, from: { id: 42 }, text: '/status' } });
  assert.ok(sentMessages.some((m) => m.text === 'SUPERVISOR BLOCK'), '/status adds the Supervisor block');
  const plan = planWake({ now: Date.now(), lastTickAt: Date.now(), unread: inbox, registered: true });
  assert.deepEqual(plan.tags, ['inbox']);
  assert.ok(!plan.text.includes('restart nivo please'), 'owner text is never typed into the terminal');
  const again = planWake({ now: Date.now(), lastTickAt: Date.now(), unread: inbox, wakes: [{ at: Date.now(), payload: { inbox: [inbox[0].id], delivered: true } }] });
  assert.deepEqual(again.tags, [], 'an announced message is not re-woken inside the window');
  assert.deepEqual(planWake({ now: 10 * 60_000 + 1, lastTickAt: 0, pollIntervalMs: 600000 }).tags, ['tick']);
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'stall-alert', text: 'STALL-ALERT x' }, { env });
  assert.equal(readInbox(SUPERVISOR_ID, env).at(-1).from, 'stall-alert');
});

test('status block and clustering', (t) => {
  const env = envOf(t);
  const ledger = openSupervisorLedger({ env });
  ledger.appendEvent({ workflowId: 'wf-supervisor', entityType: 'tick', entityId: 'main', kind: 'supervisor-tick', payload: { owed: 12, clusters: 5 }, createdAt: Date.now() - 600_000 });
  ledger.appendEvent({ workflowId: 'wf-supervisor', entityType: 'tick', entityId: 'main', kind: 'supervisor-tick', payload: { owed: 9, clusters: 4 }, createdAt: Date.now() });
  const snap = supervisorSnapshot(ledger.db);
  ledger.close();
  const html = renderSupervisorBlock(snap, { language: 'en' });
  assert.match(html, /OWED: <b>9<\/b> ↓/);
  assert.match(html, /12 → 9/);
  const items = [
    { workflowId: 'w1', incidentId: 'inc-aaaaaaaaaaaa', kind: 'source-runtime-defect', labels: ['runtime'], summary: 'watchdog.mjs misreads spinner', ageMin: 5 },
    { workflowId: 'w2', incidentId: 'inc-bbbbbbbbbbbb', kind: 'runtime-contract-defect', labels: ['runtime'], summary: 'again watchdog.mjs spinner', ageMin: 9 },
    { workflowId: 'w2', incidentId: 'inc-cccccccccccc', kind: 'decision', labels: ['decision'], summary: 'pick a port', ageMin: 1 },
  ];
  const clusters = clusterOwed(items);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].size, 2);
  assert.deepEqual(clusters[0].workflows.sort(), ['w1', 'w2']);
});

/* ------------------------------------------------------------ 2026-09-24 live defects */

test('the Supervisor seat launches with its subagent tool denied; the prompt sends diagnosis to [Worker]s', async (t) => {
  const card = parseYaml(fs.readFileSync(new URL('../modules/models/agents/claude.yaml', import.meta.url), 'utf8'));
  const cmd = seatCommand({ agent: 'claude', model: 'claude-opus-5-5', effort: 'high', card });
  assert.equal(cmd, "claude --model claude-opus-5-5 --effort high --disallowedTools 'Agent,Task'");
  assert.equal(seatCommand({ agent: 'codex', card: { terminalFallback: { command: 'codex' } } }), null, 'no denial known: the card command stands');
  const env = envOf(t);
  const host = fakeHost();
  host.card = () => card;
  await launch(env, host);
  assert.match(host.calls.spawn[0].command, /--disallowedTools 'Agent,Task'/);
  const prompt = fs.readFileSync(new URL('../modules/supervisor/supervisor-prompt.md', import.meta.url), 'utf8');
  assert.match(prompt, /Diagnosis is a \[Worker\] job too/);
  assert.match(fs.readFileSync(new URL('../modules/supervisor/worker-prompt.md', import.meta.url), 'utf8'), /`diagnosed`/);
});

test('a diagnosis worker files outcome diagnosed; the watchdog announces it once with a [report] wake', (t) => {
  const env = envOf(t);
  const ledger = openSupervisorLedger({ env });
  t.after(() => ledger.close());
  const { job } = createJob(ledger, { cluster: 'diag', files: ['scripts/x.mjs'] });
  ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(job.job_id);
  assert.equal(fileReport(ledger, { jobId: job.job_id, outcome: 'diagnosed' }).ok, false, 'a diagnosis carries its findings');
  assert.ok(fileReport(ledger, { jobId: job.job_id, outcome: 'diagnosed', summary: 'root cause: x' }).ok);
  assert.equal(jobOf(ledger.db, job.job_id).status, 'succeeded');
  const first = planWake({ now: Date.now(), lastTickAt: Date.now(), filed: [job.job_id] });
  assert.deepEqual(first.tags, ['report']);
  assert.deepEqual(planWake({ now: Date.now(), lastTickAt: Date.now(), filed: [job.job_id], wakes: [{ at: Date.now(), payload: { report: [job.job_id], text: first.text } }] }).tags, []);
});

test('watchdog: a busy Supervisor (mid-turn, or idle input with subagents running) is never woken', async (t) => {
  const subagents = [
    '❯ Message @general-purpose…', '  ⏵⏵ bypass permissions on · 1 shell · ← for agents', '  ◯ main',
    '  ● general-purpose  Checking awaitSubmission import… 8m 41s · ↓ 154.0k tokens',
    '❯ ◯ general-purpose  Checking requiresProof keys in … 8m 37s · ↓ 146.7k tokens'].join('\n');
  assert.ok(busyScreen(subagents));
  assert.ok(!busyScreen('╭──╮\n❯ \n  ⏵⏵ bypass permissions on'), 'a plain idle prompt is not busy');
  assert.ok(!busyScreen('  ◯ main'), 'the main row alone is not a subagent');
  const env = envOf(t);
  const seed = await launch(env, fakeHost());
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'desktop', text: 'hi' }, { env });
  registerSupervisor({ id: SUPERVISOR_ID, label: 'S', terminal: seed.terminal }, { env });
  const woke = [];
  const d = (state, screen) => ({ verdict: () => ({ verdict: 'live' }), screen: () => screen, exitedRow: () => null, settleMs: 0, sleep: () => {},
    state: () => state, wake: (_t, text) => { woke.push(text); return { action: 'kernel-woken', delivered: true }; }, enter: () => ({ ok: true }),
    quit: () => null, close: () => ({ ok: true }), closeExited: () => null, replace: () => assert.fail('never') });
  assert.equal((await watchdogPass({ env, d: d('active', '✽ Working…') })).action, 'busy');
  assert.equal((await watchdogPass({ env, d: d('turn-idle', subagents) })).state, 'subagents-running');
  assert.equal(woke.length, 0);
  assert.equal((await watchdogPass({ env, d: d('turn-idle', '❯ ') })).action, 'woken');
  assert.equal(woke.length, 1);
  const again = await watchdogPass({ env, d: d('turn-idle', '❯ ') });
  assert.notEqual(again.action, 'woken', 'the same unread message is not announced twice');
  assert.equal(woke.length, 1);
});

test('watchdog: a wake whose proof failed still counts, and an identical text is never sent twice', () => {
  const now = Date.now();
  const unread = [{ id: 'aaaaaaaa-1' }];
  const first = planWake({ now, lastTickAt: now, unread });
  assert.match(first.text, /new aaaaaaaa/);
  const failed = [{ at: now, payload: { inbox: ['aaaaaaaa-1'], delivered: false, text: first.text } }];
  assert.deepEqual(planWake({ now: now + 1000, lastTickAt: now, unread, wakes: failed }).tags, [], 'an undelivered attempt is still an announcement');
  const later = planWake({ now: now + 11 * 60_000, lastTickAt: now + 11 * 60_000, unread, wakes: failed });
  assert.match(later.text, /still unread aaaaaaaa/, 'a reminder names itself, so it is not the same text');
  const tick = planWake({ now, lastTickAt: now - 11 * 60_000 });
  assert.equal(planWake({ now, lastTickAt: now - 11 * 60_000, wakes: [{ at: now - 11 * 60_000 - 1, payload: { tags: [], text: tick.text } }] }).duplicate, true);
});
