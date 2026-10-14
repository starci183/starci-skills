import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
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

test('the manifest declares GraphQLResponse homes and explicit operation and server auth entries', () => {
  // fe.modules.api names its operation files as entries: a hook imports its one operation file directly (FE-API-GRAPHQL)
  assert.deepEqual(MANIFEST.slots.filter((candidate) => candidate.entries).map((candidate) => candidate.id), ['fe.modules.api', 'fe.modules.auth']);
  assert.deepEqual(MANIFEST.slots.filter((candidate) => candidate.outcomeHome).map((candidate) => candidate.id).sort(byCodeUnit), ['fe.package.api.outcome', 'fe.transport.outcome']);
  assert.equal(validateSlotsSchema(RAW), true, JSON.stringify(validateSlotsSchema.errors));
  for (const id of ['fe.transport.outcome', 'fe.package.api.outcome', 'fe.modules.api', 'fe.modules.auth', 'fe.modules.toast']) assert.deepEqual(slotProblems(slot(id), 0, APP_KIND, SCOPE), [], id);
});

test('modules/api/graphql/types.ts is the one GraphQLResponse home of an app in both editions', () => {
  const connection = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' };
  const declaration = (edition) => ({ hfs: 3, kind: 'app', project: 'demo', ...(edition ? { edition } : {}), sides: { be: { apps: [{ name: 'core', kind: 'api' }], connections: [connection] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });
  for (const edition of [undefined, 'lite']) {
    const found = openHfs({ declaration: declaration(edition) }).classifyPath('fe/apps/web/src/modules/api/graphql/types.ts');
    assert.deepEqual([found.status, found.slot], ['owned', 'fe.transport.outcome'], edition ?? 'full');
  }
});

test('entries: directories may declare public API files; malformed lists, file slots and disallowed names are refused', () => {
  const api = slot('fe.modules.api');
  assert.deepEqual(slotProblems({ ...api, entries: ['rest/index.ts'] }, 0, APP_KIND, SCOPE), [], 'an allowed file of a non-owner directory slot may be a second entry of the owner that holds it');
  assert.match(problems({ ...api, entries: [] }), /entries must be a non-empty list of unique relative file paths/);
  assert.match(problems({ ...api, entries: ['rest/index.ts', 'rest/index.ts'] }), /unique relative file paths/);
  assert.match(problems({ ...api, entries: ['../outside.ts'] }), /unique relative file paths/);
  assert.match(problems({ ...api, entries: ['/rest/index.ts'] }), /unique relative file paths/);
  assert.match(problems({ ...api, entries: 'rest/index.ts' }), /unique relative file paths/);
  assert.match(problems({ ...api, entries: ['elsewhere.ts'] }), /every entry must be one of the names the slot allows/);
  assert.deepEqual(slotProblems({ ...slot('fe.modules.toast'), entries: ['api.ts'] }, 0, APP_KIND, SCOPE), [], 'an owner may explicitly publish an additional API');
  assert.match(problems({ ...slot('fe.transport.outcome'), entries: ['types.ts'] }), /entries belong to a directory slot/);
  assert.equal(schemaAccepts('fe.modules.api', { entries: [] }), false);
  assert.equal(schemaAccepts('fe.modules.api', { entries: ['rest/index.ts', 'rest/index.ts'] }), false);
  assert.equal(schemaAccepts('fe.modules.api', { entries: 'rest/index.ts' }), false);
});

test('outcomeHome: true on a file slot only; false, a directory slot and a stray value are refused', () => {
  const outcome = slot('fe.transport.outcome');
  assert.match(problems({ ...outcome, outcomeHome: false }), /outcomeHome is true and belongs to a file slot/);
  assert.match(problems({ ...slot('fe.modules.api'), outcomeHome: true }), /outcomeHome is true and belongs to a file slot/);
  assert.match(problems({ ...outcome, outcomeHome: 'yes' }), /outcomeHome is true and belongs to a file slot/);
  assert.equal(schemaAccepts('fe.transport.outcome', { outcomeHome: false }), false);
  assert.equal(schemaAccepts('fe.transport.outcome', { outcomeHome: 'yes' }), false);
});

test('importAllowed: a slot-declared entry of an owner is a public entry, any other file of the owner is not', () => {
  const raw = structuredClone(RAW);
  raw.slots.find((candidate) => candidate.id === 'fe.modules.api').entries = ['rest/index.ts'];
  const manifest = loadSlotManifest({ text: JSON.stringify(raw) });
  const declaration = { hfs: 3, kind: 'app', project: 'demo', sides: { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const hfs = openHfs({ declaration, manifest });
  const hook = 'fe/apps/web/src/hooks/swr/api/graphql/queries/useQueryOrdersSwr.ts';
  assert.equal(hfs.importAllowed(hook, 'fe/apps/web/src/modules/api/rest/index.ts').reason, 'allowed');
  assert.equal(hfs.importAllowed(hook, 'fe/apps/web/src/modules/api/index.ts').reason, 'allowed');
  assert.equal(hfs.importAllowed(hook, 'fe/apps/web/src/modules/api/rest/uploads/presign.ts').reason, 'notPublicEntry');
  assert.equal(hfs.importAllowed(hook, 'fe/apps/web/src/modules/config/rest/index.ts').reason, 'notPublicEntry', 'the entry belongs to the api owner only');
  assert.equal(hfs.importAllowed('fe/apps/web/src/modules/api/rest/uploads/presign.ts', 'fe/apps/web/src/modules/api/rest/index.ts').reason, 'sameOwner');
});

test('an auth callback may call the explicit server auth entry in both editions, while other auth internals stay private', () => {
  for (const edition of ['full', 'lite']) {
    const declaration = { hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'core', kind: 'api' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }] }, fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.route.callback'] } } };
    const hfs = openHfs({ declaration });
    const callback = 'fe/apps/web/src/app/auth/callback/route.ts';
    assert.equal(hfs.importAllowed(callback, 'fe/apps/web/src/modules/auth/server.ts').allowed, true, edition);
    assert.equal(hfs.ownerOf('fe/apps/web/src/modules/auth/server.ts').slot, 'fe.modules.auth', edition);
    assert.equal(hfs.importAllowed(callback, 'fe/apps/web/src/modules/auth/client.ts').reason, 'notPublicEntry', edition);
  }
});
