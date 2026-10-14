import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { HfsSlotsError, loadSlotManifest, openHfs } from '../../scripts/hfs/slots.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const raw = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8'));
const schema = parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/hfs-slots.schema.yaml'), 'utf8'));
const loaded = createRequire(import.meta.url)('ajv/dist/2020.js');
const Ajv2020 = loaded.default ?? loaded;
const validate = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(schema);
const id = 'be.tests.e2e';
const reason = 'ruling:R212/case-4: lite has no e2e world; full may run flow e2e specs';

function fixture(editionWhy) {
  const doc = structuredClone(raw);
  const slot = doc.slots.find((candidate) => candidate.id === id);
  if (editionWhy === undefined) delete slot.editionWhy;
  else slot.editionWhy = editionWhy;
  return doc;
}

function resolverFor(manifest, edition) {
  return openHfs({ manifest, side: 'be', declaration: {
    hfs: 3, kind: 'app', project: 'demo', edition,
    sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
  } });
}

for (const edition of ['full', 'lite']) {
  test(`${edition}: a slot editionWhy is accepted by the schema and loader and retained by its resolver`, () => {
    const doc = fixture(reason);
    assert.equal(validate(doc), true, JSON.stringify(validate.errors));
    const manifest = loadSlotManifest({ text: JSON.stringify(doc) });
    assert.equal(manifest.slots.find((slot) => slot.id === id).editionWhy, reason);
    const slot = resolverFor(manifest, edition).slot(id);
    assert.equal(slot.editionWhy, reason);
    assert.equal(slot.presence, edition === 'lite' ? 'forbidden' : 'optional');
    assert.equal(slot.tracked, edition === 'lite' ? 'external' : 'tracked');
  });

  test(`${edition}: malformed slot editionWhy is refused by both schema and loader`, () => {
    for (const value of ['', null, 42, false, [], {}]) {
      const doc = fixture(value);
      assert.equal(validate(doc), false, `schema accepted ${JSON.stringify(value)}`);
      assert.throws(() => loadSlotManifest({ text: JSON.stringify(doc) }), (error) =>
        error instanceof HfsSlotsError && error.code === 'HFS_MANIFEST_INVALID' &&
        error.details.problems.some((problem) => problem.includes('editionWhy must be non-empty text')));
    }
  });

  test(`${edition}: existing slots remain valid without editionWhy`, () => {
    const doc = fixture();
    assert.equal(validate(doc), true, JSON.stringify(validate.errors));
    const manifest = loadSlotManifest({ text: JSON.stringify(doc) });
    assert.equal(resolverFor(manifest, edition).slot(id).editionWhy, undefined);
  });
}
