import test from 'node:test';
import assert from 'node:assert/strict';
import { astNodes, sourceIndex } from '../../scripts/checks/lib/coverage-ast.mjs';
import { resultReach } from '../../scripts/checks/lib/coverage-results.mjs';
import { claimedSpecProof, coverageProofFindings } from '../../scripts/checks/lib/coverage-proofs.mjs';

const SPEC = 'tests/checks/result.spec.mjs';
const ENFORCER = 'scripts/checks/check-result.mjs';
const CONSTANTS = 'scripts/checks/result-codes.mjs';
const CODE = 'RESULT_CODE';
const EDITIONS = ['lite', 'full'];

function fixture(enforcer, proof = 'inspect();') {
  const context = { files: new Map([
    [ENFORCER, enforcer],
    [SPEC, `import { inspect } from '../../${ENFORCER}';\n${proof}`],
  ]) };
  const index = sourceIndex(context, SPEC);
  return { context, index, call: index.tree.body.at(-1).expression };
}

test('broad enforcer dependencies retain every node and traversal order', () => {
  // This exceeds V8's argument limit for a single push(...dependencies).
  const values = Array.from({ length: 150_000 }, (_entry, position) => position);
  const { context, index, call } = fixture(`export function inspect() { return [${values.join(',')}]; }`);
  const reached = resultReach(context, index, call);
  const target = sourceIndex(context, ENFORCER).exports.get('inspect');
  const expected = astNodes(target);
  const dependencies = reached.get(ENFORCER);
  assert.equal(dependencies.length, expected.length);
  assert.ok(expected.every((node, position) => dependencies[expected.length - position - 1] === node));
  assert.equal(dependencies.filter((node) => node.type === 'Literal').length, values.length);
  assert.deepEqual(reached.get(SPEC), [call]);
});

test('helpers-only result reach keeps test helper bindings and excludes enforcer internals', () => {
  const { context, index, call } = fixture('export function inspect() { return "RESULT_CODE"; }',
    'function identity(value) { return value; }\nidentity(inspect());');
  const helpers = resultReach(context, index, call, { helpersOnly: true });
  assert.equal(helpers.has(ENFORCER), false);
  assert.ok(helpers.get(SPEC).some((node) => node.type === 'CallExpression' && node.callee.name === 'inspect'));
  const complete = resultReach(context, index, call);
  assert.ok(complete.get(ENFORCER).some((node) => node.type === 'Literal' && node.value === 'RESULT_CODE'));
});

function proofFixture(body) {
  const enforcer = "import { RESULT_CODE as failure } from './result-codes.mjs';\nexport function inspect(invalid) { return invalid ? [{code: failure}] : []; }";
  const checks = body ?? "for (const edition of ['lite', 'full']) { test('invalid', () => assert.equal(inspect(true)[0].code, 'RESULT_CODE')); test('valid', () => assert.deepEqual(inspect(false), [])); }";
  const { context } = fixture(enforcer,
    `import test from 'node:test';\nimport assert from 'node:assert/strict';\n// proves: RESULT_CODE@lite RESULT_CODE@full OTHER_CODE@lite OTHER_CODE@full\n${checks}`);
  context.files.set(CONSTANTS, "export const RESULT_CODE = 'RESULT_CODE';");
  const rule = { id: 'R01', code: CODE, failureCodes: [CODE], editions: EDITIONS, proves: [SPEC],
    enforcers: [{kind: 'runtime', id: 'inspect', at: ENFORCER}] };
  context.catalog = { rules: [rule] };
  return { context, rule };
}

for (const edition of EDITIONS) {
  test(`imported code constants substantiate the reached ${edition} emitter`, () => {
    const { context, rule } = proofFixture();
    assert.deepEqual(coverageProofFindings(context, rule, CODE, edition), []);
    context.files.set(ENFORCER, context.files.get(ENFORCER).replace('code: failure', "code: 'OTHER_CODE'"));
    assert.equal(coverageProofFindings(context, rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    context.files.set(ENFORCER, "import { RESULT_CODE as failure } from './result-codes.mjs';\nexport function inspect(failure) { return failure ? [{code: failure}] : []; }");
    assert.equal(coverageProofFindings(context, rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
  });

  test(`assertion analysis invalidates changed, removed and restored ${edition} helper sources`, () => {
    const { context, rule } = proofFixture();
    assert.deepEqual(coverageProofFindings(context, rule, CODE, edition), []);
    context.files.set(CONSTANTS, "export const RESULT_CODE = 'OTHER_CODE';");
    assert.equal(coverageProofFindings(context, rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    context.files.delete(CONSTANTS);
    assert.equal(coverageProofFindings(context, rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    context.files.set(CONSTANTS, "export const RESULT_CODE = 'RESULT_CODE';");
    assert.deepEqual(coverageProofFindings(context, rule, CODE, edition), []);
  });
}

test('cached assertion analysis preserves code and edition bindings across requests', () => {
  const { context, rule } = proofFixture("for (const [edition, code] of [['lite', 'RESULT_CODE'], ['full', 'OTHER_CODE']]) { test('invalid ' + edition, () => assert.equal(inspect(true)[0].code, code)); test('valid ' + edition, () => assert.deepEqual(inspect(false), [])); }");
  context.files.set(ENFORCER, context.files.get(ENFORCER).replace('code: failure', "code: failure, detail: 'OTHER_CODE'"));
  rule.failureCodes.push('OTHER_CODE');
  assert.deepEqual(coverageProofFindings(context, rule, CODE, 'lite'), []);
  assert.equal(coverageProofFindings(context, rule, CODE, 'full')[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
  assert.deepEqual(coverageProofFindings(context, rule, 'OTHER_CODE', 'full'), []);
  assert.equal(coverageProofFindings(context, rule, 'OTHER_CODE', 'lite')[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
  context.files.set(SPEC, context.files.get(SPEC).replace("['lite', 'RESULT_CODE']", "['lite', 'OTHER_CODE']"));
  assert.equal(coverageProofFindings(context, rule, CODE, 'lite')[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
});

test('a directly proven spec avoids parsing unrelated spec files', () => {
  const { context } = proofFixture();
  const unrelated = 'tests/checks/unrelated.spec.mjs';
  context.files.set(unrelated, 'unrelated authored source');
  let reads = 0;
  context.files.get = (file) => {
    if (file === unrelated) reads += 1;
    return Map.prototype.get.call(context.files, file);
  };
  assert.equal(claimedSpecProof(context, SPEC, CODE, 'lite'), true);
  assert.equal(reads, 0);
});
