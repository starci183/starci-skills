// One operator, one job, one artifact: scripts/validate-operator.mjs#checkDoneWhenAlternatives and #checkPrimaryOutput.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkDoneWhenAlternatives, checkPrimaryOutput, doneWhenAlternatives, ALTERNATIVE_OPENERS } from './validate-operator.mjs';
import { loadOperatorPackages, kindOf } from './operator-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const op = (doneWhen) => ({ lang: 'en', doneWhen, headings: [] });
const at = 'operators/x/operator.md';

test('a Done when with no alternative, or with mode and shape alternatives only, is one job', () => {
  assert.deepEqual(checkDoneWhenAlternatives(at, op('Done when the `receipt` exists.')), []);
  assert.deepEqual(checkDoneWhenAlternatives(at, op('Done when, under mode apply, the `receipt` records one commit; or, under mode dry, the `plan` carries a null commit.')), []);
  assert.deepEqual(checkDoneWhenAlternatives(at, op('Done when the `resolution` gives every property one rule, or records its gap; or, when the direction declared a delta of none, the `resolution` is empty.')), []);
  assert.deepEqual(checkDoneWhenAlternatives(at, op('Done when, for an image release, the `deployment` records the digest; or, for a migration release, the `migration-release` records the set applied once.')), []);
  assert.deepEqual(checkDoneWhenAlternatives(at, op('Done when either, under mode model, the `authority` travels with the receipt, or, under mode reconcile, the head has been compared.')), []);
  assert.deepEqual(doneWhenAlternatives('a; or, under mode dry, b or, when c, d').length, 3);
});
test('a Done when that joins two jobs with "or" is refused, and the error states the rule', () => {
  for (const text of [
    'Done when the `image` is published or, the `migration` is applied.',
    'Done when the `account` exists; or, the `seed` rows are written.',
    'Done when the `receipt` exists; or, the runtime serves the head, or, under mode dry, nothing is written.',
  ]) {
    const errors = checkDoneWhenAlternatives(at, op(text));
    assert.equal(errors.length, 1, text);
    assert.ok(errors[0].includes('joins two jobs'));
    for (const opener of ALTERNATIVE_OPENERS) assert.ok(errors[0].includes(`"${opener}"`));
    assert.ok(errors[0].includes('a second job is a second operator'));
  }
});
test('primaryOutput names exactly one Outputs kind and the Done when names it in backticks', () => {
  const outputs = new Set(['receipt', 'log']);
  const done = op('Done when the `receipt` records the `log`.');
  assert.deepEqual(checkPrimaryOutput('operators/x/operator.json', at, { primaryOutput: 'receipt' }, done, outputs), []);
  assert.ok(checkPrimaryOutput('operators/x/operator.json', at, {}, done, outputs).some((e) => e.includes('exactly one')));
  assert.ok(checkPrimaryOutput('operators/x/operator.json', at, { primaryOutput: ['receipt', 'log'] }, done, outputs).some((e) => e.includes('names 2 kinds')));
  assert.ok(checkPrimaryOutput('operators/x/operator.json', at, { primaryOutput: 'verdict' }, done, outputs).some((e) => e.includes('not a kind of the Outputs table')));
  assert.ok(checkPrimaryOutput('operators/x/operator.json', at, { primaryOutput: 'log' }, op('Done when the `receipt` exists.'), outputs).some((e) => e.includes('does not name the primary output `log`')));
});
test('every operator.md package in the tree passes both checks', async () => {
  const packages = (await loadOperatorPackages(root)).filter((p) => p.shape === 'v9');
  assert.ok(packages.length > 0);
  for (const pkg of packages) {
    const kinds = new Set((pkg.en.tables.outputs?.rows ?? []).map((r) => kindOf(r.kind)));
    assert.deepEqual([...checkDoneWhenAlternatives(pkg.name, pkg.en), ...checkPrimaryOutput(pkg.name, pkg.name, pkg.manifest, pkg.en, kinds)], [], pkg.name);
  }
});

// The graph is closed: scripts/validate-operator.mjs#checkGraphClosure.
import { checkGraphClosure } from './validate-operator.mjs';
const pkgOf = (id, { inputs = [], outputs = [], next = [], primary = null } = {}) => ({
  shape: 'v9', name: id.replace(/\./g, '-'), manifest: { id, primaryOutput: primary },
  en: { tables: {
    inputs: { rows: inputs.map(([kind, required]) => ({ kind: `\`${kind}\``, from: 'x', required: required ? 'yes' : 'no' })) },
    outputs: { rows: outputs.map((kind) => ({ kind: `\`${kind}\``, file: 'f', type: 'md', required: 'yes' })) },
    next: { rows: next.map((operator) => ({ when: 'w', operator: `\`${operator}\`` })) },
  } },
});
test('a required input nobody produces, and a primary output nobody reads or ends on, are refused', () => {
  const closed = [
    pkgOf('a.plan', { outputs: ['plan'], primary: 'plan', next: ['a.run'] }),
    pkgOf('a.run', { inputs: [['plan', true]], outputs: ['run'], primary: 'run', next: ['user'] }),
  ];
  assert.deepEqual(checkGraphClosure(closed), []);
  const orphanInput = checkGraphClosure([pkgOf('a.run', { inputs: [['plan', true]], outputs: ['run'], primary: 'run', next: ['user'] })]);
  assert.ok(orphanInput.some((e) => e.includes('required input plan is produced by no other operator')));
  const unread = checkGraphClosure([pkgOf('a.plan', { outputs: ['plan'], primary: 'plan', next: ['a.run'] }), pkgOf('a.run', { outputs: ['run'], primary: 'run', next: ['user'] })]);
  assert.ok(unread.some((e) => e.includes('primary output plan is consumed by no Inputs table')));
  // Its own earlier run is history, not a producer.
  const self = checkGraphClosure([pkgOf('a.run', { inputs: [['run', true]], outputs: ['run'], primary: 'run', next: ['user'] })]);
  assert.ok(self.some((e) => e.includes('required input run is produced by no other operator')));
  // An optional input needs no producer; the publish and the deploy end a chain without a user row.
  assert.deepEqual(checkGraphClosure([pkgOf('git.publish', { inputs: [['nothing', false]], outputs: ['pub'], primary: 'pub' })]), []);
});
