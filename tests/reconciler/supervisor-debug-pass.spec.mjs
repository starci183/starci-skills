import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLAIM_TTL_MS, LOOP_GRACE_MS, bindLoop, blockLoop, fixOwnerOf, loadState, loopLive, requireScheduledLoop, runPass, setupLoop, settleFix, statePath, stopLoop } from '../../scripts/reconciler/debug-pass.mjs';
import { integrityFacts, worktreeFacts } from '../../scripts/reconciler/core-watch.mjs';
import { coreDebugSettings, durationMs } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'core-watch-snapshot.json');
const SNAP = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const T0 = Date.UTC(2026, 9, 1, 3, 10);
const empty = () => ({ loop: null, fixes: {} });
const SETTINGS = coreDebugSettings({ coreDebug: { interval: '10m', worktreeLimit: 40 } });

test('the loop interval and worktree limit come from config.yaml coreDebug, validated; the default lives only in config.example.yaml', () => {
  assert.deepEqual(SETTINGS, { interval: '10m', intervalMs: 600_000, worktreeLimit: 40 });
  assert.deepEqual(coreDebugSettings({ coreDebug: { interval: '90s', worktreeLimit: 3 } }), { interval: '90s', intervalMs: 90_000, worktreeLimit: 3 });
  assert.throws(() => coreDebugSettings({}), /coreDebug is missing/);
  assert.throws(() => coreDebugSettings({ coreDebug: { interval: 'soon', worktreeLimit: 40 } }), /interval must be/);
  assert.throws(() => coreDebugSettings({ coreDebug: { interval: '0m', worktreeLimit: 40 } }), /interval must be/);
  assert.throws(() => coreDebugSettings({ coreDebug: { interval: '10m', worktreeLimit: 0 } }), /worktreeLimit/);
  assert.throws(() => coreDebugSettings({ coreDebug: { interval: '10m', worktreeLimit: 40, every: 1 } }), /unknown key every/);
  const example = parseYaml(fs.readFileSync(path.join(ROOT, 'config.example.yaml'), 'utf8'));
  assert.deepEqual(coreDebugSettings(example).intervalMs, durationMs(example.coreDebug.interval));
  const setup = setupLoop(empty(), { now: T0, settings: coreDebugSettings({ coreDebug: { interval: '15m', worktreeLimit: 40 } }) });
  assert.equal(setup.loop.interval, '15m', 'setup takes the interval from config');
  assert.equal(setup.loop.intervalMs, 900_000);
});

test('setup reserves exactly one slot without pretending a native scheduler started', () => {
  const state = empty();
  const first = setupLoop(state, { now: T0, settings: SETTINGS });
  const second = setupLoop(state, { now: T0 + 60_000, settings: SETTINGS });
  assert.equal(first.created, true);
  assert.equal(first.scheduled, false);
  assert.equal(first.live, false);
  assert.equal(first.loop.scheduler, null);
  assert.equal(first.loop.status, 'reserved');
  assert.equal(second.created, false);
  assert.equal(second.loop.id, first.loop.id);
  assert.equal(setupLoop(state, { now: T0 + 7 * 86400_000, settings: SETTINGS }).created, false, 'unknown create outcome never expires into a repeated creation');
});

