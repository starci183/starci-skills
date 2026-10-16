import test from 'node:test';
import assert from 'node:assert/strict';
import { claimedSpecProof, coverageProofFindings } from '../../scripts/checks/lib/coverage-proofs.mjs';
import { resultReach } from '../../scripts/checks/lib/coverage-results.mjs';
import { astNodes, sourceIndex } from '../../scripts/checks/lib/coverage-ast.mjs';

const CODE = 'RT_SAMPLE_FAILURE';
const SPEC = 'tests/checks/sample.spec.mjs';
const ENFORCER = 'scripts/checks/check-sample.mjs';
const EDITIONS = ['lite', 'full'];
const imports = `import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../../${ENFORCER}';
// proves: ${CODE}@lite ${CODE}@full
`;
const sourceChecks = `assert.equal(sample(true)[0].code, '${CODE}'); assert.deepEqual(sample(false), []);`;

for (const edition of EDITIONS) {
  test(`recognizes ${edition} wrapper results whose code is emitted by a delegated checker`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('valid and invalid', () => { ${sourceChecks} });`);
    context.files.set(ENFORCER, `// ${CODE}\nimport { check } from './findings.mjs';
export function sample(invalid) { const report = check(invalid); return report.findings.filter(finding => finding); }
export function unused(invalid) { return check(invalid).findings; }`);
    const delegate = 'scripts/checks/findings.mjs';
    const source = `export function check(invalid) {
const findings = []; if (invalid) findings.push({code: '${CODE}'}); return {findings}; }`;
    context.files.set(delegate, source);
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    context.files.set(delegate, source.replace(CODE, 'OTHER_CODE'));
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    context.files.delete(delegate);
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    context.files.set(delegate, source);
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    context.rule.enforcers[0].id = 'unused';
    assert.match(coverageProofFindings(context, context.rule, CODE, edition)[0]?.message, /runtime:unused/);
  });

  test(`recognizes consumed delegated checker values for ${edition}`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('valid and invalid', () => { ${sourceChecks} });`);
    context.files.set(ENFORCER, `// ${CODE}\nimport { findings } from './findings.mjs';
export function sample(invalid) { const report = findings(invalid); return report.filter(finding => finding); }
export function unused(invalid) { return findings(invalid); }`);
    context.files.set('scripts/checks/findings.mjs', `export function findings(invalid) { return invalid ? [{ code: '${CODE}' }] : []; }`);
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    context.rule.enforcers[0].id = 'unused';
    assert.match(coverageProofFindings(context, context.rule, CODE, edition)[0]?.message, /runtime:unused/);
  });

  test(`recognizes ${edition} exported aliases that return an aliased delegated result`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('valid and invalid', () => { ${sourceChecks} });`);
    context.files.set(ENFORCER, `// ${CODE}\nimport { findings as check } from './findings.mjs';
const checker = check;
const scan = invalid => { const report = checker(invalid); const result = report; return result; };
export { scan as sample };`);
    context.files.set('scripts/checks/findings.mjs', `export function findings(invalid) { return invalid ? [{ code: '${CODE}' }] : []; }`);
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
  });

  test(`refuses discarded delegated checker results and unrelated returned values for ${edition}`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('valid and invalid', () => { ${sourceChecks} });`);
    context.files.set('scripts/checks/findings.mjs', `export function findings(invalid) { return invalid ? [{ code: '${CODE}' }] : []; }`);
    for (const body of [
      'findings(invalid); return [];',
      'const ignored = findings(invalid); return unrelated();',
      'return discarded(invalid);',
      'const scan = findings; scan(invalid); return unrelated();',
      'const scan = discarded; return scan(invalid);',
    ]) {
      context.files.set(ENFORCER, `// ${CODE}\nimport { findings } from './findings.mjs';
function unrelated() { return []; }
function discarded(invalid) { findings(invalid); return []; }
export function sample(invalid) { ${body} }`);
      assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    }
  });
}

