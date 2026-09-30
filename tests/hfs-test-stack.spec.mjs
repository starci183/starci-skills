import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TestStackError, down, projectNameOf, up } from '../packages/hfs/test-stack/test-stack.mjs';
import { readStack } from '../scripts/lib/stack-services.mjs';

// `hfs test-stack` (owner refinement 2026-09-30): the world's services come from the repository's own stack definition, run for
// real behind toxiproxy under one stable project name; `up` attaches to a warm stack that answers, `down` removes only its project.

const STACK = `schema: starci/application-stacks@1
components:
  postgres: {image: 'postgres:16', role: stateful, compose: infra/compose/postgres.yaml}
  keycloak: {image: 'quay.io/keycloak/keycloak:26.0', role: stateful, compose: infra/compose/keycloak.yaml}
  toxiproxy: {image: 'ghcr.io/shopify/toxiproxy:2.9.0', role: failure-injection, compose: infra/compose/toxiproxy.yaml}
  api: {image: 'app/api', role: service, compose: infra/compose/api.yaml}
environments:
  dev:
    status: supported
    runtime: docker-compose
    composeFiles: [infra/compose/compose.yaml]
`;
const COMPOSE = `include:
  - postgres.yaml
  - keycloak.yaml
  - toxiproxy.yaml
  - api.yaml
`;
const FILES = {
  'package.json': JSON.stringify({ name: '@acme/shop-be' }),
  '.starcistacks/application-stacks.yaml': STACK,
  '.starcistacks/dev/infra/compose/compose.yaml': COMPOSE,
  '.starcistacks/dev/infra/compose/postgres.yaml': 'services:\n  postgres:\n    image: postgres:16\n    environment:\n      POSTGRES_USER: postgres\n      POSTGRES_PASSWORD_FILE: /run/secrets/pg\n    ports: ["5432:5432"]\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n',
  '.starcistacks/dev/infra/compose/keycloak.yaml': 'services:\n  keycloak:\n    image: quay.io/keycloak/keycloak:26.0\n    command: start-dev --import-realm\n    ports: ["8089:8089"]\n    volumes:\n      - ./realm.json:/opt/keycloak/data/import/realm.json:ro\n',
  '.starcistacks/dev/infra/compose/realm.json': JSON.stringify({ realm: 'shop', clients: [{ clientId: 'shop-api' }] }),
  '.starcistacks/dev/infra/compose/toxiproxy.yaml': 'services:\n  toxiproxy:\n    image: ghcr.io/shopify/toxiproxy:2.9.0\n    ports: ["8474:8474"]\n',
  '.starcistacks/dev/infra/compose/api.yaml': 'services:\n  api:\n    image: app/api\n    ports: ["3001:3001"]\n',
};

const repository = (t, files = FILES) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-stack-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
};

/** A docker that remembers what it was asked, holds the containers it started and answers ports and labels like the real one. */
const fakeIo = ({ running = [], answersHttp = true } = {}) => {
  const calls = [];
  const containers = new Map(running.map(name => [name, { service: name.split('-').at(-1), labels: {} }]));
  let nextPort = 40000;
  const ports = new Map();
  const http = [];
  const docker = args => {
    calls.push(args);
    const [verb] = args;
    if (verb === 'ps') return [...containers].map(([name, item]) => `${name}\t${item.service}\trunning`).join('\n');
    if (verb === 'network' && args[1] === 'ls') return '';
    if (verb === 'run') {
      const name = args[args.indexOf('--name') + 1];
      const service = args[args.indexOf('--label', args.indexOf('--label') + 2) + 1].split('=')[1];
      const labels = {};
      args.forEach((arg, index) => { if (arg === '--label' && args[index + 1].startsWith('com.starci.test-stack.proxies=')) labels['com.starci.test-stack.proxies'] = args[index + 1].slice('com.starci.test-stack.proxies='.length); });
      containers.set(name, { service, labels });
      return 'id';
    }
    if (verb === 'port') {
      const key = `${args[1]} ${args[2]}`;
      if (!ports.has(key)) ports.set(key, (nextPort += 1));
      return `127.0.0.1:${ports.get(key)}`;
    }
    if (verb === 'inspect') return JSON.stringify(containers.get(args.at(-1))?.labels ?? {});
    if (verb === 'rm') { for (const name of args.slice(3)) containers.delete(name); return ''; }
    return '';
  };
  const io = {
    docker,
    fetch: async (url, init = {}) => { http.push({ url, method: init.method ?? 'GET', body: init.body }); return { ok: answersHttp, status: answersHttp ? 200 : 503 }; },
    tcp: async () => true,
    sleep: async () => undefined,
    log: () => undefined,
  };
  return { io, calls, http, containers };
};

