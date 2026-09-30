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

// R47 test-world-files, owner refinement 2026-09-30: every service the dev stack (.starcistacks/dev) declares runs real in the
// world, so a fakes/<provider>/ of one is refused; the one exception is stateless GPU/model compute declared in the world
// config (test-world.config.ts, `fakedBy`) with a reason.
const STACK = (services, extra = {}) => ({
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
  '.starcistacks/dev/infra/compose/compose.yaml': `services:\n${Object.entries(services).map(([name, image]) => `  ${name}:\n    image: ${image}\n${extra[name] ?? ''}`).join('')}`,
});
const STACK_SERVICES = { postgres: 'postgres:16', redis: 'redis:7', keycloak: 'quay.io/keycloak/keycloak:26.0', toxiproxy: 'ghcr.io/shopify/toxiproxy:2.9.0' };
const runStack = (t, files, services = STACK_SERVICES, extra = {}) => runArch(archFixture(t, { files: { ...GOOD, ...STACK(services, extra), ...files }, ...DECLARE }));
const messages = report => hits(report).map(item => item.message);
const FAKE = name => ({ [`src/tests/world/fakes/${name}/server.ts`]: E });
const CONFIG = body => ({ 'src/tests/world/test-world.config.ts': `export default defineTestWorld(${body});\n` });
const INFERENCE = { ...STACK_SERVICES, inference: 'ghcr.io/acme/vllm-proxy:1.0' };

test('a world that fakes only an external SaaS the stack does not declare raises nothing', t => {
  const report = runStack(t, { ...FAKE('sepay'), ...CONFIG("{ stacks: ['dev'] }") });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('without a mail host in the stack the smtp fake stays legal', t => {
  const report = runStack(t, FAKE('smtp'));
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('a fake of a service the stack declares (by name, image repository or alias) is refused, whatever it is called', t => {
  const report = runStack(t, { ...FAKE('keycloak'), ...FAKE('redis'), ...FAKE('smtp'), ...FAKE('sepay') }, { ...STACK_SERVICES, mailpit: 'axllent/mailpit:v1.20' });
  assert.deepEqual(paths(report), ['src/tests/world/fakes/keycloak/server.ts', 'src/tests/world/fakes/redis/server.ts', 'src/tests/world/fakes/smtp/server.ts']);
  assert.match(messages(report).join('\n'), /fakes\/smtp\/ fakes mailpit \(axllent\/mailpit:v1\.20\)/);
});

test('a stateless GPU/model service the stack declares may be faked when the config declares it in fakedBy with a reason', t => {
  const report = runStack(t, { ...FAKE('inference'), ...CONFIG("{ stacks: ['dev'], fakedBy: { inference: { fake: 'inference', reason: 'Serves a GPU model; the fake speaks the same protocol.' } } }") }, INFERENCE);
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('the fakedBy of a stack service is read from the literal config only: an undeclared fake is refused and names the config', t => {
  const report = runStack(t, { ...FAKE('inference'), ...CONFIG("{ stacks: ['dev'] }") }, INFERENCE);
  assert.deepEqual(paths(report), ['src/tests/world/fakes/inference/server.ts']);
  assert.match(messages(report)[0], /declares it in fakedBy with a reason/);
});

test('a fakedBy of a stateful service (database, cache, queue, or one with a persistent volume) is refused on its config entry', t => {
  const services = { ...STACK_SERVICES, kafka: 'apache/kafka:3.8.0', worker: 'ghcr.io/acme/embedder:2' };
  const report = runStack(t, {
    ...FAKE('postgres'), ...FAKE('kafka'), ...FAKE('worker'),
    ...CONFIG("{ fakedBy: { postgres: { fake: 'postgres', reason: 'Slow.' }, kafka: { fake: 'kafka', reason: 'Broker.' }, worker: { fake: 'worker', reason: 'GPU embeddings.' } } }"),
  }, services, { worker: '    volumes:\n      - embeddings:/data\n' });
  const all = hits(report);
  assert.equal(all.length, 3, JSON.stringify(all, null, 1));
  assert.ok(all.every(item => item.path === 'src/tests/world/test-world.config.ts'));
  const text = all.map(item => item.message).join(' ');
  assert.match(text, /postgres is stateful \(a database holds data the app reads back\)/);
  assert.match(text, /kafka is stateful \(a queue holds data/);
  assert.match(text, /worker is stateful \(the stack gives it a persistent volume\)/);
});

test('a fakedBy entry with an empty reason, or naming a stack service or fake folder that does not exist, is refused as empty or stale', t => {
  const report = runStack(t, {
    ...FAKE('inference'),
    ...CONFIG("{ fakedBy: { inference: { fake: 'inference', reason: '' }, ghost: { fake: 'inference', reason: 'GPU.' }, embedder: { fake: 'missing', reason: 'GPU.' } } }"),
  }, { ...INFERENCE, embedder: 'ghcr.io/acme/embedder:2' });
  const all = hits(report);
  assert.equal(all.length, 3, JSON.stringify(all, null, 1));
  const text = all.map(item => item.message).join(' ');
  assert.match(text, /the reason is empty/);
  assert.match(text, /declares no service ghost/);
  assert.match(text, /no fakes\/missing\/ folder/);
});

test('the config stacks list names the environments the world runs: a service of a listed non-dev stack is judged too', t => {
  const files = {
    ...FAKE('cache'),
    ...CONFIG("{ stacks: ['dev', 'uat'] }"),
    '.starcistacks/uat/infra/compose/compose.yaml': 'services:\n  redis:\n    image: redis:7\n',
  };
  const stack = STACK(STACK_SERVICES);
  stack['.starcistacks/application-stacks.yaml'] = stack['.starcistacks/application-stacks.yaml'].replace('environments:\n', 'environments:\n  uat:\n    status: supported\n    runtime: docker-compose\n    composeFiles: [infra/compose/compose.yaml]\n');
  const report = runArch(archFixture(t, { files: { ...GOOD, ...stack, ...files }, ...DECLARE }));
  assert.deepEqual(paths(report), ['src/tests/world/fakes/cache/server.ts']);
});