test('result evidence traverses a checker dependency graph larger than the call argument limit', () => {
  const values = Array.from({ length: 40000 }, (_value, index) => `{ value: ${index} }`).join(',');
  const context = { files: new Map([
    [SPEC, `import { sample } from '../../${ENFORCER}'; sample();`],
    [ENFORCER, `export function sample() { return [${values}]; }`],
  ]) };
  const index = sourceIndex(context, SPEC);
  const actual = index.tree.body[1].expression;
  const reached = resultReach(context, index, actual);
  const literals = reached.get(ENFORCER).filter((node) => node.type === 'Literal');
  assert.equal(literals.length, 40000);
  assert.equal(literals[0].value, 0);
  assert.equal(literals.at(-1).value, 39999);
});

function fixture(body, lint = false) {
  const rule = { id: 'R01', code: CODE, failureCodes: [CODE], editions: EDITIONS, proves: [SPEC],
    enforcers: [{ kind: 'runtime', id: 'sample', at: ENFORCER }] };
  const files = new Map([[SPEC, imports + body], [ENFORCER,
    `export function sample(invalid) { return invalid ? [{ code: '${CODE}' }] : []; }`]]);
  if (lint) {
    rule.enforcers = [{ kind: 'eslint-be', id: 'sample' }];
    files.set('packages/eslint/be/index.mjs', `export const rules = {sample: {meta: {}, create() { return {}; }}};`);
    files.set(SPEC, imports + `import { RuleTester } from 'eslint';
import { rules } from '../../packages/eslint/be/index.mjs';
const tester = new RuleTester();
` + body);
  }
  return { catalog: { rules: [rule] }, files, rule };
}

const recognized = [
  ['string edition loop', `for (const edition of ['lite', 'full']) test('valid and invalid cases', () => { ${sourceChecks} });`],
  ['spread edition and code loop', `const editions = ['lite', 'full']; const codes = ['${CODE}'];
for (const edition of [...editions]) for (const code of [...codes]) test('cases', () => { assert.equal(sample(true)[0].code, code); assert.deepEqual(sample(false), []); });`],
  ['boolean lite loop', `for (const lite of [false, true]) { const edition = lite ? 'lite' : 'full'; test(edition + ' valid and invalid', () => { ${sourceChecks} }); }`],
  ['boolean full loop', `for (const full of [false, true]) test(full ? 'full cases' : 'lite cases', () => { ${sourceChecks} });`],
  ['nested object fixture loop', `const LOGIC_SPECS = [{role: 'policy'}, {role: 'mapper'}];
for (const edition of ['lite', 'full']) for (const {role} of LOGIC_SPECS) test(role, () => { ${sourceChecks} });`],
  ['asserted code loop variable', `for (const edition of ['lite', 'full']) for (const code of ['${CODE}']) test('cases', () => {
assert.equal(sample(true)[0].code, code); assert.deepEqual(sample(false), []); });`],
  ['destructured code and boolean cases', `const fixtures = [['${CODE}', [true, false]]];
const codes = findings => findings.map(finding => finding.code);
function expectCode(code, invalid) { const findings = sample(invalid); assert.equal(codes(findings).includes(code), invalid); }
for (const edition of ['lite', 'full']) for (const [code, cases] of fixtures) for (const invalid of cases) test('case', () => expectCode(code, invalid));`],
  ['local returned findings and codes helper', `const codes = findings => findings.map(finding => finding.code);
const scan = invalid => sample(invalid);
for (const edition of ['lite', 'full']) test('cases', () => { assert.deepEqual(codes(scan(true)), ['${CODE}']); assert.deepEqual(codes(scan(false)), []); });`],
  ['assertion helper with filtered findings', `async function expectCode(edition, code, invalid) {
const findings = await sample(invalid); const matching = findings.filter(finding => finding.code === code);
assert.equal(matching.length > 0, invalid); }
for (const edition of ['lite', 'full']) test('cases', () => { expectCode(edition, '${CODE}', true); expectCode(edition, '${CODE}', false); });`],
];

