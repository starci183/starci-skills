import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkExampleRender, exampleRenderFindings } from '../../scripts/checks/check-example-render.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const SKIPPED = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage']);

/** A tracked copy of the shape-slot example in a repository of its own, so its tree can be bent without touching the checkout. */
function trackedCopy(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-example-render-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const app = path.join(dir, 'shape-slot');
  fs.cpSync(path.join(repoRoot, 'examples', 'shape-slot'), app, { recursive: true, filter: (source) => !SKIPPED.has(path.basename(source)) });
  const git = (...args) => spawnSync('git', args, { cwd: app, env: withoutGitLocalEnv(process.env), encoding: 'utf8' });
  assert.equal(git('init', '-q', '-b', 'main').status, 0);
  return { app, track: () => assert.equal(git('add', '-A', '--', '.').status, 0) };
}

const codes = (findings) => findings.map((finding) => `${finding.code} ${finding.path}`);

test('every example app of the checkout is its render: the fast half of starci app lint finds nothing under the runtime own HFS', async () => {
  assert.deepEqual(codes(await checkExampleRender(repoRoot)), []);
});

test('a copy of an example is clean until it is bent, then each bend is a finding of its own file', async (t) => {
  const { app, track } = trackedCopy(t);
  track();
  assert.deepEqual(codes(await exampleRenderFindings(repoRoot, 'copy', app)), [], 'the tracked copy is clean');
  const workflow = path.join(app, '.github', 'workflows', 'ci.yml');
  fs.writeFileSync(workflow, fs.readFileSync(workflow, 'utf8').replace(/actions\/checkout@\S+/, 'actions/checkout@v3'));
  fs.writeFileSync(path.join(app, '.starciwork', '.gitignore'), '# an older header\n');
  fs.writeFileSync(path.join(app, '.starcistacks', '.npmignore'), '**/secrets/**\n');
  track();
  const found = codes(await exampleRenderFindings(repoRoot, 'copy', app));
  assert.ok(found.some((line) => line.startsWith('HFS_MANAGED_FILE_DRIFT .github/workflows/ci.yml')), found.join('\n'));
  assert.ok(found.some((line) => line.startsWith('HFS_MANAGED_FILE_DRIFT .starciwork/.gitignore')), found.join('\n'));
  assert.ok(found.some((line) => line.startsWith('HFS_STACKS_SHAPE .starcistacks/.npmignore')), found.join('\n'));
});
