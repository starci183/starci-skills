import test from 'node:test';
import assert from 'node:assert/strict';
import { documentedDefaultFindings, checkDocumentedDefaults, resolveDefault, CODE } from '../../scripts/checks/check-documented-defaults.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

test('the shipped documents state only defaults the code reads', () => {
  assert.deepEqual(checkDocumentedDefaults().map((finding) => finding.message), []);
});

test('RT_DOCUMENTED_DEFAULT_DRIFT names file:line for a stated default that differs from the key it cites', () => {
  const findings = documentedDefaultFindings({
    'docs/a.md': 'The cadence is `10m`.\nThe cadence (default `5m` = `debugLoop.interval`) and the limit (default `40` = `debugLoop.worktreeLimit`).\n',
    'modules/a/b.yaml': 'note: reserve (default `80` = `modules/models/tiers.yaml:usage.reservePercent`)\n',
  });
  assert.deepEqual(findings.map((finding) => [finding.code, finding.path, finding.line]), [[CODE, 'docs/a.md', 2], [CODE, 'modules/a/b.yaml', 1]]);
  assert.match(findings[0].message, /states default 5m for debugLoop\.interval, the value the code reads is 10m/);
});

test('RT_DOCUMENTED_DEFAULT_DRIFT accepts a matching citation and refuses a key that resolves to nothing', () => {
  assert.deepEqual(documentedDefaultFindings({ 'docs/a.md': 'default **false** = `specs.harness`, default `90` = `modules/models/tiers.yaml:usage.reservePercent`\n' }), []);
  assert.equal(documentedDefaultFindings({ 'docs/a.md': 'default `1` = `nothing.here`\n' }).length, 1);
  assert.equal(resolveDefault(skillRoot, 'specs.unit'), true);
});
