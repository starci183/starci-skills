// The microservice policy of `hfs check` (scripts/hfs/rules/services.mjs): R136 HFS_SERVICE_PLACEMENT, R137 HFS_IMAGE_UNPINNED,
// R138 HFS_SERVICE_STACK_DECLARATION, R139 HFS_EVENT_CONTRACT (event classes -> events.json), R140 BE_ASYNC_SPEC_MISSING, plus the event contract emit
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

// ------------------------------------------------------------------------------------------------ R136 HFS_SERVICE_PLACEMENT

test('HFS_SERVICE_PLACEMENT: a Dockerfile or a package.json of a folder outside be/apps/<service> is a second service root', () => {
  const findings = only(APP, (dir) => {
    put(dir, 'services/billing/Dockerfile', 'FROM node\n');
    put(dir, 'be/billing/package.json', '{}\n');
    put(dir, 'Dockerfile', 'FROM node\n');
  }, 'HFS_SERVICE_PLACEMENT');
  assert.deepEqual(pathsOf(findings), ['Dockerfile', 'be/billing/package.json', 'services/billing/Dockerfile']);
  assert.match(findings[0].message, /be\/apps\/<service>\//);
});

test('HFS_SERVICE_PLACEMENT: the Dockerfile of a be app, of a front-end app, the root package.json and the package.json of an fe workspace pass', () => {
  assert.deepEqual(only(APP, (dir) => {
    put(dir, 'be/apps/core/Dockerfile', 'FROM node\n');
    put(dir, 'fe/apps/web/Dockerfile', 'FROM node\n');
    put(dir, 'fe/packages/ui/package.json', '{}\n');
  }, 'HFS_SERVICE_PLACEMENT'), []);
});

// ------------------------------------------------------------------------------------------------ R137 HFS_IMAGE_UNPINNED

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

// ------------------------------------------------------------------------------------------------ R138 HFS_SERVICE_STACK_DECLARATION

test('HFS_SERVICE_STACK_DECLARATION: a service app with no component, or one that is not role service, is refused', () => {
  const findings = only(MULTI, withStack('  core:\n    image: demo/core:1.0.0\n    role: stateful\n'), 'HFS_SERVICE_STACK_DECLARATION');
  assert.deepEqual(findings.map((f) => f.app).sort(), ['billing', 'core']);
});

test('HFS_SERVICE_STACK_DECLARATION: every service app declared as a role service component passes', () => {
  assert.deepEqual(only(MULTI, withStack(COMPONENTS), 'HFS_SERVICE_STACK_DECLARATION'), []);
});

// ------------------------------------------------------------------------------------------------ R139 HFS_EVENT_CONTRACT

const EVENTS_DIR = 'be/src/modules/events';
const PLACED_PATH = `${EVENTS_DIR}/core/order-placed.event.ts`;
const REJECTED_PATH = `${EVENTS_DIR}/billing/invoice-rejected.event.ts`;
/** An event class in the shape of knowledge/patterns/be/event-bus.yaml: a payload interface, static eventName and version, create(payload). */
const eventClass = ({ className, name, version = 1, compensates, fields = 'readonly orderId: string; readonly totalCents: number; readonly note?: string' }) => `import { BaseEvent } from '@modules/platform/event-bus';
export interface ${className}Payload { ${fields} }
export class ${className} extends BaseEvent {
  static readonly eventName = "${name}";
  static readonly version = ${version};
${compensates === undefined ? '' : `  static readonly compensates = "${compensates}";\n`}  static create(payload: ${className}Payload): ${className} { return new ${className}(payload.orderId, payload); }
}
`;
const PLACED = eventClass({ className: 'OrderPlacedEvent', name: 'order.placed' });
const REJECTED = eventClass({ className: 'InvoiceRejectedEvent', name: 'billing.invoice-rejected', compensates: 'order.placed', fields: 'readonly orderId: string; readonly reason: string' });

/** What `hfs emit-contracts` writes for the event classes of `service`, in a scratch app that holds only those files. */
const emitted = (service, classes) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-events-'));
  made.push(temp);
  put(temp, 'package.json', '{}\n');
  installTypeScript(temp);
  for (const [file, text] of Object.entries(classes)) put(temp, file.replace(/^be\//, 'be/'), text);
  const out = path.join(temp, 'out');
  emitContracts({ repoRoot: path.join(temp, 'be'), declaration: { apps: [] }, outDir: out });
  return fs.readFileSync(path.join(out, 'contracts', service, 'events.json'), 'utf8');
};
/** The provider `core` (order.placed) and `billing` (invoice-rejected, compensating order.placed), their snapshots as emitted. */
const withEvents = ({ classes = { [PLACED_PATH]: PLACED, [REJECTED_PATH]: REJECTED }, snapshots = true } = {}) => (dir) => {
  withStack(COMPONENTS)(dir);
  for (const [file, text] of Object.entries(classes)) put(dir, file, text);
  if (snapshots) {
    for (const service of new Set(Object.keys(classes).map((file) => file.split('/')[4]))) {
      const own = Object.fromEntries(Object.entries(classes).filter(([file]) => file.split('/')[4] === service));
      put(dir, `be/contracts/${service}/events.json`, emitted(service, own));
    }
  }
};
const r139 = (options) => only(MULTI, withEvents(options), 'HFS_EVENT_CONTRACT');

test('HFS_EVENT_CONTRACT: event classes whose vendored snapshots equal what they emit pass', () => {
  assert.deepEqual(r139(), []);
});

test('HFS_EVENT_CONTRACT: a service with event classes and no committed snapshot is refused', () => {
  assert.deepEqual(pathsOf(r139({ snapshots: false })), ['be/contracts/billing/events.json', 'be/contracts/core/events.json']);
});

test('HFS_EVENT_CONTRACT: a snapshot that no longer equals what the event classes emit is stale', () => {
  const findings = only(MULTI, (dir) => {
    withEvents()(dir);
    put(dir, PLACED_PATH, PLACED.replace('version = 1', 'version = 2'));
  }, 'HFS_EVENT_CONTRACT');
  assert.deepEqual(findings.map((f) => [f.path, f.drift]), [['be/contracts/core/events.json', 'stale']]);
});

test('HFS_EVENT_CONTRACT: a changed payload field is drift too, and an unreadable class is refused', () => {
  const drift = only(MULTI, (dir) => {
    withEvents()(dir);
    put(dir, PLACED_PATH, PLACED.replace('readonly totalCents: number', 'readonly totalCents: string'));
  }, 'HFS_EVENT_CONTRACT');
  assert.equal(drift.length, 1);
  const loose = only(MULTI, (dir) => {
    withEvents()(dir);
    put(dir, PLACED_PATH, PLACED.replace('static readonly version = 1', 'static readonly version = VERSION'));
  }, 'HFS_EVENT_CONTRACT');
  assert.match(loose.find((f) => f.path === PLACED_PATH).message, /needs `static readonly version`/);
  const nested = only(MULTI, (dir) => {
    withEvents()(dir);
    put(dir, PLACED_PATH, PLACED.replace('readonly note?: string', 'readonly note: { text: string }'));
  }, 'HFS_EVENT_CONTRACT');
  assert.match(nested.find((f) => f.path === PLACED_PATH).message, /payload field note must be/);
});

test('HFS_EVENT_CONTRACT: an event that compensates an event no class declares is refused, one that compensates a declared event passes', () => {
  const refused = only(MULTI, withEvents({ classes: { [PLACED_PATH]: PLACED, [REJECTED_PATH]: eventClass({ className: 'InvoiceRejectedEvent', name: 'billing.invoice-rejected', compensates: 'order.shipped', fields: 'readonly orderId: string' }) } }), 'HFS_EVENT_CONTRACT');
  assert.equal(refused.length, 1);
  assert.match(refused[0].message, /compensates "order.shipped", which no event class declares/);
});

test('HFS_EVENT_CONTRACT: a committed snapshot of a service with no event class is left behind', () => {
  const findings = only(MULTI, (dir) => {
    withEvents()(dir);
    put(dir, 'be/contracts/shipping/events.json', '{}\n');
  }, 'HFS_EVENT_CONTRACT');
  assert.deepEqual(findings.map((f) => [f.path, f.drift]), [['be/contracts/shipping/events.json', 'left-behind']]);
});

test('hfs emit-contracts writes events.json for a service that declares event classes, sorted and with a final newline', () => {
  const text = emitted('billing', { [REJECTED_PATH]: REJECTED });
  assert.equal(text, `${JSON.stringify({ events: { 'billing.invoice-rejected': { compensates: 'order.placed', payload: { orderId: 'string', reason: 'string' }, version: 1 } }, schema: 'starci/event-contract@1', service: 'billing' }, null, 2)}\n`);
});

// ------------------------------------------------------------------------------------------------ R140 BE_ASYNC_SPEC_MISSING

const consumerOf = (className, file) => `import { ${className} } from '@modules/events/${file}';\nexport class ${className}Consumer {\n  readonly event = ${className}\n}\n`;
const CONSUMER_REJECTED = 'be/src/features/orders/transport/message/invoice-rejected.consumer.ts';
const CONSUMER_PLACED = 'be/src/features/billing/transport/message/order-placed.consumer.ts';
const SPEC_PLACED = 'be/src/tests/e2e/orders/order-placed.e2e-spec.ts';
const SPEC_REJECTED = 'be/src/tests/e2e/orders/invoice-rejected.e2e-spec.ts';
const SPEC = (...events) => `import { useTestWorld } from '../../world/use-test-world';\nconst world = useTestWorld({ apps: ['core'] });\n${events.map((event) => `it('handles ${event}', () => undefined);`).join('\n')}\n`;
/** `billing` consumes `order.placed`; `core` consumes `billing.invoice-rejected`, which compensates `order.placed`. */
const asyncRepo = (specs = {}) => (dir) => {
  withEvents()(dir);
  put(dir, CONSUMER_PLACED, consumerOf('OrderPlacedEvent', 'core'));
  put(dir, CONSUMER_REJECTED, consumerOf('InvoiceRejectedEvent', 'billing'));
  for (const [file, text] of Object.entries(specs)) put(dir, file, text);
};
const r140 = (specs) => only(MULTI, asyncRepo(specs), 'BE_ASYNC_SPEC_MISSING');

test('BE_ASYNC_SPEC_MISSING: a consumed event no e2e spec names, and a spec that does not boot the world, are refused on the consumer', () => {
  assert.deepEqual(r140().map((f) => [f.path, f.event]).sort(), [[CONSUMER_PLACED, 'order.placed'], [CONSUMER_REJECTED, 'billing.invoice-rejected']]);
  const notWorld = r140({ [SPEC_PLACED]: "it('order.placed', () => undefined)\n", [SPEC_REJECTED]: "it('billing.invoice-rejected', () => undefined)\n" });
  assert.equal(notWorld.length, 2);
  assert.match(notWorld[0].message, /has no e2e spec/);
});

test('BE_ASYNC_SPEC_MISSING: the spec of a saga step must also drive the event it compensates', () => {
  const stepOnly = r140({ [SPEC_PLACED]: SPEC('order.placed'), [SPEC_REJECTED]: SPEC('billing.invoice-rejected') });
  assert.equal(stepOnly.length, 1);
  assert.equal(stepOnly[0].path, SPEC_REJECTED);
  assert.match(stepOnly[0].message, /undoes "order.placed", but never names it/);
});

test('BE_ASYNC_SPEC_MISSING: every consumed event named by an e2e spec through the world, a saga step driving the whole flow, passes', () => {
  assert.deepEqual(r140({ [SPEC_PLACED]: SPEC('order.placed'), [SPEC_REJECTED]: SPEC('order.placed', 'billing.invoice-rejected') }), []);
  assert.deepEqual(r140({ 'be/src/tests/e2e/orders/whole-saga.e2e-spec.ts': SPEC('order.placed', 'billing.invoice-rejected') }), []);
});
