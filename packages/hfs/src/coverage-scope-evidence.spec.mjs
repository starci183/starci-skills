// proves: HFS_COVERAGE_SCOPE_DRIFT@lite
// proves: HFS_COVERAGE_SCOPE_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderTargets, writeTargets } from '../sync/index.mjs';
import { managedFindings } from '../sync/managed.mjs';
import { APP, PRESETS } from './helpers/hfs-cli-fixture.mjs';

function synced(context, edition) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-coverage-scope-evidence-'));
  context.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const declaration = { ...structuredClone(APP), edition };
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(declaration));
  const targets = renderTargets(declaration, PRESETS);
  writeTargets(repoRoot, targets);
  return { repoRoot, tracked: ['hfs.json', ...targets.map(target => target.path)], presets: PRESETS };
}

const mutations = [
  ['be/jest.config.js', text => text.replace('"service",', '')],
  ['codecov.yml', text => text.replace('target: 100%', 'target: 80%')],
  ['sonar-project.properties', text => text.replace('sonar.coverage.exclusions=', 'sonar.coverage.exclusions=be/src/modules/**,')],
];

for (const edition of ['lite', 'full']) {
  test(`${edition} accepts the rendered coverage scope without HFS_COVERAGE_SCOPE_DRIFT`, async context => {
    const options = synced(context, edition);
    const findings = await managedFindings(options);
    assert.deepEqual(findings, []);
    assert.equal(findings.some(finding => finding.code === 'HFS_COVERAGE_SCOPE_DRIFT'), false);
  });

  for (const [relative, mutate] of mutations) {
    test(`${edition} rejects drift in ${relative} as HFS_COVERAGE_SCOPE_DRIFT`, async context => {
      const options = synced(context, edition);
      const file = path.join(options.repoRoot, relative);
      const rendered = fs.readFileSync(file, 'utf8');
      const changed = mutate(rendered);
      assert.notEqual(changed, rendered);
      fs.writeFileSync(file, changed);
      const findings = await managedFindings(options);
      assert.deepEqual(findings.map(finding => [finding.code, finding.path]), [['HFS_COVERAGE_SCOPE_DRIFT', relative]]);
      fs.writeFileSync(file, rendered);
      assert.deepEqual(await managedFindings(options), []);
    });
  }
}