test('a stale durable heartbeat remains held until its exact native cancellation is confirmed', () => {
  const state = empty();
  const { loop } = setupLoop(state, { now: T0, settings: SETTINGS });
  const bind = { now: T0, loopId: loop.id, scheduler: 'codex-heartbeat', schedulerId: 'automation-one', confirmed: true };
  assert.throws(() => bindLoop(state, { ...bind, confirmed: false }), /confirmed native/);
  assert.throws(() => bindLoop(state, { ...bind, loopId: 'foreign' }), /ID does not match/);
  assert.throws(() => bindLoop(state, { ...bind, scheduler: 'devin-loop' }), /confirmed native/);
  assert.equal(bindLoop(state, bind).bound, true);
  assert.equal(bindLoop(state, bind).bound, false, 'exact binding replay is idempotent');
  assert.throws(() => bindLoop(state, { ...bind, schedulerId: 'automation-two' }), /binding already exists/);
  assert.equal(loopLive(loop, T0), false, 'accepted scheduler creation is not proof a tick ran');
  runPass(state, { alerts: [] }, { now: T0, loopId: loop.id, dispatch: () => null });
  const deadline = T0 + 2 * loop.intervalMs + LOOP_GRACE_MS;
  assert.equal(loopLive(loop, deadline), true);
  assert.equal(loopLive(loop, deadline + 1), false);
  runPass(state, { alerts: [] }, { now: deadline + 1, dispatch: () => null });
  assert.equal(loop.lastPassAt, T0, 'a manual pass does not renew another scheduler');
  assert.equal(loopLive(loop, deadline + 1), false);
  const later = deadline + 2 * loop.intervalMs + LOOP_GRACE_MS;
  assert.equal(setupLoop(state, { now: later, settings: SETTINGS }).created, false);
  const stop = { loopId: loop.id, schedulerId: 'automation-one', confirmation: 'cancelled', confirmed: true };
  assert.throws(() => stopLoop(state, { ...stop, confirmed: false }), /native cancellation/);
  assert.throws(() => stopLoop(state, { ...stop, schedulerId: 'automation-two' }), /does not match/);
  assert.throws(() => stopLoop(state, { ...stop, confirmation: 'ended' }), /does not match/, 'a durable heartbeat needs cancellation, not an absent chat process');
  assert.equal(state.loop.id, loop.id);
  assert.equal(stopLoop(state, stop).stopped, loop.id);
  const again = setupLoop(state, { now: later, settings: SETTINGS });
  assert.equal(again.created, true);
  assert.notEqual(again.loop.id, loop.id);
  assert.throws(() => requireScheduledLoop(state, loop.id), /ID does not match/, 'a cancelled scheduler tick cannot reach its replacement');
  assert.throws(() => runPass(state, SNAP, { now: later, loopId: loop.id, dispatch: () => assert.fail('stale tick dispatched') }), /ID does not match/);
  assert.deepEqual(state.fixes, {});
});

test('an ended native Claude loop can release its slot only with exact confirmed closure', () => {
  const state = empty();
  const { loop } = setupLoop(state, { now: T0, settings: SETTINGS });
  bindLoop(state, { now: T0, loopId: loop.id, scheduler: 'claude-loop', schedulerId: 'claude-task-one', confirmed: true });
  assert.throws(() => stopLoop(state, { loopId: loop.id, schedulerId: 'claude-task-one', confirmation: 'ended' }), /native cancellation/);
  assert.equal(stopLoop(state, { loopId: loop.id, schedulerId: 'claude-task-one', confirmation: 'ended', confirmed: true }).stopped, loop.id);
  assert.equal(setupLoop(state, { now: T0, settings: SETTINGS }).created, true, 'known authoritative closure does not leave an ended loop held forever');
});

test('unsupported local recurrence is visibly blocked and an uncertain create cannot be cleared by age', () => {
  const state = empty();
  const { loop } = setupLoop(state, { now: T0, settings: SETTINGS });
  const out = blockLoop(state, { loopId: loop.id, reason: 'local Devin recurrence has no verified native facility' });
  assert.equal(out.blocked, true);
  assert.equal(out.scheduled, false);
  assert.equal(out.live, false);
  runPass(state, { alerts: [] }, { now: T0, dispatch: () => null });
  assert.equal(loop.lastPassAt, null);
  assert.equal(setupLoop(state, { now: T0 + 7 * 86400_000, settings: SETTINGS }).created, false);
  assert.throws(() => stopLoop(state, { loopId: loop.id, confirmation: 'not-created', confirmed: false }), /native cancellation/);
  assert.throws(() => stopLoop(state, { loopId: loop.id, confirmation: 'cancelled', confirmed: true }), /uncertain/);
  assert.equal(stopLoop(state, { loopId: loop.id, confirmation: 'not-created', confirmed: true }).stopped, loop.id);
});

