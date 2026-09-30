import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-be-fixture.mjs';

// R47 test-world-files (BE_TEST_TOPOLOGY): src/tests/world/ holds only global-setup.ts, global-teardown.ts, use-test-world.ts,
// fakes/, kit/ and role-suffixed files at its root (knowledge/hfs/slots.yaml be.tests.world allows).
const E = 'export const value = 1;\n';
const GOOD = {
  'src/tests/world/global-setup.ts': E,
  'src/tests/world/global-teardown.ts': E,
  'src/tests/world/use-test-world.ts': E,
  'src/tests/world/fakes/stripe/stripe.server.ts': E,
  'src/tests/world/kit/wait-for.service.ts': E,
  'src/tests/world/identity.client.ts': E,
  'src/tests/world/checkout.contracts.ts': E,
  'src/tests/world/world.policy.ts': E,
  'src/tests/world/world.error.ts': E,
  'src/tests/world/world.options.ts': E,
};
const DECLARE = { declaration: { optionalSlots: [] } };
const hits = report => findings(report, 'BE_TEST_TOPOLOGY').filter(item => item.slot === 'be.tests.world');
const paths = report => hits(report).map(item => item.path).sort();
const run = (t, files) => runArch(archFixture(t, { files: { ...GOOD, ...files }, ...DECLARE }));

test('a test world with its fixed files, fakes/, kit/ and role-suffixed root helpers raises no world-files finding', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.testWorldFiles.status, 'checked');
  assert.ok(report.coverage.checkedRuleIds.includes('BE_TEST_TOPOLOGY'));
});

test('a stray file, a file without a role suffix, an unknown folder or a role file in a subfolder is refused', t => {
  const report = run(t, {
    'src/tests/world/helpers.ts': E,
    'src/tests/world/checkout.helper.ts': E,
    'src/tests/world/utils/clock.client.ts': E,
    'src/tests/world/setup.ts': E,
  });
  assert.deepEqual(paths(report), ['src/tests/world/checkout.helper.ts', 'src/tests/world/helpers.ts', 'src/tests/world/setup.ts', 'src/tests/world/utils/clock.client.ts']);
  assert.match(hits(report)[0].message, /holds only/);
});

// R47 test-world-files, owner refinement 2026-09-30: the world's services and image versions come from the stack definition
// (.starcistacks/dev), a service the stack declares runs real (no fake of it), and no test source spells an image.
const STACK = (services) => ({
  '.starcistacks/application-stacks.yaml': [
    'schema: starci/application-stacks@1',
    'components:',
    ...Object.entries(services).flatMap(([name, image]) => [`  ${name}:`, `    image: ${image}`, '    role: stateful']),
    'environments:',
    '  dev:',
    '    status: supported',
    '    runtime: docker-compose',
    '    composeFiles: [infra/compose/compose.yaml]',
    '',
  ].join('\n'),
  '.starcistacks/dev/infra/compose/compose.yaml': `services:\n${Object.entries(services).map(([name, image]) => `  ${name}:\n    image: ${image}\n`).join('')}`,
});
const STACK_SERVICES = { postgres: 'postgres:16', redis: 'redis:7', keycloak: 'quay.io/keycloak/keycloak:26.0', toxiproxy: 'ghcr.io/shopify/toxiproxy:2.9.0' };
const runStack = (t, files, services = STACK_SERVICES) => runArch(archFixture(t, { files: { ...GOOD, ...STACK(services), ...files }, ...DECLARE }));
const messages = report => hits(report).map(item => item.message);

