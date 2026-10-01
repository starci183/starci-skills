// The microservice policy of `hfs check` (scripts/hfs/rules/services.mjs): R128 HFS_SERVICE_PLACEMENT, R129 HFS_IMAGE_UNPINNED,
// R130 HFS_SERVICE_STACK_DECLARATION, R131 HFS_EVENT_CONTRACT, R132 BE_ASYNC_SPEC_MISSING, plus the event contract emit
// (packages/hfs/emit). Each rule has a violating and a passing tree; the clean app of tests/helpers/hfs-cli-fixture.mjs is the base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { emitContracts } from '../../packages/hfs/emit/contracts.mjs';
import { APP, STACKS_DECLARATION, appOf, cleanup, gitAdd, installTypeScript, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

const MULTI = appOf({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'billing', kind: 'worker' }] } });
const made = [];
const repoOf = (declaration = MULTI, mutate) => {
  const dir = writeCleanRepo(declaration);
  made.push(dir);
  if (mutate) mutate(dir);
  return gitAdd(dir);
};
test.after(() => cleanup(made));

const put = (dir, relative, text = 'export {};\n') => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const only = (declaration, mutate, code) => checkRepo({ repoRoot: repoOf(declaration, mutate) }).findings.filter((f) => f.code === code);
const pathsOf = (findings) => findings.map((f) => f.path).sort();

const stack = (components) => `${STACKS_DECLARATION}components:\n${components}`;
const COMPONENTS = [
  '  postgres:', '    image: postgres:16.4@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '    role: stateful',
  '  core:', '    image: demo/core:1.0.0', '    role: service',
  '  billing:', '    image: demo/billing:1.0.0', '    role: service', '',
].join('\n');
const withStack = (components) => (dir) => put(dir, '.starcistacks/application-stacks.yaml', stack(components));

// ------------------------------------------------------------------------------------------------ R128 HFS_SERVICE_PLACEMENT

