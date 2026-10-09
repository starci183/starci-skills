// The Supervisor seat and a revision change: settled by the runtime when it concerns the seat nothing, woken once when files are added to its
// contract, replaced at its next yield (reason contract-changed) when a rule of its contract was removed, never replaced mid-turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchSupervisor } from '../../scripts/supervisor/start-supervisor.mjs';
import { readSupervisor, SKILL_ROOT, SUPERVISOR_ID } from '../../scripts/machine/home.mjs';
import { registerSupervisor } from '../../scripts/supervisor/telegram-bridge.mjs';
import { watchdogPass } from '../../scripts/supervisor/supervisor-watchdog.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { recordReplaced } from '../../scripts/reconciler/revision-ack.mjs';
import { supervisorSeat } from '../../scripts/reconciler/revision-seats.mjs';
import { NOTICE_EVENT } from '../../scripts/reconciler/revision-notice.mjs';
import { revisionRepo } from '../helpers/revision-repo.mjs';

const MENU = 'modules/supervisor/supervisor-menu.yaml';

function fakeHost() {
  let n = 0;
  return {
    list: () => ({ ok: true, terminals: [{ handle: 'term_entry', title: 'pwsh', worktreePath: SKILL_ROOT, writable: true }], visualLayouts: [] }),
    tabTitles: (_layouts, rows) => new Map(rows.map((r) => [r.handle, r.tab ?? null])),
    show: (d) => ({ ok: true, state: String(d).startsWith('ctx_new') ? 'ready' : 'ready' }), stop: () => ({ ok: true }), release: () => ({ ok: true }),
    bindSeat: () => 'seat.json', screen: () => '> ', exitedRow: () => null, close: () => ({ ok: true }), quit: () => ({ sent: true, exited: false }),
    start: () => { n += 1; return { ok: true, terminal: `term_new${n}`, dispatchId: `ctx_new${n}`, runId: 'run', taskId: `task_${n}` }; },
  };
}
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared' } };

async function world(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sup-rev-'));
  const env = { STARCI_LOCAL_ROOT: path.join(dir, 'la'), STARCI_SUPERVISOR_MODE: 'kernel' };
  const repo = revisionRepo(t, { files: { [MENU]: 'items:\n  - a\n  - b\n' } });
  const saved = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = repo.root;
  t.after(() => { if (saved === undefined) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = saved; fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const seed = await launchSupervisor({ env, deps: fakeHost(), settings, template: '{launchAuthority}\n{doctrine}', doc: { kernelSeat: { does: ['x'] } } });
  registerSupervisor({ id: SUPERVISOR_ID, label: 'S', terminal: seed.terminal }, { env });
  withMachine((m) => recordReplaced(supervisorSeat({ m, root: repo.root, current: repo.base }), 'boot'), { env });
  const seat = { state: 'turn-idle', order: [], wakeText: null };
  const d = { show: () => ({ ok: true, state: 'ready' }), screen: () => '❯ ', settleMs: 0, sleep: () => {}, state: () => seat.state, outputAge: () => null, escape: () => ({ ok: true }),
    wake: (_terminal, text) => { seat.order.push('wake'); seat.wakeText = text; return { action: 'kernel-woken', delivered: true }; }, enter: () => ({ ok: true }), quit: () => null, close: () => ({ ok: true }),
    replace: () => { seat.order.push('replace'); return { ok: true, action: 'restarted', terminal: 'term_replaced' }; },
    rotate: (handover) => { seat.order.push('rotate'); seat.handover = handover; return { ok: true, action: 'restarted', terminal: 'term_rotated' }; } };
  const events = (kind) => readSupervisor((m) => m.supEvents({ kind, order: 'asc', limit: -1 }).map((e) => e.payload), [], { env });
  return { env, repo, seat, d, events };
}

test('a change that concerns the Supervisor nothing is settled by the runtime: no wake, no replacement', async (t) => {
  const w = await world(t);
  w.repo.commit('docs', { 'docs/a.md': '# a\n', 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\n' });
  const pass = await watchdogPass({ env: w.env, d: w.d });
  assert.equal(pass.action, 'idle');
  assert.deepEqual(w.seat.order, []);
  assert.deepEqual(w.events(NOTICE_EVENT).map((p) => p.verdict), ['replaced', 'not-concerned']);
});

test('rules added to its contract wake the idle Supervisor once, with the revision in the wake and none the second time', async (t) => {
  const w = await world(t);
  w.repo.commit('menu grows', { [MENU]: 'items:\n  - a\n  - b\n  - c\n' });
  const first = await watchdogPass({ env: w.env, d: w.d });
  assert.equal(first.action, 'woken');
  assert.match(w.seat.wakeText, /\[revision\] Runtime rev [0-9a-f]{12} changed 1 file\(s\) of your contract \(modules\/supervisor\/supervisor-menu\.yaml\)/);
  assert.equal((await watchdogPass({ env: w.env, d: w.d })).action, 'idle', 'the same revision never wakes it twice');
  assert.deepEqual(w.seat.order, ['wake']);
  assert.deepEqual(w.events('supervisor-wake').map((p) => p.revision).filter(Boolean).length, 1);
  assert.deepEqual(w.events(NOTICE_EVENT).map((p) => p.verdict), ['replaced', 'woken']);
});

test('a rule removed from its contract replaces the Supervisor at its next yield, with the reason contract-changed and the stores as its handover', async (t) => {
  const w = await world(t);
  w.repo.commit('rule removed', { [MENU]: 'items:\n  - a\n' });
  w.seat.state = 'active';
  assert.equal((await watchdogPass({ env: w.env, d: w.d })).action, 'idle', 'never in the middle of a turn');
  assert.deepEqual(w.seat.order, []);
  w.seat.state = 'turn-idle';
  const pass = await watchdogPass({ env: w.env, d: w.d });
  assert.equal(pass.action, 'rotated');
  assert.deepEqual(w.seat.order, ['rotate'], 'a replacement, not a wake');
  assert.match(w.seat.handover, /contract-changed: 1 rule file\(s\)/);
  assert.match(w.events('supervisor-rotated')[0].reason, /^contract-changed:/);
  assert.deepEqual(w.events(NOTICE_EVENT).map((p) => p.verdict), ['replaced', 'replaced'], 'the fresh seat read the tree at birth');
  assert.equal((await watchdogPass({ env: w.env, d: w.d })).action, 'idle', 'it is not replaced twice');
});

test('the file the Supervisor boots from replaces it on any change', async (t) => {
  const w = await world(t);
  const prompt = fs.readFileSync(path.join(w.repo.root, 'modules/supervisor/supervisor-prompt.md'), 'utf8');
  w.repo.commit('prompt grows', { 'modules/supervisor/supervisor-prompt.md': `${prompt}\nAn added sentence.\n` });
  assert.equal((await watchdogPass({ env: w.env, d: w.d })).action, 'rotated');
});
