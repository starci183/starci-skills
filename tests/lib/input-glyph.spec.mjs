import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INPUT_GLYPH, INPUT_GLYPH_CLASS, AGENT_GLYPH_CLASS, INPUT_GLYPH_ROW } from '../../scripts/lib/input-glyph.mjs';
import { stagedInputRegion, frameWithDraft, classifyAgentScreen } from '../../scripts/lib/terminal-liveness.mjs';

// Five call sites grew five spellings of "the glyph an agent CLI draws at the head of its input
// row" ([>›❯❭], [>›❯❭»], [>›❯❭], [›❯❭], [>❯❭]). scripts/lib/input-glyph.mjs is the one source;
// cli.mjs keeps its own only because only the w2-api lanes may edit it.

test('the classes name every provider glyph', () => {
  for (const char of ['>', '›', '❯', '❭', '»']) {
    assert.ok(INPUT_GLYPH.test(` ${char} `), `INPUT_GLYPH matches a bare ${char}`);
    assert.ok(INPUT_GLYPH_ROW.test(`${char} text`), `INPUT_GLYPH_ROW matches ${char}`);
  }
  assert.ok(!INPUT_GLYPH.test('*   a bullet'), 'a bare * bullet is never an input glyph');
  assert.ok(!INPUT_GLYPH_ROW.test('* a bullet'), 'the row class never counts a bare * bullet');
  assert.equal(AGENT_GLYPH_CLASS, '[›❯❭]', 'evidence stays narrow: no shell-echoable char');
  assert.equal(INPUT_GLYPH_CLASS, '[>›❯❭»]');
});

test('stagedInputRegion reads the last glyph row - the ">" echo - as the input region', () => {
  const screen = ['some output', 'more output', '❯', '> hello world this is the sent echo'].join('\n');
  const region = stagedInputRegion(screen, { sentText: 'hello world this is the sent echo' });
  assert.ok(region, 'the LAST glyph row - the ">" echo - is the input region');
  assert.equal(region.row, '> hello world this is the sent echo');
  const idle = ['spinner above', '❯'].join('\n');
  assert.ok(stagedInputRegion(idle, { sentText: 'something else entirely here' }) === null, 'no staged text: null');
});

test('frameWithDraft writes a draft into the last input-glyph row', () => {
  const claude = 'output\n❯';
  assert.equal(frameWithDraft(claude, 'd'), 'output\n❯ d');
  assert.equal(frameWithDraft('no glyph row', 'd'), 'no glyph row\n› d');
});

test('a prompt row still classifies turn-idle across the glyph set', () => {
  for (const row of ['❯', '› ', '» staged', '> ']) {
    const { state } = classifyAgentScreen(`answer text\n${row}`);
    assert.equal(state, 'turn-idle', row);
  }
});

test('the five former copies are gone from the runtime scripts', () => {
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.doesNotMatch(read('../../scripts/lib/terminal-liveness.mjs'), /\[>›❯❭\]|\[›❯❭\](?!\])/);
  assert.doesNotMatch(read('../../scripts/agent/lib.mjs'), /\[>❯❭\]|\[›❯❭\](?!\])/);
  assert.doesNotMatch(read('../../scripts/supervisor/supervisor-watchdog.mjs'), /\[>›❯❭\](?!\])/);
  // cli.mjs is reserved for the w2-api lanes: its INPUT_ROW_GLYPH copy stays until they adopt it.
  assert.match(read('../../scripts/kernel/cli.mjs'), /INPUT_ROW_GLYPH/);
});
