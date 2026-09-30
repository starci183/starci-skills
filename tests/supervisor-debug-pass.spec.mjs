import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLAIM_TTL_MS, LOOP_GRACE_MS, fixOwnerOf, loadState, loopLive, runPass, setupLoop, settleFix, statePath } from '../scripts/supervisor/debug-pass.mjs';
import { integrityFacts, worktreeFacts } from '../scripts/supervisor/core-watch.mjs';
import { claudeDebugSettings, durationMs } from '../engine/config.mjs';
import { parseYaml } from '../engine/yaml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'core-watch-snapshot.json');
const SNAP = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const T0 = Date.UTC(2026, 9, 1, 3, 10);
const empty = () => ({ loop: null, fixes: {} });
const SETTINGS = claudeDebugSettings({ claudeDebug: { interval: '10m', worktreeLimit: 40 } });

test('the loop interval and worktree limit come from config.yaml claudeDebug, validated; the default lives only in config.example.yaml', () => {
  assert.deepEqual(SETTINGS, { interval: '10m', intervalMs: 600_000, worktreeLimit: 40 });
  assert.deepEqual(claudeDebugSettings({ claudeDebug: { interval: '90s', worktreeLimit: 3 } }), { interval: '90s', intervalMs: 90_000, worktreeLimit: 3 });
  assert.throws(() => claudeDebugSettings({}), /claudeDebug is missing/);
  assert.throws(() => claudeDebugSettings({ claudeDebug: { interval: 'soon', worktreeLimit: 40 } }), /interval must be/);
  assert.throws(() => claudeDebugSettings({ claudeDebug: { interval: '0m', worktreeLimit: 40 } }), /interval must be/);
  assert.throws(() => claudeDebugSettings({ claudeDebug: { interval: '10m', worktreeLimit: 0 } }), /worktreeLimit/);
  assert.throws(() => claudeDebugSettings({ claudeDebug: { interval: '10m', worktreeLimit: 40, every: 1 } }), /unknown key every/);
  const example = parseYaml(fs.readFileSync(path.join(ROOT, 'config.example.yaml'), 'utf8'));
  assert.deepEqual(claudeDebugSettings(example).intervalMs, durationMs(example.claudeDebug.interval));
  const setup = setupLoop(empty(), { now: T0, settings: claudeDebugSettings({ claudeDebug: { interval: '15m', worktreeLimit: 40 } }) });
  assert.equal(setup.loop.interval, '15m', 'setup takes the interval from config');
  assert.equal(setup.loop.intervalMs, 900_000);
});

test('setup creates exactly one loop; a second setup creates none', () => {
  const state = empty();
  const started = [];
  const first = setupLoop(state, { now: T0, settings: SETTINGS, startLoop: (l) => started.push(l.id) });
  const second = setupLoop(state, { now: T0 + 60_000, settings: SETTINGS, startLoop: (l) => started.push(l.id) });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.loop.id, first.loop.id);
  assert.deepEqual(started, [first.loop.id]);
});

test('a loop that stopped passing is stale and the next setup replaces it; a passing loop stays live', () => {
  const state = empty();
  const { loop } = setupLoop(state, { now: T0, settings: SETTINGS });
  const deadline = T0 + 2 * loop.intervalMs + LOOP_GRACE_MS;
  assert.equal(loopLive(loop, deadline), true);
  assert.equal(loopLive(loop, deadline + 1), false);
  runPass(state, { alerts: [] }, { now: deadline, dispatch: () => null });
  assert.equal(loopLive(state.loop, deadline + 1), true, 'a pass keeps the loop live');
  const later = deadline + 2 * loop.intervalMs + LOOP_GRACE_MS + 1;
  const again = setupLoop(state, { now: later, settings: SETTINGS });
  assert.equal(again.created, true);
  assert.equal(again.replaced.id, loop.id);
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
  const main = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-integrity-'));
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

test('worktrees: over the configured limit or with a vanished directory is an alert; owner asks and config route to the owner', () => {
  const porcelain = ['worktree D:/r', 'branch refs/heads/main', '', 'worktree D:/lanes/a', 'branch refs/heads/lane/a', '',
    'worktree D:/lanes/b', 'branch refs/heads/lane/b', 'prunable gitdir file points to non-existent location', ''].join('\n');
  const facts = worktreeFacts(['D:/r'], { worktreeLimit: 2, git: () => ({ ok: true, stdout: porcelain, error: '' }), exists: () => true });
  assert.equal(facts.get('worktrees:r'), '3 worktrees (limit 2); 1 orphan (directory gone): D:/lanes/b');
  const one = worktreeFacts(['D:/r'], { worktreeLimit: 5, git: () => ({ ok: true, stdout: 'worktree D:/r\nbranch refs/heads/main\n', error: '' }), exists: () => true });
  assert.equal(one.get('worktrees:r'), null);
  assert.equal(fixOwnerOf('wf:nivo:auth:owner'), 'owner');
  assert.equal(fixOwnerOf('config:claudeDebug'), 'owner');
  assert.equal(fixOwnerOf('integrity:node_modules'), 'core');
});

test('CLI: pass twice over the recorded snapshot dispatches once, in a temp state root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-pass-'));
  const env = { ...process.env, STARCI_LOCAL_ROOT: root };
  const run = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/supervisor/debug-pass.mjs', ...args], { cwd: ROOT, env, encoding: 'utf8' }));
  try {
    const first = run('pass', '--snapshot', FIXTURE);
    assert.equal(first.dispatched.length, 3);
    assert.equal(first.loop, null, 'a pass without setup records no loop');
    assert.equal(loadState(statePath(env)).fixes.engine.state, 'dispatching');
    assert.deepEqual(run('pass', '--snapshot', FIXTURE).dispatched, []);
    assert.equal(run('claim', '--key', 'engine', '--lane', 'fix-engine').state, 'fixing');
    assert.equal(run('stop').stopped, null);
    assert.equal(run('status').loop, null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
