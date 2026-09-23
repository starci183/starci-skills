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
  const r = reapAgentProcess({ agent: 'codex', dispatchedAt: at, platform: 'win32',
    list: () => [proc(75328, CODEX, at + 2_000)], run: (cmd, args) => { calls.push([cmd, ...args]); return { status: 0 }; } });
  assert.deepEqual(r, { reaped: true, pid: 75328 });
  assert.deepEqual(calls, [['taskkill', '/PID', '75328', '/T', '/F']]);
});