test('HFS_SERVICE_PLACEMENT: a Dockerfile or a package.json of a folder outside be/apps/<service> is a second service root', () => {
  const findings = only(APP, (dir) => {
    put(dir, 'services/billing/Dockerfile', 'FROM node\n');
    put(dir, 'be/billing/package.json', '{}\n');
    put(dir, 'Dockerfile', 'FROM node\n');
  }, 'HFS_SERVICE_PLACEMENT');
  assert.deepEqual(pathsOf(findings), ['Dockerfile', 'be/billing/package.json', 'services/billing/Dockerfile']);
  assert.match(findings[0].message, /be\/apps\/<service>\//);
});

test('HFS_SERVICE_PLACEMENT: the Dockerfile of a be app, of a front-end app, the root package.json and a workspace package pass', () => {
  assert.deepEqual(only(APP, (dir) => {
    put(dir, 'be/apps/core/Dockerfile', 'FROM node\n');
    put(dir, 'fe/apps/web/Dockerfile', 'FROM node\n');
    put(dir, 'fe/packages/ui/package.json', '{}\n');
  }, 'HFS_SERVICE_PLACEMENT'), []);
});

// ------------------------------------------------------------------------------------------------ R129 HFS_IMAGE_UNPINNED

test('HFS_IMAGE_UNPINNED: a multi-service stack with a moving image (no tag, latest, major only) is refused, each component named', () => {
  const findings = only(MULTI, withStack([
    '  postgres:', '    image: postgres:16', '    role: stateful',
    '  redis:', '    image: redis:latest', '    role: stateful',
    '  core:', '    image: demo/core', '    role: service',
    '  billing:', '    image: demo/billing:1.0.0', '    role: service', '',
  ].join('\n')), 'HFS_IMAGE_UNPINNED');
  assert.deepEqual(findings.map((f) => f.component).sort(), ['core', 'postgres', 'redis']);
  assert.match(findings.find((f) => f.component === 'core').message, /has no tag/);
  assert.match(findings.find((f) => f.component === 'postgres').message, /not an exact version/);
});

test('HFS_IMAGE_UNPINNED: exact versions and digests pass, and a single-service product is not judged', () => {
  const digest = `quay.io/keycloak/keycloak@sha256:${'a'.repeat(64)}`;
  assert.deepEqual(only(MULTI, withStack(`${COMPONENTS}  keycloak:\n    image: ${digest}\n    role: stateful\n  minio:\n    image: cgr.dev/chainguard/minio:2024.1.2-r0\n    role: stateful\n`), 'HFS_IMAGE_UNPINNED'), []);
  assert.deepEqual(only(APP, withStack('  postgres:\n    image: postgres:16\n    role: stateful\n'), 'HFS_IMAGE_UNPINNED'), []);
});

// ------------------------------------------------------------------------------------------------ R130 HFS_SERVICE_STACK_DECLARATION

test('HFS_SERVICE_STACK_DECLARATION: a service app with no component, or one that is not role service, is refused', () => {
  const findings = only(MULTI, withStack('  core:\n    image: demo/core:1.0.0\n    role: stateful\n'), 'HFS_SERVICE_STACK_DECLARATION');
  assert.deepEqual(findings.map((f) => f.app).sort(), ['billing', 'core']);
});

test('HFS_SERVICE_STACK_DECLARATION: every service app declared as a role service component passes', () => {
  assert.deepEqual(only(MULTI, withStack(COMPONENTS), 'HFS_SERVICE_STACK_DECLARATION'), []);
});

// ------------------------------------------------------------------------------------------------ R131 HFS_EVENT_CONTRACT

const EVENTS_TS = 'export const EVENTS = {\n  "order.placed": { stream: "order-events", version: 1, payload: { orderId: "string", totalCents: "number", note: "string?" } },\n} as const\n';
const CONSUMES_TS = (version = 1, event = 'order.placed') => `export const CONSUMES = {\n  core: { "${event}": ${version} },\n} as const\n`;
/** The provider `core` and the consumer `billing`; the snapshot is what `hfs emit-contracts` writes. */
const withEvents = ({ consumes = CONSUMES_TS(), snapshot = true, events = EVENTS_TS } = {}) => (dir) => {
  withStack(COMPONENTS)(dir);
  put(dir, 'be/apps/core/src/events.ts', events);
  put(dir, 'be/apps/billing/src/consumes.ts', consumes);
  if (snapshot) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-events-'));
    put(temp, 'package.json', '{}\n');
    installTypeScript(temp);
    put(temp, 'be/apps/core/src/events.ts', events);
    const out = path.join(temp, 'out');
    emitContracts({ repoRoot: path.join(temp, 'be'), declaration: { apps: [{ name: 'core', kind: 'worker' }] }, outDir: out });
    put(dir, 'be/contracts/core/events.json', fs.readFileSync(path.join(out, 'contracts/core/events.json'), 'utf8'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
};
const r131 = (options) => only(MULTI, withEvents(options), 'HFS_EVENT_CONTRACT');

test('HFS_EVENT_CONTRACT: a consumer reading an event at the vendored version, with a snapshot equal to the provider table, passes', () => {
  assert.deepEqual(r131(), []);
});

test('HFS_EVENT_CONTRACT: a provider with no committed snapshot and a consumer of a service with no snapshot are refused', () => {
  const findings = r131({ snapshot: false });
  assert.deepEqual(pathsOf(findings), ['be/apps/billing/src/consumes.ts', 'be/contracts/core/events.json']);
});

test('HFS_EVENT_CONTRACT: an unknown event and a version the snapshot does not declare are refused on the consumer', () => {
  assert.match(r131({ consumes: CONSUMES_TS(1, 'order.cancelled') })[0].message, /"order.cancelled", which be\/contracts\/core\/events.json does not declare/);
  assert.match(r131({ consumes: CONSUMES_TS(2) })[0].message, /at version 2, but be\/contracts\/core\/events.json declares version 1/);
});

test('HFS_EVENT_CONTRACT: a snapshot that no longer equals the provider table is stale, and a table that is not a literal is refused', () => {
  const stale = only(MULTI, (dir) => {
    withEvents()(dir);
    put(dir, 'be/apps/core/src/events.ts', EVENTS_TS.replace('version: 1', 'version: 2'));
  }, 'HFS_EVENT_CONTRACT');
  assert.deepEqual(stale.map((f) => [f.path, f.drift]), [['be/contracts/core/events.json', 'stale']]);
  const loose = only(MULTI, (dir) => {
    withEvents()(dir);
    put(dir, 'be/apps/core/src/events.ts', 'const stream = "x"\nexport const EVENTS = { "a.b": { stream, version: 1, payload: {} } } as const\n');
  }, 'HFS_EVENT_CONTRACT');
  assert.match(loose.find((f) => f.path === 'be/apps/core/src/events.ts').message, /needs a string `stream`/);
});

test('hfs emit-contracts writes events.json for an api or worker app that declares events.ts, sorted and with a final newline', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-events-'));
  made.push(temp);
  put(temp, 'package.json', '{}\n');
  installTypeScript(temp);
  put(temp, 'be/apps/billing/src/events.ts', 'export const EVENTS = { "invoice.rejected": { version: 1, stream: "billing-events", payload: { orderId: "string", reason: "string" } } } as const\n');
  const result = emitContracts({ repoRoot: path.join(temp, 'be'), declaration: { apps: [{ name: 'billing', kind: 'worker' }] } });
  assert.deepEqual(result.written, ['contracts/billing/events.json']);
  const text = fs.readFileSync(path.join(temp, 'be/contracts/billing/events.json'), 'utf8');
  assert.equal(text, `${JSON.stringify({ events: { 'invoice.rejected': { payload: { orderId: 'string', reason: 'string' }, stream: 'billing-events', version: 1 } }, schema: 'starci/event-contract@1', service: 'billing' }, null, 2)}\n`);
});

// ------------------------------------------------------------------------------------------------ R132 BE_ASYNC_SPEC_MISSING

const CONSUMER = 'be/src/features/orders/transport/message/order-placed.consumer.ts';
const CONSUMER_TS = 'export class OrderPlacedConsumer {\n  readonly event = "order.placed"\n}\n';
const SAGA = 'be/src/features/orders/application/cancel-unbilled.saga.ts';
const SAGA_TS = "import { Saga } from '@nestjs/cqrs';\nexport class CancelUnbilledSaga {\n  @Saga()\n  cancel = () => null;\n}\n";
const NOT_A_SAGA_TS = "import { Saga } from './local';\nexport class Plain {\n  @Saga()\n  run = () => null;\n}\n";
const SPEC = (event) => `import { useTestWorld } from '../../world/use-test-world';\nconst world = useTestWorld({ apps: ['core'] });\nit('handles ${event}', () => undefined);\n`;
const asyncRepo = ({ spec, specPath = 'be/src/tests/e2e/orders/order-placed.e2e-spec.ts', consumer = CONSUMER_TS, extra = {} } = {}) => (dir) => {
  withStack(COMPONENTS)(dir);
  put(dir, 'be/contracts/core/events.json', `${JSON.stringify({ events: { 'order.placed': { payload: {}, stream: 's', version: 1 } }, schema: 'starci/event-contract@1', service: 'core' }, null, 2)}\n`);
  put(dir, CONSUMER, consumer);
  for (const [file, text] of Object.entries(extra)) put(dir, file, text);
  if (spec !== undefined) put(dir, specPath, spec);
};
const r132 = (options) => only(MULTI, asyncRepo(options), 'BE_ASYNC_SPEC_MISSING');

test('BE_ASYNC_SPEC_MISSING: a consumer with no e2e spec, a saga with no spec and a spec that does not boot the world are refused', () => {
  assert.deepEqual(r132({ extra: { [SAGA]: SAGA_TS } }).map((f) => [f.path, f.kind]).sort(), [[SAGA, 'saga'], [CONSUMER, 'consumer']]);
  assert.match(r132({ spec: "it('x', () => undefined)\n" })[0].message, /never calls useTestWorld/);
});

test('BE_ASYNC_SPEC_MISSING: a consumer spec that never names the consumed event is refused', () => {
  const findings = r132({ spec: SPEC('something-else') });
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /never names the event it consumes \("order.placed"\)/);
});

test('BE_ASYNC_SPEC_MISSING: a consumer and a saga each with an e2e spec through the world pass; a decorator not of @nestjs/cqrs is no saga', () => {
  assert.deepEqual(r132({ spec: SPEC('order.placed'), extra: { [SAGA]: SAGA_TS, 'be/src/tests/e2e/orders/cancel-unbilled.e2e-spec.ts': SPEC('anything') } }), []);
  assert.deepEqual(r132({ spec: SPEC('order.placed'), extra: { 'be/src/features/orders/application/plain.saga.ts': NOT_A_SAGA_TS } }), []);
});