for (const [shape, body] of recognized) {
  for (const edition of EDITIONS) {
    test(`recognizes ${shape} for ${edition}`, () => {
      const context = fixture(body);
      assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
      assert.equal(claimedSpecProof(context, SPEC, CODE, edition), true);
    });
  }
}

const lintShapes = [
  ['nested LOGIC_SPECS RuleTester loop', `const LOGIC_SPECS = [{role: 'policy'}, {role: 'mapper'}];
for (const edition of ['lite', 'full']) for (const {role} of LOGIC_SPECS) test(role, () => tester.run('sample', rules.sample, {valid: ['ok'], invalid: [{code: 'bad', errors: 1}]}));`],
  ['boolean RuleTester factory', `const testerFor = lite => new RuleTester();
for (const lite of [false, true]) test('cases', () => testerFor(lite).run('sample', rules.sample, {valid: ['ok'], invalid: [{code: 'bad', errors: 1}]}));`],
  ['isolatedCases transformation', `const isolatedCases = cases => Object.fromEntries(Object.entries(cases).map(([kind, fixtures]) => [kind, fixtures.map(fixture => ({...fixture, before: () => {}}))]));
for (const edition of ['lite', 'full']) test('cases', () => tester.run('sample', rules.sample, isolatedCases({valid: [{code: 'ok'}], invalid: [{code: 'bad', errors: 1}]})));`],
  ['loop variable rule name and implementation', `const checks = [['sample', rules.sample]];
for (const edition of ['lite', 'full']) for (const [name, implementation] of checks) test('cases', () => tester.run(name, implementation, {valid: ['ok'], invalid: [{code: 'bad', errors: 1}]}));`],
];

for (const [shape, body] of lintShapes) {
  for (const edition of EDITIONS) {
    test(`recognizes ${shape} for ${edition}`, () => {
      const context = fixture(body, true);
      assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
      assert.equal(claimedSpecProof(context, SPEC, CODE, edition), true);
    });
  }
}

for (const edition of EDITIONS) {
  test(`${edition} lint registrations resolve through an imported implementation`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('cases', () => tester.run('sample', rules.sample,
{valid: ['ok'], invalid: [{code: 'bad', errors: 1}]}));`, true);
    context.files.set('packages/eslint/be/index.mjs', `import { rules as contributed } from './contribution.mjs';
const CONTRIBUTIONS = [{ rules: contributed }]; export const rules = contributed;`);
    context.files.set('packages/eslint/be/contribution.mjs', `import { owned } from './owned.mjs'; export const rules = {sample: owned};`);
    context.files.set('packages/eslint/be/owned.mjs', `export const owned = {meta: {code: '${CODE}'}, create() { return {}; }};
export const unrelated = {meta: {code: '${CODE}'}, create() { return {}; }};`);
    context.files.set(SPEC, context.files.get(SPEC).replace("../../packages/eslint/be/index.mjs", "../../packages/eslint/be/contribution.mjs"));
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    const wrong = context.files.get(SPEC).replace('rules.sample', 'unrelated');
    context.files.set(SPEC, `import { unrelated } from '../../packages/eslint/be/owned.mjs';\n${wrong}`);
    assert.match(coverageProofFindings(context, context.rule, CODE, edition)[0]?.message, /eslint-be:sample/);
  });

  test(`imported ${edition} lint contributions prove only their registered implementation`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('cases', () => tester.run('sample', rules.sample,
{valid: ['ok'], invalid: [{code: 'bad', errors: 1}]}));`, true);
    context.files.set('packages/eslint/be/index.mjs', `import { rules as contributed } from './contribution.mjs';
const CONTRIBUTIONS = [{ rules: contributed }]; export const rules = contributed;`);
    context.files.set('packages/eslint/be/contribution.mjs', `import { owned } from './owned.mjs'; export const rules = {sample: owned};`);
    context.files.set('packages/eslint/be/owned.mjs', `export const owned = {meta: {code: '${CODE}'}, create() { return {}; }};
export const unrelated = {meta: {code: '${CODE}'}, create() { return {}; }};`);
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    const wrong = context.files.get(SPEC).replace('rules.sample', 'unrelated');
    context.files.set(SPEC, `import { unrelated } from '../../packages/eslint/be/owned.mjs';\n${wrong}`);
    assert.match(coverageProofFindings(context, context.rule, CODE, edition)[0]?.message, /eslint-be:sample/);
  });
}