test('a pass dispatches each alert of the recorded snapshot exactly once', () => {
  const state = empty();
  const calls = [];
  const { dispatched, rows } = runPass(state, SNAP, { now: T0, dispatch: (a) => { calls.push(a.key); return a.key === 'engine' ? { lane: 'fix-engine' } : null; } });
  assert.deepEqual(calls, SNAP.alerts.map((a) => a.key));
  assert.equal(dispatched.length, 3);
  assert.equal(state.fixes.engine.state, 'fixing');
  assert.equal(state.fixes['service:harness-tunnel'].state, 'dispatching');
  assert.deepEqual(rows.map((r) => r.state), ['fixing', 'dispatching', 'dispatching']);
  assert.deepEqual(rows.map((r) => r.fixOwner), ['core', 'core', 'core']);
});

test('a second pass with the same alerts dispatches nothing new, even when the alert text changed', () => {
  const state = empty();
  runPass(state, SNAP, { now: T0, dispatch: () => null });
  const changed = { ...SNAP, alerts: SNAP.alerts.map((a) => (a.key === 'engine' ? { ...a, text: 'leader STALE heartbeat 812s' } : a)) };
  const calls = [];
  const second = runPass(state, changed, { now: T0 + 600_000, dispatch: (a) => { calls.push(a.key); return null; } });
  assert.deepEqual(calls, []);
  assert.deepEqual(second.dispatched, []);
  assert.equal(state.fixes.engine.text, 'leader STALE heartbeat 812s');
});

test('a cleared alert closes its fix; an unclaimed reservation past the TTL is dispatched again; claim and note bind it', () => {
  const state = empty();
  runPass(state, SNAP, { now: T0, dispatch: () => null });
  settleFix(state, 'engine', { now: T0, lane: 'fix-engine' });
  settleFix(state, 'wf:nivo:auth-login:leg:impl.login:job-7', { now: T0, reason: 'workflow evidence only' });
  assert.throws(() => settleFix(state, 'service:nope', { now: T0, lane: 'x' }), /no open alert/);
  const later = T0 + CLAIM_TTL_MS + 1;
  const calls = [];
  const { rows } = runPass(state, { alerts: SNAP.alerts.slice(1) }, { now: later, dispatch: (a) => { calls.push(a.key); return null; } });
  assert.deepEqual(calls, ['service:harness-tunnel'], 'only the unclaimed reservation is dispatched again');
  assert.equal(rows.find((r) => r.key === 'engine').state, 'resolved');
  assert.equal(state.fixes.engine, undefined);
  assert.equal(state.fixes['wf:nivo:auth-login:leg:impl.login:job-7'].state, 'noted');
  assert.deepEqual(settleFix(state, 'service:harness-tunnel', { now: later, release: true }), { key: 'service:harness-tunnel', released: true });
});

