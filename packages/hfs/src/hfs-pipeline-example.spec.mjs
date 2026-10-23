// proves: HFS_CI_MISSING_CANON@lite HFS_CI_MISSING_CANON@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipelineFindings } from '../runtime/scripts/hfs/rules/pipeline.mjs';

const PREFIX = 'node node_modules/@starci/hfs/runtime/scripts/hfs/example-secrets.mjs --run . -- ';

for (const edition of ['lite', 'full']) {
  test('canonical lint stays required through the exact example runner (' + edition + ')', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-pipeline-example-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const root = path.join(directory, 'examples', 'fixture');
    fs.writeFileSync(path.join(directory, 'hfs.json'), JSON.stringify({ kind: 'runtime' }));
    fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
    fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ kind: 'app', edition }));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { lint: 'starci app lint', unit: 'echo unit' } }));
    const findings = (command) => {
      fs.writeFileSync(path.join(root, '.github/workflows/ci.yml'), 'steps:\n  - run: ' + command + '\n');
      return pipelineFindings({ repoRoot: root, files: ['.github/workflows/ci.yml'], pins: { '@starci/cli': { version: '4.4.0' } } });
    };
    for (const command of ['npm run lint', PREFIX + 'npm run lint', PREFIX + 'npm run lint -- --sonar reports/lint.sonar.json'])
      assert.deepEqual(findings(command), [], command);
    for (const command of [
      PREFIX + 'npm run unit',
      PREFIX + 'echo npm run lint',
      'echo ' + PREFIX + 'npm run lint',
      PREFIX + 'starci app check',
      PREFIX + 'npx @starci/cli@0.0.1 app lint',
      PREFIX.replace('example-secrets.mjs', 'other-runner.mjs') + 'npm run lint',
      PREFIX.replace('--run . --', '--run other-app --') + 'npm run lint',
      PREFIX.replace('--run . --', '--run .') + 'npm run lint',
    ]) {
      assert.deepEqual(findings(command).map((finding) => finding.code), ['HFS_CI_MISSING_CANON'], command);
    }
    fs.writeFileSync(path.join(directory, 'hfs.json'), JSON.stringify({ kind: 'app' }));
    assert.deepEqual(findings('npm run lint'), [], 'ordinary app lint remains accepted');
    assert.deepEqual(findings(PREFIX + 'npm run lint').map((finding) => finding.code), ['HFS_CI_MISSING_CANON'], 'ordinary apps gain no example runner exemption');
  });
}
