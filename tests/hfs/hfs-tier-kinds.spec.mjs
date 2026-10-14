import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { HfsSlotsError, loadSlotManifest, openHfs } from '../../scripts/hfs/slots.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const schema = parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/hfs-slots.schema.yaml'), 'utf8'));
const loaded = createRequire(import.meta.url)('ajv/dist/2020.js');
const Ajv2020 = loaded.default ?? loaded;
const validate = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(schema);
const manifest = loadSlotManifest();
const copy = () => JSON.parse(JSON.stringify(manifest));
const declaration = {
  hfs: 3, kind: 'app', project: 'fixture',
  sides: { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
};
const refusal = doc => assert.throws(() => loadSlotManifest({ text: JSON.stringify(doc) }), error => error instanceof HfsSlotsError && error.code === 'HFS_MANIFEST_INVALID');

test('tier source/target-kind restrictions validate in the schema and loader', () => {
  // The loader adds version components; the source manifest is the schema document.
  const doc = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8'));
  assert.equal(validate(doc), true, JSON.stringify(validate.errors));
  assert.deepEqual(manifest.tiers.fe.feature.mayImportKinds, { feature: { from: ['pages', 'layouts'], to: ['overlays'] } });
});

test('pages and layouts may host overlays while the other feature edges and component imports remain forbidden', () => {
  const hfs = openHfs({ declaration, side: 'fe', manifest });
  const entry = (kind, name) => `apps/web/src/features/${kind}/${name}/index.tsx`;
  const cases = [
    [entry('pages', 'Home'), entry('overlays', 'Confirm'), true],
    [entry('layouts', 'Shell'), entry('overlays', 'Confirm'), true],
    [entry('layouts', 'Shell'), entry('pages', 'Home'), false],
    [entry('overlays', 'Confirm'), entry('overlays', 'Other'), false],
    ['apps/web/src/components/branches/OverlayHost/index.tsx', entry('overlays', 'Confirm'), false],
  ];
  for (const [from, to, allowed] of cases) {
    const result = hfs.importAllowed(from, to);
    assert.equal(result.allowed, allowed, `${from} -> ${to}`);
    if (!allowed) assert.equal(result.reason, 'tierDirection');
  }
});

test('schema and loader refuse malformed source/target-kind restrictions', () => {
  const pairs = [[], {}, { from: ['pages'] }, { from: [], to: ['overlays'] }, { from: ['pages'], to: ['overlays', 'overlays'] }, { from: ['bad kind'], to: ['overlays'] }, { from: ['pages'], to: ['bad kind'] }, { from: ['pages'], to: ['overlays'], extra: [] }];
  const restrictions = [{}, [], { BadTier: { from: ['pages'], to: ['overlays'] } }, ...pairs.map(pair => ({ feature: pair }))];
  for (const restriction of restrictions) {
    const doc = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8'));
    doc.tiers.fe.feature.mayImportKinds = restriction;
    assert.equal(validate(doc), false, JSON.stringify(restriction));
    refusal(doc);
  }
});

test('the loader refuses restrictions of an unpermitted tier or an undeclared source/target kind', () => {
  const pair = { from: ['pages'], to: ['overlays'] };
  for (const restriction of [{ ghost: pair }, { route: pair }, { feature: { ...pair, from: ['ghost'] } }, { feature: { ...pair, to: ['ghost'] } }]) {
    const doc = copy();
    delete doc.major; delete doc.minor; delete doc.patch;
    doc.tiers.fe.feature.mayImportKinds = restriction;
    refusal(doc);
  }
});

test('the resolver reads both source and target kinds from the manifest and preserves the same-owner exemption', () => {
  const doc = copy();
  delete doc.major; delete doc.minor; delete doc.patch;
  doc.tiers.fe.feature.mayImportKinds.feature = { from: ['layouts'], to: ['pages'] };
  const hfs = openHfs({ declaration, side: 'fe', manifest: loadSlotManifest({ text: JSON.stringify(doc) }) });
  const from = 'apps/web/src/features/layouts/Shell/index.tsx';
  assert.equal(hfs.importAllowed(from, 'apps/web/src/features/pages/Other/index.tsx').allowed, true);
  const overlay = hfs.importAllowed(from, 'apps/web/src/features/overlays/Confirm/index.tsx');
  assert.equal(overlay.allowed, false);
  assert.equal(overlay.reason, 'tierDirection');
  assert.deepEqual(overlay.kindRestriction, { from: ['layouts'], to: ['pages'] });
  assert.equal(overlay.fromKind, 'layouts');
  assert.equal(overlay.toKind, 'overlays');
  const page = hfs.importAllowed('apps/web/src/features/pages/Home/index.tsx', 'apps/web/src/features/pages/Other/index.tsx');
  assert.equal(page.allowed, false);
  assert.equal(page.reason, 'tierDirection');
  assert.equal(page.fromKind, 'pages');
  assert.equal(hfs.importAllowed(from, 'apps/web/src/features/layouts/Shell/component.tsx').reason, 'sameOwner');
  assert.equal(hfs.importAllowed(from, 'apps/web/src/components/providers/Theme/index.tsx').allowed, false);
});
