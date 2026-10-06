// worker-accounting.spec.mjs — worker accounting through Orca's orchestration worker-list (lane WLIST): the
// scripts/machine/worker-list-all.mjs pager over the scripts/api/orca/worker-list.mjs call (driven through the shared fake Orca, never the live host), the pure reads of
// scripts/lib/worker-accounting.mjs, the lane-owner rule, and the current machine.sqlite schema (terminals keeps shell sightings only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { workerListAll, activeWorkersAllRuns } from '../../scripts/machine/worker-list-all.mjs';
import { releasePlan, workerTerminalHandles, activeWorkerOn, worktreePathOf } from '../../scripts/lib/worker-accounting.mjs';
import { laneOwnerOf } from '../../scripts/machine/lane-owner.mjs';
import { MACHINE_VERSION, openMachine } from '../../engine/db/machine.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const WRAPPER = path.join(ROOT, 'scripts', 'machine', 'worker-list-all.mjs');

const row = (dispatchId, { run = 'run_a', terminalState = 'reclaimable', liveness = 'exited', argv = null, worktree = 'lanes/x' } = {}) => ({
  dispatchId, runId: run, workerState: 'succeeded', terminalState, agentTerminalHandle: `term_${dispatchId}`,
  resource: { terminalHandle: `term_${dispatchId}`, worktreeId: `repo-1::${worktree}` },
  projection: { liveness: { verdict: liveness }, nextAction: { kind: argv ? 'release' : 'none', argv: argv ?? [] } },
});
const releaseArgv = (id) => ['orca', 'orchestration', 'worker-release', '--dispatch', id, '--json'];

test('worker-list wrapper: --run and --terminal-state reach Orca, and every page is followed with the cursor unchanged', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-worker-list-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const state = path.join(dir, 'state.json'), log = path.join(dir, 'calls.jsonl');
  const rows = [...Array.from({ length: 230 }, (_, i) => row(`ctx_${i}`)), row('ctx_other', { run: 'run_b' }), row('ctx_live', { terminalState: 'active' })];
  fs.writeFileSync(state, JSON.stringify({ workerRows: rows }));
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]), STARCI_FAKE_ORCA_STATE: state, STARCI_FAKE_ORCA_LOG: log };
  const r = spawnSync(process.execPath, [WRAPPER, '--run', 'run_a', '--terminal-state', 'reclaimable'], { encoding: 'utf8', env, windowsHide: true, timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.workers.length, 230, 'paged past 100 rows');
  assert.equal(out.pages, 3);
  assert.deepEqual(out.scope, { source: 'flag' });
  const argvs = fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l).argv).filter((a) => a.includes('worker-list'));
  assert.equal(argvs.length, 3);
  for (const a of argvs) assert.ok(a.includes('--run') && a[a.indexOf('--run') + 1] === 'run_a' && a.includes('--terminal-state') && a.includes('--json'), a.join(' '));
  assert.deepEqual(argvs.map((a) => (a.includes('--cursor') ? a[a.indexOf('--cursor') + 1] : null)), [null, '100', '200']);
});

test('workerListAll: a failed page fails the listing, and a cursor that never ends is cut off', () => {
  let n = 0;
  const failing = workerListAll({ run: 'r', list: () => (++n === 1 ? { ok: true, workers: [row('a')], page: { hasMore: true, nextCursor: 'c1' } } : { ok: false, error: 'runtime_unavailable' }) });
  assert.deepEqual([failing.ok, failing.error, failing.workers.length], [false, 'runtime_unavailable', 1]);
  const endless = workerListAll({ run: 'r', maxPages: 3, list: () => ({ ok: true, workers: [], page: { hasMore: true, nextCursor: 'again' } }) });
  assert.equal(endless.ok, false);
  assert.match(endless.error, /after 3 pages/);
});

test('activeWorkersAllRuns: only a listing over every Run counts; a bound or failed one is null', () => {
  assert.deepEqual(activeWorkersAllRuns({ list: () => ({ ok: true, workers: [row('a', { terminalState: 'active' })], scope: { source: 'all' } }) }).map((w) => w.dispatchId), ['a']);
  assert.equal(activeWorkersAllRuns({ list: () => ({ ok: true, workers: [], scope: { source: 'bound' } }) }), null);
  assert.equal(activeWorkersAllRuns({ list: () => ({ ok: false }) }), null);
  assert.equal(activeWorkersAllRuns({ list: () => { throw Error('ENOENT'); } }), null);
});

