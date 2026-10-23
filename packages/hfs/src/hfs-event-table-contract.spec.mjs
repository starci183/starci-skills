// proves: HFS_EVENT_CONTRACT@lite HFS_EVENT_CONTRACT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serviceFindings } from '../runtime/scripts/hfs/rules/services.mjs';

const PROVIDER = 'be/apps/core/src/events.ts';
const CONSUMER = 'be/apps/billing/src/consumes.ts';
const SNAPSHOT = 'be/contracts/core/events.json';
const events = { 'order.placed': { version: 1, payload: { orderId: 'string' } } };
const clean = {
  [PROVIDER]: `export const EVENTS = ${JSON.stringify(events)} as const;`,
  [CONSUMER]: 'export const CONSUMES = { core: { "order.placed": 1 } } as const;',
  [SNAPSHOT]: JSON.stringify({ schema: 'starci/event-contract@1', service: 'core', events }),
};

function check(edition, override = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-event-table-'));
  const sources = Object.entries({ ...clean, ...override }).filter(([, text]) => text !== null);
  try {
    for (const [file, text] of sources) {
      const target = path.join(repoRoot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    return serviceFindings({ repoRoot, files: sources.map(([file]) => file), repo: { edition } })
      .filter((finding) => finding.code === 'HFS_EVENT_CONTRACT');
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

for (const edition of ['lite', 'full']) {
  test(`${edition} HFS_EVENT_CONTRACT passes matching literal tables and snapshot`, () => {
    assert.deepEqual(check(edition), []);
  });
  test(`${edition} HFS_EVENT_CONTRACT refuses missing, stale and invalid snapshots`, () => {
    for (const snapshot of [null, '{}', '{broken']) {
      assert.ok(check(edition, { [SNAPSHOT]: snapshot }).some((finding) => finding.code === 'HFS_EVENT_CONTRACT'));
    }
  });
  test(`${edition} HFS_EVENT_CONTRACT refuses unknown providers, events and versions`, () => {
    for (const table of ['{ missing: { "order.placed": 1 } }', '{ core: { "order.unknown": 1 } }', '{ core: { "order.placed": 99 } }']) {
      assert.ok(check(edition, { [CONSUMER]: `export const CONSUMES = ${table} as const;` }).some((finding) => finding.code === 'HFS_EVENT_CONTRACT'));
    }
  });
  test(`${edition} HFS_EVENT_CONTRACT refuses nonliteral tables and unknown compensation`, () => {
    for (const file of [PROVIDER, CONSUMER]) {
      const name = file === PROVIDER ? 'EVENTS' : 'CONSUMES';
      assert.ok(check(edition, { [file]: `export const ${name} = dynamic();` }).some((finding) => finding.code === 'HFS_EVENT_CONTRACT'));
    }
    const compensating = { 'order.cancelled': { version: 1, payload: {}, compensates: 'order.unknown' } };
    assert.ok(check(edition, {
      [PROVIDER]: `export const EVENTS = ${JSON.stringify(compensating)} as const;`,
      [SNAPSHOT]: JSON.stringify({ schema: 'starci/event-contract@1', service: 'core', events: compensating }),
      [CONSUMER]: null,
    }).some((finding) => finding.code === 'HFS_EVENT_CONTRACT'));
  });
}
