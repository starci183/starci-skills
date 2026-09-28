import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { foreignLandedPaths, ownedPathEffects } from '../scripts/kernel/settle-landed.mjs';
import { writeJobPatch } from '../scripts/kernel/job-artifacts.mjs';

const git = (root, ...args) => {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
};

const fixture = (t, count) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pathspec-batches-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'pathspecs@starci.test');
  git(root, 'config', 'user.name', 'pathspecs');
  const specs = Array.from({ length: count }, (_, i) => `owned/file-${String(i).padStart(4, '0')}-${'long-name-'.repeat(8)}.txt`);
  fs.mkdirSync(path.join(root, 'owned'));
  for (const spec of specs) fs.writeFileSync(path.join(root, spec), spec);
  fs.writeFileSync(path.join(root, 'foreign.txt'), 'outside ownership\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'owned and foreign files');
  return { root, specs, head: git(root, 'rev-parse', 'HEAD') };
};

for (const count of [2, 1601]) {
  test(`foreignLandedPaths finds a foreign file across ${count} owned pathspecs`, (t) => {
    const { root, specs, head } = fixture(t, count);
    const found = foreignLandedPaths({ root, specs, head, sinceMs: 0, timeoutMs: 120_000 });
    assert.deepEqual(found, { commits: [{ sha: head, foreign: ['foreign.txt'] }] });
  });
}

test('dead-worker effects and job patch cover a large owned set', (t) => {
  const { root, specs, head } = fixture(t, 1601);
  const effects = ownedPathEffects({ base: root, ownedPaths: specs, sinceMs: 0 });
  assert.equal(effects.provable, true, effects.error);
  assert.deepEqual(effects.commits, [head]);

  const jobDir = path.join(root, 'artifacts');
  const patch = writeJobPatch({ repo: root, job: { job_id: 'large-job' }, envelope: { head }, result: null,
    payload: { owned_paths: specs }, sinceMs: 0, jobDir });
  assert.equal(patch.error, undefined, patch.error);
  const content = fs.readFileSync(patch.file, 'utf8');
  assert.ok(content.includes(`diff --git a/${specs[0]} b/${specs[0]}`));
  assert.ok(content.includes(`diff --git a/${specs.at(-1)} b/${specs.at(-1)}`));
  assert.ok(!content.includes('diff --git a/foreign.txt b/foreign.txt'));
});
