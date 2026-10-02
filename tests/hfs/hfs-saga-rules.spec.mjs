// The saga pattern of `hfs check` (scripts/hfs/rules/saga.mjs): R169 BE_SAGA_STEP_COMPENSATION, R170 BE_SAGA_STATE_VERSIONED,
// R171 BE_SAGA_EVENT_CONTRACT, R172 BE_SAGA_CONSUMER_DEDUPE, R173 BE_SAGA_E2E_MISSING, and the declared-pattern mechanism that enables
// the saga slots (`patterns: ["saga"]` in hfs.json sides.be). Each rule has a violating and a passing tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { appOf, cleanup, gitAdd, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

const OPTIONAL = ['be.contract.events', 'be.transport.message'];
const WITH_SAGA = appOf({ be: { apps: [{ name: 'core', kind: 'api' }], optionalSlots: OPTIONAL, patterns: ['saga'] } });
const WITHOUT_PATTERN = appOf({ be: { apps: [{ name: 'core', kind: 'api' }], optionalSlots: OPTIONAL } });
const made = [];
const repoOf = (declaration, mutate) => {
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
const run = (declaration, mutate) => checkRepo({ repoRoot: repoOf(declaration, mutate) }).findings;
const only = (findings, code) => findings.filter((f) => f.code === code);

const SAGA = 'be/src/features/saga/place/';
const STEP = `${SAGA}steps/reserve.saga-step.ts`;
const COMPENSATION = `${SAGA}compensations/reserve.compensation.ts`;
const ORCHESTRATOR = `${SAGA}place.saga.service.ts`;
const STATE = `${SAGA}place.saga-state.ts`;
const CONSUMER = 'be/src/features/saga/place/transport/message/invoice-rejected.consumer.ts';
const SPEC = 'be/src/tests/e2e/orders/place.e2e-spec.ts';

const STEP_TS = 'export class ReserveStep {\n  readonly event = "order.placed"\n}\n';
const COMPENSATION_TS = 'export class ReserveCompensation {\n  readonly event = "billing.invoice-rejected"\n}\n';
const ORCHESTRATOR_TS = "import { SagaService } from '../../../modules/platform/saga';\nimport { ReserveStep } from './steps/reserve.saga-step';\nimport { ReserveCompensation } from './compensations/reserve.compensation';\nexport class PlaceSaga { constructor(readonly s: SagaService, readonly a: ReserveStep, readonly b: ReserveCompensation) {} }\n";
const STATE_TS = "export interface PlaceSagaState {\n  readonly status: 'running' | 'compensated'\n  readonly version: number\n}\n";
const CONSUMER_TS = 'export class InvoiceRejectedConsumer {\n  handle(message: { eventId: string }): string { return message.eventId }\n}\n';
const CONTRACTS = {
  'be/contracts/orders/events.json': `${JSON.stringify({ events: { 'order.placed': { payload: {}, version: 1 } }, schema: 'starci/event-contract@1', service: 'orders' }, null, 2)}\n`,
  'be/contracts/billing/events.json': `${JSON.stringify({ events: { 'billing.invoice-rejected': { compensates: 'order.placed', payload: {}, version: 1 } }, schema: 'starci/event-contract@1', service: 'billing' }, null, 2)}\n`,
};
const SPEC_TS = "import { useTestWorld } from '../../world/use-test-world';\nconst world = useTestWorld({ apps: ['core'] });\nit('compensates billing.invoice-rejected', async () => { await world.infra.postgresql.connection('order').during(async () => undefined); });\n";
/** A complete saga: orchestrator, state, one step with its compensation, the consumer, the contracts and the e2e spec; `override` replaces or (null) removes a file. */
const sagaRepo = (override = {}) => (dir) => {
  const files = { [STEP]: STEP_TS, [COMPENSATION]: COMPENSATION_TS, [ORCHESTRATOR]: ORCHESTRATOR_TS, [STATE]: STATE_TS, [CONSUMER]: CONSUMER_TS, [SPEC]: SPEC_TS, ...CONTRACTS, ...override };
  for (const [file, text] of Object.entries(files)) if (text !== null) put(dir, file, text);
};
const saga = (code, override) => only(run(WITH_SAGA, sagaRepo(override)), code);

// ------------------------------------------------------------------------------------------------ the declared pattern

test('the saga slots are enabled only by the declared pattern: an undeclared saga folder is HFS_SLOT_NOT_ENABLED', () => {
  const undeclared = only(run(WITHOUT_PATTERN, sagaRepo()), 'HFS_SLOT_NOT_ENABLED').map((f) => f.path).filter((file) => file.includes('/saga/')).sort();
  assert.deepEqual(undeclared, [COMPENSATION, ORCHESTRATOR, STATE, STEP].sort());
  assert.deepEqual(only(run(WITH_SAGA, sagaRepo()), 'HFS_SLOT_NOT_ENABLED'), []);
});

test('a pattern no slot declares is refused in hfs.json', () => {
  const declaration = appOf({ be: { apps: [{ name: 'core', kind: 'api' }], patterns: ['no-such-pattern'] } });
  assert.throws(() => resolveRepoDeclaration(loadSlotManifest(), declaration), /patterns names no-such-pattern/);
  assert.doesNotThrow(() => resolveRepoDeclaration(loadSlotManifest(), WITH_SAGA));
});

// ------------------------------------------------------------------------------------------------ R169 BE_SAGA_STEP_COMPENSATION

test('BE_SAGA_STEP_COMPENSATION: a step without a compensation, a compensation without a step and an orchestrator that omits one are refused', () => {
  const missing = saga('BE_SAGA_STEP_COMPENSATION', { [COMPENSATION]: null });
  assert.deepEqual(missing.map((f) => f.path), [STEP]);
  assert.match(missing.find((f) => f.path === STEP).message, /saga step with no compensation/);
  const orphan = saga('BE_SAGA_STEP_COMPENSATION', { [STEP]: null });
  assert.match(orphan.find((f) => f.path === COMPENSATION).message, /compensation of no step/);
  const unlisted = saga('BE_SAGA_STEP_COMPENSATION', { [ORCHESTRATOR]: "import { SagaService } from '../../../modules/platform/saga';\nexport class PlaceSaga {}\n" });
  assert.equal(unlisted.length, 2);
});

test('BE_SAGA_STEP_COMPENSATION: a folder of steps with no orchestrator is refused; a complete saga passes', () => {
  const findings = saga('BE_SAGA_STEP_COMPENSATION', { [ORCHESTRATOR]: null, [STATE]: null });
  assert.ok(findings.some((f) => /no orchestrator/.test(f.message)));
  assert.deepEqual(saga('BE_SAGA_STEP_COMPENSATION'), []);
});

// ------------------------------------------------------------------------------------------------ R170 BE_SAGA_STATE_VERSIONED

test('BE_SAGA_STATE_VERSIONED: an orchestrator with no state file, a state with no numeric version and an orchestrator that bypasses the store are refused', () => {
  assert.match(saga('BE_SAGA_STATE_VERSIONED', { [STATE]: null })[0].message, /has no .*place.saga-state.ts/);
  const unversioned = saga('BE_SAGA_STATE_VERSIONED', { [STATE]: "export interface PlaceSagaState {\n  readonly status: string\n  readonly version: string\n}\n" });
  assert.deepEqual(unversioned.map((f) => f.path), [STATE]);
  const bypass = saga('BE_SAGA_STATE_VERSIONED', { [ORCHESTRATOR]: ORCHESTRATOR_TS.replace("import { SagaService } from '../../../modules/platform/saga';\n", "import { SagaService } from '../../../modules/platform/other';\n") });
  assert.match(bypass[0].message, /does not use the fenced store of platform\/saga/);
});

test('BE_SAGA_STATE_VERSIONED: a typed, versioned state and an orchestrator on the fenced store pass', () => {
  assert.deepEqual(saga('BE_SAGA_STATE_VERSIONED'), []);
  assert.deepEqual(saga('BE_SAGA_STATE_VERSIONED', { [STATE]: "export type PlaceSagaState = {\n  status: string\n  version: number\n}\n" }), []);
});

// ------------------------------------------------------------------------------------------------ R171 BE_SAGA_EVENT_CONTRACT

test('BE_SAGA_EVENT_CONTRACT: a step with no event, an event no contract declares and a compensation the contract does not say compensates are refused', () => {
  assert.match(saga('BE_SAGA_EVENT_CONTRACT', { [STEP]: 'export class ReserveStep {}\n' })[0].message, /names no event/);
  assert.match(saga('BE_SAGA_EVENT_CONTRACT', { [STEP]: STEP_TS.replace('order.placed', 'order.unknown') })[0].message, /"order.unknown", which no be\/contracts/);
  const wrong = saga('BE_SAGA_EVENT_CONTRACT', { 'be/contracts/billing/events.json': CONTRACTS['be/contracts/billing/events.json'].replace('"compensates": "order.placed",', '') });
  assert.match(wrong[0].message, /does not declare `compensates: "order.placed"`/);
});

test('BE_SAGA_EVENT_CONTRACT: events named in the contracts, the compensation declaring what it undoes, pass', () => {
  assert.deepEqual(saga('BE_SAGA_EVENT_CONTRACT'), []);
});

// ------------------------------------------------------------------------------------------------ R172 BE_SAGA_CONSUMER_DEDUPE

test('BE_SAGA_CONSUMER_DEDUPE: a consumer of a saga feature that never reads the delivery id is refused; one that passes it on passes', () => {
  const findings = saga('BE_SAGA_CONSUMER_DEDUPE', { [CONSUMER]: 'export class InvoiceRejectedConsumer {\n  handle(): string { return "x" }\n}\n' });
  assert.deepEqual(findings.map((f) => f.path), [CONSUMER]);
  assert.deepEqual(saga('BE_SAGA_CONSUMER_DEDUPE'), []);
});

// ------------------------------------------------------------------------------------------------ R173 BE_SAGA_E2E_MISSING

test('BE_SAGA_E2E_MISSING: a compensation path with no e2e spec, one through the world that injects no failure, are refused', () => {
  assert.match(saga('BE_SAGA_E2E_MISSING', { [SPEC]: null })[0].message, /has no e2e spec/);
  const noFault = saga('BE_SAGA_E2E_MISSING', { [SPEC]: SPEC_TS.replace(/it\(.*\n/, "it('compensates billing.invoice-rejected', () => undefined);\n") });
  assert.match(noFault[0].message, /injects no failure/);
});

test('BE_SAGA_E2E_MISSING: an e2e spec through the world that names the compensation event and injects a failure passes', () => {
  assert.deepEqual(saga('BE_SAGA_E2E_MISSING'), []);
  assert.deepEqual(saga('BE_SAGA_E2E_MISSING', { [SPEC]: SPEC_TS.replace('.during(async () => undefined)', ".cut()") }), []);
});
