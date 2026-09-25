import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INPUT_GLYPH, INPUT_GLYPH_CLASS, INPUT_GLYPH_BOXED_CLASS, AGENT_GLYPH_CLASS, INPUT_GLYPH_ROW } from '../scripts/lib/input-glyph.mjs';
import { stagedInputRegion, frameWithDraft, classifyAgentScreen } from '../scripts/kernel/terminal-liveness.mjs';

// Five call sites grew five spellings of "the glyph an agent CLI draws at the head of its input
// row" ([>›❯❭*], [>›❯❭»], [>›❯❭], [›❯❭], [>❯❭]). scripts/lib/input-glyph.mjs is the one source;
// api.mjs keeps its own only because only the w2-api lanes may edit it.

test('the classes name every provider glyph, boxed including Qwen\'s "*"', () => {
  for (const char of ['>', '›', '❯', '❭', '»']) {
    assert.ok(INPUT_GLYPH.test(` ${char} `), `INPUT_GLYPH matches a bare ${char}`);
    assert.ok(INPUT_GLYPH_ROW.test(`${char} text`), `INPUT_GLYPH_ROW matches ${char}`);
  }
  assert.ok(INPUT_GLYPH.test('*   Type your message'), 'boxed class counts Qwen\'s * input row');
  assert.ok(!INPUT_GLYPH_ROW.test('* a bullet'), 'the row class never counts a bare * bullet');
  assert.equal(AGENT_GLYPH_CLASS, '[›❯❭]', 'evidence stays narrow: no shell-echoable char');
  assert.equal(INPUT_GLYPH_BOXED_CLASS, '[>›❯❭»*]');
  assert.equal(INPUT_GLYPH_CLASS, '[>›❯❭»]');
});

test('stagedInputRegion reads Qwen\'s boxed row and its ">" echo like before', () => {
  const screen = ['some output', 'more output', '*   Type your message', '> hello world this is the sent echo'].join('\n');
  const region = stagedInputRegion(screen, { sentText: 'hello world this is the sent echo' });
  assert.ok(region, 'the LAST glyph row - the ">" echo - is the input region');
  assert.equal(region.row, '> hello world this is the sent echo');
  const qwenBox = ['spinner above', '*   Type your message or @path/to/file'].join('\n');
  assert.ok(stagedInputRegion(qwenBox, { sentText: 'something else entirely here' }) === null, 'no staged text: null');
});

test('frameWithDraft writes a draft into the last input-glyph row - including Qwen\'s * box', () => {
  const screen = 'output line\n*   Type your message';
  assert.equal(frameWithDraft(screen, 'wake text'), 'output line\n* wake text');
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
  assert.doesNotMatch(read('../scripts/kernel/terminal-liveness.mjs'), /\[>›❯❭\]|\[›❯❭\](?!\])/);
  assert.doesNotMatch(read('../scripts/agent/lib.mjs'), /\[>❯❭\]|\[›❯❭\](?!\])/);
  assert.doesNotMatch(read('../scripts/supervisor/watchdog.mjs'), /\[>›❯❭\](?!\])/);
  // api.mjs is reserved for the w2-api lanes: its INPUT_ROW_GLYPH copy stays until they adopt it.
  assert.match(read('../scripts/kernel/api.mjs'), /INPUT_ROW_GLYPH/);
});
