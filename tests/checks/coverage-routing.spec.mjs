import assert from 'node:assert/strict';
import test from 'node:test';
import { coverageProofFindings } from '../../scripts/checks/lib/coverage-proofs.mjs';
import { lintEnforcersForCode, registeredLintRules } from '../../scripts/checks/lib/coverage-routing.mjs';

const COPY = 'FE_COPY_IN_CALL';
const GLYPH = 'FE_ICON_INLINE_SVG';
const WHY = 'packages/eslint/fe/lib/why.mjs';
const LAW = 'packages/eslint/fe/glyph.mjs';
const COPY_SPEC = 'tests/checks/copy.spec.mjs';
const GLYPH_SPEC = 'tests/checks/glyph.spec.mjs';
const APPEND = `Object.assign(reasons, { glyph: { code: '${GLYPH}' } });`;

function proofSource(id, code, module) {
  const tests = ['lite', 'full'].map(edition => `test('valid and invalid ${edition}', () => tester.run('${id}', rules.${id}, { valid: ['ok'], invalid: [{ code: 'bad', errors: 1 }] }));`).join('\n');
  return `import test from 'node:test';
import { RuleTester } from 'eslint';
import { rules } from '../../packages/eslint/fe/${module}.mjs';
const tester = new RuleTester();
// proves: ${code}@lite ${code}@full
${tests}`;
}

function routingFixture(append = APPEND) {
  const rule = {
    id: 'R286', code: COPY, failureCodes: [COPY, GLYPH], editions: ['lite', 'full'],
    enforcers: [{ kind: 'eslint-fe', id: 'copy' }, { kind: 'eslint-fe', id: 'glyph' }],
    proves: [{ path: COPY_SPEC, codes: [COPY] }, { path: GLYPH_SPEC, codes: [GLYPH] }],
  };
  const files = new Map([
    ['packages/eslint/fe/index.mjs', `import { rules as copyRules } from './copy.mjs';
import { rules as glyphRules } from './glyph.mjs';
const CONTRIBUTIONS = [{ rules: copyRules }, { rules: glyphRules }];`],
    [WHY, `export const why = { copy: { code: '${COPY}' } };`],
    ['packages/eslint/fe/copy.mjs', 'export const rules = { copy: { create() { return {}; } } };'],
    [LAW, `import { why as reasons } from './lib/why.mjs';
${append}
export const rules = { glyph: { create() { return {}; } } };`],
    [COPY_SPEC, proofSource('copy', COPY, 'copy')],
    [GLYPH_SPEC, proofSource('glyph', GLYPH, 'glyph')],
  ]);
  return { context: { files, catalog: { rules: [rule] } }, rule };
}

for (const edition of ['lite', 'full']) {
  test(`appended why mappings keep the copy and glyph proofs separate in ${edition}`, () => {
    const { context, rule } = routingFixture();
    const registered = registeredLintRules(context, 'eslint-fe');
    assert.equal(registered.get('copy').code, COPY);
    assert.equal(registered.get('glyph').code, GLYPH);
    assert.deepEqual(lintEnforcersForCode(context, rule, COPY, edition).map(entry => entry.id), ['copy']);
    assert.deepEqual(lintEnforcersForCode(context, rule, GLYPH, edition).map(entry => entry.id), ['glyph']);
    assert.deepEqual(coverageProofFindings(context, rule, COPY, edition), []);
    assert.deepEqual(coverageProofFindings(context, rule, GLYPH, edition), []);
  });
}

test('why additions in the canonical map and multiple Object.assign sources are read', () => {
  const { context } = routingFixture(`const additions = { glyph: { code: '${GLYPH}' } };
Object.assign(reasons, {}, additions);`);
  context.files.set(WHY, `export const why = {};
Object.assign(why, { copy: { code: '${COPY}' } });`);
  const registered = registeredLintRules(context, 'eslint-fe');
  assert.equal(registered.get('copy').code, COPY);
  assert.equal(registered.get('glyph').code, GLYPH);
});

test('dormant and unrelated Object.assign calls cannot claim a shipped rule code', () => {
  const additions = [
    `function register() { ${APPEND} }`,
    `Object.assign({}, { glyph: { code: '${GLYPH}' } });`,
    `const other = {}; Object.assign(other, { glyph: { code: '${GLYPH}' } });`,
    `const Object = { assign() {} }; ${APPEND}`,
  ];
  for (const append of additions) {
    const { context } = routingFixture(append);
    assert.equal(registeredLintRules(context, 'eslint-fe').get('glyph').code, undefined);
  }
});

test('an unregistered law cannot append code evidence to the shipped plugin', () => {
  const { context } = routingFixture('');
  context.files.set('packages/eslint/fe/unregistered.mjs', `import { why as reasons } from './lib/why.mjs'; ${APPEND}`);
  assert.equal(registeredLintRules(context, 'eslint-fe').get('glyph').code, undefined);
});
