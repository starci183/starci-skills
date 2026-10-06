// supervisor-gc.spec.mjs — the garbage collection's decisions (scripts/supervisor/gc.mjs) and the verified close
// (scripts/machine/close-verify.mjs). Pure: every host seam is injected; nothing touches Orca, git or the ledgers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTerminals, onlyPrompts, isShellTitle, tabTitles, gcLine } from '../../scripts/supervisor/gc.mjs';
import { closeAndVerify, closeSelfSafe } from '../../scripts/machine/close-verify.mjs';
import { translator } from '../../scripts/lib/i18n.mjs';
import { winPath } from '../fixtures/win-path.mjs';

const DRIVE = winPath('C', ''), F = DRIVE.replace(/\\/g, '/'); const RT = `${F}Repositories/x/.claude`;
const REPO_PATH = `${F}Repositories/shop-be`;
const term = (handle, title, extra = {}) => ({ handle, title, connected: true, worktreePath: RT, ...extra });
const sup = { seat: { handle: 'term_seat', live: true }, jobs: [
  { jobId: 'fix-a-aaaaaa', status: 'failed', cluster: 'a', handle: 'term_old' },
  { jobId: 'fix-b-bbbbbb', status: 'running', cluster: 'b', handle: 'term_b' },
  { jobId: 'fix-dead-row-cccccc', status: 'succeeded', cluster: 'dead-row', handle: 'term_gone' },
] };
const ledger = { repo: REPO_PATH, workflows: [
  { workflowId: 'wf-live', name: 'Nivo · Live', ended: false, kernelHandle: 'term_k' },
  { workflowId: 'wf-old', name: 'Nivo · Old', ended: true, kernelHandle: null },
], jobs: [
  { jobId: 'op-1', workflowId: 'wf-live', kind: 'op', status: 'running', handles: ['term_op1'] },
  { jobId: 'op-2', workflowId: 'wf-live', kind: 'op', status: 'succeeded', handles: ['term_op2'] },
  { jobId: 'kernel-wf-live', workflowId: 'wf-live', kind: 'kernel', status: 'running', handles: ['term_k'] },
] };
const PROMPTS = `PS ${DRIVE}Repositories\\x\\.claude> PS ${DRIVE}Repositories\\x\\.cl\naude>`;

const decide = (terminals, { screens = {}, seen = {}, ledgers = [ledger], procs = null, workers = new Set() } = {}) => Object.fromEntries(classifyTerminals({
  terminals, titles: new Map(), sup, ledgers, workers, screenOf: (h) => screens[h] ?? null, procs, seen, now: 1_000_000_000, minAgeMs: 600_000,
}).map((d) => [d.handle, d]));

test('prompts-only screens and plain shell titles', () => {
  assert.equal(onlyPrompts(PROMPTS), true);
  assert.equal(onlyPrompts(`${PROMPTS} npm test`), false);
  assert.equal(onlyPrompts(''), false);
  assert.equal(isShellTitle('Terminal 17'), true);
  assert.equal(isShellTitle('shop-be', { worktreeName: 'shop-be' }), true);
  for (const title of ['[Worker] fix-x', '[Kernel] Nivo · Live', '[Op] a · Nivo', '[Supervisor] main', '✳ Claude Code']) assert.equal(isShellTitle(title), false, title);
  const titles = tabTitles([{ root: { tabs: [{ title: '[Op] x · Nivo · Live', panes: { type: 'terminal', handle: 'term_z' } }] } }]);
  assert.equal(titles.get('term_z'), '[Op] x · Nivo · Live');
  assert.equal(gcLine({ agents: 2, terminals: 3, worktrees: 1, freedBytes: 2 * 1024 ** 3, ramFreedBytes: 0 }),
    translator('vi')('Garbage collected: {agents} agent(s), {terminals} terminal(s), {worktrees} worktree(s), {bytes}', { agents: 2, terminals: 3, worktrees: 1, bytes: '2.0 GB' }));
});

test('never the live seat, a live job, a live Kernel or a terminal the runtime did not create', () => {
  const d = decide([term('term_seat', 'x'), term('term_b', '[Worker] b'), term('term_k', '[Kernel] Nivo · Live', { worktreePath: REPO_PATH }),
    term('term_op1', '[Op] a · Nivo · Live', { worktreePath: REPO_PATH }), term('term_owner', '✳ Claude Code')]);
  for (const h of ['term_seat', 'term_b', 'term_k', 'term_op1', 'term_owner']) assert.equal(d[h].verdict, 'keep', h);
});

