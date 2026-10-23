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
// R01, the slot ownership of every tracked path, as the app check (scripts/hfs/check.mjs, the bundled copy) judges it: it refuses a path no slot owns, a
// path two slots own equally, a path of an opt-in slot nobody declared, a tracked path of a forbidden slot and a tracked path of an ignored slot, and
// accepts the owned path, in lite and in full. The ambiguous path needs a manifest with a gap: the shipped manifest has none (the loader refuses two
// slots that claim the same pattern text, but not two patterns that differ only in the name of a variable), so that case loads the shipped manifest plus
// two such slots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';
import { loadSlotManifest } from '../runtime/scripts/hfs/slots.mjs';
import { APP } from './helpers/hfs-cli-fixture.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..', 'runtime');
const APP_MANIFEST = loadSlotManifest({ root: RUNTIME });

/** The shipped manifest plus two slots, copies of `app.build-output`, whose patterns `twin/<left>/` and `twin/<right>/` own the same paths at the same specificity. */
function manifestWithGap() {
  const doc = parseYaml(fs.readFileSync(path.join(RUNTIME, 'knowledge', 'hfs', 'slots.yaml'), 'utf8'));
  const template = doc.slots.find((slot) => slot.id === 'app.build-output');
  doc.slots.push({ ...template, id: 'app.build-output.left', path: 'twin/<left>/' }, { ...template, id: 'app.build-output.right', path: 'twin/<right>/' });
  return loadSlotManifest({ text: JSON.stringify(doc) });
}
const APP_GAP = manifestWithGap();

const REPO_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-slot-ownership-'));
test.after(() => fs.rmSync(REPO_ROOT, { recursive: true, force: true }));

/** The findings of the app check over the tracked `files` (no disk tree), for an app of `edition` declared as `declaration`. */
const appFindings = (edition, files, manifest = APP_MANIFEST, declaration = APP) => checkRepo({ repoRoot: REPO_ROOT, root: RUNTIME, manifest, declaration: { ...structuredClone(declaration), edition }, files, tree: false }).findings;
const withCode = (findings, code) => findings.filter((finding) => finding.code === code).map((finding) => finding.path);

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

  test(`${edition}: app check accepts the delivery scripts of the app root and refuses an unowned file beside them`, () => {
    assert.deepEqual(withCode(appFindings(edition, ['scripts/env-sync.mjs', 'scripts/with-secrets.mjs']), 'HFS_SLOT_UNDECLARED'), []);
    assert.deepEqual(withCode(appFindings(edition, ['scripts/notes/unowned.txt']), 'HFS_SLOT_UNDECLARED'), ['scripts/notes/unowned.txt']);
  });

  test(`${edition}: app check refuses a tracked path of an ignored slot and accepts a tracked one`, () => {
    assert.deepEqual(withCode(appFindings(edition, ['coverage/a.json']), 'HFS_TRACKED_MUST_BE_IGNORED'), ['coverage/a.json']);
    assert.deepEqual(withCode(appFindings(edition, ['README.md']), 'HFS_TRACKED_MUST_BE_IGNORED'), []);
  });
}
