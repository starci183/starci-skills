// The declared-pattern tree checks (scripts/hfs/rules/event-bus.mjs): R136 BE_EVENT_CLASS_CONTRACT (a typed event class equals its entry
// in the vendored contract) and R140 BE_PATTERN_SPEC_MISSING (a declared pattern has its proof scenarios on the test world).
// Fixtures are built from a temp directory; each violating case changes one fact of the passing base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eventClassContractFindings, patternSpecFindings, stemOfEvent } from '../../scripts/hfs/rules/event-bus.mjs';

const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const EVENT = (name, version, extra = '') => `export class PlacedEvent {\n  static readonly eventName = ${JSON.stringify(name)};\n  static readonly version = ${version};\n${extra}}\n`;
const CONTRACT = (events) => `${JSON.stringify({ schema: 'starci/event-contract@1', service: 'order', events }, null, 2)}\n`;
const BASE = {
  'be/src/modules/events/order/order-placed.event.ts': EVENT('order.placed', 1),
  'be/contracts/order/events.json': CONTRACT({ 'order.placed': { version: 1 } }),
};
const DECLARED = { sides: { be: { patterns: ['event-bus'] } } };

/** A temp repo holding `files` (path to text); returns its root and the tracked file list. */
const repoOf = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-event-bus-'));
  made.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return { repoRoot: dir, files: Object.keys(files) };
};
const eventFindings = (files, repo = DECLARED) => eventClassContractFindings({ ...repoOf(files), repo });
const messages = (findings) => findings.map((f) => f.message).join('\n');

test('BE_EVENT_CLASS_CONTRACT: a class that equals its contract entry, and a contract that has its class, are clean', () => {
  assert.deepEqual(eventFindings(BASE), []);
  assert.deepEqual(eventFindings({ ...BASE, 'be/src/modules/events/order/order-v2.event.ts': EVENT('order.v2', 2), 'be/contracts/order/events.json': CONTRACT({ 'order.placed': { version: 1 }, 'order.v2': { version: 2 } }) }), []);
  assert.deepEqual(eventFindings({}, { sides: { be: {} } }), [], 'a repo that does not declare the pattern is never judged');
  assert.deepEqual(eventFindings({ 'be/src/modules/events/order/order-placed.event.ts': 'broken' }, { sides: { be: {} } }), []);
});

test('BE_EVENT_CLASS_CONTRACT: an unlisted event, a version mismatch, an orphan contract entry and a misnamed file are each a finding', () => {
  const unlisted = eventFindings({ ...BASE, 'be/contracts/order/events.json': CONTRACT({}) });
  assert.equal(unlisted.length, 1);
  assert.equal(unlisted[0].code, 'BE_EVENT_CLASS_CONTRACT');
  assert.match(unlisted[0].message, /does not list/);
  const noContract = eventFindings({ 'be/src/modules/events/order/order-placed.event.ts': EVENT('order.placed', 1) });
  assert.match(messages(noContract), /not tracked/);
  const mismatch = eventFindings({ ...BASE, 'be/contracts/order/events.json': CONTRACT({ 'order.placed': { version: 2 } }) });
  assert.match(messages(mismatch), /version 1 but .* version 2/);
  const orphan = eventFindings({ ...BASE, 'be/contracts/order/events.json': CONTRACT({ 'order.placed': { version: 1 }, 'order.shipped': { version: 1 } }) });
  assert.equal(orphan.length, 1);
  assert.match(orphan[0].message, /order-shipped\.event\.ts/);
  const misnamed = eventFindings({ ...BASE, 'be/src/modules/events/order/placed.event.ts': EVENT('order.placed', 1), 'be/src/modules/events/order/order-placed.event.ts': EVENT('order.placed', 1) });
  assert.match(messages(misnamed), /is `order-placed\.event\.ts`/);
});

test('BE_EVENT_CLASS_CONTRACT: a class without both literals, or two classes in a file, is a finding', () => {
  const dynamic = eventFindings({ ...BASE, 'be/src/modules/events/order/order-placed.event.ts': 'const N = "order.placed";\nexport class PlacedEvent {\n  static readonly eventName = N;\n  static readonly version = 1;\n}\n' });
  assert.match(messages(dynamic), /exactly one event class/);
  const two = eventFindings({ ...BASE, 'be/src/modules/events/order/order-placed.event.ts': `${EVENT('order.placed', 1)}${EVENT('order.other', 1)}` });
  assert.match(messages(two), /2 candidates/);
  assert.equal(stemOfEvent('order.placed'), 'order-placed');
});

const SCENARIOS = { 'event-bus': ['atomic-with-transaction', 'redelivery-then-dead-letter'], queue: ['scheduler-fires-once'] };
const specOf = (...titles) => `describe('flow', () => {\n${titles.map((t) => `  it(${JSON.stringify(t)}, () => {});\n`).join('')}});\n`;
const specFindings = (files, patterns, scenarios = SCENARIOS) => patternSpecFindings({ ...repoOf(files), repo: { sides: { be: { patterns } } }, scenarios });

test('BE_PATTERN_SPEC_MISSING: every scenario of a declared pattern has a titled e2e or integration test', () => {
  const files = { 'be/src/tests/e2e/checkout/place-order.e2e-spec.ts': specOf('event-bus/atomic-with-transaction: the row commits with the order', 'event-bus/redelivery-then-dead-letter: three failures bury it') };
  assert.deepEqual(specFindings(files, ['event-bus']), []);
  assert.deepEqual(specFindings({}, []), [], 'no declared pattern, nothing required');
  assert.deepEqual(specFindings({}, ['saga']), [], 'a pattern with no scenario table asks nothing here');
  const split = { 'be/src/tests/e2e/a/a.e2e-spec.ts': specOf('event-bus/atomic-with-transaction: x'), 'be/src/tests/integration/b/b.integration-spec.ts': specOf('event-bus/redelivery-then-dead-letter: y') };
  assert.deepEqual(specFindings(split, ['event-bus']), []);
});

test('BE_PATTERN_SPEC_MISSING: a missing scenario, a title without its prefix and a spec outside the test folders are findings', () => {
  const partial = specFindings({ 'be/src/tests/e2e/a/a.e2e-spec.ts': specOf('event-bus/atomic-with-transaction: x') }, ['event-bus']);
  assert.equal(partial.length, 1);
  assert.equal(partial[0].code, 'BE_PATTERN_SPEC_MISSING');
  assert.equal(partial[0].scenario, 'event-bus/redelivery-then-dead-letter');
  const untitled = specFindings({ 'be/src/tests/e2e/a/a.e2e-spec.ts': specOf('atomic with transaction', 'redelivery-then-dead-letter') }, ['event-bus']);
  assert.equal(untitled.length, 2);
  const misplaced = specFindings({ 'be/src/modules/domain/a/a.service.spec.ts': specOf('event-bus/atomic-with-transaction: x', 'event-bus/redelivery-then-dead-letter: y') }, ['event-bus']);
  assert.equal(misplaced.length, 2, 'a unit spec is not proof on the test world');
  const two = specFindings({}, ['event-bus', 'queue']);
  assert.equal(two.length, 3);
});