test('a world that reads its services from the stack and fakes only an external SaaS raises nothing', t => {
  const report = runStack(t, {
    'src/tests/world/fakes/sepay/server.ts': E,
    'src/tests/world/stack.client.ts': [
      'import { execFileSync } from "node:child_process";',
      'export const up = () => execFileSync("docker", ["exec", "web", "psql", "-h", "127.0.0.1", "-p", "8080:80", "-e", "USER=admin:admin", "--url", "localhost:3000"]);',
      'export const label = "todo-e2e-run=1";',
      '',
    ].join('\n'),
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('an image the dev stack declares, spelled in the world or in a fixture, is refused: the world reads the stack at run time', t => {
  const report = runStack(t, {
    'src/tests/world/docker.client.ts': 'export const POSTGRES_IMAGE = "postgres:16";\n',
    'src/tests/fixtures/database.ts': 'export const other = "redis:6";\n',
  });
  const all = findings(report, 'BE_TEST_TOPOLOGY');
  assert.deepEqual(all.map(item => item.path).sort(), ['src/tests/fixtures/database.ts', 'src/tests/world/docker.client.ts']);
  assert.match(all[0].message, /image literal of \.starcistacks\/dev/);
});

test('a docker run of an image the dev stack does not declare, in an argument array or a command string, and a testcontainers image are refused', t => {
  const report = runStack(t, {
    'src/tests/world/docker.client.ts': 'export const args = ["run", "-d", "--name", "x", "mysql:8"];\nexport const line = "docker run -d mongo:7";\n',
    'src/tests/world/containers.client.ts': 'import { GenericContainer } from "testcontainers";\nexport const box = new GenericContainer("rabbitmq:3");\n',
  });
  assert.deepEqual(paths(report), ['src/tests/world/containers.client.ts', 'src/tests/world/docker.client.ts', 'src/tests/world/docker.client.ts']);
  assert.match(messages(report).join('\n'), /"mysql:8" is an image \.starcistacks\/dev does not declare/);
  assert.match(messages(report).join('\n'), /"mongo:7"/);
  assert.match(messages(report).join('\n'), /"rabbitmq:3"/);
});

test('a fake of a service the stack declares (by its name, image repository or alias) is refused; a fake of an undeclared SaaS is not', t => {
  const report = runStack(t, {
    'src/tests/world/fakes/keycloak/server.ts': E,
    'src/tests/world/fakes/redis/redis-fake.service.ts': E,
    'src/tests/world/fakes/smtp/server.ts': E,
    'src/tests/world/fakes/sepay/server.ts': E,
  }, { ...STACK_SERVICES, mailpit: 'axllent/mailpit:v1.20' });
  assert.deepEqual(paths(report), ['src/tests/world/fakes/keycloak/server.ts', 'src/tests/world/fakes/redis/redis-fake.service.ts', 'src/tests/world/fakes/smtp/server.ts']);
  assert.match(messages(report).join('\n'), /fakes\/smtp\/ fakes mailpit \(axllent\/mailpit:v1\.20\)/);
});

test('without a mail host in the stack the smtp fake stays legal', t => {
  const report = runStack(t, { 'src/tests/world/fakes/smtp/server.ts': E });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

// Owner-approved exception (BE-CONVENTION 1.16): a stack service that is stateless compute needing special hardware or an
// external model may be faked, only when the world README marks it in the table | stack service | fake | reason | holds |.
const README = rows => ['# World', '', '| stack service | fake | reason | holds |', '|---|---|---|---|', ...rows, ''].join('\n');
const INFERENCE = { ...STACK_SERVICES, inference: 'ghcr.io/acme/vllm-proxy:1.0' };
const FAKE_FILES = name => ({ [`src/tests/world/fakes/${name}/server.ts`]: E });

test('a stateless GPU/model service the stack declares may be faked when the world README marks it with a reason and both conditions', t => {
  const report = runStack(t, {
    ...FAKE_FILES('inference'),
    'src/tests/world/README.md': README(['| `inference` | `inference` | Serves a GPU model; the fake speaks the same protocol. | a, b |']),
  }, INFERENCE);
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('a fake of a stack service the world README does not mark is refused, and the message names the table to fill', t => {
  const report = runStack(t, FAKE_FILES('inference'), INFERENCE);
  assert.deepEqual(paths(report), ['src/tests/world/fakes/inference/server.ts']);
  assert.match(messages(report)[0], /stateless compute that needs special hardware or an external model/);
});

test('a marked fake of a stateful service (database, cache, identity, mail, queue or one with a persistent volume) is refused on its README row', t => {
  const services = { ...STACK_SERVICES, kafka: 'apache/kafka:3.8.0', worker: 'ghcr.io/acme/embedder:2' };
  const files = {
    ...FAKE_FILES('postgres'),
    ...FAKE_FILES('kafka'),
    ...FAKE_FILES('worker'),
    'src/tests/world/README.md': README([
      '| postgres | postgres | It is slow. | a, b |',
      '| kafka | kafka | Needs a broker. | a, b |',
      '| worker | worker | Embeds text on a GPU. | a, b |',
    ]),
    '.starcistacks/dev/infra/compose/compose.yaml': `services:\n${Object.entries(services).map(([name, image]) => `  ${name}:\n    image: ${image}\n${name === 'worker' ? '    volumes:\n      - embeddings:/data\n' : ''}`).join('')}`,
  };
  const report = runStack(t, files, services);
  const all = hits(report);
  assert.equal(all.length, 3, JSON.stringify(all, null, 1));
  assert.ok(all.every(item => item.path === 'src/tests/world/README.md'));
  assert.match(all[0].message, /postgres is stateful \(a database holds data the app reads back\)/);
  assert.match(all[1].message, /kafka is stateful \(a queue holds data/);
  assert.match(all[2].message, /worker is stateful \(the stack gives it a persistent volume\)/);
});

test('a README row with an empty reason, without both conditions, or naming a service or fake that does not exist is refused as invalid', t => {
  const report = runStack(t, {
    ...FAKE_FILES('inference'),
    'src/tests/world/README.md': README([
      '| inference | inference |  | a, b |',
      '| inference | inference | Needs a GPU. | b |',
      '| ghost | inference | Needs a GPU. | a, b |',
      '| inference | missing | Needs a GPU. | a, b |',
    ]),
  }, INFERENCE);
  const all = hits(report);
  assert.deepEqual(all.map(item => item.line), [5, 6, 7, 8]);
  assert.match(all[0].message, /the reason is empty/);
  assert.match(all[1].message, /holds must be "a, b"/);
  assert.match(all[2].message, /declares no service ghost/);
  assert.match(all[3].message, /no fakes\/missing\/ folder/);
});