test('main-checkout integrity: a deleted tracked file and an empty node_modules are diagnosed and dispatched once to a core lane', () => {
  const main = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-debug-integrity-'));
  const git = (...args) => execFileSync('git', args, { cwd: main, encoding: 'utf8', windowsHide: true });
  try {
    git('init', '-q');
    fs.writeFileSync(path.join(main, 'kept.mjs'), 'export {};\n');
    fs.writeFileSync(path.join(main, 'gone.mjs'), 'export {};\n');
    git('add', '.');
    git('-c', 'user.name=spec', '-c', 'user.email=spec@example.invalid', 'commit', '-q', '-m', 'fixture');
    fs.rmSync(path.join(main, 'gone.mjs'));
    fs.mkdirSync(path.join(main, 'node_modules'));
    fs.mkdirSync(path.join(main, 'packages', 'node_modules', 'acorn'), { recursive: true });
    const facts = integrityFacts(main);
    assert.match(facts.get('integrity:tracked-deleted'), /^1 tracked file\(s\) deleted .*gone\.mjs/);
    assert.match(facts.get('integrity:node_modules'), /node_modules is empty/);
    assert.equal(facts.get('integrity:packages/node_modules'), null, 'a populated packages/node_modules is ok');
    const alerts = [...facts].filter(([, t]) => t).map(([key, text]) => ({ key, text }));
    const state = empty();
    const calls = [];
    const first = runPass(state, { alerts }, { now: T0, dispatch: (a) => { calls.push(a); return null; } });
    assert.deepEqual(first.dispatched.map((d) => [d.key, d.fixOwner]), [['integrity:tracked-deleted', 'core'], ['integrity:node_modules', 'core']]);
    runPass(state, { alerts }, { now: T0 + 600_000, dispatch: (a) => { calls.push(a); return null; } });
    assert.equal(calls.length, 2, 'the second pass dispatches nothing new');
    fs.rmSync(path.join(main, 'packages', 'node_modules'), { recursive: true });
    assert.match(integrityFacts(main).get('integrity:packages/node_modules'), /missing/);
  } finally { fs.rmSync(main, { recursive: true, force: true }); }
});

test('worktrees (Orca worktree ps): over the limit, a vanished directory or an unregistered stamped tree is an alert; owner asks and config route to the owner', () => {
  const row = (id, p, o = {}) => ({ id: `r1::${p}`, repoId: 'r1', hostId: 'local', path: p, branch: id, comment: '', isMainWorktree: false, liveTerminalCount: 0, ...o });
  const page = { ok: true, truncated: false, omittedHostIds: [], worktrees: [row('main', 'r', { isMainWorktree: true }), row('lane/a', 'lanes/a'), row('lane/b', 'lanes/b'),
    row('wf-x', 'orca/wf-x', { comment: 'starci:workflow:wf-x;wf=x' }), row('wf-y', 'orca/wf-y', { comment: 'starci:workflow:wf-y;wf=y' }),
    { ...row('other', 'q/other'), repoId: 'r2' }] };
  const facts = worktreeFacts(['r'], { worktreeLimit: 2, ps: () => page, registered: () => new Set(['r1::orca/wf-y']), exists: (p) => p !== 'lanes/b' });
  assert.equal(facts.get('worktrees:r'), '5 worktrees (limit 2); 1 orphan (directory gone): lanes/b; 1 runtime-stamped tree(s) with no registry row: orca/wf-x');
  assert.equal(facts.get('worktrees:orca'), null);
  const one = worktreeFacts(['r', 'unknown'], { worktreeLimit: 5, ps: () => ({ ...page, worktrees: page.worktrees.slice(0, 2) }), registered: () => new Set(), exists: () => true });
  assert.deepEqual([one.get('worktrees:r'), one.get('worktrees:unknown')], [null, null], 'an unstamped lane is no orphan; a repository Orca does not know has nothing to judge');
  const down = worktreeFacts(['r'], { ps: () => ({ ok: false, error: 'orca runtime not reachable' }), registered: () => new Set() });
  assert.equal(down.get('worktrees:orca'), 'orca worktree ps failed: orca runtime not reachable');
  assert.equal(fixOwnerOf('wf:nivo:auth:owner'), 'owner');
  assert.equal(fixOwnerOf('config:coreDebug'), 'owner');
  assert.equal(fixOwnerOf('integrity:node_modules'), 'core');
});

