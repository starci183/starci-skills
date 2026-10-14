import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceIndex } from '../../scripts/checks/lib/coverage-ast.mjs';
import { resultReach } from '../../scripts/checks/lib/coverage-results.mjs';

const CODE = 'RT_SAMPLE_FAILURE';
const SPEC = 'tests/checks/sample.spec.mjs';
const ENFORCER = 'scripts/checks/check-sample.mjs';

function fixture(body, implementation, extra = []) {
  const context = { files: new Map([
    [SPEC, `import { sample } from '../../${ENFORCER}'; ${body}`],
    [ENFORCER, implementation], ...extra,
  ]) };
  const index = sourceIndex(context, SPEC);
  return { context, index, calls: index.tree.body.slice(1).map(statement => statement.expression) };
}

test('source implementation reach is cached across calls and excludes authored fixture arguments', () => {
  const { context, index, calls } = fixture(
    "sample({ payload: 'invalid fixture argument' }); sample({ payload: 'passing fixture argument' });",
    `export function sample({ payload }) { return [{ code: '${CODE}', details: payload }]; }`,
  );
  const source = sourceIndex(context, ENFORCER);
  const implementation = source.exports.get('sample');
  const first = resultReach(context, index, calls[0], { code: CODE });
  const cached = source.reaches.get(implementation);
  assert.ok(cached);
  const second = resultReach(context, index, calls[1], { code: CODE });
  assert.equal(source.reaches.get(implementation), cached);
  assert.deepEqual(first.get(ENFORCER), second.get(ENFORCER));
  const literals = [...first.values(), ...second.values()].flat().filter(node => node.type === 'Literal');
  assert.ok(literals.some(node => node.value === CODE));
  assert.ok(literals.every(node => !String(node.value).includes('fixture argument')));
});

test('cached implementation reach refreshes when a delegated source changes', () => {
  const dependency = 'scripts/checks/findings.mjs';
  const { context, index, calls } = fixture('sample();',
    `import { findings } from './findings.mjs'; export function sample() { return [{ code: '${CODE}', details: findings() }]; }`,
    [[dependency, "export function findings() { return 'before'; }"]],
  );
  const source = sourceIndex(context, ENFORCER);
  const implementation = source.exports.get('sample');
  resultReach(context, index, calls[0], { code: CODE });
  const previous = source.reaches.get(implementation);
  context.files.set(dependency, "export function findings() { return 'after'; }");
  const reached = resultReach(context, index, calls[0], { code: CODE });
  assert.notEqual(source.reaches.get(implementation), previous);
  assert.ok(reached.get(dependency).some(node => node.value === 'after'));
  assert.ok(reached.get(dependency).every(node => node.value !== 'before'));
});

test('delegated checker results preserve parameter bindings through consumed wrappers', () => {
  const dependency = 'scripts/checks/findings.mjs';
  const { context, index, calls } = fixture(
    `const scan = invalid => sample(invalid); scan(true);`,
    `import { findings } from './findings.mjs'; export function sample(invalid) { const report = findings(invalid); return report.filter(finding => finding); }`,
    [[dependency, `export function findings(invalid) { return invalid ? [{ code: '${CODE}' }] : []; }`]],
  );
  const reached = resultReach(context, index, calls[1], { code: CODE });
  assert.ok(reached.get(ENFORCER).includes(sourceIndex(context, ENFORCER).exports.get('sample')));
  assert.ok(reached.get(dependency).some(node => node.value === CODE));
});

test('discarded delegated checker results do not reach an unrelated returned value', () => {
  const dependency = 'scripts/checks/findings.mjs';
  const { context, index, calls } = fixture('sample(true);',
    "import { findings } from './findings.mjs'; export function sample(invalid) { findings(invalid); return []; }",
    [[dependency, `export function findings(invalid) { return invalid ? [{ code: '${CODE}' }] : []; }`]],
  );
  const reached = resultReach(context, index, calls[0], { code: CODE });
  assert.ok(reached.has(ENFORCER));
  assert.equal(reached.has(dependency), false);
});
