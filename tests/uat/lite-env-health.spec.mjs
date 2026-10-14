import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkEnvironments, environmentIdsOfPaths } from '../../scripts/uat/env-health.mjs';

const fixture = (t, edition) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-lite-env-health-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(repo, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', edition }));
  return repo;
};

const legacyWork = repo => {
  const work = path.join(repo, '.starciwork');
  const flow = path.join(work, 'features', 'login', 'uat', 'password-sign-in');
  const environment = path.join(work, '_resources', 'environments', 'local', 'resource.yaml');
  fs.mkdirSync(flow, { recursive: true });
  fs.mkdirSync(path.dirname(environment), { recursive: true });
  fs.writeFileSync(path.join(work, 'workspace.yaml'), 'schema: work/workspace@1\nrepositories: []\n');
  fs.writeFileSync(path.join(flow, 'index.yaml'), 'refs: [environment.t.local]\n');
  fs.writeFileSync(environment, 'schema: work/resource@1\nid: environment.t.local\nprobes: []\n');
  return environment;
};

const ownedFlow = '.starciwork/features/login/uat/password-sign-in';

test('lite env-health reads workspace.yaml and ignores forbidden Work metadata and explicit Work resources', async t => {
  const repo = fixture(t, 'lite');
  let result = await checkEnvironments({ repo, paths: [ownedFlow] });
  assert.deepEqual([result.ready, result.declared, result.environments], [true, false, []]);

  const environment = legacyWork(repo);
  const reads = [];
  const readFileSync = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (String(file).startsWith(path.join(repo, '.starciwork')) && /\.ya?ml$/i.test(String(file))) reads.push(file);
    return readFileSync(file, ...args);
  });
  assert.deepEqual(environmentIdsOfPaths(repo, [ownedFlow]), []);
  result = await checkEnvironments({ repo, paths: [ownedFlow] });
  assert.deepEqual([result.ready, result.declared, result.environments], [true, false, []]);
  result = await checkEnvironments({ repo, ids: ['environment.t.local', environment] });
  assert.deepEqual(result.environments, []);
  assert.deepEqual(result.unresolved, ['environment.t.local', environment]);
  assert.deepEqual([...new Set(reads)], [path.join(repo, '.starciwork', 'workspace.yaml')], 'lite reads workspace.yaml and skips forbidden Work YAML left over from an earlier layout');

  const external = path.join(repo, 'environment.yaml');
  fs.writeFileSync(external, 'schema: work/resource@1\nid: environment.t.external\nprobes: []\n');
  result = await checkEnvironments({ repo, ids: [external] });
  assert.equal(result.ready, true);
  assert.equal(result.environments[0].id, 'environment.t.external');
  assert.deepEqual([...new Set(reads)], [path.join(repo, '.starciwork', 'workspace.yaml')]);
});

test('full env-health keeps discovering Work record environment refs and workspace metadata', async t => {
  const repo = fixture(t, 'full');
  legacyWork(repo);
  assert.deepEqual(environmentIdsOfPaths(repo, [ownedFlow]), ['environment.t.local']);
  const result = await checkEnvironments({ repo, paths: [ownedFlow] });
  assert.deepEqual([result.ready, result.declared], [true, true]);
  assert.equal(result.environments[0].id, 'environment.t.local');
  assert.equal(result.environments[0].file, '.starciwork/_resources/environments/local/resource.yaml');
});
