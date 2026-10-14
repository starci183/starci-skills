// proves: CI_TRIGGERS_RELEASE_ONLY@lite
// proves: CI_TRIGGERS_RELEASE_ONLY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { gitTriggerFindings } from '../../scripts/hfs/runtime-rules/git-triggers.mjs';

const findingsFor = (edition, events) => {
  const file = `examples/${edition}-app/.github/workflows/ci.yml`;
  const text = `name: ci\non:\n${events}\njobs: {}\n`;
  return gitTriggerFindings({ repo: { kind: 'app', edition }, files: [file], read: () => text });
};

for (const edition of ['lite', 'full']) {
  test(`${edition}: app workflows cannot start on main or on a schedule`, () => {
    for (const events of ['  push:\n    branches: [main]', '  schedule:\n    - cron: "0 3 * * *"']) {
      const findings = findingsFor(edition, events);
      assert.deepEqual(findings.map((f) => f.code), ['CI_TRIGGERS_RELEASE_ONLY']);
      assert.equal(findings[0].path, `examples/${edition}-app/.github/workflows/ci.yml`);
      assert.match(findings[0].message, /not allowed/);
    }
  });

  test(`${edition}: a release-tag workflow with manual dispatch passes`, () => {
    assert.deepEqual(findingsFor(edition, "  push:\n    tags: ['v*']\n  workflow_dispatch:"), []);
  });
}
