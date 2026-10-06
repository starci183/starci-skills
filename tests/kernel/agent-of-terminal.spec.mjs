import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agentOfTerminal, KNOWN_TERMINAL_AGENTS, QUIT_COMMAND, quitAgent } from '../../scripts/kernel/quit-agent.mjs';
import { dedupeTerminals } from '../../scripts/kernel/terminal-dedupe.mjs';
import { terminalIdentityOf } from '../../scripts/lib/terminal-liveness.mjs';
import { seatAgentOf } from '../../scripts/reconciler/services.mjs';
import { worktreesWithWorkingAgents } from '../../scripts/supervisor/worker-verbs-list.mjs';
import { launchSupervisor } from '../../scripts/supervisor/start-supervisor.mjs';
import { withSupervisor, supervisorEvent, writeSeat, seatOf } from '../../scripts/machine/home.mjs';

// The existing terminal-liveness owner normalizes provider facts once per consumer entry.
// quit-agent applies the explicit supported metadata threshold; titles/defaults cannot authorize
// provider-specific quit input. Both closure callers retain their original exact handle and owner.

test('a named provider is returned as named - devin included', () => {
  for (const agent of ['claude', 'codex', 'devin']) {
    assert.equal(agentOfTerminal({ agent }), agent);
    assert.equal(agentOfTerminal({ agent: agent.toUpperCase() }), agent, 'case-folded');
  }
  assert.deepEqual([...KNOWN_TERMINAL_AGENTS].sort(), ['claude', 'codex', 'devin']);
});

