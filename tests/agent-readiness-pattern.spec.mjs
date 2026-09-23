import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_READY_PATTERN } from '../scripts/agent/lib.mjs';
import { parseYaml } from '../engine/yaml.mjs';

// Claude Code renders "Opus 5.5 with high effort", never the id claude-opus-5-5;
// the kernel boot failed at model-attestation until the card declared the name.
test('every Claude model id the runtimes route to has a display name the claude card attests', () => {
  const card = parseYaml(fs.readFileSync(new URL('../modules/models/agents/claude.yaml', import.meta.url), 'utf8'));
  const runtimes = fs.readFileSync(new URL('../modules/models/runtimes.yaml', import.meta.url), 'utf8');
  const ids = [...new Set(runtimes.match(/claude-(?:opus|sonnet|haiku|fable)-[0-9]+(?:-[0-9]+)?/g) ?? [])];
  assert.ok(ids.length > 0);
  for (const id of ids) assert.ok(card.modelAttestation?.displayNames?.[id], `claude card declares a display name for ${id}`);
});

// Claude Code 2.1.280 draws a rule and a status row below its `❯` prompt; the
// readiness pattern anchored at end-of-screen never matched a ready kernel, so
// every nivo Claude kernel timed out at readiness while it sat at its prompt.
test('the default readiness pattern finds a prompt glyph on any line, not only the last', () => {
  const re = new RegExp(DEFAULT_READY_PATTERN, 'i');
  const claude = [
    ' ▐▛███▛█   Claude Code v2.1.280',
    '▝▜██████▀  Opus 5.5 with high effort · Claude Max',
    '  ▝▝ ▝▝    D:\\Repositories\\nivo-backend',
    '─────',
    '❯',
    '─────',
    '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents',
  ].join('\n');
  assert.equal(re.test(claude), true);
  assert.equal(re.test('› Ask Codex to do anything'), true);
  assert.equal(re.test('❯ '), true, 'a last-line prompt still matches');
  assert.equal(re.test('Loading project…\nThinking'), false, 'no prompt glyph, not ready');
  assert.equal(re.test('❯ 1. Auto (match terminal)'), false, 'a menu cursor with text is not a bare prompt');
});
