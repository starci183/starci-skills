import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { askAssets, askLines, redlinesOf } from '../../scripts/work/draw-review-ask.mjs';

// The wording and the evidence of a draw-review ask's question: a sentence is added only when it has something to
// say, and the owner is shown every drawn part and its redline.
const tr = (text, params = {}) => text.replace(/\{(\w+)\}/g, (_, key) => String(params[key]));

test('a question carries a sentence only for what it has to say', () => {
  const quiet = askLines({ tr, priorRounds: [], answered: [], retired: [], proposals: [], rationale: [] });
  assert.deepEqual(quiet, { roundLine: '', retiredLine: '', proposalLine: '', whyLine: '' });
  const loud = askLines({
    tr,
    priorRounds: [{}, {}],
    answered: [{ id: 'ON-1', text: 'bigger title' }, { id: 'ON-2', text: 'tighter cards' }],
    retired: ['loading', '403'],
    proposals: [{ name: 'Timeline' }, { name: 'Ledger' }],
    rationale: [{ file: 'a/rationale.json', decisions: 4 }],
  });
  assert.equal(loud.roundLine, ' Round 3; this redraw addresses your notes: [ON-1] bigger title | [ON-2] tighter cards.');
  assert.equal(loud.retiredLine, ' Data-status images (loading, 403) are retired and not for review.');
  assert.equal(loud.proposalLine, ' Grammar proposals (yours to decide, never auto-accepted): Timeline, Ledger.');
  assert.equal(loud.whyLine, ' Evidence for every decision: the redline images (spacing, rule ids) and a/rationale.json (4 decisions).');
});

test('a redraw round without open notes says so', () => {
  const lines = askLines({ tr, priorRounds: [{}], answered: [], retired: [], proposals: [], rationale: [] });
  assert.equal(lines.roundLine, ' Round 2; this redraw addresses your notes: (none).');
});

test('every drawn part is shown, and a part with a redline brings it too', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-review-ask-'));
  try {
    const dir = path.join(repoRoot, 'ui');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'home.content.png'), 'x');
    fs.writeFileSync(path.join(dir, 'home.content.redline.png'), 'x');
    fs.writeFileSync(path.join(dir, 'list.content.png'), 'x');
    const reviewed = [
      { path: 'home.content.png', shape: 'Home', breakpoint: 'desktop' },
      { path: 'list.content.png', shape: 'List', breakpoint: 'mobile' },
    ];
    const redlines = redlinesOf(dir, repoRoot, reviewed);
    assert.deepEqual(redlines, [{ part: 'home.content.png', path: 'home.content.redline.png', repoPath: 'ui/home.content.redline.png', shape: 'Home', breakpoint: 'desktop' }]);
    const assets = askAssets({ tr, dir, repoRoot, reviewed, redlines, proposals: [], label: (p) => `${p.shape} - ${p.breakpoint}`, bpLabel: (bp) => bp });
    assert.deepEqual(assets, [
      { path: 'ui/home.content.png', label: 'Home - desktop' },
      { path: 'ui/list.content.png', label: 'List - mobile' },
      { path: 'ui/home.content.redline.png', label: 'Home - redline desktop' },
    ]);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});
