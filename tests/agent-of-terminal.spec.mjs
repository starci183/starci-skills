import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { agentOfTerminal, KNOWN_TERMINAL_AGENTS, QUIT_COMMAND, quitAgent } from '../scripts/kernel/quit-agent.mjs';

// One agentOf used to live in terminal-dedupe.mjs (claude/codex/qwen) and start-supervisor.mjs
// (claude/codex/qwen/devin): a restored Devin terminal was identified as 'claude' and got Claude's
// double Ctrl+C typed into its input box. quit-agent.mjs now owns the identification (LC-3).

test('a named provider is returned as named - devin included', () => {
  for (const agent of ['claude', 'codex', 'qwen', 'devin']) {
    assert.equal(agentOfTerminal({ agent }), agent);
    assert.equal(agentOfTerminal({ agent: agent.toUpperCase() }), agent, 'case-folded');
  }
  assert.deepEqual([...KNOWN_TERMINAL_AGENTS].sort(), ['claude', 'codex', 'devin', 'qwen']);
});

test('an unnamed entry falls back through the titles, then to the caller fallback', () => {
  assert.equal(agentOfTerminal({ tabTitle: '[Supervisor] qwen', paneTitle: null }), 'qwen');
  assert.equal(agentOfTerminal({ tabTitle: null, paneTitle: 'codex session' }), 'codex');
  assert.equal(agentOfTerminal({ tabTitle: 'qwen code', paneTitle: 'codex' }), 'qwen', 'qwen outranks codex in the same titles');
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

test('both former copies are gone: dedupe and the supervisor import the shared helper', () => {
  const dedupe = fs.readFileSync(new URL('../scripts/kernel/terminal-dedupe.mjs', import.meta.url), 'utf8');
  const supervisor = fs.readFileSync(new URL('../scripts/supervisor/start-supervisor.mjs', import.meta.url), 'utf8');
  assert.match(dedupe, /import \{[^}]*agentOfTerminal[^}]*\} from '\.\/quit-agent\.mjs'/);
  assert.match(supervisor, /agentOfTerminal.*quit-agent\.mjs/);
  assert.doesNotMatch(dedupe + supervisor, /const agentOf\s*=/);
});
