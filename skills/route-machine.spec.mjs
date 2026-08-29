import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { conditionMatches, nextState } from './route-machine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const machine = (id) => JSON.parse(readFileSync(path.join(root, id, 'machine.json'), 'utf8'));

test('v7 routes only from normalized input or validated operator output', () => {
  assert.equal(conditionMatches({ inputEquals: { 'intent.mode': 'audit' } }, {}, { intent: { mode: 'audit' } }), true);
  assert.equal(conditionMatches({ outputEquals: { outcome: 'passed' } }, { output: { outcome: 'passed' } }, {}), true);
  assert.equal(conditionMatches(
    { outputEquals: { outcome: 'passed' } },
    { trace: { actualOutput: { outcome: 'passed' } } },
    {}
  ), true);
});

test('frontend starts, consumes RETURN, or consumes authority RESUME without restarting blindly', () => {
  const fe = machine('starci-fe-process');
  assert.equal(nextState(fe, 'analyze-input', {}, { receiptType: 'NONE' }), 'compile');
  assert.equal(nextState(fe, 'analyze-input', {}, { receiptType: 'RETURN' }), 'consume-return');
  assert.equal(nextState(fe, 'analyze-input', {}, { receiptType: 'RESUME' }), 'consume-choice-resume');
});

test('wait states require a typed RESUME and use only the declared resume target', () => {
  const fe = machine('starci-fe-process');
  assert.throws(() => nextState(fe, 'direction-choice', {}, {}), /typed RESUME/);
  assert.equal(nextState(fe, 'direction-choice', { type: 'RESUME' }, {}), 'analyze-input');
  assert.throws(() => nextState(fe, 'mutation-choice', { type: 'RETURN' }, {}), /typed RESUME/);
  assert.equal(nextState(fe, 'mutation-choice', { type: 'RESUME' }, {}), 'analyze-input');
});

test('ambiguous or absent routes fail closed', () => {
  const ambiguous = {
    id: 'ambiguous',
    states: {
      start: {
        kind: 'choice',
        on: [
          { when: {}, target: 'a' },
          { when: {}, target: 'b' }
        ]
      },
      a: { kind: 'terminal', result: 'complete' },
      b: { kind: 'terminal', result: 'blocked' }
    }
  };
  assert.throws(() => nextState(ambiguous, 'start', {}, {}), /matched 2/);
  assert.throws(() => nextState(machine('starci-fe-process'), 'analyze-input', {}, { receiptType: 'UNKNOWN' }), /matched 0/);
});

test('all twelve public machines are v7 mission machines', () => {
  const catalog = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'));
  assert.equal(catalog.skills.length, 12);
  for (const { id } of catalog.skills) {
    const candidate = machine(id);
    assert.equal(candidate.schemaVersion, 7, id);
    assert.equal(candidate.start, 'analyze-input', id);
    assert.equal(candidate.states['analyze-input'].kind, 'analysis', id);
  }
});
