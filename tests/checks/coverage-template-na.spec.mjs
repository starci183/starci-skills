import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadRuleCatalog } from '../../scripts/hfs/rule-catalog.mjs';
import { coverageRuleFindings } from '../../scripts/checks/lib/coverage-rules.mjs';

// proves: RT_COVERAGE_NO_TEMPLATE@lite RT_COVERAGE_NO_TEMPLATE@full

const root = path.resolve(import.meta.dirname, '..', '..');
const header = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8'));
const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020.js').default;
const validate = new Ajv2020({ strict: false, allErrors: true, logger: false })
  .compile(parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/hfs-rules.schema.yaml'), 'utf8')));
const editions = ['lite', 'full'];
const reason = 'This rule validates product assets supplied by the app; no asset content is scaffolded.';

function catalogFor(edition) {
  return {
    schema: header.schema, version: header.version, gates: header.gates, enforcerKinds: header.enforcerKinds,
    rules: [{
      id: 'R282', code: 'HFS_ASSET_OVERSIZE', law: 'Product assets stay within their declared budgets.',
      kinds: ['check'], gates: ['land'], failureCodes: ['HFS_ASSET_OVERSIZE'], editions: [edition],
      enforcers: [{ kind: 'hfs', id: 'asset-budget', at: 'scripts/hfs/rules/asset-budget.mjs' }],
    }],
  };
}

function contextFor(rule, edition, slot) {
  return {
    catalog: { rules: [rule] },
    manifest: { editions: [edition], profiles: ['app'], slots: slot ? [slot] : [] },
    files: new Map(), examples: [],
  };
}

const templateFindings = (context) => coverageRuleFindings(context).filter((finding) => finding.code === 'RT_COVERAGE_NO_TEMPLATE');

for (const edition of editions) {
  test(`templateNa accepts a valid ${edition} reason in the schema and catalog loader`, () => {
    const catalog = catalogFor(edition);
    catalog.rules[0].templateNa = reason;
    assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
    assert.equal(loadRuleCatalog({ text: JSON.stringify(catalog) }).rule('R282').templateNa, reason);
  });

  test(`templateNa rejects invalid ${edition} reasons in the schema and catalog loader`, () => {
    for (const value of ['', '  \n\t ', null, false, 42, ['reason'], { reason }]) {
      const catalog = catalogFor(edition);
      catalog.rules[0].templateNa = value;
      assert.equal(validate(catalog), false, `Accepted ${JSON.stringify(value)}`);
      assert.throws(() => loadRuleCatalog({ text: JSON.stringify(catalog) }), (error) =>
        error.code === 'HFS_RULES_INVALID' && error.details.problems.some((problem) => problem.includes('templateNa')));
    }
  });

  test(`templateNa remains optional for a valid ${edition} catalog`, () => {
    const catalog = catalogFor(edition);
    assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
    assert.doesNotThrow(() => loadRuleCatalog({ text: JSON.stringify(catalog) }));
  });

  test(`RT_COVERAGE_NO_TEMPLATE accepts the passing ${edition} rule with no scaffolded surface`, () => {
    const rule = catalogFor(edition).rules[0];
    rule.templateNa = reason;
    const context = contextFor(rule, edition);
    assert.deepEqual(templateFindings(context), []);
    const findings = coverageRuleFindings(context);
    for (const code of ['RT_COVERAGE_NO_ENFORCER', 'RT_COVERAGE_NO_SPEC', 'RT_COVERAGE_NO_DOC', 'RT_COVERAGE_NO_WITNESS', 'RT_COVERAGE_NO_EXAMPLE']) {
      assert.ok(findings.some((finding) => finding.code === code), `${code} still needs evidence`);
    }
  });

  test(`RT_COVERAGE_NO_TEMPLATE detects the violating ${edition} rule without a reason`, () => {
    const rule = catalogFor(edition).rules[0];
    const context = contextFor(rule, edition);
    assert.equal(templateFindings(context).length, 1);
    for (const value of ['', ' \n ', false, 42, null]) {
      rule.templateNa = value;
      assert.equal(templateFindings(context).length, 1, JSON.stringify(value));
    }
  });

  test(`templateNa preserves required ${edition} slot template enforcement`, () => {
    const rule = catalogFor(edition).rules[0];
    rule.templateNa = reason;
    const slot = { id: 'app.asset', profiles: ['app'], path: 'asset.png', presence: 'required', rules: ['R282'] };
    const context = contextFor(rule, edition, slot);
    const findings = templateFindings(context);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, slot.id);
    assert.equal(findings[0].path, 'knowledge/hfs/slots.yaml');
  });
}
