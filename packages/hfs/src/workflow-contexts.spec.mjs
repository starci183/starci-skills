// proves: HFS_WORKFLOW_CONTEXT@lite
// proves: HFS_WORKFLOW_CONTEXT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { workflowContextsFindings } from '../runtime/scripts/hfs/rules/workflow-contexts.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

const FAILURE = 'HFS_WORKFLOW_CONTEXT';
const FILE = '.github/workflows/ci.yml';
const RUNNER_PATH = '${{ runner.temp }}/data';
const doc = (jobEnvValue, stepEnvValue) => `name: ci
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      DATA: ${jobEnvValue}
    steps:
      - run: echo "$STEP"
        env:
          STEP: ${stepEnvValue}
`;
const run = (t, edition, text, repo = { kind: 'app', edition }) => {
  const root = mkdtemp(t, 'hfs-workflow-context-');
  fs.mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
  fs.writeFileSync(path.join(root, FILE), text);
  return workflowContextsFindings({ repoRoot: root, files: [FILE], repo, isRoot: true });
};

for (const edition of ['lite', 'full']) {
  test(`${edition}: a valid workflow reading runner data only in step env is clean`, (t) => {
    assert.deepEqual(run(t, edition, doc('${{ github.sha }}', RUNNER_PATH)), []);
  });

  test(`${edition}: ${FAILURE} violation - job env reading the runner context is refused with its line`, (t) => {
    const found = run(t, edition, doc(RUNNER_PATH, '${{ github.sha }}'));
    assert.equal(found.length, 1);
    assert.equal(found[0].code, FAILURE);
    assert.equal(found[0].context, 'runner');
    assert.equal(found[0].keyPath, 'jobs.build.env.DATA');
    assert.equal(found[0].line, 7);
  });

  test(`${edition}: ${FAILURE} reject - job env cannot read the steps context`, (t) => {
    const found = run(t, edition, doc('${{ steps.x.outputs.y }}', '${{ env.DATA }}'));
    assert.deepEqual(found.map((finding) => finding.context), ['steps']);
  });

  test(`${edition}: ${FAILURE} negative - a repository that is not an app is not judged`, (t) => {
    assert.deepEqual(run(t, edition, doc(RUNNER_PATH, RUNNER_PATH), { kind: 'runtime' }), []);
  });
}
