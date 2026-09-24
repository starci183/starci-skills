import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyAgentScreen } from '../scripts/kernel/terminal-liveness.mjs';
import { parseYaml } from '../engine/yaml.mjs';

// The busy frames status still read turn-idle after 0856299e6, so the frontier asked for a nudge
// that landed mid-turn (or the Kernel refused it and wrote an incident). Each frame below is the
// shape a Kernel quoted, or one captured from a live worker on 2026-09-24.
const CLAUDE_CHROME = ['────────', '❯ ', '────────', '  ⏵⏵ bypass permissions on (shift+tab to cycle)'];
const CODEX_FOOT = ['› Ask Codex to do anything', '', '  gpt-6-sol high · D:\\Repositories\\nivo-backend · Report task outcome'];
const DEVIN_FOOT = ['──── (bypass permissions on) ─', '❭ Guide Devin while it works', '────', 'SWE-2 Max   Context: 66k / 262k tokens (25%)'];

test('a Codex status row with its tree detail, or a held message, is a running turn (inc-29dc6dc51975, inc-b261cf2c56c5, inc-c2793e212c63)', () => {
  // Captured 2026-09-24 from nivo term_7427743e: a Codex op blocked in `orca orchestration ask`.
  const waiting = ['• Ran node shell-conformance.mjs .starciwork/features/sales/ui/workbench', '  └   REFUSED ui.sales.workbench binds no shell',
    '• Waiting for background terminal (2m 30s • esc to interrupt) · 3 background terminals running · /ps to view · /stop to…',
    '  └ orca orchestration ask --from term_7427743e --question "Lệnh api op-contract cho job op…', ...CODEX_FOOT];
  assert.equal(classifyAgentScreen(waiting.join('\n')).state, 'active');
  assert.equal(classifyAgentScreen(['• Waiting for background terminal (18m 10s • esc to interrupt) · 1 background terminal running', '  └ npm run test:e2e', ...CODEX_FOOT].join('\n')).state, 'active');
  const held = ['• Working (4m 47s • esc to interrupt) · 2 background terminals running', '',
    '• Messages to be submitted after next tool call (press esc to interrupt and send immediately)',
    '  ↳ Operation liveness wake for durable job op-brand.decide-dbe2a11a40 (brand.decide) attempt 3. Your accepted',
    '    contract remains running but no durable report is filed.', ...CODEX_FOOT];
  assert.equal(classifyAgentScreen(held.join('\n')).state, 'active', 'a nudge held behind the running turn');
});

test('a Claude spinner above a wrapped tip, a folded todo list, a long todo list or a queued wake is a running turn', () => {
  const tip = ['✢ Thundering… (7m 45s · ↓ 44.1k tokens)', "  ⎿  Tip: Use /btw to ask a quick side question without interrupting Claude's current", '     work', ...CLAUDE_CHROME];
  assert.equal(classifyAgentScreen(tip.join('\n')).state, 'active', 'inc-1ba6ab0cf626: the tip wraps onto a second row');
  const folded = ['✽ Reading owned records… (2m · ↓ 3k tokens)', '  ⎿  ☒ Read records', '     ☐ Write report', '     … +3 pending', ...CLAUDE_CHROME];
  assert.equal(classifyAgentScreen(folded.join('\n')).state, 'active', 'a todo list folded into "… +3 pending"');
  const long = ['✽ Reading owned records… (2m · ↓ 3k tokens)', '  ⎿  ☒ step 0', ...Array.from({ length: 11 }, (_, i) => `     ☐ step ${i + 1}`), ...CLAUDE_CHROME];
  assert.equal(classifyAgentScreen(long.join('\n')).state, 'active', 'inc-a579fa590ed8: the spinner above a todo list longer than the 14-row window');
  const queued = ['✢ Concocting… (running PostToolUse hook · 2m 57s)', '', '> Wake: re-read the exact contract with api op-contract, continue only inside its',
    '  existing authority, and file exactly one api report.', '', '────────', '❯ ', '────────', '  Press up to edit queued messages'];
  assert.equal(classifyAgentScreen(queued.join('\n')).state, 'active', 'starci-next inc-f6df6aad55b7: a wake queued behind the turn');
  assert.equal(classifyAgentScreen(['✻ Manifesting… (15s · ↓ 677 tokens)', '', ...CLAUDE_CHROME].join('\n')).state, 'active', 'inc-d0692581b618');
});

test('a Devin spinner whose row wraps is a running turn (inc-3b9864f5f3f8, inc-07830ad93e97)', () => {
  const wrapped = ['⠠⠤ Thinking · 5m 58s (esc twice to interrupt) · (457c · ctrl+o for details · alt+t to', 'toggle)', ...DEVIN_FOOT];
  assert.equal(classifyAgentScreen(wrapped.join('\n')).state, 'active');
  const writing = ['⠠⠤ Writing .../email-challenge/evidence/backend-implement-18/checks.json · 11m 39s (esc twice to', 'interrupt)', ...DEVIN_FOOT];
  assert.equal(classifyAgentScreen(writing.join('\n')).state, 'active');
});

test('a finished answer below an old spinner still reads turn-idle, near or far', () => {
  assert.equal(classifyAgentScreen(['✢ Transmuting… (running PreToolUse hook · 1m 26s · ↓ 3.9k tokens)', '● Report filed with outcome done.', ...CLAUDE_CHROME].join('\n')).state, 'turn-idle');
  assert.equal(classifyAgentScreen(['• Working (4m 36s • esc to interrupt)', '• Report filed; waiting on the Kernel.', ...CODEX_FOOT].join('\n')).state, 'turn-idle');
  // A spinner beyond the 14-row window counts only when nothing but companion rows follow it.
  const far = ['✽ Reading owned records… (2m · ↓ 3k tokens)', ...Array.from({ length: 12 }, (_, i) => `     ☐ step ${i + 1}`), '● Done: report filed.', ...CLAUDE_CHROME];
  assert.equal(classifyAgentScreen(far.join('\n')).state, 'turn-idle');
  // A long answer row followed by more prose is not a wrap of a spinner: the answer's bullet ends the turn.
  const prose = ['• Working (4m 36s • esc to interrupt) · 1 background terminal running · /ps to view · /stop to close',
    '• Yielding: the report is filed and the Kernel settles it next; nothing else runs in this turn.', 'Next: settle.', ...CODEX_FOOT];
  assert.equal(classifyAgentScreen(prose.join('\n')).state, 'turn-idle');
});

test('Devin trusts a frozen spinner frame for an hour: its card sets liveness.activeStaleMs', () => {
  const card = parseYaml(fs.readFileSync(new URL('../modules/models/agents/devin.yaml', import.meta.url), 'utf8'));
  assert.ok(Number(card.liveness?.activeStaleMs) >= 3_600_000, 'Devin redraws nothing during a long tool call');
  const runtimes = parseYaml(fs.readFileSync(new URL('../modules/models/runtimes.yaml', import.meta.url), 'utf8'));
  assert.ok(Number(runtimes.allocation.liveness.quietMs) > Number(runtimes.allocation.liveness.activeStaleMs), 'quiet outlasts a stale frame');
  const api = fs.readFileSync(new URL('../scripts/kernel/api.mjs', import.meta.url), 'utf8');
  assert.match(api, /livenessMsOf\(job, 'activeStaleMs', ACTIVE_STALE_MS\)/, 'observeOperationWorker reads the card override');
});
