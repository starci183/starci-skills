// proves: BE_CONTRACT_BREAKING@lite
// proves: BE_CONTRACT_BREAKING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contractCompatFindings } from '../runtime/scripts/hfs/rules/contract-compat.mjs';

const publishedEvent = {
  stream: 'order-events',
  version: 1,
  payload: { orderId: 'string', totalCents: 'number', note: 'string?' },
};
const contract = (events) => ({ schema: 'starci/event-contract@1', service: 'order', events });
const pinned = contract({ 'order.placed': publishedEvent });

function repository(t, edition, current) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-contract-coverage-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const members = {
    'hfs.json': { kind: 'app', edition, sides: { be: { dir: 'be' } } },
    'be/contracts/order/events.pin.json': pinned,
    'be/contracts/order/events.json': current,
  };
  for (const [file, contents] of Object.entries(members)) {
    const destination = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(contents));
  }
  return { repoRoot, files: Object.keys(members) };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} BE_CONTRACT_BREAKING rejects removing a published payload field`, (t) => {
    const current = contract({
      'order.placed': { ...publishedEvent, payload: { orderId: 'string', note: 'string?' } },
    });
    const findings = contractCompatFindings(repository(t, edition, current));
    assert.deepEqual(findings.map((finding) => finding.code), ['BE_CONTRACT_BREAKING']);
    assert.equal(findings[0].path, 'be/contracts/order/events.json');
    assert.match(findings[0].message, /lost payload field totalCents/);
  });

  test(`${edition} BE_CONTRACT_BREAKING rejects adding a required payload field`, (t) => {
    const current = contract({
      'order.placed': { ...publishedEvent, payload: { ...publishedEvent.payload, currency: 'string' } },
    });
    const findings = contractCompatFindings(repository(t, edition, current));
    assert.deepEqual(findings.map((finding) => finding.code), ['BE_CONTRACT_BREAKING']);
    assert.match(findings[0].message, /gained required payload field currency/);
  });

  test(`${edition} BE_CONTRACT_BREAKING accepts additive fields and a new version beside the old event`, (t) => {
    const current = contract({
      'order.placed': { ...publishedEvent, payload: { ...publishedEvent.payload, currency: 'string?' } },
      'order.placed.v2': { stream: 'order-events', version: 2, payload: { orderId: 'string', total: 'number' } },
    });
    assert.deepEqual(contractCompatFindings(repository(t, edition, current)), []);
    assert.deepEqual(contractCompatFindings(repository(t, edition, pinned)), []);
  });
}
