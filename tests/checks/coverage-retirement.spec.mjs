import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageCiteFindings } from '../../scripts/checks/lib/coverage-cites.mjs';
import { CODE, rulingCiteFindings } from '../../scripts/checks/lib/ruling-cites.mjs';

const COVERAGE_CODE = 'RT_COVERAGE_SUPERSEDED_CITE';
const LEDGER = 'knowledge/hfs/requirements.yaml';
const ENFORCER = 'scripts/hfs/retired-header.mjs';
const retiring = {
  id: 'locale-header',
  staleWhen: ['x-locale'],
  retires: ['x-locale'],
  retiredIn: [LEDGER, ENFORCER],
};
const ledgerText = 'statement: Accept-Language replaces x-locale.\n';

function scanRetirement(edition, files, rulings = [retiring]) {
  const ownerRulings = { rulings };
  return [
    { code: COVERAGE_CODE, findings: coverageCiteFindings({ edition, rulings: ownerRulings, files }) },
    { code: CODE, findings: rulingCiteFindings(files, { ownerRulings }) },
  ];
}

for (const edition of ['lite', 'full']) {
  test(`${edition} citation scans accept the declared retirement ledger and enforcer`, () => {
    const files = { [LEDGER]: ledgerText, [ENFORCER]: 'const retiredHeader = "x-locale";\n' };
    for (const { findings } of scanRetirement(edition, files)) assert.deepEqual(findings, []);
  });

  test(`${edition} citation scans still flag every other file naming the retired term`, () => {
    const files = {
      [LEDGER]: ledgerText,
      'knowledge/hfs/other-requirements.yaml': ledgerText,
      'knowledge/hfs/requirements.yaml.md': ledgerText,
      'docs/guide.md': 'Send x-locale to the api.\n',
      'scripts/hfs/other-header.mjs': 'const header = "x-locale";\n',
    };
    const comparePaths = (left, right) => left.localeCompare(right);
    const expected = Object.keys(files).filter((file) => file !== LEDGER).sort(comparePaths);
    for (const { code, findings } of scanRetirement(edition, files)) {
      assert.deepEqual(findings.map((finding) => finding.path).sort(comparePaths), expected);
      assert.ok(findings.every((finding) => finding.code === code && finding.line === 1));
    }
  });

  test(`${edition} citation scans require both retires and the exact retiredIn path`, () => {
    for (const record of [
      { ...retiring, retires: undefined },
      { ...retiring, retires: [] },
      { ...retiring, retiredIn: undefined },
      { ...retiring, retiredIn: [`${LEDGER}.other`] },
    ]) {
      for (const { code, findings } of scanRetirement(edition, { [LEDGER]: ledgerText }, [record])) {
        assert.equal(findings.length, 1);
        assert.equal(findings[0].code, code);
        assert.equal(findings[0].path, LEDGER);
      }
    }
    const scalar = { ...retiring, retires: 'x-locale', retiredIn: LEDGER };
    for (const { findings } of scanRetirement(edition, { [LEDGER]: ledgerText }, [scalar])) {
      assert.deepEqual(findings, []);
    }
  });

  test(`${edition} retirement files still refuse superseded ruling citations`, () => {
    const rulings = [retiring, { id: 'current-locale', supersedes: ['locale-header'] }];
    const files = { [LEDGER]: `${ledgerText}ruling:locale-header is authoritative.\n` };
    for (const { code, findings } of scanRetirement(edition, files, rulings)) {
      assert.equal(findings.length, 1);
      assert.equal(findings[0].code, code);
      assert.equal(findings[0].path, LEDGER);
      assert.equal(findings[0].line, 2);
      assert.match(findings[0].message, /superseded/);
    }
  });
}
