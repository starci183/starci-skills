import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { releaseProofImages } from '../../scripts/supervisor/release-proof-images.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const success = (stdout = '') => ({ status: 0, stdout, stderr: '' });

function app(t, { project = 'shop', dockerfile = 'FROM scratch\n' } = {}) {
  const root = mkdtemp(t, 'starci-release-images-');
  fs.writeFileSync(path.join(root, 'hfs.json'), `${JSON.stringify({ hfs: 2, kind: 'app', project })}\n`);
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name: project, private: true })}\n`);
  fs.mkdirSync(path.join(root, 'be', 'apps', 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'be', 'apps', 'api', 'Dockerfile'), dockerfile);
  return root;
}

test('release images builds, labels, health-checks and tears down by exact id', async (t) => {
  const root = app(t), calls = [];
  const result = await releaseProofImages({ cwd: root, args: {}, role: 'release', env: {} }, {
    underHostLock: async (options, fn) => { calls.push(['lock', options]); return fn(); },
    proofBuild: (request, options) => { calls.push(['build', request, options]); return success(); },
    proofImageInspect: (tag) => { calls.push(['image-inspect', tag]); return success('sha256:image|1234\n'); },
    proofRun: (request) => { calls.push(['run', request]); return success('container-id\n'); },
    containerInspect: (id, format) => { calls.push(['inspect', id, format]); return success(format.includes('Health') ? 'healthy\n' : 'true\n'); },
    proofContainerRemove: (id) => { calls.push(['remove', id]); return success(); },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(calls.find((call) => call[0] === 'run')[1], { tag: 'shop/api:dev', project: 'shop' });
  assert.equal(calls.find((call) => call[0] === 'remove')[1], 'container-id');
  assert.deepEqual(result.data.images[0], {
    side: 'be', app: 'api', dockerfile: 'be/apps/api/Dockerfile', tag: 'shop/api:dev', ok: true,
    imageId: 'sha256:image', size: '1234', health: 'healthy', running: true, teardown: true,
  });
});

test('an image without HEALTHCHECK must stay running ten seconds before it passes', async (t) => {
  const root = app(t);
  let sleeps = 0;
  const result = await releaseProofImages({ cwd: root, args: {} }, {
    underHostLock: async (_options, fn) => fn(),
    proofBuild: () => success(), proofImageInspect: () => success('id|1'), proofRun: () => success('cid'),
    containerInspect: (_id, format) => success(format.includes('Health') ? 'nohealthcheck' : 'true'),
    proofContainerRemove: () => success(), sleep: async (ms) => { assert.equal(ms, 5_000); sleeps += 1; },
  });
  assert.equal(result.code, 0);
  assert.equal(sleeps, 2);
});

test('release images tears down an unhealthy container and refuses protected names or port 3100 before Docker', async (t) => {
  const root = app(t), removed = [];
  const unhealthy = await releaseProofImages({ cwd: root, args: {} }, {
    underHostLock: async (_options, fn) => fn(),
    proofBuild: () => success(), proofImageInspect: () => success('id|1'), proofRun: () => success('cid'),
    containerInspect: (_id, format) => success(format.includes('Health') ? 'unhealthy' : 'true'),
    proofContainerRemove: (id) => { removed.push(id); return success(); },
  });
  assert.equal(unhealthy.code, 1);
  assert.deepEqual(removed, ['cid']);

  let mutated = false;
  const guarded = { proofBuild: () => { mutated = true; return success(); } };
  assert.equal((await releaseProofImages({ cwd: app(t, { project: 'nivo-lite' }), args: {} }, guarded)).code, 2);
  assert.equal((await releaseProofImages({ cwd: app(t, { dockerfile: 'FROM scratch\nEXPOSE 3100\n' }), args: {} }, guarded)).code, 2);
  assert.equal(mutated, false);
});
