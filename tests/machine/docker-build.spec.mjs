import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { dockerBuild } from '../../scripts/machine/docker-build.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function app(t, project = 'shop') {
  const cwd = mkdtemp(t, 'starci-docker-build-');
  fs.writeFileSync(path.join(cwd, 'hfs.json'), `${JSON.stringify({ hfs: 2, kind: 'app', project, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } })}\n`);
  for (const file of ['be/apps/api/Dockerfile', 'fe/apps/web/Dockerfile']) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), 'FROM scratch\n');
  }
  return cwd;
}

test('docker build uses the declared Dockerfile, app-root context, tag, and no-cache flag', async (t) => {
  const cwd = app(t);
  let call;
  const result = await dockerBuild({ cwd, positionals: ['api'], args: { tag: 'spec', 'no-cache': true } }, {
    underHostLock: async (options, fn) => { assert.deepEqual(options, { role: 'owner', purpose: 'docker-build', env: undefined }); return fn(); },
    dockerBuild: (request, options) => { call = { request, options }; return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(call, { request: { dockerfile: 'be/apps/api/Dockerfile', tag: 'shop/api:spec', noCache: true }, options: { cwd } });
  assert.deepEqual(result.data, { schema: 'starci/docker-build@1', project: 'shop', app: 'api', tag: 'shop/api:spec', dockerfile: 'be/apps/api/Dockerfile', context: cwd });
});

test('docker build refuses undeclared, ambiguous, missing, and nivo-lite apps before Docker', async (t) => {
  let called = false;
  const deps = { dockerBuild: () => { called = true; } };
  assert.equal((await dockerBuild({ cwd: app(t), positionals: ['missing'], args: {} }, deps)).code, 2);
  assert.equal((await dockerBuild({ cwd: app(t, 'nivo-lite'), positionals: ['api'], args: {} }, deps)).data.code, 'DOCKER_PORT_POLICY');
  assert.equal(called, false);
});
