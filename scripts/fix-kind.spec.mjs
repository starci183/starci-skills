// The line between a fix and a regeneration, in kind and in patience: scripts/validate-request.mjs#fixKindErrors,
// #rulePrefixTopics and #loadFixSize, read from resources/orchestrator.json#fixSize.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { fixKindErrors, rulePrefixTopics, loadFixSize, FIX_OPERATOR } from './validate-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const size = await loadFixSize(root);
const topics = await rulePrefixTopics(root);
const req = (finding, step = 3, extra = {}) => ({ operatorId: FIX_OPERATOR, step, parallel: 1, sessionId: 's', requirements: { finding, mode: 'apply' }, inputs: {}, ...extra });
const errors = (r, state = { steps: {} }, sessionRoot = null) => fixKindErrors(root, state, r, sessionRoot, { size, topics });
// A session on disk with earlier interface.fix branches naming findings.
function session(fixes) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fix-kind-'));
  const steps = {};
  fixes.forEach((finding, i) => {
    const cell = `${i + 1}/1`;
    steps[cell] = FIX_OPERATOR;
    mkdirSync(path.join(dir, `step-${i + 1}`, 'parallel-1', 'request'), { recursive: true });
    writeFileSync(path.join(dir, `step-${i + 1}`, 'parallel-1', 'request', 'request.json'), JSON.stringify(req(finding, i + 1)));
  });
  return { dir, state: { steps }, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the orchestrator publishes the fix size in count, kind and patience', () => {
  assert.ok(Number.isInteger(size.maxFiles) && size.maxFiles >= 1);
  assert.ok(Array.isArray(size.generateTopics) && size.generateTopics.includes('composition'));
  assert.ok(Array.isArray(size.generatePrefixes) && size.generatePrefixes.length);
  assert.ok(Number.isInteger(size.escalateAfter) && size.escalateAfter >= 1);
});
test('every published rule prefix resolves to one topic folder of knowledge/ui', () => {
  assert.ok(topics.size > 10);
  for (const topic of new Set(topics.values())) assert.ok(['composition', 'presentation', 'proof'].includes(topic), topic);
  for (const prefix of size.generatePrefixes) assert.ok(topics.has(prefix), `${prefix} is published by no topic`);
});
test('a presentation or proof-measurement finding is fix-eligible; a composition or taste finding is a surface generated again', async () => {
  const presentation = [...topics].find(([, t]) => t === 'presentation')[0];
  const composition = [...topics].find(([, t]) => t === 'composition')[0];
  const measured = [...topics].find(([p, t]) => t === 'proof' && !size.generatePrefixes.includes(p))[0];
  assert.deepEqual(await errors(req(`m1/root.card/${presentation}-1`)), []);
  assert.deepEqual(await errors(req(`m1/root.card/${measured}-1`)), []);
  const comp = await errors(req(`m1/root.card/${composition}-2`));
  assert.ok(comp.some((e) => e.includes('composition') && e.includes('FIX_TOO_LARGE')), comp.join('\n'));
  const taste = await errors(req(`m1/root.card/${size.generatePrefixes[0]}-3`));
  assert.ok(taste.some((e) => e.includes('generatePrefixes') && e.includes('FIX_TOO_LARGE')), taste.join('\n'));
});
test('a UAT finding carries no rule and is fix-eligible on kind', async () => {
  assert.deepEqual(await errors(req('20260905-010203-abcdef0/open-item')), []);
});
test('a finding fixed once already in the session is not fixed again: the next repair is the generator', async () => {
  const s = session(['m1/root.card/GAP-1', 'm1/root.card/PADDING-2']);
  try {
    const again = await errors(req('m1/root.card/GAP-1', 3), s.state, s.dir);
    assert.ok(again.some((e) => e.includes('already fixed 1 time') && e.includes('1/1') && e.includes('FIX_TOO_LARGE')), again.join('\n'));
    const fresh = await errors(req('m1/root.card/FONT-3', 3), s.state, s.dir);
    assert.deepEqual(fresh, []);
    // Only branches before this one count: a later branch is not history.
    const earlier = await errors(req('m1/root.card/PADDING-2', 2), s.state, s.dir);
    assert.deepEqual(earlier, []);
  } finally { s.cleanup(); }
});
test('another operator, a nested exchange, or a tree with no fix size is left alone', async () => {
  assert.deepEqual(await errors({ ...req('m1/root.card/ACTION-1'), operatorId: 'interface.generate' }), []);
  assert.deepEqual(await errors({ ...req('m1/root.card/ACTION-1'), exchange: 'critique' }), []);
  assert.deepEqual(await fixKindErrors(root, { steps: {} }, req('m1/root.card/ACTION-1'), null, { size: null, topics }), []);
});
