import assert from 'node:assert/strict';
import test from 'node:test';
import { coverageRoutingFindings } from '../../scripts/checks/lib/coverage-routing.mjs';

function fixture(body) {
  const code = 'PROFILE_BOUNDARY';
  const rule = { id: 'R900', code, failureCodes: [code], enforcers: [
    { kind: 'machine', id: 'boundary', at: 'scripts/machine.mjs' },
    { kind: 'eslint-be', id: 'boundary' },
  ] };
  const files = new Map([
    ['scripts/hfs/architecture/surface.mjs', `const BE = ['be']; enforcer('boundary', BE, ['${code}']);`],
    ['scripts/machine.mjs', `export function boundary(graph, verdict) { ${body} }`],
    ['packages/eslint/be/index.mjs', `export const rules = { boundary: {} };`],
  ]);
  return { context: { files, catalog: { rules: [rule] } }, rule, code };
}

const aliases = `const feature = graph.profile === 'be' && verdict.allowed;
const from = feature ? lookup('from') : null;
const to = feature ? lookup('to') : null;
const cross = from !== null && to !== null && from !== to;`;

for (const edition of ['lite', 'full']) {
  test(`backend aliases and nullable guards restrict a genuine emission in ${edition}`, () => {
    const { context, rule, code } = fixture(`${aliases} if (cross) report('PROFILE_BOUNDARY');`);
    assert.deepEqual(coverageRoutingFindings(context, rule, code, edition), []);
  });

  test(`an unguarded emission still requires the missing frontend route in ${edition}`, () => {
    const { context, rule, code } = fixture(`${aliases} report('PROFILE_BOUNDARY');`);
    const findings = coverageRoutingFindings(context, rule, code, edition);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /fe lint plugin/);
  });

  test(`unknown and mutable guards cannot conceal a frontend emission in ${edition}`, () => {
    for (const body of [
      `const guard = unknown(); if (guard) report('PROFILE_BOUNDARY');`,
      `let guard = graph.profile === 'be'; guard = true; if (guard) report('PROFILE_BOUNDARY');`,
      `${aliases} if (cross || unknown()) report('PROFILE_BOUNDARY');`,
      `const guard = graph.profile !== 'be'; if (guard) report('PROFILE_BOUNDARY');`,
      `const guard = graph.profile === 'be'; function nested(guard) { if (guard) report('PROFILE_BOUNDARY'); } nested(verdict.allowed);`,
      `const guard = graph.profile === 'be'; function nested(value) { const { guard } = value; if (guard) report('PROFILE_BOUNDARY'); } nested(verdict);`,
    ]) {
      const { context, rule, code } = fixture(body);
      assert.equal(coverageRoutingFindings(context, rule, code, edition).length, 1);
    }
  });
}
