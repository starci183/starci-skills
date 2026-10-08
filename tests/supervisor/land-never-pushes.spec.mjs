// land-never-pushes.spec.mjs - a land fast-forwards LOCAL main and ends there. The remote main of the runtime moves with a release only
// (scripts/supervisor/release-cut.mjs), so the land gate has no push step, no push-owed follow-up and no switch for either.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { land, runChecks } from '../../scripts/supervisor/land.mjs';
import { landOutcomeOf, recordLand } from '../../scripts/supervisor/land-record.mjs';
import { DEFAULTS, supervisorSettings } from '../../scripts/machine/home.mjs';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* the temp root is swept */ } });
  return dir;
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

test('with the default config a land moves local main and leaves the remote main where it was', async (t) => {
  const base = tmp(t, 'starci-land-never-pushes-');
  const origin = path.join(base, 'origin.git');
  const root = path.join(base, 'work');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(base, 'clone', '-q', origin, root);
  for (const [k, v] of [['user.name', 'Spec'], ['user.email', 'spec@example.invalid'], ['core.autocrlf', 'false']]) git(root, 'config', k, v);
  git(root, 'checkout', '-q', '-b', 'main');
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 1;\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'push', '-q', 'origin', 'main');
  const remoteBefore = git(origin, 'rev-parse', 'refs/heads/main');
  git(root, 'checkout', '-q', '-b', 'lane');
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 2;\n');
  git(root, 'commit', '-q', '-am', 'lane work');
  const sha = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-q', 'main');
  const env = { STARCI_LOCAL_ROOT: path.join(tmp(t, 'starci-land-env-'), 'la') };
  env.STARCI_LANES_ROOT = path.join(path.dirname(env.STARCI_LOCAL_ROOT), 'lanes');

  const result = await land({ commits: [sha], root, env, deps: { runChecks: (opts) => runChecks({ ...opts, runSpecs: false }) } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(git(root, 'rev-parse', 'main'), result.landed, 'local main moved');
  assert.equal(git(origin, 'rev-parse', 'refs/heads/main'), remoteBefore, 'the remote main did not');
  assert.equal('push' in result, false, 'the result carries no push');
  assert.equal(result.outcome, undefined);
});

test('the land record has no push row and no push-owed follow-up; the shipped default and the settings carry no push key', () => {
  const outcome = landOutcomeOf({ ok: true, landed: 'a'.repeat(40), checks: [] }, { commits: ['b'.repeat(40)], startedAt: 1 });
  assert.equal('push' in outcome, false);
  assert.equal(outcome.log.kind, 'land.passed');
  const decisions = [];
  const m = { recordLandOutcome: () => ({ runId: 7 }), supJob: () => null, openSupDecision: (d) => decisions.push(d) };
  assert.equal(recordLand(m, { result: { ok: true, landed: 'a'.repeat(40), push: { pushed: false, refused: 'secret scan' } }, commits: ['b'.repeat(40)], jobId: 'job-1', startedAt: 1 }), 7);
  assert.deepEqual(decisions, [], 'a land owes nobody a push');
  assert.deepEqual(DEFAULTS.landGate, { mode: 'shared' });
  assert.deepEqual(supervisorSettings().landGate, { mode: 'shared' });
});
