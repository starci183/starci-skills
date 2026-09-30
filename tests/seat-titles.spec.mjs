import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { tabTitlesOf } from '../scripts/kernel/terminal-dedupe.mjs';
import { repairKernelTabTitle } from '../scripts/kernel/watchdog.mjs';
import { repairSupervisorTabTitles, watchdogPass } from '../scripts/supervisor/watchdog.mjs';
import { launchSupervisor } from '../scripts/supervisor/start-supervisor.mjs';

const listing = (tabs) => ({ ok: true,
  terminals: Object.keys(tabs).map((handle, i) => ({ handle, tabId: `tab${i}`, title: 'Done - Claude', connected: true })),
  visualLayouts: Object.entries(tabs).map(([handle, title], i) => ({ tabId: `tab${i}`, title, panes: { handle } })),
});
const host = (tabs) => {
  const calls = [];
  return { calls, list: () => listing(tabs), tabTitles: tabTitlesOf,
    rename: (terminal, title) => { calls.push({ terminal, title }); return { ok: true }; } };
};

test('launchers declare runtime tab titles and do not disable managed Claude title readiness', () => {
  const kernel = fs.readFileSync(new URL('../scripts/kernel/start-workflow.mjs', import.meta.url), 'utf8');
  const supervisor = fs.readFileSync(new URL('../scripts/supervisor/start-supervisor.mjs', import.meta.url), 'utf8');
  const workers = fs.readFileSync(new URL('../scripts/supervisor/workers.mjs', import.meta.url), 'utf8');
  const ops = fs.readFileSync(new URL('../scripts/kernel/api.mjs', import.meta.url), 'utf8');
  assert.match(kernel, /const title = `\[Kernel\] \$\{kernelName\}`/);
  assert.match(supervisor, /title: SUPERVISOR_TITLE, prompt/);
  assert.match(workers, /const title = `\$\{WORKER_TITLE_PREFIX\} \$\{job\.payload\.cluster\}`/);
  assert.doesNotMatch(workers, /CLAUDE_CODE_DISABLE_TERMINAL_TITLE/);
  assert.doesNotMatch(ops, /CLAUDE_CODE_DISABLE_TERMINAL_TITLE/);
});

test('kernel watchdog repairs a drifted tab, ignoring the pane title', () => {
  const d = host({ term_kernel: 'Claude Code' });
  const result = repairKernelTabTitle('term_kernel', 'Example workflow', d);
  assert.equal(result?.ok, true);
  assert.deepEqual(d.calls, [{ terminal: 'term_kernel', title: '[Kernel] Example workflow' }]);
  const stable = host({ term_kernel: '[Kernel] Example workflow' });
  assert.equal(repairKernelTabTitle('term_kernel', 'Example workflow', stable), null);
  assert.deepEqual(stable.calls, [], 'pane title drift alone does not trigger tab rename');
});

test('supervisor watchdog repairs its seat and only live Worker tabs', () => {
  const d = host({ term_sup: 'Done - Claude', term_worker: 'Claude Code', term_ok: '[Worker] fine', term_reported: 'Claude Code' });
  const repairs = repairSupervisorTabTitles('term_sup', [
    { worker_id: 'term_worker', payload: { cluster: 'fix-title', terminalClosed: false } },
    { worker_id: 'term_ok', payload: { cluster: 'fine', terminalClosed: false } },
    { worker_id: 'term_reported', payload: { cluster: 'reported', terminalClosed: true } },
  ], d);
  assert.equal(repairs.length, 2);
  assert.deepEqual(d.calls, [
    { terminal: 'term_sup', title: '[Supervisor] main' },
    { terminal: 'term_worker', title: '[Worker] fix-title' },
  ]);
});

test('unavailable Orca listing does not issue a rename', () => {
  const calls = [];
  const d = { list: () => ({ ok: false, hostUnavailable: true }), rename: (...args) => calls.push(args), tabTitles: tabTitlesOf };
  assert.equal(repairKernelTabTitle('term_kernel', 'Example workflow', d)?.ok, false);
  assert.equal(repairSupervisorTabTitles('term_sup', [], d).length, 0);
  assert.deepEqual(calls, []);
});

test('a refused rename is retried on the next watchdog wake', () => {
  const calls = [];
  const d = { list: () => listing({ term_kernel: 'Claude Code' }), tabTitles: tabTitlesOf,
    rename: (terminal, title) => { calls.push({ terminal, title }); return { ok: calls.length > 1 }; } };
  assert.equal(repairKernelTabTitle('term_kernel', 'Example workflow', d)?.ok, false);
  assert.equal(repairKernelTabTitle('term_kernel', 'Example workflow', d)?.ok, true);
  assert.equal(calls.length, 2);
});

test('a Supervisor watchdog pass applies the seat title while handling a wake', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seat-titles-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const env = { LOCALAPPDATA: path.join(root, 'local'), STARCI_SUPERVISOR_MODE: 'kernel' };
  const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000,
    language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } };
  const launch = await launchSupervisor({ env, settings, template: '{launchAuthority}\n{doctrine}', doc: { kernelSeat: { does: ['x'] } }, deps: {
    list: () => ({ ok: true, terminals: [], visualLayouts: [] }), tabTitles: () => new Map(),
    screen: () => '❯ ', exitedRow: () => null, close: () => ({ ok: true }), quit: () => ({ exited: true }),
    show: () => ({ ok: false, error: 'no worker' }), bindSeat: () => 'seat.json',
    start: () => ({ ok: true, terminal: 'term_sup', dispatchId: 'ctx_sup', runId: 'run_sup', taskId: 'task_sup' }),
  } });
  assert.equal(launch.ok, true);
  const d = host({ term_sup: 'Done - Claude' });
  Object.assign(d, { show: () => ({ ok: true, state: 'ready' }), screen: () => '❯ ',
    settleMs: 0, state: () => 'turn-idle', wake: () => ({ action: 'kernel-woken', delivered: true }),
    enter: () => ({ ok: true }), close: () => ({ ok: true }) });
  const pass = await watchdogPass({ env, d });
  assert.equal(pass.action, 'woken');
  assert.deepEqual(d.calls, [{ terminal: 'term_sup', title: '[Supervisor] main' }]);
});