test('native supervised custody protects maintenance even when the host worker listing is empty', () => {
  const decisions = classifyTerminals({ terminals: [term('held-debug', 'Terminal 7')], titles: new Map(),
    sup: { ...sup, seatHandles: ['held-debug'] }, ledgers: [], workers: new Set(), screenOf: () => PROMPTS,
    seen: { 'held-debug': 0 }, now: 1_000_000_000, minAgeMs: 1 });
  assert.equal(decisions[0].verdict, 'keep');
  assert.equal(decisions[0].klass, 'supervisor-seat');
});

test('collects the terminals the ledgers bind to a settled op, a finished [Worker] job or an ended workflow', () => {
  const ended = { ...ledger, workflows: [...ledger.workflows, { workflowId: 'wf-done', name: 'Nivo · Done', ended: true, kernelHandle: 'term_oldk' }] };
  const d = decide([term('term_old', '[Worker] a'), term('term_op2', '[Op] b · Nivo · Live', { worktreePath: REPO_PATH }), term('term_oldk', '[Kernel] Nivo · Done', { worktreePath: REPO_PATH })], { ledgers: [ended] });
  assert.deepEqual(['term_old', 'term_op2', 'term_oldk'].map((h) => [h, d[h].verdict, d[h].klass]),
    [['term_old', 'collect', 'sup-worker'], ['term_op2', 'collect', 'op-worker'], ['term_oldk', 'collect', 'kernel']]);
});

test('a runtime title or a staging path on screen identifies nothing: an unbound terminal is kept', () => {
  // Former false positives: title-regex identification closed an owner's own tab named like a runtime tab.
  const d = decide([term('term_w', '[Worker] a'), term('term_untitled', 'Fix dead worker question row'), term('term_dup', '[Op] c · Nivo · Live', { worktreePath: REPO_PATH }),
    term('term_sup2', '[Supervisor] main'), term('term_k2', '[Kernel] Nivo · Old', { worktreePath: REPO_PATH })],
  { screens: { term_untitled: `› 1. Use session directory (${DRIVE}starci-lanes\\staging\\fix-dead-row-cccccc)` }, seen: { term_dup: 0, term_w: 0 } });
  for (const h of ['term_w', 'term_untitled', 'term_dup', 'term_sup2', 'term_k2']) assert.deepEqual([h, d[h].verdict], [h, 'keep']);
});

test('a terminal Orca accounts for as a worker is Orca\'s: never closed here, even when a ledger binds it to a settled job', () => {
  const d = decide([term('term_op2', '[Op] b · Nivo · Live', { worktreePath: REPO_PATH }), term('term_old', '[Worker] a'), term('term_s', 'Terminal 3')],
    { workers: new Set(['term_op2', 'term_old', 'term_s']), screens: { term_s: PROMPTS }, seen: { term_s: 0 } });
  for (const h of ['term_op2', 'term_old', 'term_s']) assert.deepEqual([h, d[h].verdict, d[h].klass], [h, 'keep', 'orca-worker']);
});