test('releasePlan: release a reclaimable worker (liveness live, exited or unverifiable) whose nextAction is worker-release of itself', () => {
  const plan = Object.fromEntries(releasePlan([
    row('ok', { argv: releaseArgv('ok') }),
    row('live', { liveness: 'live', argv: releaseArgv('live') }),
    row('unv', { liveness: 'unverifiable', argv: releaseArgv('unv') }),
    row('missing', { liveness: null, argv: releaseArgv('missing') }),
    row('stop', { argv: ['orca', 'orchestration', 'worker-stop', '--dispatch', 'stop'] }),
    row('other', { argv: releaseArgv('someone-else') }),
    row('unknown', { terminalState: 'release_unknown', argv: releaseArgv('unknown') }),
    row('active', { terminalState: 'active', liveness: 'live' }),
    row('retained', { terminalState: 'retained' }),
  ]).map((d) => [d.dispatchId, d.verdict]));
  assert.deepEqual(plan, { ok: 'release', live: 'release', unv: 'release', missing: 'refuse', stop: 'refuse', other: 'refuse', unknown: 'refuse', active: 'keep', retained: 'keep' });
});

test('workerTerminalHandles names every terminal Orca has not released; worktreePathOf reads Orca\'s worktree id', () => {
  const handles = workerTerminalHandles([row('a', { terminalState: 'active' }), row('b'), row('c', { terminalState: 'released' }), row('d', { terminalState: 'release_unknown' })]);
  assert.deepEqual([...handles].sort(), ['term_a', 'term_b', 'term_d']);
  assert.equal(worktreePathOf(row('a', { worktree: 'starci-lanes/dv/c0-wlist' })), 'starci-lanes/dv/c0-wlist');
  assert.equal(worktreePathOf({ projection: { workspace: { id: 'repo::wt-x' } } }), 'wt-x');
  assert.equal(worktreePathOf({}), null);
});

test('lane owner: an active worker in the lane or below it owns it; a released one, a sibling prefix or a title does not', () => {
  const lane = path.resolve('/lanes/slim');
  const inLane = row('w1', { terminalState: 'active', worktree: path.join(lane, 'src').replace(/\\/g, '/') });
  assert.equal(activeWorkerOn([inLane], lane)?.dispatchId, 'w1');
  assert.match(laneOwnerOf({ lanePath: lane, workers: [inLane] }), /active worker w1 \(terminal term_w1\) works in it/);
  assert.equal(laneOwnerOf({ lanePath: lane, workers: [row('w2', { terminalState: 'released', worktree: lane.replace(/\\/g, '/') })] }), null);
  assert.equal(laneOwnerOf({ lanePath: lane, workers: [row('w3', { terminalState: 'active', worktree: `${lane.replace(/\\/g, '/')}-api` })] }), null, 'slim-api is not slim');
  assert.match(laneOwnerOf({ lanePath: lane, workers: null }), /unavailable/);
  assert.match(laneOwnerOf({ lanePath: lane, branch: 'lane/slim', workers: [], sup: { jobs: [{ jobId: 'fix-1', status: 'running', branch: 'lane/slim' }] } }), /Supervisor job fix-1/);
});

test('machine.sqlite: terminals keeps only shell/other sightings; worker columns and worker rows are gone', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-machine-terminals-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const m = openMachine({ file: path.join(dir, 'machine.sqlite') });
  try {
    assert.equal(m.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
    assert.deepEqual(m.providerReservations(), []);
    const cols = m.db.prepare("SELECT name FROM pragma_table_info('terminals')").all().map((r) => r.name);
    assert.deepEqual(cols, ['handle', 'title', 'role', 'opened_at', 'closed_at', 'close_verified_at', 'closed_by']);
    m.upsertTerminal({ handle: 'term_s', title: 'Terminal 3', role: 'shell', openedAt: 1 });
    assert.throws(() => m.upsertTerminal({ handle: 'term_op', role: 'op', openedAt: 1 }), /CHECK constraint failed/);
    assert.equal(m.closeTerminal('term_s', { by: 'gc', verified: true }), true);
    for (const view of ['v_seats', 'v_leaks', 'v_search_ids']) assert.doesNotThrow(() => m.db.prepare(`SELECT * FROM ${view}`).all(), view);
    assert.equal(m.db.prepare("SELECT count(*) n FROM v_search_ids WHERE kind='terminal'").get().n, 1);
  } finally { m.close(); }
});
