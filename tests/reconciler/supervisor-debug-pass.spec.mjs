import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLAIM_TTL_MS, fixOwnerOf, loadState, runPass, settleFix, diagnosticAction, requireDiagnosticSeat } from '../../scripts/reconciler/debug-pass.mjs';
import { integrityFacts, worktreeFacts } from '../../scripts/reconciler/core-watch.mjs';
import { coreDebugSettings, durationMs } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { writeSeat, setEnabled, seatOf } from '../../scripts/machine/home.mjs';
import { coreDebugProfile, stopCoreDebug } from '../../scripts/reconciler/core-debug.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'core-watch-snapshot.json');
const SNAP = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const T0 = Date.UTC(2026, 9, 1, 3, 10);
const empty = () => ({ fixes: {}, lastPassAt: null });

test('core cadence and worktree threshold read the owner block without duplicating defaults', () => {
  assert.deepEqual(coreDebugSettings({ coreDebug: { interval: '90s', worktreeLimit: 3 } }), { interval: '90s', intervalMs: 90_000, worktreeLimit: 3 });
  assert.throws(() => coreDebugSettings({}), /coreDebug is missing/);
  assert.throws(() => coreDebugSettings({ coreDebug: { interval: 'soon', worktreeLimit: 3 } }), /interval/);
  const example = parseYaml(fs.readFileSync(path.join(ROOT, 'config.example.yaml'), 'utf8'));
  assert.equal(coreDebugSettings(example).intervalMs, durationMs(example.coreDebug.interval));
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


test('machine diagnostic state persists across handles and fences an obsolete native Dispatch', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-diag-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  const m = openMachine({ env }), profile = coreDebugProfile();
  try {
    writeSeat(m, { token: 'debug-one', profile, value: { dispatch: 'dispatch-one', terminal: 'term-one' }, now: T0 });
    setEnabled(m, true, { profile, now: T0 });
    assert.throws(() => requireDiagnosticSeat(m, 'foreign'), /does not match/);
    assert.equal(diagnosticAction(m, 'pass', { snapshot: SNAP, dispatch: 'dispatch-one' }, T0).dispatched.length, 3);
    diagnosticAction(m, 'claim', { key: 'engine', lane: 'fix-engine', dispatch: 'dispatch-one' }, T0);
    assert.equal(diagnosticAction(m, 'pass', { snapshot: SNAP, dispatch: 'dispatch-one' }, T0 + 1).dispatched.length, 0);
    writeSeat(m, { token: 'debug-two', profile, value: { dispatch: 'dispatch-two', terminal: 'term-two' }, now: T0 + 2 });
    const before = loadState(m);
    assert.throws(() => diagnosticAction(m, 'release', { key: 'engine', dispatch: 'dispatch-one' }, T0 + 3), /does not match/);
    assert.deepEqual(loadState(m), before);
  } finally { m.close(); }
  const fresh = openMachine({ env });
  try { assert.equal(loadState(fresh).fixes.engine.lane, 'fix-engine'); }
  finally { fresh.close(); }
  assert.equal(fs.existsSync(path.join(root, 'debug', 'state.json')), false);
});

test('disabled held custody refuses worker diagnostic mutation while retaining the prior state', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-diag-disabled-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  const m = openMachine({ env }), profile = coreDebugProfile();
  try {
    writeSeat(m, { token: 'held', profile, value: { dispatch: 'held-dispatch', terminal: 'held-terminal' } });
    setEnabled(m, true, { profile });
    diagnosticAction(m, 'pass', { snapshot: SNAP, dispatch: 'held-dispatch' }, T0);
    const before = loadState(m);
    const stopped = await stopCoreDebug({ env, deps: { host: {
      stop: () => ({ ok: true }), release: () => ({ ok: false, effectState: 'unknown' })
    } } });
    assert.equal(stopped.ok, false);
    assert.equal(stopped.action, 'stop-unproven');
    assert.throws(() => diagnosticAction(m, 'release', { key: 'engine', dispatch: 'held-dispatch' }, T0 + 1), /enabled held native maintenance seat/);
    assert.deepEqual(loadState(m), before);
    assert.equal(seatOf(m, Date.now(), profile).value.dispatch, 'held-dispatch');
    assert.equal(diagnosticAction(m, 'note', { key: 'engine', reason: 'owner retains the diagnosis' }, T0 + 2).state, 'noted');
  } finally { m.close(); }
});

test('concurrent CLI passes serialize diagnostic custody through the machine writer', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-diag-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  const seed = openMachine({ env }); seed.close();
  const run = (...args) => new Promise((resolve, reject) => execFile(process.execPath, ['scripts/reconciler/debug-pass.mjs', ...args],
    { cwd: ROOT, env, encoding: 'utf8' }, (error, stdout, stderr) => error ? reject(new Error(stderr)) : resolve(JSON.parse(stdout))));
  const results = await Promise.all([run('pass', '--snapshot', FIXTURE), run('pass', '--snapshot', FIXTURE)]);
  assert.deepEqual(results.map(result => result.dispatched.length).sort(), [0, 3]);
  assert.equal(Object.keys((await run('status')).fixes).length, 3);
  const retired = await new Promise(resolve => execFile(process.execPath, ['scripts/reconciler/debug-pass.mjs', 'setup'],
    { cwd: ROOT, env, encoding: 'utf8' }, error => resolve(error?.code ?? 0)));
  assert.equal(retired, 2);
});

test('a stale diagnostic CLI Dispatch is refused before its snapshot file is read', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-diag-fence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  const m = openMachine({ env });
  try {
    writeSeat(m, { token: 'held', profile: coreDebugProfile(), value: { dispatch: 'current', terminal: 'term-current' } });
    setEnabled(m, true, { profile: coreDebugProfile() });
  }
  finally { m.close(); }
  assert.throws(() => execFileSync(process.execPath, ['scripts/reconciler/debug-pass.mjs', 'pass', '--dispatch', 'stale', '--snapshot', 'missing-must-not-be-read.json'],
    { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), /Dispatch does not match/);
});
