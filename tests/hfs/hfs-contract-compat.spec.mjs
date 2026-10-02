import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { breakingChanges, contractCompatFindings, CONTRACT_BREAKING } from '../../scripts/hfs/rules/contract-compat.mjs';

// R157 BE_CONTRACT_BREAKING: an event contract evolves only additively against its pinned previous copy.

const contract = (events) => ({ schema: 'starci/event-contract@1', service: 'order', events });
const PLACED = { stream: 'order-events', version: 1, payload: { eventId: 'string', orderId: 'string', totalCents: 'number', note: 'string?' } };

function repo(t, { pin, current }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-contract-compat-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (rel, value) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), `${JSON.stringify(value, null, 2)}\n`); };
  const files = [];
  if (pin) { write('be/contracts/order/events.pin.json', pin); files.push('be/contracts/order/events.pin.json'); }
  if (current) { write('be/contracts/order/events.json', current); files.push('be/contracts/order/events.json'); }
  return { root, files };
}
const run = (t, spec) => { const { root, files } = repo(t, spec); return contractCompatFindings({ repoRoot: root, files }); };

test('BE_CONTRACT_BREAKING: a removed event or field, a changed type, version, stream or optionality, and a new required field are breaking', (t) => {
  const pin = contract({ 'order.placed': PLACED, 'order.cancelled': { stream: 'order-events', version: 1, payload: { orderId: 'string' } } });
  const cases = {
    'removed event': [contract({ 'order.placed': PLACED }), /event order\.cancelled was removed/],
    'removed field': [contract({ 'order.placed': { ...PLACED, payload: { eventId: 'string', orderId: 'string', note: 'string?' } }, 'order.cancelled': pin.events['order.cancelled'] }), /lost payload field totalCents/],
    'changed type': [contract({ 'order.placed': { ...PLACED, payload: { ...PLACED.payload, totalCents: 'string' } }, 'order.cancelled': pin.events['order.cancelled'] }), /changed payload field totalCents from number to string/],
    'optional to required': [contract({ 'order.placed': { ...PLACED, payload: { ...PLACED.payload, note: 'string' } }, 'order.cancelled': pin.events['order.cancelled'] }), /changed payload field note from optional to required/],
    'required to optional': [contract({ 'order.placed': { ...PLACED, payload: { ...PLACED.payload, totalCents: 'number?' } }, 'order.cancelled': pin.events['order.cancelled'] }), /changed payload field totalCents from required to optional/],
    'version bumped in place': [contract({ 'order.placed': { ...PLACED, version: 2 }, 'order.cancelled': pin.events['order.cancelled'] }), /changed its version from 1 to 2.*Add order\.placed\.v2/],
    'stream moved': [contract({ 'order.placed': { ...PLACED, stream: 'orders' }, 'order.cancelled': pin.events['order.cancelled'] }), /changed its stream/],
    'new required field': [contract({ 'order.placed': { ...PLACED, payload: { ...PLACED.payload, currency: 'string' } }, 'order.cancelled': pin.events['order.cancelled'] }), /gained required payload field currency/],
  };
  for (const [name, [current, message]] of Object.entries(cases)) {
    const found = run(t, { pin, current });
    assert.equal(found.length, 1, `${name}: ${JSON.stringify(found)}`);
    assert.equal(found[0].code, CONTRACT_BREAKING);
    assert.equal(found[0].level, 'error');
    assert.equal(found[0].path, 'be/contracts/order/events.json');
    assert.match(found[0].message, message, name);
  }
  assert.equal(breakingChanges(pin, contract({})).length, 2);
});

test('BE_CONTRACT_BREAKING: new events, new optional fields, a .v2 event next to the old one and an unpinned service pass', (t) => {
  const pin = contract({ 'order.placed': PLACED });
  const additive = contract({
    'order.placed': { ...PLACED, payload: { ...PLACED.payload, currency: 'string?', tags: 'string[]?' } },
    'order.placed.v2': { stream: 'order-events', version: 2, payload: { eventId: 'string', orderId: 'string', total: 'number' } },
    'order.shipped': { stream: 'order-events', version: 1, payload: { orderId: 'string' } },
  });
  assert.deepEqual(run(t, { pin, current: additive }), []);
  assert.deepEqual(run(t, { pin, current: pin }), [], 'an identical contract is compatible');
  assert.deepEqual(run(t, { current: contract({ 'order.placed': PLACED }) }), [], 'a service with no pin is not judged');
  assert.deepEqual(breakingChanges(pin, additive), []);
});

test('BE_CONTRACT_BREAKING: a pin whose events.json is gone, and an unreadable pin, are findings', (t) => {
  const gone = run(t, { pin: contract({ 'order.placed': PLACED }) });
  assert.equal(gone.length, 1);
  assert.match(gone[0].message, /is missing or unreadable while be\/contracts\/order\/events\.pin\.json pins the contract of service order/);
  const broken = run(t, { pin: { not: 'a contract' }, current: contract({}) });
  assert.equal(broken.length, 1);
  assert.match(broken[0].message, /not a readable event contract/);
});
