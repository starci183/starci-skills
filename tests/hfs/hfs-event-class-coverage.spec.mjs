// proves: BE_EVENT_CLASS_CONTRACT@lite
// proves: BE_EVENT_CLASS_CONTRACT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eventClassContractFindings } from '../../scripts/hfs/rules/event-bus.mjs';

const eventPath = 'be/src/modules/events/order/order-placed.event.ts';
const contractPath = 'be/contracts/order/events.json';
const eventClass = 'export class OrderPlacedEvent { static readonly eventName = "order.placed"; static readonly version = 1; }';

function eventFixture(t, edition, events) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-event-class-coverage-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const sources = {
    [eventPath]: eventClass,
    [contractPath]: JSON.stringify({ schema: 'starci/event-contract@1', service: 'order', events }),
  };
  for (const [file, content] of Object.entries(sources)) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { repoRoot, files: Object.keys(sources), repo: { edition, sides: { be: { patterns: ['event-bus'] } } } };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} accepts an event class with the same contract name and version`, (t) => {
    const fixture = eventFixture(t, edition, { 'order.placed': { version: 1 } });
    assert.deepEqual(eventClassContractFindings(fixture), []);
  });

  test(`${edition} rejects a typed event class missing from its vendored contract`, (t) => {
    const fixture = eventFixture(t, edition, {});
    const findings = eventClassContractFindings(fixture);
    assert.deepEqual(findings.map((finding) => finding.code), ['BE_EVENT_CLASS_CONTRACT']);
    assert.equal(findings[0].path, eventPath);
    assert.match(findings[0].message, /does not list/);
  });

  test(`${edition} rejects a contract version that differs from its typed event class`, (t) => {
    const fixture = eventFixture(t, edition, { 'order.placed': { version: 2 } });
    const findings = eventClassContractFindings(fixture);
    assert.deepEqual(findings.map((finding) => finding.code), ['BE_EVENT_CLASS_CONTRACT']);
    assert.match(findings[0].message, /version 1 but .* version 2/);
  });
}
