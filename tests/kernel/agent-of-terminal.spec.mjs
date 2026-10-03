import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agentOfTerminal, KNOWN_TERMINAL_AGENTS, QUIT_COMMAND, quitAgent } from '../../scripts/kernel/quit-agent.mjs';
import { dedupeTerminals } from '../../scripts/kernel/terminal-dedupe.mjs';
import { launchSupervisor } from '../../scripts/supervisor/start-supervisor.mjs';
import { withSupervisor, supervisorEvent } from '../../scripts/machine/home.mjs';

// One agentOf used to live in terminal-dedupe.mjs (claude/codex) and start-supervisor.mjs
// (claude/codex/devin): a restored Devin terminal was identified as 'claude' and got Claude's
// double Ctrl+C typed into its input box. quit-agent.mjs now owns the identification (LC-3).

test('a named provider is returned as named - devin included', () => {
  for (const agent of ['claude', 'codex', 'devin']) {
    assert.equal(agentOfTerminal({ agent }), agent);
    assert.equal(agentOfTerminal({ agent: agent.toUpperCase() }), agent, 'case-folded');
  }
  assert.deepEqual([...KNOWN_TERMINAL_AGENTS].sort(), ['claude', 'codex', 'devin']);
});

test('an unnamed entry falls back through the titles, then to the caller fallback', () => {
  assert.equal(agentOfTerminal({ tabTitle: '[Supervisor] codex', paneTitle: null }), 'codex');
  assert.equal(agentOfTerminal({ tabTitle: null, paneTitle: 'codex session' }), 'codex');
  assert.equal(agentOfTerminal({ tabTitle: '[Supervisor] main', paneTitle: 'tick' }), 'claude', 'default fallback');
  assert.equal(agentOfTerminal({ tabTitle: 'x', paneTitle: 'y' }, 'devin'), 'devin', 'the supervisor passes its configured agent');
  assert.equal(agentOfTerminal({}), 'claude');
  assert.equal(agentOfTerminal(null), 'claude', 'a missing entry is still answered');
});

test('identifying devin never gives it a quit command: the close alone runs', () => {
  const agent = agentOfTerminal({ agent: 'devin' });
  assert.equal(QUIT_COMMAND[agent], undefined, 'devin has no typed quit - quitAgent returns null');
  assert.equal(quitAgent({ handle: 'term-1', agent, show: () => ({ ok: true, connected: true }) }), null);
});

// Both former call sites now pass the resolved agent through to their quit seam — observed on the seam itself.
test('dedupe closes an agent terminal through a quit typed for ITS agent, never a re-derived default', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-agentof-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const quits = [];
  const out = dedupeTerminals({ repos: [repo], env: {}, deps: {
    list: () => ({ ok: true, terminals: [
      { handle: 'term_codex', worktreePath: repo, title: 'op-fix.be-a1b2c3 (Codex)', agentIdentity: 'codex' },
      { handle: 'term_devin', worktreePath: repo, title: 'op-fix.be-a1b2c3 (Devin)', agentIdentity: 'devin' },
    ], visualLayouts: [] }),
    read: () => 'working frame, no shell prompt',
    bindings: () => ({ bound: new Set(), busy: null }), worktrees: (dir) => [dir],
    quit: ({ handle, agent }) => { quits.push({ handle, agent }); return { exited: true }; },
    close: () => ({ ok: true }),
  } });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(quits.map((q) => q.agent), ['codex', 'devin'], 'agentOfTerminal decides what the quit types');
  assert.deepEqual(out.closed.map((c) => c.handle).sort(), ['term_codex', 'term_devin']);
});

test('the supervisor close-out passes the resolved agent (its own fallback) to the quit seam', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-agentof-sup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const env = { LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_MODE: 'kernel', ORCA_TERMINAL_HANDLE: 'term_me' };
  // A recorded earlier seat session whose tab shows Codex — but whose recorded agent is devin: the recorded
  // identity wins, and an unnamed one falls back to the configured agent, never to 'claude'.
  withSupervisor((m) => supervisorEvent(m, { kind: 'supervisor-booted', payload: { terminal: 'term_old' } }), { env });
  const quits = [];
  const launch = await launchSupervisor({ env, template: '{launchAuthority}\n{doctrine}', doc: { kernelSeat: { does: ['x'] } },
    settings: { agent: 'codex', model: 'gpt-6.1-sol', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } },
    deps: {
      list: () => ({ ok: true, terminals: [{ handle: 'term_old', title: 'pwsh', agentIdentity: 'devin', connected: true }], visualLayouts: [] }),
      tabTitles: () => new Map(),
      screen: () => 'agent frame', exitedRow: () => null,
      quit: (handle, agent) => { quits.push({ handle, agent }); return { exited: true }; },
      close: () => ({ ok: true }), show: () => ({ ok: false, error: 'no worker' }), bindSeat: () => 'seat.json',
      start: () => ({ ok: true, terminal: 'term_new', dispatchId: 'ctx_new', runId: 'run_s', taskId: 'task_s' }),
    } });
  assert.equal(launch.action, 'booted', JSON.stringify(launch));
  assert.deepEqual(quits, [{ handle: 'term_old', agent: 'devin' }], 'the duplicate seat is quit as devin, not as the configured codex');
});
