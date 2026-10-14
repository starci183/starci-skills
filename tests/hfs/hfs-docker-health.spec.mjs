// proves: HFS_DOCKER_HEALTHCHECK_FAKE@lite HFS_DOCKER_HEALTHCHECK_FAKE@full BE_READY_REAL@lite BE_READY_REAL@full BE_HEALTH_SIGNALS@lite BE_HEALTH_SIGNALS@full
// The violating and passing fixtures of R262 live in packages/eslint/be/health-ready.spec.mjs; these tests run that file under the tests/ tree so the catalog's proof discovery finds them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const healthSpec = (filter) => spawnSync(process.execPath, ['--test', `--test-name-pattern=${filter}`, 'packages/eslint/be/health-ready.spec.mjs'], { encoding: 'utf8' });

test('HFS_DOCKER_HEALTHCHECK_FAKE refuses a fake probe and passes the real live route, in lite and full', () => {
  const run = healthSpec('HFS_DOCKER_HEALTHCHECK_FAKE');
  assert.equal(run.status, 0, run.stdout.slice(-800));
});

test('BE_READY_REAL and BE_HEALTH_SIGNALS refuse liveness aliases and missing controllers and pass the real probes, in lite and full', () => {
  const run = healthSpec('BE_READY_REAL|BE_HEALTH_SIGNALS');
  assert.equal(run.status, 0, run.stdout.slice(-800));
});
