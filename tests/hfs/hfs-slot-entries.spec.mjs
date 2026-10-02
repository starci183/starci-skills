import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { APP_KIND, slotProblems } from '../../scripts/hfs/manifest-shape.mjs';
import { loadSlotManifest, openHfs } from '../../scripts/hfs/slots.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const Ajv2020 = (() => { const loaded = require('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const validateSlotsSchema = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/hfs-slots.schema.yaml'), 'utf8')));
const RAW = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge/hfs/slots.yaml'), 'utf8'));
const MANIFEST = loadSlotManifest();
const SCOPE = { appScope: 'app', scopes: ['app', 'be', 'fe'] };
const problems = (slot) => slotProblems(slot, 0, APP_KIND, SCOPE).join('\n');
const slot = (id) => MANIFEST.slots.find((candidate) => candidate.id === id);
const schemaAccepts = (id, patch) => {
  const manifest = structuredClone(RAW);
  Object.assign(manifest.slots.find((candidate) => candidate.id === id), patch);
  return validateSlotsSchema(manifest);
};

test('the manifest declares the db owner client entry and the Outcome homes as data, and both the shape check and the schema accept them', () => {
  assert.deepEqual(slot('fe.modules.db').entries, ['browser.ts']);
  assert.deepEqual(MANIFEST.slots.filter((candidate) => candidate.outcomeHome).map((candidate) => candidate.id).sort(), ['fe.db.outcome', 'fe.package.api.outcome', 'fe.transport.outcome']);
  assert.equal(validateSlotsSchema(RAW), true, JSON.stringify(validateSlotsSchema.errors));
  for (const id of ['fe.modules.db', 'fe.db.outcome', 'fe.transport.outcome', 'fe.package.api.outcome']) assert.deepEqual(slotProblems(slot(id), 0, APP_KIND, SCOPE), [], id);
});

test('the lite db outcome slot owns modules/db/outcome.ts under lite only; under full that file is plain db owner content', () => {
  const connection = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' };
  const declaration = (edition) => ({ hfs: 2, kind: 'app', project: 'demo', ...(edition ? { edition } : {}), sides: { be: { apps: [{ name: 'core', kind: 'api' }], connections: [connection] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });
  const file = 'fe/apps/web/src/modules/db/outcome.ts';
  const lite = openHfs({ declaration: declaration('lite') }).classifyPath(file);
  assert.deepEqual([lite.status, lite.slot], ['owned', 'fe.db.outcome']);
  const full = openHfs({ declaration: declaration() }).classifyPath(file);
  assert.deepEqual([full.status, full.slot], ['owned', 'fe.modules.db']);
  assert.equal(openHfs({ declaration: declaration('lite') }).classifyPath('fe/apps/web/src/modules/db/browser.ts').slot, 'fe.modules.db');
});

test('entries: a malformed list, an owner slot, a file slot and a name the slot does not allow are shape problems', () => {
  const db = slot('fe.modules.db');
  assert.match(problems({ ...db, entries: [] }), /entries must be a non-empty list of unique relative file paths/);
  assert.match(problems({ ...db, entries: ['browser.ts', 'browser.ts'] }), /unique relative file paths/);
  assert.match(problems({ ...db, entries: ['../outside.ts'] }), /unique relative file paths/);
  assert.match(problems({ ...db, entries: ['/browser.ts'] }), /unique relative file paths/);
  assert.match(problems({ ...db, entries: 'browser.ts' }), /unique relative file paths/);
  assert.match(problems({ ...db, entries: ['elsewhere.ts'] }), /every entry must be one of the names the slot allows/);
  assert.match(problems({ ...slot('fe.modules'), entries: ['browser.ts'] }), /entries belong to a directory slot that is not an owner/);
  assert.match(problems({ ...slot('fe.transport.client'), entries: ['client.ts'] }), /entries belong to a directory slot that is not an owner/);
  assert.equal(schemaAccepts('fe.modules.db', { entries: [] }), false);
  assert.equal(schemaAccepts('fe.modules.db', { entries: ['browser.ts', 'browser.ts'] }), false);
  assert.equal(schemaAccepts('fe.modules.db', { entries: 'browser.ts' }), false);
});

test('outcomeHome: true on a file slot only; false, a directory slot and a stray value are refused', () => {
  const outcome = slot('fe.transport.outcome');
  assert.match(problems({ ...outcome, outcomeHome: false }), /outcomeHome is true and belongs to a file slot/);
  assert.match(problems({ ...slot('fe.modules.db'), outcomeHome: true }), /outcomeHome is true and belongs to a file slot/);
  assert.match(problems({ ...outcome, outcomeHome: 'yes' }), /outcomeHome is true and belongs to a file slot/);
  assert.equal(schemaAccepts('fe.transport.outcome', { outcomeHome: false }), false);
  assert.equal(schemaAccepts('fe.transport.outcome', { outcomeHome: 'yes' }), false);
});

test('importAllowed: a slot-declared entry of an owner is a public entry, any other file of the owner is not', () => {
  const connection = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' };
  const declaration = { hfs: 2, kind: 'app', project: 'demo', edition: 'lite', sides: { be: { apps: [{ name: 'core', kind: 'api' }], connections: [connection] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const hfs = openHfs({ declaration });
  const hook = 'fe/apps/web/src/hooks/orders/useOrders.ts';
  assert.deepEqual(hfs.importAllowed(hook, 'fe/apps/web/src/modules/db/browser.ts').reason, 'allowed');
  assert.equal(hfs.importAllowed(hook, 'fe/apps/web/src/modules/db/index.ts').reason, 'allowed');
  assert.equal(hfs.importAllowed(hook, 'fe/apps/web/src/modules/db/principal.ts').reason, 'notPublicEntry');
  assert.equal(hfs.importAllowed(hook, 'fe/apps/web/src/modules/config/browser.ts').reason, 'notPublicEntry', 'the entry belongs to the db owner only');
  assert.equal(hfs.importAllowed('fe/apps/web/src/modules/db/principal.ts', 'fe/apps/web/src/modules/db/browser.ts').reason, 'sameOwner');
});
