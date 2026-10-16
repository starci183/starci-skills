import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageProofFindings } from '../../scripts/checks/lib/coverage-proofs.mjs';

const CODE = 'COLLECTED_FAILURE';
const ENFORCER = 'scripts/checks/collector.mjs';
const SPEC = 'tests/checks/collector.spec.mjs';

function fixture(body, helpers = '') {
  const rule = { id: 'R01', failureCodes: [CODE], proves: [SPEC],
    enforcers: [{ kind: 'runtime', id: 'sample', at: ENFORCER }] };
  return { rule, catalog: { rules: [rule] }, files: new Map([
    [ENFORCER, `// ${CODE}\nimport { check } from './child.mjs';
${helpers}
export function sample(invalid) { ${body} }`],
    ['scripts/checks/child.mjs', `export function check(invalid) { return invalid ? [{code: '${CODE}'}] : []; }`],
    [SPEC, `// proves: ${CODE}@lite ${CODE}@full
import test from 'node:test'; import assert from 'node:assert/strict';
import { sample } from '../../${ENFORCER}';
for (const edition of ['lite', 'full']) test('valid and invalid', () => {
assert.deepEqual(sample(true).map(finding => finding.code), ['${CODE}']);
assert.deepEqual(sample(false), []);
});`],
  ]) };
}

const positive = [
  ['spread pushes', 'const findings = []; findings.push(...check(invalid)); return findings;'],
  ['single pushes', 'const findings = []; if (invalid) findings.push(check(invalid)[0]); return findings;'],
  ['collector aliases', 'const findings = []; const alias = findings; alias.push(...check(invalid)); return findings;'],
  ['parameter writes', 'const findings = []; fill(findings, invalid); return findings;',
    'function fill(output, invalid) { output.push(...check(invalid)); }'],
  ['destructured parameter writes', 'const findings = []; fill({output: findings}, invalid); return findings;',
    'function fill({output}, invalid) { output.push(...check(invalid)); }'],
  ['invoked callback writes', 'const findings = []; visit(() => findings.push(...check(invalid))); return findings;',
    'function visit(fn) { fn(); }'],
  ['async parameter writes', 'const findings = []; fill({findings}, invalid); return findings;',
    'async function fill({findings}, invalid) { await each([invalid], value => findings.push(...check(value))); } function each(items, fn) { return new Promise(resolve => { for (const item of items) fn(item); resolve(); }); }'],
];
const negative = [
  ['empty iteration', 'const findings = []; for (const item of []) findings.push(...check(invalid)); return findings;'],
  ['early branch return', 'const findings = []; if (true) return []; findings.push(...check(invalid)); return findings;'],
  ['false branch', 'const findings = []; if (false) findings.push(...check(invalid)); return findings;'],
  ['custom ignored iteration callback', 'const findings = []; unknown.forEach(() => findings.push(...check(invalid))); return findings;'],
  ['discarded calls', 'const findings = []; check(invalid); return findings;'],
  ['different array', 'const findings = []; const other = []; other.push(...check(invalid)); return findings;'],
  ['unused writer', 'const findings = []; const fill = () => findings.push(...check(invalid)); return findings;'],
  ['ignored callback', 'const findings = []; ignore(() => findings.push(...check(invalid))); return findings;',
    'function ignore(fn) { return []; }'],
  ['shadowed collector', 'const findings = []; { const findings = []; findings.push(...check(invalid)); } return findings;'],
  ['cleared collector', 'const findings = []; findings.push(...check(invalid)); findings.length = 0; return findings;'],
  ['reassigned collector', 'let findings = []; findings.push(...check(invalid)); findings = []; return findings;'],
  ['unreachable push', 'const findings = []; return findings; findings.push(...check(invalid));'],
  ['unused sibling export', 'return [];', 'export function unused(invalid) { const findings = []; findings.push(...check(invalid)); return findings; }'],
];
for (const edition of ['lite', 'full']) {
  for (const [shape, body, helpers] of [
    ['spread facade result', 'const findings = []; findings.push(...check(invalid)); return findings;', ''],
    ['loop facade result', 'const findings = []; for (const item of check(invalid)) findings.push({code: item.code}); return findings;', ''],
    ['built facade result', 'const findings = []; const add = code => findings.push({code}); for (const item of check(invalid)) add(item.code); return build({findings});',
      'function build({findings}) { return {findings}; }'],
    ['mapped initialized facade result', 'const findings = [...check(invalid)]; return {findings: findings.map(item => item)};', ''],
  ]) test(`recognizes ${edition} ${shape} and refuses unresolved facades`, () => {
    const context = fixture(body, helpers);
    context.files.set(ENFORCER, context.files.get(ENFORCER).replace("'./child.mjs'", "'./facade.mjs'"));
    if (shape.includes('built') || shape.includes('mapped')) context.files.set(SPEC, context.files.get(SPEC)
      .replace('sample(true).map', 'sample(true).findings.map').replace('sample(false),', 'sample(false).findings,'));
    const facade = 'scripts/checks/facade.mjs';
    context.files.set(facade, "export { scan as check } from './bridge.mjs';");
    context.files.set('scripts/checks/bridge.mjs', "export { check as scan } from './child.mjs';");
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    for (const source of [
      "export { check } from './facade.mjs';",
      "export { check } from './missing.mjs';",
      "export { absent as check } from './child.mjs';",
      "export { check } from 'external-package';",
    ]) {
      context.files.set(facade, source);
      assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    }
  });
  test(`refuses ${edition} facade emissions into a discarded sink`, () => {
    const context = fixture('const findings = []; const ignored = []; ignored.push(...check(invalid)); return findings;');
    context.files.set(ENFORCER, context.files.get(ENFORCER).replace("'./child.mjs'", "'./facade.mjs'"));
    context.files.set('scripts/checks/facade.mjs', "export { check } from './child.mjs';");
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
  });
  for (const [shape, body, helpers] of [
    ['discarded builder argument', 'const findings = []; findings.push(...check(invalid)); return build({findings});', 'function build(input) { return []; }'],
    ['different builder property', 'const findings = []; const other = []; findings.push(...check(invalid)); return build({findings, other});', 'function build({other}) { return other; }'],
    ['shadowed facade', 'const check = () => []; const findings = []; findings.push(...check(invalid)); return findings;', ''],
    ['empty facade loop', 'const findings = []; for (const item of []) findings.push(...check(invalid)); return findings;', ''],
  ]) test(`refuses ${edition} ${shape}`, () => {
    const context = fixture(body, helpers);
    context.files.set(ENFORCER, context.files.get(ENFORCER).replace("'./child.mjs'", "'./facade.mjs'"));
    context.files.set('scripts/checks/facade.mjs', "export { check } from './child.mjs';");
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
  });
  for (const [shape, body, helpers] of positive) test(`recognizes ${edition} ${shape}`, () => {
    const context = fixture(body, helpers);
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
  });
  for (const [shape, body, helpers] of negative) test(`refuses ${edition} ${shape}`, () => {
    const context = fixture(body, helpers);
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
  });
}
