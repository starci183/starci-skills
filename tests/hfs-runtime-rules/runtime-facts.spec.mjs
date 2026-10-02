// runtime-facts.spec.mjs - RT_FACT_FALSE (scripts/hfs/runtime-rules/facts.mjs): the facts of knowledge/hfs/facts.yaml hold
// against slots.yaml, and prose that states the opposite is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { contradictions, factFindings, slotProblem } from '../../scripts/hfs/runtime-rules/facts.mjs';

const manifest = loadSlotManifest();
const FACTS = `schema: starci/facts@1
facts:
  - id: fe-app-has-package-json
    claim: Each fe app has its own package.json.
    slot: {id: fe.app.next, requires: package.json}
    contradicts:
      - pattern: '\\bno \`?package\\.json\`?\\b'
        near: 'apps/<app>|an fe app'
  - id: one-root-lockfile
    claim: One root lockfile.
    slot: {id: app.lockfile, presence: required}
`;
const ctxOf = (texts) => ({ root: process.cwd(), files: Object.keys(texts), params: { generated: [{ root: 'packages/x/runtime' }] }, read: (file) => texts[file] ?? null });

test('RT_FACT_FALSE: the shipped facts hold against slots.yaml', () => {
  const doc = { fe: { id: 'fe.app.next', requires: 'package.json' }, lock: { id: 'app.lockfile', presence: 'required' } };
  assert.equal(slotProblem({ id: 'a', claim: 'c', slot: doc.fe }, manifest), null);
  assert.equal(slotProblem({ id: 'b', claim: 'c', slot: doc.lock }, manifest), null);
});

test('RT_FACT_FALSE: a fact the slot does not say, or a slot slots.yaml lacks, is refused', () => {
  assert.match(slotProblem({ id: 'a', claim: 'c', slot: { id: 'fe.app.next', requires: 'no-such-file' } }, manifest), /does not require no-such-file/);
  assert.match(slotProblem({ id: 'b', claim: 'c', slot: { id: 'app.lockfile', presence: 'forbidden' } }, manifest), /presence is required/);
  assert.match(slotProblem({ id: 'c', claim: 'c', slot: { id: 'nope' } }, manifest), /does not declare/);
});

test('RT_FACT_FALSE: prose that says an fe app has no package.json is refused, a be line is clean', () => {
  const fact = { id: 'f', claim: 'c', contradicts: [{ pattern: '\\bno `?package\\.json`?\\b', near: 'apps/<app>|an fe app' }] };
  assert.deepEqual(contradictions(fact, 'x\n├── apps/<app>/   # one Next app, no package.json of its own\n'), [{ line: 2, pattern: fact.contradicts[0].pattern }]);
  assert.deepEqual(contradictions(fact, 'an fe app root\nnext.config.ts   no package.json: the app root holds it\n').map((hit) => hit.line), [2]);
  assert.deepEqual(contradictions(fact, 'an fe app is a workspace\nthe back end has no package.json of its own\n'), [{ line: 2, pattern: fact.contradicts[0].pattern }], 'without `unless`, the window of an fe app line reaches it');
  const withUnless = { ...fact, contradicts: [{ ...fact.contradicts[0], unless: 'back end' }] };
  assert.deepEqual(contradictions(withUnless, 'an fe app is a workspace\nthe back end has no package.json of its own\n'), []);
  assert.deepEqual(contradictions(fact, 'be has no package.json of its own\n'), []);
});

test('RT_FACT_FALSE: the repo scan refuses a contradicting file, skips generated copies and the facts file, and a missing facts file', () => {
  const texts = { 'knowledge/hfs/facts.yaml': FACTS, 'docs/a.md': 'an fe app has no package.json\n', 'docs/b.md': 'fine\n', 'packages/x/runtime/docs/c.md': 'an fe app has no package.json\n' };
  const found = factFindings(ctxOf(texts));
  assert.deepEqual(found.map((f) => [f.code, f.path, f.line]), [['RT_FACT_FALSE', 'docs/a.md', 1]]);
  assert.deepEqual(factFindings(ctxOf({ 'docs/b.md': 'fine\n' })).map((f) => f.path), ['knowledge/hfs/facts.yaml']);
  assert.deepEqual(factFindings(ctxOf({ 'knowledge/hfs/facts.yaml': FACTS, 'docs/b.md': 'fine\n' })), []);
});
