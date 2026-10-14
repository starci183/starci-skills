// proves: HFS_CI_MISSING_CANON@lite
// proves: HFS_CI_MISSING_CANON@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { pipelineFindings } from '../../scripts/hfs/rules/pipeline.mjs';

const CODE = 'HFS_CI_MISSING_CANON';
const WORKFLOW = '.github/workflows/ci.yml';
const pins = parseYaml(fs.readFileSync(path.resolve(import.meta.dirname, '../../knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;

function fixture(t, edition) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-ci-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const declaration = { hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(declaration));
  fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ private: true, scripts: { lint: 'starci app lint' } }));
  fs.mkdirSync(path.join(repoRoot, '.github/workflows'), { recursive: true });
  const { repo } = openHfs({ repoRoot });
  assert.equal(repo.edition, edition);
  return {
    write(command) { fs.writeFileSync(path.join(repoRoot, WORKFLOW), `name: CI\non: workflow_dispatch\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${command}\n`); },
    check() { return pipelineFindings({ repoRoot, repo, files: ['hfs.json', 'package.json', WORKFLOW], pins }); },
    repoRoot,
  };
}

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: CI must run the lint entry, and its npm script must really invoke it`, (t) => {
    const app = fixture(t, edition);
    app.write('starci app check');
    const [missing] = app.check();
    assert.equal(missing.code, CODE);
    assert.equal(missing.level, 'error');
    assert.equal(missing.path, WORKFLOW);
    app.write('npm run lint -- --sonar reports/lint.sonar.json');
    fs.writeFileSync(path.join(app.repoRoot, 'package.json'), JSON.stringify({ scripts: { lint: 'echo done' } }));
    assert.deepEqual(app.check().map((finding) => finding.code), [CODE]);
    fs.writeFileSync(path.join(app.repoRoot, 'package.json'), JSON.stringify({ scripts: { lint: 'starci app lint' } }));
    assert.deepEqual(app.check(), []);
  });

  test(`${CODE}@${edition}: an explicit CLI version must match the canon pin`, (t) => {
    const app = fixture(t, edition);
    app.write('npx @starci/cli@0.0.0 app lint');
    const [drift] = app.check();
    assert.equal(drift.code, CODE);
    assert.equal(drift.pinned, pins['@starci/cli'].version);
    app.write(`npx @starci/cli@${pins['@starci/cli'].version} app lint`);
    assert.deepEqual(app.check(), []);
  });
}
