// proves: HFS_SLOT_UNDECLARED@lite
// proves: HFS_SLOT_UNDECLARED@full
// proves: HFS_SLOT_AMBIGUOUS@lite
// proves: HFS_SLOT_AMBIGUOUS@full
// proves: HFS_SLOT_NOT_ENABLED@lite
// proves: HFS_SLOT_NOT_ENABLED@full
// proves: HFS_FORBIDDEN_PRESENT@lite
// proves: HFS_FORBIDDEN_PRESENT@full
// proves: HFS_TRACKED_MUST_BE_IGNORED@lite
// proves: HFS_TRACKED_MUST_BE_IGNORED@full
// R01, the slot ownership of every tracked path: the app check (scripts/hfs/check.mjs) and the runtime check (scripts/hfs/runtime-check.mjs) refuse a path
// no slot owns, a path two slots own equally, a path of an opt-in slot nobody declared, a tracked path of a forbidden slot and a tracked path of an
// ignored slot, and accept the owned path, in lite and in full. The ambiguous path needs a manifest with a gap: the shipped manifests have none (the
// loader refuses two slots that claim the same pattern text, but not two patterns that differ only in the name of a variable), so those cases load the
// shipped manifest plus two such slots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { HFS_MANIFEST_FILE, RUNTIME_MANIFEST_FILE, loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { APP } from '../helpers/hfs-cli-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const RUNTIME_DECLARATION = { hfs: 1, kind: 'runtime', project: 'proof' };
const APP_MANIFEST = loadSlotManifest({ root: ROOT });
const RUNTIME_MANIFEST = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });

/** The shipped manifest `file` plus two slots, copies of `id`, whose patterns `twin/<left>/` and `twin/<right>/` own the same paths at the same specificity. */
function manifestWithGap(file, id) {
  const doc = parseYaml(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const template = doc.slots.find((slot) => slot.id === id);
  doc.slots.push({ ...template, id: `${id}.left`, path: 'twin/<left>/' }, { ...template, id: `${id}.right`, path: 'twin/<right>/' });
  return loadSlotManifest({ text: JSON.stringify(doc) });
}
const APP_GAP = manifestWithGap(HFS_MANIFEST_FILE, 'app.build-output');
const RUNTIME_GAP = manifestWithGap(RUNTIME_MANIFEST_FILE, 'runtime.build-output');

const appFindings = (edition, files, manifest = APP_MANIFEST, declaration = APP) => checkRepo({ repoRoot: ROOT, root: ROOT, manifest, declaration: { ...structuredClone(declaration), edition }, files, tree: false }).findings;
const withCode = (findings, code) => findings.filter((finding) => finding.code === code).map((finding) => finding.path);

/** A temporary runtime repository: only its hfs.json is read, the tracked files are passed in. */
function runtimeRepository(context) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-r01-'));
  context.after(() => {
    assert.equal(path.dirname(repoRoot), path.resolve(os.tmpdir()));
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(RUNTIME_DECLARATION));
  return repoRoot;
}
const runtimeFindings = (repoRoot, files, manifest = RUNTIME_MANIFEST) => runtimeCheck({ repoRoot, manifest, base: null, drift: [], files, tree: false }).findings;

const WEBHOOK = 'be/src/features/webhooks/sepay/transport/http/sepay.webhook.ts';
const WITH_WEBHOOKS = { ...APP, sides: { ...APP.sides, be: { ...APP.sides.be, patterns: ['webhooks'] } } };

for (const edition of ['lite', 'full']) {
  test(`${edition}: app check refuses a path no slot owns and accepts an owned path`, () => {
    assert.deepEqual(withCode(appFindings(edition, ['be/src/stray/thing.ts']), 'HFS_SLOT_UNDECLARED'), ['be/src/stray/thing.ts']);
    assert.deepEqual(withCode(appFindings(edition, ['be/src/modules/domain/stock/index.ts']), 'HFS_SLOT_UNDECLARED'), []);
  });

  test(`${edition}: app check refuses a path two slots own equally and accepts the shipped manifest`, () => {
    assert.deepEqual(withCode(appFindings(edition, ['twin/one/a.json'], APP_GAP), 'HFS_SLOT_AMBIGUOUS'), ['twin/one/a.json']);
    assert.deepEqual(withCode(appFindings(edition, ['coverage/a.json'], APP_GAP), 'HFS_SLOT_AMBIGUOUS'), []);
    assert.deepEqual(withCode(appFindings(edition, ['twin/one/a.json']), 'HFS_SLOT_AMBIGUOUS'), []);
  });

  test(`${edition}: app check refuses a path of an opt-in slot nobody declared and accepts a declared one`, () => {
    assert.deepEqual(withCode(appFindings(edition, [WEBHOOK]), 'HFS_SLOT_NOT_ENABLED'), [WEBHOOK]);
    assert.deepEqual(withCode(appFindings(edition, [WEBHOOK], APP_MANIFEST, WITH_WEBHOOKS), 'HFS_SLOT_NOT_ENABLED'), []);
  });

  test(`${edition}: app check refuses a tracked path of a forbidden slot and accepts an allowed one`, () => {
    assert.deepEqual(withCode(appFindings(edition, ['be/.sops.yaml']), 'HFS_FORBIDDEN_PRESENT'), ['be/.sops.yaml']);
    assert.deepEqual(withCode(appFindings(edition, ['.sops.yaml']), 'HFS_FORBIDDEN_PRESENT'), []);
  });

  test(`${edition}: app check refuses a tracked path of an ignored slot and accepts a tracked one`, () => {
    assert.deepEqual(withCode(appFindings(edition, ['coverage/a.json']), 'HFS_TRACKED_MUST_BE_IGNORED'), ['coverage/a.json']);
    assert.deepEqual(withCode(appFindings(edition, ['README.md']), 'HFS_TRACKED_MUST_BE_IGNORED'), []);
  });

  test(`${edition}: runtime check refuses a path no slot owns and accepts an owned path`, (context) => {
    const repoRoot = runtimeRepository(context);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['zzz/a.mjs']), 'HFS_SLOT_UNDECLARED'), ['zzz/a.mjs']);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['scripts/hfs/check.mjs']), 'HFS_SLOT_UNDECLARED'), []);
  });

  test(`${edition}: runtime check refuses a path two slots own equally and accepts the shipped manifest`, (context) => {
    const repoRoot = runtimeRepository(context);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['twin/one/a.json'], RUNTIME_GAP), 'HFS_SLOT_AMBIGUOUS'), ['twin/one/a.json']);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['scripts/hfs/check.mjs'], RUNTIME_GAP), 'HFS_SLOT_AMBIGUOUS'), []);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['twin/one/a.json']), 'HFS_SLOT_AMBIGUOUS'), []);
  });

  test(`${edition}: runtime check refuses a tracked path of a forbidden slot and accepts an allowed one`, (context) => {
    const repoRoot = runtimeRepository(context);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['tmp-x.mjs']), 'HFS_FORBIDDEN_PRESENT'), ['tmp-x.mjs']);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['scripts/hfs/check.mjs']), 'HFS_FORBIDDEN_PRESENT'), []);
  });

  test(`${edition}: runtime check refuses a tracked path of an ignored slot and accepts a tracked one`, (context) => {
    const repoRoot = runtimeRepository(context);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['config.yaml']), 'HFS_TRACKED_MUST_BE_IGNORED'), ['config.yaml']);
    assert.deepEqual(withCode(runtimeFindings(repoRoot, ['scripts/hfs/check.mjs']), 'HFS_TRACKED_MUST_BE_IGNORED'), []);
  });
}