test('CLI: pass twice over the recorded snapshot dispatches once, in a temp state root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-debug-pass-'));
  const env = { ...process.env, STARCI_LOCAL_ROOT: root };
  const run = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/reconciler/debug-pass.mjs', ...args], { cwd: ROOT, env, encoding: 'utf8' }));
  try {
    const first = run('pass', '--snapshot', FIXTURE);
    assert.equal(first.dispatched.length, 3);
    assert.equal(first.loop, null, 'a pass without setup records no loop');
    assert.equal(loadState(statePath(env)).fixes.engine.state, 'dispatching');
    assert.deepEqual(run('pass', '--snapshot', FIXTURE).dispatched, []);
    assert.equal(run('claim', '--key', 'engine', '--lane', 'fix-engine').state, 'fixing');
    assert.throws(() => run('stop'), /ID does not match/, 'stop without a held identity cannot clear custody');
    assert.equal(run('status').loop, null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('CLI binding, cancellation and scheduled-pass fencing use a private durable state file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-debug-binding-'));
  const env = { ...process.env, STARCI_LOCAL_ROOT: root };
  const run = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/reconciler/debug-pass.mjs', ...args], { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  try {
    const setup = run('setup');
    assert.equal(setup.live, false);
    assert.equal(run('status').scheduled, false);
    assert.equal(run('setup').created, false);
    const id = setup.loop.id;
    assert.throws(() => run('pass', '--loop-id', id, '--snapshot', 'must-not-be-read.json'), /no confirmed native scheduler/);
    assert.equal(run('bind', '--loop-id', id, '--scheduler', 'codex-heartbeat', '--scheduler-id', 'fixture-heartbeat', '--confirmed').bound, true);
    assert.equal(run('status').live, false);
    assert.throws(() => run('pass', '--loop-id', 'foreign', '--snapshot', 'must-not-be-read.json'), /ID does not match/, 'fencing precedes snapshot collection');
    assert.equal(run('pass', '--loop-id', id, '--snapshot', FIXTURE).dispatched.length, 3);
    assert.equal(run('status').live, true);
    assert.throws(() => run('stop', '--loop-id', id, '--scheduler-id', 'foreign', '--confirmation', 'cancelled', '--confirmed'), /does not match/);
    assert.equal(run('status').loop.scheduler.id, 'fixture-heartbeat');
    assert.equal(run('stop', '--loop-id', id, '--scheduler-id', 'fixture-heartbeat', '--confirmation', 'cancelled', '--confirmed').stopped, id);
    assert.equal(run('status').loop, null);
    assert.equal(run('status').fixes.engine.state, 'dispatching', 'cancelled scheduling preserves alert ownership');
    fs.writeFileSync(statePath(env), '{broken');
    assert.throws(() => run('setup'), /JSON|Unexpected/, 'unreadable existing custody cannot authorize creation');
    assert.equal(fs.readFileSync(statePath(env), 'utf8'), '{broken');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('concurrent CLI setup contenders create one durable scheduler reservation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-debug-concurrent-'));
  const env = { ...process.env, STARCI_LOCAL_ROOT: root };
  const setup = () => new Promise((resolve, reject) => {
    execFile(process.execPath, ['scripts/reconciler/debug-pass.mjs', 'setup'], { cwd: ROOT, env, encoding: 'utf8' }, (error, stdout, stderr) => {
      try { resolve({ exit: error?.code ?? 0, out: JSON.parse(stdout) }); } catch (failure) { reject(new Error(`${failure.message}: ${stderr}`)); }
    });
  });
  try {
    const results = await Promise.all([setup(), setup(), setup()]);
    assert.equal(results.filter(({ out }) => out.created === true).length, 1);
    const id = loadState(statePath(env)).loop.id;
    for (const { exit, out } of results) {
      if (exit === 0) assert.equal(out.loop.id, id);
      else { assert.equal(exit, 1); assert.equal(out.reason, 'held'); }
    }
    assert.equal(loadState(statePath(env)).loop.status, 'reserved');
    assert.deepEqual(loadState(statePath(env)).fixes, {});
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