test('unknown, conflicting, title-only and unsupported identities do not select provider-specific quit input', () => {
  for (const entry of [
    { tabTitle: '[Supervisor] codex', paneTitle: null },
    { tabTitle: null, paneTitle: 'codex session' },
    { tabTitle: '[Supervisor] main', paneTitle: 'tick' },
    { agentIdentity: 'custom-client' }, { agentIdentity: 'cursor' },
    { agentIdentity: 'codex', provider: 'claude' }, {}, null,
  ]) assert.equal(agentOfTerminal(entry), null, JSON.stringify(entry));
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

test('the supervisor close-out passes explicit metadata independently of its configured agent', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-agentof-sup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const env = { STARCI_LOCAL_ROOT: path.join(root, 'la'), STARCI_SUPERVISOR_MODE: 'kernel', ORCA_TERMINAL_HANDLE: 'term_me' };
  // The recorded earlier session's listing names Devin while the configured supervisor uses Codex.
  // Explicit terminal metadata wins; configured agents and titles cannot select a quit command.
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

test('shared terminal metadata facts reach the actual list, seat and strict quit consumers', async () => {
  const worktree = path.join(os.tmpdir(), 'starci-identity-matrix');
  for (const provider of ['claude', 'codex', 'devin']) {
    for (const entry of [
      { agentIdentity: provider }, { agentIdentity: { agent: provider } },
      { agentIdentity: { id: provider } }, { agentIdentity: { provider } },
      { agent: provider }, { provider }, { agentType: provider },
    ]) {
      const identity = terminalIdentityOf(entry);
      assert.equal(identity.provider, provider, JSON.stringify(entry));
      assert.equal(identity.proof, 'attested', 'recognized metadata, not an authority token');
      assert.equal(seatAgentOf(entry), provider, 'seat uses the same metadata fact');
      assert.equal(agentOfTerminal(entry), provider, 'quit adapter applies its explicit-provider threshold');
      const listed = await worktreesWithWorkingAgents([{ path: worktree }], () => ({
        ok: true, terminals: [{ ...entry, handle: 'term_matrix', connected: true }],
      }));
      assert.deepEqual(listed.worktrees[0].agents, [{ state: 'working', agentType: provider }]);
    }
  }
  const titleOnly = { title: 'Codex task' };
  assert.equal(terminalIdentityOf(titleOnly).proof, 'heuristic');
  assert.equal(seatAgentOf(titleOnly), 'codex', 'current classifier retains title evidence');
  assert.equal(agentOfTerminal(titleOnly), null, 'title evidence cannot select a quit command');
  const listed = await worktreesWithWorkingAgents([{ path: worktree }], () => ({
    ok: true, terminals: [{ ...titleOnly, handle: 'term_manual', connected: true }],
  }));
  assert.deepEqual(listed.worktrees[0].agents, [], 'a title alone does not turn a manual pane into a worker');
});

test('dedupe preserves exact listed metadata and holds an unverified close without a guessed quit', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-agentof-dedupe-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const cases = [
    { handle: 'term_object', agentIdentity: { agent: 'codex' }, expected: 'codex' },
    { handle: 'term_provider', provider: 'claude', expected: 'claude' },
    { handle: 'term_agent', agent: 'devin', expected: 'devin' },
    { handle: 'term_title', expected: null },
    { handle: 'term_conflict', agentIdentity: 'codex', provider: 'claude', expected: null },
    { handle: 'term_cursor', agentIdentity: 'cursor', expected: null },
    { handle: 'term_unknown', agentIdentity: 'custom-client', expected: null },
  ];
  const expected = new Map(cases.map(({ handle, expected: agent }) => [handle, agent]));
  const quits = [], closes = [];
  const out = dedupeTerminals({ repos: [repo], env: {}, deps: {
    list: () => ({ ok: true, terminals: cases.map(({ expected: _expected, ...entry }) => ({
      ...entry, worktreePath: repo, title: 'op-identity.be-a1b2c3 (Codex)', connected: true,
    })), visualLayouts: [] }),
    read: () => 'working frame, no shell prompt',
    bindings: () => ({ bound: new Set(), busy: null }), worktrees: (dir) => [dir],
    quit: ({ handle, agent }) => {
      quits.push({ handle, agent });
      if (QUIT_COMMAND[agent]) return { sent: false, exited: false };
      const refused = quitAgent({ handle, agent,
        show: () => assert.fail('no known quit command may query the provider'),
        send: () => assert.fail('unknown or unsupported identity must not type a guessed quit'),
        read: () => assert.fail('no known quit command may read the provider'),
      });
      assert.equal(refused, null);
      return refused;
    },
    close: (handle) => {
      closes.push(handle);
      return expected.get(handle) === null ? { ok: false, error: 'fixture-close-unverified' } : { ok: true };
    },
  } });
  assert.deepEqual(quits, cases.map(({ handle, expected: agent }) => ({ handle, agent })));
  assert.deepEqual(closes, cases.map(({ handle }) => handle), 'existing closure uses each original exact handle');
  assert.equal(out.ok, false, 'unverified close is retained, not converted into a verified exit');
  for (const row of out.closed) {
    assert.equal(row.ok, expected.get(row.handle) !== null);
    if (expected.get(row.handle) === null) {
      assert.equal(row.error, 'fixture-close-unverified');
      assert.notEqual(row.quit?.exited, true);
    }
  }
});

test('live supervisor duplicate closure uses exact metadata without adopting or replacing its seat', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-agentof-sup-live-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const env = { STARCI_LOCAL_ROOT: path.join(root, 'la'), STARCI_SUPERVISOR_MODE: 'kernel', ORCA_TERMINAL_HANDLE: 'term_me' };
  const cases = [
    { handle: 'term_object', agentIdentity: { agent: 'devin' }, expected: 'devin' },
    { handle: 'term_provider', provider: 'claude', expected: 'claude' },
    { handle: 'term_type', agentType: 'codex', expected: 'codex' },
    { handle: 'term_title', expected: null },
    { handle: 'term_conflict', agentIdentity: 'codex', provider: 'claude', expected: null },
    { handle: 'term_cursor', agentIdentity: 'cursor', expected: null },
  ];
  const expected = new Map(cases.map(({ handle, expected: agent }) => [handle, agent]));
  withSupervisor((m) => {
    writeSeat(m, { token: 'identity-live-fixture', value: { terminal: 'term_seat', dispatch: 'dispatch_fixture', attempt: 1 }, now: 1000 });
    for (const terminal of ['term_seat', ...cases.map(({ handle }) => handle)]) {
      supervisorEvent(m, { kind: 'supervisor-booted', payload: { terminal } });
    }
  }, { env });
  const quits = [], closes = [];
  const launch = await launchSupervisor({ env, now: () => 1000,
    settings: { agent: 'codex', model: 'gpt-6.1-sol', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } },
    deps: {
      list: () => ({ ok: true, terminals: [
        { handle: 'term_seat', agentIdentity: 'codex', connected: true },
        ...cases.map(({ expected: _expected, ...entry }) => ({ ...entry, title: 'Codex restored session', connected: true })),
      ], visualLayouts: [] }),
      tabTitles: () => new Map(), screen: () => 'agent frame', exitedRow: () => null,
      show: (dispatch) => { assert.equal(dispatch, 'dispatch_fixture'); return { ok: true, state: 'running' }; },
      quit: (handle, agent) => {
        quits.push({ handle, agent });
        if (QUIT_COMMAND[agent]) return { sent: false, exited: false };
        const refused = quitAgent({ handle, agent,
          show: () => assert.fail('no known quit command may query the provider'),
          send: () => assert.fail('unknown or unsupported identity must not type a guessed quit'),
          read: () => assert.fail('no known quit command may read the provider'),
        });
        assert.equal(refused, null);
        return refused;
      },
      close: (handle) => {
        closes.push(handle);
        return expected.get(handle) === null ? { ok: false, error: 'fixture-close-unverified' } : { ok: true };
      },
      start: () => assert.fail('an already-live seat must not be replaced'),
      stop: () => assert.fail('the live seat must not be stopped'),
      release: () => assert.fail('the live seat must not be released'),
      bindSeat: () => assert.fail('no new worker or trust/seat binding is created'),
    } });
  assert.equal(launch.action, 'already-live', JSON.stringify(launch));
  assert.equal(launch.terminal, 'term_seat');
  assert.deepEqual(quits, cases.map(({ handle, expected: agent }) => ({ handle, agent })));
  assert.deepEqual(closes, cases.map(({ handle }) => handle));
  for (const row of launch.closedDuplicates) {
    assert.equal(row.ok, expected.get(row.handle) !== null);
    if (expected.get(row.handle) === null) assert.equal(row.error, 'fixture-close-unverified');
  }
  const seat = withSupervisor((m) => seatOf(m, 1000), { env });
  assert.equal(seat.value.terminal, 'term_seat');
  assert.equal(seat.value.dispatch, 'dispatch_fixture');
});
