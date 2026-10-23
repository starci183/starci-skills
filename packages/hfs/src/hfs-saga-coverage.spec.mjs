// proves: BE_SAGA_STEP_COMPENSATION@lite
// proves: BE_SAGA_STEP_COMPENSATION@full
// proves: BE_SAGA_STATE_VERSIONED@lite
// proves: BE_SAGA_STATE_VERSIONED@full
// proves: BE_SAGA_EVENT_CONTRACT@lite
// proves: BE_SAGA_EVENT_CONTRACT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sagaFindings } from '../runtime/scripts/hfs/rules/saga.mjs';

const FOLDER = 'be/src/features/saga/place/';
const STEP = `${FOLDER}steps/reserve.saga-step.ts`;
const COMPENSATION = `${FOLDER}compensations/reserve.compensation.ts`;
const ORCHESTRATOR = `${FOLDER}place.saga.service.ts`;
const STATE = `${FOLDER}place.saga-state.ts`;
const CONSUMER = `${FOLDER}transport/message/invoice-rejected.consumer.ts`;
const CONTRACT = 'be/contracts/orders/events.json';
const E2E = 'be/src/tests/e2e/orders/place.e2e-spec.ts';
const ORCHESTRATOR_TS = [
  "import { SagaService } from '../../../modules/platform/saga';",
  "import { ReserveStep } from './steps/reserve.saga-step';",
  "import { ReserveCompensation } from './compensations/reserve.compensation';",
  'export class PlaceSaga { constructor(readonly store: SagaService, readonly step: ReserveStep, readonly compensation: ReserveCompensation) {} }',
].join('\n');
const CONTRACT_EVENTS = {
  'order.placed': { version: 1, payload: {} },
  'billing.invoice-rejected': { version: 1, payload: {}, compensates: 'order.placed' },
};
const BASE_FILES = {
  [STEP]: 'export class ReserveStep { readonly event = "order.placed"; }',
  [COMPENSATION]: 'export class ReserveCompensation { readonly event = "billing.invoice-rejected"; }',
  [ORCHESTRATOR]: ORCHESTRATOR_TS,
  [STATE]: 'export interface PlaceSagaState { status: string; version: number; }',
  [CONSUMER]: 'export class InvoiceRejectedConsumer { constructor(readonly command: CancelOrder) {} handle(message: { eventId: string }) { return this.command.execute({ eventId: message.eventId }); } }',
  [CONTRACT]: JSON.stringify({ schema: 'starci/event-contract@1', service: 'orders', events: CONTRACT_EVENTS }),
};
const made = [];

function fixture(edition, overrides = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-saga-coverage-'));
  made.push(repoRoot);
  const sources = { ...BASE_FILES, ...overrides };
  if (edition === 'full') sources[E2E] = "const world = useTestWorld({ apps: ['order'] }); it('compensates billing.invoice-rejected', () => world.infra.postgresql.connection('order').cut());";
  const files = [];
  for (const [file, source] of Object.entries(sources)) {
    if (source === null) continue;
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
    files.push(file);
  }
  return { repoRoot, files, repo: { edition } };
}

test.after(() => {
  for (const repoRoot of made) fs.rmSync(repoRoot, { recursive: true, force: true });
});

for (const edition of ['lite', 'full']) {
  test(`${edition} rejects saga steps without matching compensations or a complete orchestrator`, () => {
    assert.deepEqual(sagaFindings(fixture(edition, { [COMPENSATION]: null }))
      .filter((finding) => finding.code === 'BE_SAGA_STEP_COMPENSATION').map((finding) => finding.path), [STEP]);
    assert.deepEqual(sagaFindings(fixture(edition, { [STEP]: null }))
      .filter((finding) => finding.code === 'BE_SAGA_STEP_COMPENSATION').map((finding) => finding.path), [COMPENSATION]);
    assert.deepEqual(sagaFindings(fixture(edition, { [ORCHESTRATOR]: null }))
      .filter((finding) => finding.code === 'BE_SAGA_STEP_COMPENSATION').map((finding) => finding.path), [FOLDER]);
    assert.equal(sagaFindings(fixture(edition, { [ORCHESTRATOR]: "import { SagaService } from '../../../modules/platform/saga'; export class PlaceSaga {}" }))
      .filter((finding) => finding.code === 'BE_SAGA_STEP_COMPENSATION').length, 2);
  });

  test(`${edition} accepts matching saga steps and compensations listed by their orchestrator`, () => {
    assert.deepEqual(sagaFindings(fixture(edition))
      .filter((finding) => finding.code === 'BE_SAGA_STEP_COMPENSATION'), []);
  });

  test(`${edition} rejects missing or unversioned saga state and bypassed fenced storage`, () => {
    assert.deepEqual(sagaFindings(fixture(edition, { [STATE]: null }))
      .filter((finding) => finding.code === 'BE_SAGA_STATE_VERSIONED').map((finding) => finding.path), [ORCHESTRATOR]);
    assert.deepEqual(sagaFindings(fixture(edition, { [STATE]: 'export interface PlaceSagaState { status: string; version: string; }' }))
      .filter((finding) => finding.code === 'BE_SAGA_STATE_VERSIONED').map((finding) => finding.path), [STATE]);
    assert.deepEqual(sagaFindings(fixture(edition, { [ORCHESTRATOR]: ORCHESTRATOR_TS.replace('platform/saga', 'platform/other') }))
      .filter((finding) => finding.code === 'BE_SAGA_STATE_VERSIONED').map((finding) => finding.path), [ORCHESTRATOR]);
  });

  test(`${edition} accepts typed saga state with a numeric version and the fenced platform store`, () => {
    assert.deepEqual(sagaFindings(fixture(edition))
      .filter((finding) => finding.code === 'BE_SAGA_STATE_VERSIONED'), []);
    assert.deepEqual(sagaFindings(fixture(edition, { [STATE]: 'export type PlaceSagaState = { status: string; version: number; };' }))
      .filter((finding) => finding.code === 'BE_SAGA_STATE_VERSIONED'), []);
  });

  test(`${edition} rejects missing saga event declarations and mismatched compensation contracts`, () => {
    assert.deepEqual(sagaFindings(fixture(edition, { [STEP]: 'export class ReserveStep {}' }))
      .filter((finding) => finding.code === 'BE_SAGA_EVENT_CONTRACT').map((finding) => finding.path), [STEP]);
    assert.deepEqual(sagaFindings(fixture(edition, { [STEP]: 'export class ReserveStep { readonly event = "order.unknown"; }' }))
      .filter((finding) => finding.code === 'BE_SAGA_EVENT_CONTRACT').map((finding) => finding.path), [STEP, COMPENSATION]);
    const events = { ...CONTRACT_EVENTS, 'billing.invoice-rejected': { version: 1, payload: {} } };
    assert.deepEqual(sagaFindings(fixture(edition, { [CONTRACT]: JSON.stringify({ events }) }))
      .filter((finding) => finding.code === 'BE_SAGA_EVENT_CONTRACT').map((finding) => finding.path), [COMPENSATION]);
  });

  test(`${edition} accepts declared saga events whose compensation contract names the forward event`, () => {
    assert.deepEqual(sagaFindings(fixture(edition))
      .filter((finding) => finding.code === 'BE_SAGA_EVENT_CONTRACT'), []);
  });

}
