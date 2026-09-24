import test from 'node:test';
import assert from 'node:assert/strict';
import { matchAgentProcess, reapAgentProcess, REAP_WINDOW_MS } from '../scripts/kernel/reap-agent-process.mjs';

// Five settled Claude/Codex op workers kept running hidden after Orca closed
// their terminals (stop_unverified); the supervisor matched each by the agent
// image started inside its op's dispatch window and stopped it by hand.
const at = Date.parse('2026-09-23T07:43:59Z');
const CLAUDE_OP = String.raw`"C:\Users\Hi\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe" --dangerously-skip-permissions --model claude-opus-5-5`;
const CLAUDE_APP = String.raw`"C:\Program Files\WindowsApps\Claude_2.2553.13.0_x64__pzs8sxrjxfjjc\app\claude.exe" --type=renderer`;
const CODEX = String.raw`C:\Users\Hi\AppData\Roaming\npm\node_modules\@openai\codex\vendor\codex.exe --model gpt-6-sol`;
const proc = (pid, commandLine, startedAt) => ({ pid, image: commandLine.replace(/^"?([^"]+?\.exe)"?.*$/, '$1'), commandLine, startedAt });

test('exactly one agent process started inside the dispatch window is the match', () => {
  const list = [proc(73596, CLAUDE_OP, at + 20_000), proc(22484, CLAUDE_APP, at + 5_000), proc(65364, CODEX, at + 1_000)];
  assert.deepEqual(matchAgentProcess(list, { agent: 'claude', dispatchedAt: at }), { pid: 73596, candidates: [73596] },
    "Claude Desktop's own helpers never count, nor does another CLI");
  assert.equal(matchAgentProcess(list, { agent: 'claude', dispatchedAt: at + 10 * REAP_WINDOW_MS }).pid, null, 'outside the window is no match');
});

test('two candidates, an unknown agent or an unknown dispatch time stop nothing', () => {
  const two = [proc(1, CLAUDE_OP, at), proc(2, CLAUDE_OP, at + 30_000)];
  const m = matchAgentProcess(two, { agent: 'claude', dispatchedAt: at });
  assert.equal(m.pid, null);
  assert.match(m.reason, /ambiguous/);
  assert.equal(matchAgentProcess(two, { agent: 'gemini', dispatchedAt: at }).pid, null);
  assert.equal(matchAgentProcess(two, { agent: 'claude', dispatchedAt: null }).pid, null);
  let killed = false;
  const r = reapAgentProcess({ agent: 'claude', dispatchedAt: at, platform: 'win32', list: () => two, run: () => { killed = true; return { status: 0 }; } });
  assert.deepEqual([r.reaped, killed], [false, false], 'an ambiguous match is reported, never guessed');
});

test('the single match is stopped with its process tree', () => {
  const calls = [];
  const r = reapAgentProcess({ agent: 'codex', dispatchedAt: at, platform: 'win32', otherLaunches: [],
    list: () => [proc(75328, CODEX, at + 2_000)], run: (cmd, args) => { calls.push([cmd, ...args]); return { status: 0 }; } });
  assert.deepEqual(r, { reaped: true, pid: 75328 });
  assert.deepEqual(calls, [['taskkill', '/PID', '75328', '/T', '/F']]);
});

// 2026-09-23 17:33:51: settling StarCi Next op-workspace.manage-f26a871054 (Codex, dispatched
// 17:27:27, its own process already quit) found one codex.exe inside its window - the live
// worker of nivo op-architecture.decide-cad5880b07, dispatched 17:28:51 by another Kernel - and
// killed it; the worker froze at "Working (5m 32s)" above a bare PowerShell prompt
// (inc-9912c049df82). Thirty-four such kills ran that day across nivo, Mia Mia and StarCi Next.
test('a lone candidate that another live agent launched inside the window is never stopped', () => {
  const settled = Date.parse('2026-09-23T17:27:27Z'), victim = Date.parse('2026-09-23T17:28:51Z');
  const victimProcess = proc(41104, CODEX, victim - 20_000);
  const launches = [{ id: 'op-architecture.decide-cad5880b07', at: victim }];
  const m = matchAgentProcess([victimProcess], { agent: 'codex', dispatchedAt: settled, otherLaunches: launches });
  assert.equal(m.pid, null);
  assert.equal(m.rival, 'op-architecture.decide-cad5880b07');
  assert.match(m.reason, /may be that agent's/);
  let killed = false;
  const kill = () => { killed = true; return { status: 0 }; };
  const r = reapAgentProcess({ agent: 'codex', dispatchedAt: settled, otherLaunches: launches, platform: 'win32', list: () => [victimProcess], run: kill });
  assert.deepEqual([r.reaped, r.rival, killed], [false, 'op-architecture.decide-cad5880b07', false]);
  // No census (a ledger of the host could not be read): nothing is stopped either.
  const blind = reapAgentProcess({ agent: 'codex', dispatchedAt: settled, platform: 'win32', list: () => [victimProcess], run: kill });
  assert.deepEqual([blind.reaped, killed], [false, false]);
  assert.match(blind.reason, /census unavailable/);
  // A launch outside the window is no rival: the lone orphan is still stopped.
  const far = reapAgentProcess({ agent: 'codex', dispatchedAt: settled, otherLaunches: [{ id: 'op-x', at: settled + 10 * REAP_WINDOW_MS }],
    platform: 'win32', list: () => [proc(7, CODEX, settled + 1_000)], run: kill });
  assert.deepEqual([far.reaped, far.pid, killed], [true, 7, true]);
});

test('a spec run never reads or stops the host processes', () => {
  const r = reapAgentProcess({ agent: 'codex', dispatchedAt: Date.now(), otherLaunches: [], env: { NODE_TEST_CONTEXT: 'child-v8' } });
  assert.equal(r.reaped, false);
  assert.match(r.reason, /test context/);
});
