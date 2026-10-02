import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { dockerDown, dockerPs, dockerUp } from '../../scripts/machine/docker-stack.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const success = (stdout = '') => ({ status: 0, stdout, stderr: '' });

function app(t, project = 'shop') {
  const cwd = mkdtemp(t, 'starci-docker-stack-');
  fs.writeFileSync(path.join(cwd, 'hfs.json'), `${JSON.stringify({ hfs: 2, kind: 'app', project, sides: { be: { apps: [] }, fe: { apps: [] } } })}\n`);
  const composeDir = path.join(cwd, '.starcistacks', 'dev', 'infra', 'compose');
  fs.mkdirSync(composeDir, { recursive: true });
  fs.writeFileSync(path.join(composeDir, 'api.yaml'), 'services: {}\n');
  return cwd;
}

test('docker up checks the model, injects labels, waits, and maps ports plus health', async (t) => {
  const cwd = app(t);
  const calls = [];
  const model = {
    services: { api: { ports: [{ published: 41001, target: 3000 }] } },
    networks: { default: {} },
    volumes: { data: {} },
  };
  const result = await dockerUp({ cwd, role: 'worker', positionals: ['api'], args: {} }, {
    underHostLock: async (options, fn) => { calls.push(['lock', options]); return fn(); },
    composeConfig: (file) => { calls.push(['config', file]); return success(JSON.stringify(model)); },
    withOverride: async (override, fn) => { calls.push(['override', override]); return fn('labels.json'); },
    composeUp: (request) => { calls.push(['up', request]); return success(); },
    composePs: (request) => { calls.push(['ps', request]); return success(JSON.stringify([{ Name: 'starci-shop-api-api-1', State: 'running', Health: 'healthy', Publishers: [{ URL: '0.0.0.0', PublishedPort: 41001, TargetPort: 3000, Protocol: 'tcp' }] }])); },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, {
    schema: 'starci/docker-up@1', project: 'shop', stack: 'api',
    containers: [{ name: 'starci-shop-api-api-1', ports: ['0.0.0.0:41001->3000/tcp'], health: 'healthy' }],
  });
  assert.deepEqual(calls[0], ['lock', { role: 'worker', purpose: 'docker-up', env: undefined }]);
  assert.deepEqual(calls[2][1], {
    services: { api: { labels: { 'starci.project': 'shop' } } },
    networks: { default: { labels: { 'starci.project': 'shop' } } },
    volumes: { data: { labels: { 'starci.project': 'shop' } } },
  });
  assert.deepEqual(calls[3][1], { files: [path.join(cwd, '.starcistacks', 'dev', 'infra', 'compose', 'api.yaml'), 'labels.json'], projectName: 'starci-shop-api', waitSeconds: 120, build: false });
});

test('docker up refuses a protected port before any mutating Docker call', async (t) => {
  const cwd = app(t);
  let mutated = false;
  const result = await dockerUp({ cwd, positionals: ['api'], args: {} }, {
    composeConfig: () => success(JSON.stringify({ services: { api: { ports: [{ published: 3100, target: 3000 }] } } })),
    composeUp: () => { mutated = true; return success(); },
  });
  assert.equal(result.code, 2);
  assert.equal(result.data.code, 'DOCKER_PORT_POLICY');
  assert.equal(mutated, false);
});

test('docker down queries both labels and removes only selected non-foreign ids', async (t) => {
  const cwd = app(t);
  const calls = [];
  const filters = ['label=starci.project=shop', 'label=com.docker.compose.project=starci-shop-api'];
  const result = await dockerDown({ cwd, positionals: ['api'], args: { volumes: true } }, {
    dockerPs: (request) => { calls.push(['ps', request]); return success([
      JSON.stringify({ ID: 'ours-id', Names: 'starci-shop-api-api-1' }),
      JSON.stringify({ ID: 'foreign-id', Names: 'nivo-lite-db' }),
    ].join('\n')); },
    resourceList: (kind, actualFilters) => { calls.push(['list', kind, actualFilters]); return success(kind === 'network' ? 'net-id\n' : 'vol-id\n'); },
    composeDown: (ids) => { calls.push(['down', ids]); return success(); },
    resourceRemove: (kind, ids) => { calls.push(['remove', kind, ids]); return success(); },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(calls, [
    ['ps', { all: true, filters }],
    ['list', 'network', filters],
    ['list', 'volume', filters],
    ['down', ['ours-id']],
    ['remove', 'network', ['net-id']],
    ['remove', 'volume', ['vol-id']],
  ]);
  assert.deepEqual(result.data.removed, { containers: ['ours-id'], networks: ['net-id'], volumes: ['vol-id'] });
  assert.match(result.text, /containers: ours-id/);
  assert.match(result.text, /networks: net-id/);
  assert.match(result.text, /volumes: vol-id/);
});

test('docker down never invokes a removal for empty labelled selections', async (t) => {
  const cwd = app(t);
  let removed = false;
  const result = await dockerDown({ cwd, positionals: ['api'], args: {} }, {
    dockerPs: () => success(),
    resourceList: () => success(),
    composeDown: () => { removed = true; },
    resourceRemove: () => { removed = true; },
  });
  assert.equal(result.code, 0);
  assert.equal(removed, false);
});

test('docker ps lists labelled containers and --all tags visible nivo-lite containers foreign', async () => {
  const stdout = [
    JSON.stringify({ Names: 'starci-shop-api-1', Labels: 'starci.project=shop', State: 'running', Ports: '0.0.0.0:41001->3000/tcp' }),
    JSON.stringify({ Names: 'nivo-lite-db', Labels: '', State: 'running', Ports: '0.0.0.0:3100->3000/tcp' }),
    JSON.stringify({ Names: 'unrelated', Labels: '', State: 'running', Ports: '' }),
  ].join('\n');
  const result = await dockerPs({ args: { all: true } }, { dockerPs: () => success(stdout) });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data.containers.map(({ name, foreign }) => [name, foreign]), [['starci-shop-api-1', false], ['nivo-lite-db', true]]);
  assert.match(result.text, /nivo-lite-db \[foreign\]/);
});
