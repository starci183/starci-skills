import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { coverageRuleFindings } from '../../scripts/checks/lib/coverage-rules.mjs';
import { appFrontendFindings } from '../../scripts/hfs/rules/frontend-tree.mjs';

// proves: RT_COVERAGE_NO_EXAMPLE@lite RT_COVERAGE_NO_EXAMPLE@full
// proves: FE_WIRE_GENERATED@lite FE_WIRE_GENERATED@full

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = 'tests/fixtures/hfs-generated-wire';
const GENERATED = 'fe/apps/web/src/modules/api/graphql/__generated__/graphql.ts';
const SNAPSHOT = 'be/contracts/api/schema.graphql';
const QUERY = 'fe/apps/web/src/modules/api/graphql/queries/query-ping.graphql';
const SLOT = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge/hfs/slots.yaml'), 'utf8')).slots
  .find((slot) => slot.id === 'fe.transport.generated');

function coverageFindings(edition, includeOutput) {
  const file = `${FIXTURE}/${GENERATED}`;
  const files = includeOutput ? new Map([[file, fs.readFileSync(path.join(ROOT, file), 'utf8')]]) : new Map();
  return coverageRuleFindings({
    catalog: { rules: [] }, files, examples: [],
    manifest: { editions: [edition], profiles: ['fe'], slots: [SLOT] },
  }).filter((finding) => finding.code === 'RT_COVERAGE_NO_EXAMPLE');
}

function wireFixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-generated-wire-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(ROOT, FIXTURE), root, { recursive: true });
  const repo = { edition, sides: { fe: { reads: ['be/contracts/'], apps: [{ name: 'web', kind: 'next' }] } } };
  // Generated output remains a disk artifact to R52 even when a dedicated test fixture is tracked.
  const files = ['package.json', 'fe/apps/web/package.json', SNAPSHOT, QUERY];
  const findings = () => appFrontendFindings({ repoRoot: root, files, repo })
    .filter((finding) => finding.code === 'FE_WIRE_GENERATED');
  return { root, findings };
}

for (const edition of ['lite', 'full']) {
  test(`generated wire fixture passes ${edition} slot coverage and FE_WIRE_GENERATED`, (t) => {
    assert.deepEqual(coverageFindings(edition, true), []);
    assert.deepEqual(wireFixture(t, edition).findings(), []);
  });

  test(`generated wire fixture refuses missing or stale ${edition} evidence`, (t) => {
    const missing = coverageFindings(edition, false);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].rule, 'fe.transport.generated');
    const { root, findings } = wireFixture(t, edition);
    fs.writeFileSync(path.join(root, SNAPSHOT), 'type Query { ping: String! changed: String }\n');
    assert.match(findings()[0].message, /different schema digest/);
    fs.rmSync(path.join(root, GENERATED));
    assert.match(findings()[0].message, /no generated wire types/);
  });
}
