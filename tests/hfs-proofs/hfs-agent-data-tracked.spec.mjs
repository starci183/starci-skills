// proves: HFS_AGENT_DATA_TRACKED@full
// The lite boundary has its own HFS_STARCIWORK_LITE_FORBIDDEN code and returns before this full Work rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { checkStarciworkBoundary } from '../../scripts/work/validate/check-example-work.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const git = (cwd, args) => {
  const result = spawnSync('git', args, { cwd, env: withoutGitLocalEnv(process.env), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};
const fixture = (t, edition, agentData) => {
  const root = mkdtemp(t, `starci-agent-data-proof-${edition}-`);
  const work = path.join(root, '.starciwork');
  fs.mkdirSync(work);
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } }));
  fs.writeFileSync(path.join(work, 'workspace.yaml'), 'schema: work/workspace@1\nid: proof\n');
  if (agentData) fs.writeFileSync(path.join(work, 'runtime.sqlite'), 'fixture ledger data\n');
  git(root, ['init', '-q']);
  git(root, ['add', '.']);
  return { root, work };
};
const check = (work) => {
  const problems = [];
  const warnings = [];
  checkStarciworkBoundary(work, problems, warnings);
  return { problems, warnings };
};

test('full: a tracked agent ledger is refused with the product boundary code', (t) => {
  const { work } = fixture(t, 'full', true);
  const result = check(work);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /runtime\.sqlite.*ledger is agent data.*\[HFS_AGENT_DATA_TRACKED\]/);
  assert.deepEqual(result.warnings, []);
});

test('full: untracked agent data does not become a tracked-product finding', (t) => {
  const { root, work } = fixture(t, 'full', true);
  git(root, ['rm', '--cached', '--', '.starciwork/runtime.sqlite']);
  assert.equal(fs.existsSync(path.join(work, 'runtime.sqlite')), true);
  assert.deepEqual(check(work), { problems: [], warnings: [] });
});

test('lite: the edition boundary uses its separate forbidden-content code', (t) => {
  const { work } = fixture(t, 'lite', true);
  const result = check(work);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /runtime\.sqlite.*\[HFS_STARCIWORK_LITE_FORBIDDEN\]/);
  assert.equal(result.problems.some((problem) => problem.includes('HFS_AGENT_DATA_TRACKED')), false);
});

test('lite: a tracked workspace declaration passes its edition boundary', (t) => {
  assert.deepEqual(check(fixture(t, 'lite', false).work), { problems: [], warnings: [] });
});
