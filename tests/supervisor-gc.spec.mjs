// supervisor-gc.spec.mjs — the garbage collection's decisions (scripts/supervisor/gc.mjs) and the verified close
// (scripts/lib/close-verify.mjs). Pure: every host seam is injected; nothing touches Orca, git or the ledgers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTerminals, onlyPrompts, roleOfTitle, tabTitles, workflowsNamed, gcLine } from '../scripts/supervisor/gc.mjs';
import { closeAndVerify, closeSelfSafe } from '../scripts/lib/close-verify.mjs';

const RT = 'D:/Repositories/x/.claude';
const NIVO = 'D:/Repositories/nivo-backend';
const term = (handle, title, extra = {}) => ({ handle, title, connected: true, worktreePath: RT, ...extra });
const sup = { seat: { handle: 'term_seat', live: true }, jobs: [
  { jobId: 'fix-a-aaaaaa', status: 'failed', cluster: 'a', handle: 'term_old' },
  { jobId: 'fix-b-bbbbbb', status: 'running', cluster: 'b', handle: 'term_b' },
  { jobId: 'fix-dead-row-cccccc', status: 'succeeded', cluster: 'dead-row', handle: 'term_gone' },
] };
const ledger = { repo: NIVO, workflows: [
  { workflowId: 'wf-live', name: 'Nivo · Live', ended: false, kernelHandle: 'term_k' },
  { workflowId: 'wf-old', name: 'Nivo · Old', ended: true, kernelHandle: null },
], jobs: [
  { jobId: 'op-1', workflowId: 'wf-live', kind: 'op', status: 'running', handles: ['term_op1'] },
  { jobId: 'op-2', workflowId: 'wf-live', kind: 'op', status: 'succeeded', handles: ['term_op2'] },
  { jobId: 'kernel-wf-live', workflowId: 'wf-live', kind: 'kernel', status: 'running', handles: ['term_k'] },
] };
const PROMPTS = 'PS D:\\Repositories\\x\\.claude> PS D:\\Repositories\\x\\.cl\naude>';

const decide = (terminals, { screens = {}, seen = {}, ledgers = [ledger], procs = null } = {}) => Object.fromEntries(classifyTerminals({
  terminals, titles: new Map(), sup, ledgers, screenOf: (h) => screens[h] ?? null, procs, seen, now: 1_000_000_000, minAgeMs: 600_000, runtimeRoot: RT,
}).map((d) => [d.handle, d]));

test('prompts-only screens and runtime titles', () => {
  assert.equal(onlyPrompts(PROMPTS), true);
  assert.equal(onlyPrompts(`${PROMPTS} npm test`), false);
  assert.equal(onlyPrompts(''), false);
  assert.equal(roleOfTitle('[Worker] fix-x'), 'worker');
  assert.equal(roleOfTitle('<pasted> You are the [Supervisor] kernel of'), 'supervisor');
  assert.equal(roleOfTitle('Terminal 17'), 'shell');
  assert.equal(roleOfTitle('nivo-backend', { worktreeName: 'nivo-backend' }), 'shell');
  assert.equal(roleOfTitle('✳ Claude Code'), null);
  const titles = tabTitles([{ root: { tabs: [{ title: '[Op] x · Nivo · Live', panes: { type: 'terminal', handle: 'term_z' } }] } }]);
  assert.equal(titles.get('term_z'), '[Op] x · Nivo · Live');
  assert.deepEqual(workflowsNamed('[Kernel] Nivo · Old', ledger.workflows).map((w) => w.workflowId), ['wf-old']);
  assert.deepEqual(workflowsNamed('[Op] fix · 3/34 · Nivo · Live', ledger.workflows).map((w) => w.workflowId), ['wf-live']);
  assert.match(gcLine({ agents: 2, terminals: 3, worktrees: 1, freedBytes: 2 * 1024 ** 3, ramFreedBytes: 0 }), /^Dọn rác: 2 agent, 3 terminal, 1 worktree, 2\.0 GB$/);
});

test('never the live seat, a live job, a live Kernel or a terminal the runtime did not create', () => {
  const d = decide([term('term_seat', 'x'), term('term_b', '[Worker] b'), term('term_k', '[Kernel] Nivo · Live', { worktreePath: NIVO }),
    term('term_op1', '[Op] a · Nivo · Live', { worktreePath: NIVO }), term('term_owner', '✳ Claude Code')]);
  for (const h of ['term_seat', 'term_b', 'term_k', 'term_op1', 'term_owner']) assert.equal(d[h].verdict, 'keep', h);
});

test('collects finished workers (by title or by staging path on screen), settled ops, ended Kernels, replaced seats', () => {
  const d = decide([term('term_seat', 'x'), term('term_w', '[Worker] a'), term('term_untitled', 'Fix dead worker question row'),
    term('term_op2', '[Op] b · Nivo · Live', { worktreePath: NIVO }), term('term_oldk', '[Kernel] Nivo · Old', { worktreePath: NIVO }),
    term('term_sup2', '[Supervisor] main')], { screens: { term_untitled: '› 1. Use session directory (D:\\starci-lanes\\staging\\fix-dead-row-cccccc)' } });
  for (const h of ['term_w', 'term_untitled', 'term_op2', 'term_oldk', 'term_sup2']) assert.equal(d[h].verdict, 'collect', h);
});