const vacuous = [
  ['uncalled assertion helper', `function unused() { ${sourceChecks} } for (const edition of ['lite', 'full']) test('valid and invalid', () => {});`],
  ['uncalled checker function', `for (const edition of ['lite', 'full']) test('valid and invalid', () => { const unused = () => sample(true); assert.equal('${CODE}', '${CODE}'); });`],
  ['ignored code parameter', `function check(unused) { assert.ok(sample(true).length > 0); assert.deepEqual(sample(false), []); }
for (const edition of ['lite', 'full']) test('valid and invalid', () => check('${CODE}'));`],
  ['discarded checker result', `const scan = invalid => { sample(invalid); return []; };
for (const edition of ['lite', 'full']) test('valid and invalid', () => { assert.deepEqual(scan(true), ['${CODE}']); assert.deepEqual(scan(false), []); });`],
  ['message-only code mention', `for (const edition of ['lite', 'full']) test('valid and invalid', () => { assert.ok(sample(true).length > 0, '${CODE}'); assert.deepEqual(sample(false), []); });`],
  ['empty nested fixtures', `for (const edition of ['lite', 'full']) for (const code of []) test('valid and invalid', () => { ${sourceChecks} });`],
];

for (const [shape, body] of vacuous) {
  for (const edition of EDITIONS) {
    test(`refuses ${shape} for ${edition}`, () => {
      const context = fixture(body);
      assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
      assert.equal(claimedSpecProof(context, SPEC, CODE, edition), false);
    });
  }
}

for (const edition of EDITIONS) {
  test(`refuses an emptied isolatedCases output for ${edition}`, () => {
    const context = fixture(`const isolatedCases = cases => ({...cases, valid: []});
for (const edition of ['lite', 'full']) test('cases', () => tester.run('sample', rules.sample, isolatedCases({valid: ['ok'], invalid: [{code: 'bad', errors: 1}]})));`, true);
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    assert.equal(claimedSpecProof(context, SPEC, CODE, edition), false);
  });
}

