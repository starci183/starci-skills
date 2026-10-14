import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCoverageRatchet, legacyCoverageRule, legacyCoverageSlot } from '../../scripts/checks/lib/coverage-ratchet.mjs';
import { coverageRuleFindings } from '../../scripts/checks/lib/coverage-rules.mjs';
import { coverageReport, formatCoverageReport } from '../../scripts/checks/check-hfs-coverage.mjs';

const EDITIONS = ['lite', 'full'];
const SLOT = 'app.sample';
const CODES = ['RT_COVERAGE_NO_TEMPLATE', 'RT_COVERAGE_NO_EXAMPLE'];

function contextFor(slot = {}) {
  return {
    catalog: { rules: [] },
    manifest: { editions: EDITIONS, profiles: ['app'], slots: [{
      id: SLOT, profiles: ['app'], path: 'sample.yaml', presence: 'required',
      tracked: 'tracked', tier: 'none', tests: 'none', since: '3.1.0', ...slot,
    }] },
    files: new Map(), examples: [],
  };
}

function slotFindings(context, edition) {
  return applyCoverageRatchet(context, coverageRuleFindings(context))
    .filter((finding) => finding.rule === SLOT && finding.edition === edition);
}

for (const edition of EDITIONS) {
  test(`legacy ${edition} slot gaps remain counted backlog warnings`, () => {
    for (const since of ['2.1.0', '3.0.0', '3.1.0']) {
      const context = contextFor({ since });
      const findings = slotFindings(context, edition);
      assert.deepEqual(findings.map((finding) => finding.code), CODES);
      assert.ok(findings.every((finding) => finding.level === 'warning' && finding.legacy));
      const report = coverageReport(findings);
      assert.equal(report.ok, true);
      assert.equal(report.legacyBacklog.total, 2);
      assert.deepEqual(report.legacyBacklog.byCode, Object.fromEntries(CODES.map((code) => [code, 1])));
      assert.match(formatCoverageReport(report), /Legacy backlog: 2 warnings/);
    }
  });

  test(`each coverage field adopts the ${edition} slot and gates its remaining gaps`, () => {
    for (const field of ['templateNa', 'exemplifiedBy', 'editionWhy', 'scaffold']) {
      const context = contextFor({ [field]: undefined });
      const findings = slotFindings(context, edition);
      assert.ok(findings.length > 0, field);
      assert.ok(findings.every((finding) => finding.level === 'error' && !finding.legacy), field);
      assert.equal(coverageReport(findings).legacyBacklog.total, 0);
    }
  });

  test(`new ${edition} slots cannot enter the legacy backlog without metadata`, () => {
    for (const since of ['3.1.1', '3.2.0', '3.10.0', '4.0.0']) {
      const findings = slotFindings(contextFor({ since }), edition);
      assert.deepEqual(findings.map((finding) => finding.code), CODES);
      assert.ok(findings.every((finding) => finding.level === 'error' && !finding.legacy));
    }
  });

  test(`slot adoption is independent of its ${edition} owning rule's metadata`, () => {
    const context = contextFor({ rules: ['SAMPLE_CODE'] });
    context.catalog.rules = [{ id: 'R247', code: 'SAMPLE_CODE', failureCodes: ['SAMPLE_CODE'] }];
    const finding = { code: 'RT_COVERAGE_NO_EXAMPLE', rule: SLOT, edition, path: 'knowledge/hfs/slots.yaml' };
    assert.equal(applyCoverageRatchet(context, [finding])[0].legacy, true);
    context.catalog.rules[0].id = 'R01';
    context.manifest.slots[0].editionWhy = 'Adopted coverage';
    assert.equal(applyCoverageRatchet(context, [finding])[0].level, 'error');
  });
}

test('invalid slot versions, unknown chains and missing enforcers stay errors', () => {
  assert.equal(legacyCoverageSlot({ since: 'invalid' }), false);
  assert.equal(legacyCoverageSlot({}), false, 'a slot without since is never legacy (the manifest loader refuses it)');
  const context = contextFor();
  const findings = [
    { code: 'RT_COVERAGE_NO_ENFORCER', rule: SLOT, legacy: true },
    { code: 'RT_COVERAGE_SURFACE_UNMAPPED', slot: 'app.unknown' },
    { code: 'RT_COVERAGE_REQUIREMENT_UNLEDGERED', path: 'docs/sample.md' },
  ];
  assert.ok(applyCoverageRatchet(context, findings).every((finding) => finding.level === 'error' && !finding.legacy));
});

// Rule legacy status is derived from the id alone: older than R247 (and not yet adopted), never from a missing field.
test('a rule is legacy only when its id is older than R247 and it carries no coverage field', () => {
  assert.equal(legacyCoverageRule({ id: 'R246' }), true);
  assert.equal(legacyCoverageRule({ id: 'R01' }), true);
  assert.equal(legacyCoverageRule({ id: 'R247' }), false, 'R247 and later are always gated');
  assert.equal(legacyCoverageRule({ id: 'R300' }), false);
  assert.equal(legacyCoverageRule({ id: 'X1' }), false, 'an id that is not R<number> is never legacy');
  assert.equal(legacyCoverageRule({}), false, 'a rule without an id is never legacy');
  assert.equal(legacyCoverageRule({ id: 'R246', docs: ['docs/x.md'] }), false, 'a legacy rule that adopts a coverage field is gated');
});