test('idle shells: only prompts, no agent, old enough', () => {
  const t = [term('term_s1', 'Terminal 8'), term('term_s2', 'Terminal 9'), term('term_s3', 'Terminal 10', { agentIdentity: 'claude' })];
  const screens = { term_s1: PROMPTS, term_s2: `${PROMPTS} git status` };
  const young = decide(t, { screens });
  assert.equal(young.term_s1.verdict, 'refuse');
  assert.equal(young.term_s2.verdict, 'keep');
  assert.equal(young.term_s3.verdict, 'keep');
  const procs = [{ pid: 1, ppid: 0, name: 'Orca.exe', exe: `${DRIVE}Orca\\daemon-host\\1\\Orca.exe` },
    { pid: 2, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoLogo -NoExit', created: 1 }];
  assert.equal(decide(t, { screens, procs }).term_s1.verdict, 'collect');
});

test('closeAndVerify proves the close; closeSelfSafe detaches from its own terminal', () => {
  let state = 'connected';
  const show = () => (state === 'gone' ? { ok: false, errorCode: 'terminal_handle_stale' } : { ok: true, terminal: {}, connected: state === 'connected' });
  const closed = closeAndVerify('term_x', { show, list: () => ({ terminals: [{ handle: 'term_x', tabId: 't1' }] }), close: () => { state = 'disconnected'; return { ok: true }; }, sleep: () => {}, wait: () => ({ ok: false, hostUnavailable: true }) });
  assert.deepEqual([closed.ok, closed.proof, closed.tab], [true, 'disconnected', 't1']);
  state = 'connected';
  const stuck = closeAndVerify('term_x', { show, list: () => ({ terminals: [] }), close: () => ({ ok: true }), sleep: () => {}, verifyMs: 0, wait: () => ({ ok: false, hostUnavailable: true }) });
  assert.equal(stuck.ok, false);
  assert.equal(stuck.reason, 'still-connected');
  let spawned = null;
  const self = closeSelfSafe('term_me', { env: { ORCA_TERMINAL_HANDLE: 'term_me' }, spawnFn: (_, args) => { spawned = args; return { pid: 7, unref() {} }; } });
  assert.equal(self.detached, true);
  assert.ok(spawned.includes('--terminal') && spawned.includes('term_me'));
});

test('closeAndVerify takes the proof from terminal wait --for exit; polling terminal show is only the fallback (alpha5 1.2)', () => {
  const shows = [], waits = [];
  const show = () => { shows.push(1); return { ok: true, terminal: {}, connected: true }; };
  const list = () => ({ terminals: [{ handle: 'term_w', tabId: 't9' }] });
  const proven = closeAndVerify('term_w', { show, list, close: () => ({ ok: true }), sleep: () => {}, verifyMs: 4000,
    wait: (a) => { waits.push(a); return { ok: true, satisfied: true, status: 'exited' }; } });
  assert.deepEqual([proven.ok, proven.proof, proven.attempts], [true, 'disconnected', 1]);
  assert.deepEqual(waits.map((a) => [a.terminal, a.for, a.timeoutMs]), [['term_w', 'exit', 4000]]);
  assert.equal(shows.length, 1, 'only the initial state read: no polling of terminal show after the close');
  // a live terminal: the wait times out, the pane is closed once more, and it is never claimed gone
  let closes = 0;
  const stuck = closeAndVerify('term_w', { show, list, close: () => { closes += 1; return { ok: true }; }, sleep: () => {}, verifyMs: 4000,
    wait: () => ({ ok: true, satisfied: false, timedOut: true }) });
  assert.deepEqual([stuck.ok, stuck.reason, closes], [false, 'still-connected', 2]);
});

test('leaked processes: orphan agent CLIs and PowerShell no tab owns; never the Claude desktop app', async () => {
  const { orphanProcesses } = await import('../../scripts/supervisor/gc.mjs');
  const { isAgentProcess } = await import('../../scripts/machine/close-verify.mjs');
  const D = `${F}Orca/daemon-host/1/Orca.exe`;
  const table = [
    { pid: 1, ppid: 0, name: 'Orca.exe', exe: D, created: 1 },
    { pid: 2, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoExit', created: 2 },
    { pid: 3, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoExit', created: 3 },
    { pid: 4, ppid: 3, name: 'codex.exe', cmd: 'codex.exe', created: 4 },
    { pid: 5, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoExit', created: 5 },
    { pid: 6, ppid: 99, name: 'devin.exe', cmd: 'devin.exe', created: 6 },
    { pid: 7, ppid: 98, name: 'claude.exe', exe: `${F}Program Files/WindowsApps/Claude/app/Claude.exe`, cmd: 'Claude.exe', created: 7 },
    { pid: 8, ppid: 97, name: 'node.exe', cmd: `node ${F}x/.claude/scripts/supervisor/land.mjs --job fix-a`, created: 8 },
  ];
  assert.equal(isAgentProcess(table[3]), true);
  assert.equal(isAgentProcess(table[7]), false);
  const plan = orphanProcesses({ table, now: 1_000_000, minAgeMs: 10, listedCount: 2 });
  assert.deepEqual(plan.map((p) => [p.pid, p.kind]), [[6, 'orphan-agent'], [2, 'orphan-shell']]);
});