test('boolean loop evidence remains attached to the edition that executes it', () => {
  const context = fixture(`for (const lite of [false, true]) { if (lite) test('valid and invalid', () => { ${sourceChecks} }); }`);
  assert.deepEqual(coverageProofFindings(context, context.rule, CODE, 'lite'), []);
  assert.equal(coverageProofFindings(context, context.rule, CODE, 'full')[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
});

for (const edition of EDITIONS) {
  test(`different ${edition} RuleTester loop implementations retain their own identities`, () => {
    const context = fixture(`const checks = [['sample', rules.sample], ['other', rules.other]];
for (const edition of ['lite', 'full']) for (const [name, implementation] of checks) test('cases', () => tester.run(name, implementation, {valid: ['ok'], invalid: [{code: 'bad', errors: 1}]}));`, true);
    context.rule.enforcers.push({kind: 'eslint-be', id: 'other'});
    context.files.set('packages/eslint/be/index.mjs', 'export const rules = {sample: {create() { return {}; }}, other: {create() { return {}; }}};');
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    context.files.set(SPEC, context.files.get(SPEC).replace("['other', rules.other]", "['other', rules.sample]"));
    assert.match(coverageProofFindings(context, context.rule, CODE, edition)[0]?.message, /eslint-be:other/);
  });
}

for (const edition of EDITIONS) {
  test(`ignores comment-only additional source owners for ${edition}`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('cases', () => { ${sourceChecks} });`);
    const commentOnly = 'scripts/checks/comment-only.mjs';
    context.rule.enforcers.push({ kind: 'runtime', id: 'comment-only', at: commentOnly });
    for (const comment of [`// ${CODE}`, `/* ${CODE} */`]) {
      context.files.set(commentOnly, comment + '\nexport function unrelated() { return []; }');
      assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    }
  });

  test(`refuses a comment-only checker proof for ${edition}`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('cases', () => { ${sourceChecks} });`);
    context.files.set(ENFORCER, `// ${CODE}\nexport function sample() { return []; }`);
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    assert.equal(claimedSpecProof(context, SPEC, CODE, edition), false);
  });

  test(`recognizes static diagnostic text in template literals for ${edition}`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('cases', () => { ${sourceChecks} });`);
    const tick = String.fromCodePoint(96);
    for (const diagnostic of [CODE, '${invalid}: [' + CODE + ']']) {
      context.files.set(ENFORCER, 'export function sample(invalid) { return invalid ? [{code: '
        + tick + diagnostic + tick + '}] : []; }');
      assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
      assert.equal(claimedSpecProof(context, SPEC, CODE, edition), true);
    }
  });

  test(`refuses discarded template diagnostic results for ${edition}`, () => {
    const context = fixture(`const scan = invalid => { sample(invalid); return []; };
for (const edition of ['lite', 'full']) test('cases', () => {
assert.deepEqual(scan(true), ['${CODE}']); assert.deepEqual(scan(false), []); });`);
    const tick = String.fromCodePoint(96);
    context.files.set(ENFORCER, 'export function sample(invalid) { return invalid ? [{code: '
      + tick + CODE + tick + '}] : []; }');
    assert.equal(coverageProofFindings(context, context.rule, CODE, edition)[0]?.code, 'RT_COVERAGE_PROOF_VACUOUS');
    assert.equal(claimedSpecProof(context, SPEC, CODE, edition), false);
  });
}

for (const edition of EDITIONS) {
  test(`bounds ownership work for a large unrelated enforcer in ${edition}`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('cases', () => { ${sourceChecks} });`);
    const large = 'scripts/checks/large.mjs';
    const functions = Array.from({ length: 150 }, (_value, i) =>
      `export function f${i}() { return [${Array.from({ length: 20 }, (_entry, j) => j).join(',')}]; }`).join('\n');
    context.files.set(large, functions);
    context.rule.enforcers.push({ kind: 'runtime', id: 'large', at: large });
    const index = sourceIndex(context, large);
    let scans = 0;
    const values = index.exports.values.bind(index.exports);
    index.exports.values = () => { scans++; return values(); };
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    assert.equal(scans, 0, 'absent code must not scan exported functions');
  });

  test(`bounds repeated diamond delegation work in ${edition}`, () => {
    const context = fixture(`for (const edition of ['lite', 'full']) test('cases', () => { ${sourceChecks} });`);
    const large = 'scripts/checks/diamond.mjs';
    const functions = Array.from({ length: 14 }, (_value, i) =>
      `function f${i + 1}() { return [f${i}(), f${i}()]; }`).join('\n');
    context.files.set(large, `// ${CODE}\nfunction f0() { return []; }\n${functions}\nexport function large() { return f14(); }`);
    context.rule.enforcers.push({ kind: 'runtime', id: 'large', at: large });
    let work = 0;
    for (const node of astNodes(sourceIndex(context, large).tree).filter(entry => entry.type === 'FunctionDeclaration')) {
      const body = node.body;
      Object.defineProperty(node, 'body', { enumerable: true, get() {
        assert.ok(++work < 2000, 'ownership traversal must stay bounded on a shared call graph');
        return body;
      } });
    }
    for (let scan = 0; scan < 3; scan++) {
      assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
    }
    assert.ok(work > 0);
    const source = context.files.get(large);
    context.files.set(large, source.replace('return [];', `return [{code: '${CODE}'}];`));
    assert.match(coverageProofFindings(context, context.rule, CODE, edition)[0]?.message, /runtime:large/);
    context.files.set(large, source);
    assert.deepEqual(coverageProofFindings(context, context.rule, CODE, edition), []);
  });
}
