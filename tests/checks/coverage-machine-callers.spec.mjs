import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageRoutingFindings } from '../../scripts/checks/lib/coverage-routing.mjs';

function fixture(body, wrapper = 'return delegated(input);') {
  const code = 'CALLER_BOUNDARY';
  const rule = { id: 'R900', code, failureCodes: [code], enforcers: [
    { kind: 'machine', id: 'boundary', at: 'scripts/boundary.mjs' },
    { kind: 'eslint-fe', id: 'boundary' },
  ] };
  const files = new Map([
    ['scripts/hfs/architecture/surface.mjs', `const FE = ['fe']; enforcer('boundary', FE, ['${code}']);`],
    ['scripts/hfs/architecture/index.mjs', `import { delegated } from '../../wrapper.mjs';
      function run(input) { ${wrapper} }
      function once(config) { ${body} }
      export function checkArchitecture(config) { return cached(() => once(config)); }`],
    ['scripts/wrapper.mjs', `import { boundary } from './boundary.mjs'; export function delegated(input) { return boundary(input); }`],
    ['scripts/boundary.mjs', `export function boundary(input) { return [{ ruleId: '${code}' }]; }`],
    ['packages/eslint/fe/index.mjs', 'export const rules = { boundary: {} };'],
  ]);
  return { context: { files, catalog: { rules: [rule] } }, rule, code };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} frontend caller guard reaches a delegated emitter through local and imported wrappers`, () => {
    const { context, rule, code } = fixture("if (config.kinds.includes('frontend')) return run(config);");
    assert.deepEqual(coverageRoutingFindings(context, rule, code, edition), []);
  });

  test(`${edition} unguarded, unknown, backend and additional callers retain missing lint routes`, () => {
    for (const body of [
      'return run(config);',
      'if (unknown(config)) return run(config);',
      "if (config.kinds.includes('backend')) return run(config);",
      "if (config.kinds.includes('frontend')) run(config); return run(config);",
      "if (config.kinds.includes('other')) return run(config);",
      "if (config[kinds].includes('frontend')) return run(config);",
      "if (config.kinds[includes]('frontend')) return run(config);",
    ]) {
      const { context, rule, code } = fixture(body);
      const findings = coverageRoutingFindings(context, rule, code, edition);
      assert.equal(findings.length, 1, body);
      assert.match(findings[0].message, /be lint plugin/);
    }
  });

  test(`${edition} dormant and unresolved delegations cannot restrict an emitter`, () => {
    for (const wrapper of ['return unrelated(input);', 'function dormant() { return delegated(input); } return [];']) {
      const { context, rule, code } = fixture("if (config.kinds.includes('frontend')) return run(config);", wrapper);
      assert.equal(coverageRoutingFindings(context, rule, code, edition).length, 1);
    }
  });

  test(`${edition} invoking an unrelated export in an emitter module cannot supply a profile`, () => {
    const { context, rule, code } = fixture("if (config.kinds.includes('frontend')) return run(config);");
    context.files.set('scripts/wrapper.mjs', "import { unrelated } from './boundary.mjs'; export function delegated(input) { return unrelated(input); }");
    context.files.set('scripts/boundary.mjs', `export function unrelated() { return []; } export function boundary() { return [{ ruleId: '${code}' }]; }`);
    assert.equal(coverageRoutingFindings(context, rule, code, edition).length, 1);
  });
}