test('an unbound tab of a live workflow waits for the age rule, and is refused while a running job lost its terminal', () => {
  const t = [term('term_k', '[Kernel] Nivo · Live', { worktreePath: NIVO }), term('term_op1', 'x', { worktreePath: NIVO }), term('term_dup', '[Op] c · Nivo · Live', { worktreePath: NIVO })];
  assert.equal(decide(t).term_dup.verdict, 'refuse');
  assert.equal(decide(t, { seen: { term_dup: 1_000_000_000 - 700_000 } }).term_dup.verdict, 'collect');
  const lost = [term('term_k', '[Kernel] Nivo · Live', { worktreePath: NIVO }), term('term_dup', '[Op] c · Nivo · Live', { worktreePath: NIVO })];
  assert.equal(decide(lost, { seen: { term_dup: 0 } }).term_dup.verdict, 'refuse');
});

test('idle shells: only prompts, no agent, old enough', () => {
  const t = [term('term_s1', 'Terminal 8'), term('term_s2', 'Terminal 9'), term('term_s3', 'Terminal 10', { agentIdentity: 'claude' })];
  const screens = { term_s1: PROMPTS, term_s2: `${PROMPTS} git status` };
  const young = decide(t, { screens });
  assert.equal(young.term_s1.verdict, 'refuse');
  assert.equal(young.term_s2.verdict, 'keep');
  assert.equal(young.term_s3.verdict, 'keep');
  const procs = [{ pid: 1, ppid: 0, name: 'Orca.exe', exe: 'C:\\Orca\\daemon-host\\1\\Orca.exe' },
    { pid: 2, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoLogo -NoExit', created: 1 }];
  assert.equal(decide(t, { screens, procs }).term_s1.verdict, 'collect');
});

test('closeAndVerify proves the close; closeSelfSafe detaches from its own terminal', () => {
  let state = 'connected';
  const show = () => (state === 'gone' ? { ok: false, errorCode: 'terminal_handle_stale' } : { ok: true, terminal: {}, connected: state === 'connected' });
  const closed = closeAndVerify('term_x', { show, list: () => ({ terminals: [{ handle: 'term_x', tabId: 't1' }] }), close: () => { state = 'disconnected'; return { ok: true }; }, sleep: () => {} });
  assert.deepEqual([closed.ok, closed.proof, closed.tab], [true, 'disconnected', 't1']);
  state = 'connected';
  const stuck = closeAndVerify('term_x', { show, list: () => ({ terminals: [] }), close: () => ({ ok: true }), sleep: () => {}, verifyMs: 0 });
  assert.equal(stuck.ok, false);
  assert.equal(stuck.reason, 'still-connected');
  let spawned = null;
  const self = closeSelfSafe('term_me', { env: { ORCA_TERMINAL_HANDLE: 'term_me' }, spawnFn: (_, args) => { spawned = args; return { pid: 7, unref() {} }; } });
  assert.equal(self.detached, true);
  assert.ok(spawned.includes('--terminal') && spawned.includes('term_me'));
});

test('leaked processes: orphan agent CLIs and PowerShell no tab owns; never the Claude desktop app', async () => {
  const { orphanProcesses } = await import('../scripts/supervisor/gc.mjs');
  const { isAgentProcess, orcaAgents } = await import('../scripts/lib/close-verify.mjs');
  const D = 'C:/Orca/daemon-host/1/Orca.exe';
  const table = [
    { pid: 1, ppid: 0, name: 'Orca.exe', exe: D, created: 1 },
    { pid: 2, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoExit', created: 2 },
    { pid: 3, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoExit', created: 3 },
    { pid: 4, ppid: 3, name: 'codex.exe', cmd: 'codex.exe', created: 4 },
    { pid: 5, ppid: 1, name: 'powershell.exe', cmd: 'powershell.exe -NoExit', created: 5 },
    { pid: 6, ppid: 99, name: 'devin.exe', cmd: 'devin.exe', created: 6 },
    { pid: 7, ppid: 98, name: 'claude.exe', exe: 'C:/Program Files/WindowsApps/Claude/app/Claude.exe', cmd: 'Claude.exe', created: 7 },
    { pid: 8, ppid: 97, name: 'node.exe', cmd: 'node D:/x/.claude/scripts/supervisor/land.mjs --job fix-a', created: 8 },
  ];
  assert.equal(isAgentProcess(table[3]), true);
  assert.equal(isAgentProcess(table[7]), false);
  assert.deepEqual([...orcaAgents(table).keys()], [4]);
  const plan = orphanProcesses({ table, now: 1_000_000, minAgeMs: 10, listedCount: 2 });
  assert.deepEqual(plan.map((p) => [p.pid, p.kind]), [[6, 'orphan-agent'], [2, 'orphan-shell']]);
});