test('the stable project name is the package name without its scope plus -test-stack', t => {
  assert.equal(projectNameOf(repository(t)), 'shop-be-test-stack');
});

test('the stack reader takes services, images, mounts and *_FILE secrets from the declaration; own services and the proxy are told apart', t => {
  const stack = readStack({ root: repository(t) });
  assert.deepEqual(stack.services.map(service => [service.name, service.runs]), [['postgres', true], ['keycloak', true], ['toxiproxy', true], ['api', false]]);
  assert.equal(stack.proxy.image, 'ghcr.io/shopify/toxiproxy:2.9.0');
  const postgres = stack.services.find(service => service.name === 'postgres');
  assert.equal(postgres.environment.POSTGRES_PASSWORD, 'starci-test-secret');
  assert.equal('POSTGRES_PASSWORD_FILE' in postgres.environment, false);
  assert.deepEqual(postgres.mounts, [], 'a named volume is ephemeral in the test stack');
  assert.deepEqual(stack.services.find(service => service.name === 'keycloak').command, ['start-dev', '--import-realm']);
});

test('up starts every real service and the proxy under the project, publishes on loopback with OS ports, creates one proxy per port and reports started', async t => {
  const root = repository(t);
  const { io, calls, http } = fakeIo();
  const state = await up({ root, io });
  assert.equal(state.started, true);
  assert.equal(state.project, 'shop-be-test-stack');
  const runs = calls.filter(args => args[0] === 'run');
  const IMAGES = ['postgres:16', 'quay.io/keycloak/keycloak:26.0', 'ghcr.io/shopify/toxiproxy:2.9.0'];
  assert.deepEqual(runs.map(args => args.find(arg => IMAGES.includes(arg))), IMAGES);
  const postgres = runs.find(args => args.includes('postgres:16'));
  assert.ok(postgres.includes('POSTGRES_PASSWORD=starci-test-secret'));
  assert.ok(postgres.includes('127.0.0.1::5432'));
  assert.ok(postgres.includes('shop-be-test-stack'), 'attached to the project network');
  const keycloak = runs.find(args => args.includes('--import-realm'));
  assert.ok(keycloak.some(arg => arg.startsWith('type=bind,source=') && arg.endsWith('target=/opt/keycloak/data/import/realm.json,readonly')), 'the realm is mounted as the dev stack mounts it');
  assert.ok(!runs.some(args => args.includes('app/api')), 'the app own service is not started');
  const created = http.filter(request => request.method === 'POST' && request.url.endsWith('/proxies')).map(request => JSON.parse(request.body));
  assert.deepEqual(created.map(proxy => [proxy.name, proxy.upstream]), [['postgres-5432', 'postgres:5432'], ['keycloak-8089', 'keycloak:8089']]);
  assert.deepEqual(Object.keys(state.services), ['postgres', 'keycloak']);
  assert.equal(state.services.postgres.ports[0].proxyName, 'postgres-5432');
  assert.notEqual(state.services.postgres.ports[0].proxy, state.services.postgres.ports[0].direct);
});

test('up attaches to a warm stack that answers: started is false, the proxies are reset and nothing is started', async t => {
  const root = repository(t);
  const cold = fakeIo();
  await up({ root, io: cold.io });
  const warm = fakeIo();
  warm.io.docker = (args) => (args[0] === 'run' ? assert.fail('a warm stack is never restarted') : cold.io.docker(args));
  warm.io.fetch = async (url, init = {}) => { warm.http.push({ url, method: init.method ?? 'GET' }); return { ok: true, status: 200 }; };
  const state = await up({ root, io: warm.io });
  assert.equal(state.started, false);
  assert.ok(warm.http.some(request => request.method === 'POST' && request.url.endsWith('/reset')));
});

test('up refuses a stack without toxiproxy, naming what to add', async t => {
  const files = { ...FILES, '.starcistacks/dev/infra/compose/compose.yaml': 'include:\n  - postgres.yaml\n' };
  await assert.rejects(up({ root: repository(t, files), io: fakeIo().io }), error => error instanceof TestStackError && /declares no toxiproxy service/.test(error.message));
});

test('down removes exactly the containers and networks labelled with the project', async t => {
  const { io, calls } = fakeIo({ running: ['shop-be-test-stack-postgres', 'shop-be-test-stack-toxiproxy'] });
  const result = down({ project: 'shop-be-test-stack', io });
  assert.deepEqual(result.removed, ['shop-be-test-stack-postgres', 'shop-be-test-stack-toxiproxy']);
  assert.deepEqual(calls.find(args => args[0] === 'rm'), ['rm', '-f', '-v', 'shop-be-test-stack-postgres', 'shop-be-test-stack-toxiproxy']);
  assert.ok(calls.find(args => args[0] === 'ps').includes('label=com.starci.test-stack=shop-be-test-stack'));
});
