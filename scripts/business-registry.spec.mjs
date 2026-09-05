import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REGISTRY_FILE, applyHeadPublication, archiveObject, archivedHashOf, boundSourceHeads, businessesRootOf, canonicalize, contentAddress, objectRelPath, openStore, planHeadPublication, selfFingerprint, verifyHeadPublication } from './business-registry.mjs';

const FEATURE = 'paid-access';
const SOURCE = 'c'.repeat(40);
const posix = (p) => p.split(path.sep).join('/');
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const fingerprinted = (doc, field) => ({ ...doc, [field]: selfFingerprint(doc, field) });

const CLAIMS = fingerprinted({
  featureId: FEATURE, sourceHead: SOURCE,
  claims: [
    { claimId: 'c-fact', kind: 'fact', sourceHead: SOURCE },
    { claimId: 'c-intent', kind: 'intent', sourceHead: null },
    { claimId: 'c-moved', kind: 'fact', sourceHead: 'd'.repeat(40) },
  ],
}, 'fingerprint');

function root() {
  const dir = posix(path.join(mkdtempSync(path.join(tmpdir(), 'business-registry-')), '.worktrees', 'businesses'));
  mkdirSync(path.join(dir, 'objects', 'sha256'), { recursive: true });
  writeFileSync(path.join(dir, REGISTRY_FILE), JSON.stringify({ schemaVersion: 1, project: 'p', hashAlgorithm: 'sha256', canonicalization: 'RFC8785-JCS', featureHeads: {}, objects: { immutable: true, byHash: {} } }, null, 2));
  return dir;
}
const modelAt = (dir, over = {}) => fingerprinted({
  featureId: FEATURE, mode: 'reconcile', headRef: `${dir}/features/${FEATURE}`, state: 'implemented',
  promise: { statement: 's', actorStatement: 'a', eligibilityStatement: 'e' },
  lineage: { previousHeadRef: null, previousState: 'in-progress', transition: 'in-progress->implemented' },
  claimsFingerprint: CLAIMS.fingerprint, coverageFingerprint: `sha256:${'b'.repeat(64)}`,
  reconciliation: { deliveredEvidenceRefs: ['src/a.ts'], discrepancies: [] }, ...over,
}, 'headFingerprint');

test('canonicalization is RFC 8785: members sorted by code unit, no insignificant whitespace', () => {
  assert.equal(canonicalize({ b: 1, a: 2, A: 3 }), '{"A":3,"a":2,"b":1}');
  assert.equal(canonicalize({ z: [1, { y: null, x: true }], '': '' }), '{"":"","z":[1,{"x":true,"y":null}]}');
  assert.equal(canonicalize(-0), '0');
  assert.throws(() => canonicalize({ a: undefined }), /has no canonical form/);
  assert.throws(() => canonicalize(Number.POSITIVE_INFINITY), /has no canonical form/);
});

test('a document has two addresses and they are never the same number', () => {
  const document = fingerprinted({ featureId: FEATURE, state: 'implemented' }, 'headFingerprint');
  const address = contentAddress(document);
  assert.equal(address, sha(canonicalize(document)));
  assert.equal(document.headFingerprint, `sha256:${sha(canonicalize({ featureId: FEATURE, state: 'implemented' }))}`);
  assert.notEqual(`sha256:${address}`, document.headFingerprint);
  // Formatting is not identity: the same document indented differently has the same address.
  assert.equal(contentAddress(JSON.parse(JSON.stringify(document))), address);
});

test('a head reference resolves its businesses root, and only under one', () => {
  assert.equal(businessesRootOf('/x/.worktrees/businesses/features/paid-access'), '/x/.worktrees/businesses');
  assert.equal(businessesRootOf('/x/.worktrees/businesses/features/starci/paid-access'), '/x/.worktrees/businesses');
  assert.equal(businessesRootOf('/x/.worktrees/authority/features/paid-access'), null);
  assert.equal(businessesRootOf('/x/.worktrees/businesses/paid-access'), null);
  assert.equal(archivedHashOf(`/x/.worktrees/businesses/${objectRelPath('a'.repeat(64))}`), 'a'.repeat(64));
  assert.equal(archivedHashOf('/x/sessions/s/step-5/parallel-1/response/data/model.json'), null);
});

test('an archived object hashes to its own filename and is written once', () => {
  const dir = root();
  const store = openStore(dir);
  const document = modelAt(dir);
  const first = archiveObject(store, document);
  assert.equal(first.created, true);
  assert.equal(path.basename(first.file), `${contentAddress(document)}.json`);
  assert.equal(contentAddress(JSON.parse(readFileSync(first.file, 'utf8'))), first.hash);
  const again = archiveObject(openStore(dir), document);
  assert.equal(again.created, false);
  assert.equal(again.hash, first.hash);
  rmSync(dir, { recursive: true, force: true });
});

test('the index entry carries the head, the state, the lineage and the delivered sources the claims bind', () => {
  assert.deepEqual(boundSourceHeads(CLAIMS), [SOURCE, 'd'.repeat(40)]);
  const dir = root();
  const first = modelAt(dir, { state: 'in-progress', lineage: { previousHeadRef: null, previousState: null, transition: 'absent->pending' } });
  applyHeadPublication(openStore(dir), planHeadPublication({ store: openStore(dir), featureId: FEATURE, model: first, claims: CLAIMS, coverage: { featureId: FEATURE, rows: [] } }));
  const firstEntry = openStore(dir).entry(FEATURE);
  assert.equal(firstEntry.head, contentAddress(first));
  assert.equal(firstEntry.baseHead, firstEntry.head, 'a first publication is its own base');
  assert.equal(firstEntry.previousHead, null);
  assert.deepEqual(firstEntry.sources, [{ role: 'be', head: SOURCE }, { role: 'be', head: 'd'.repeat(40) }]);

  const second = modelAt(dir, { lineage: { previousHeadRef: `${dir}/${objectRelPath(firstEntry.head)}`, previousState: 'in-progress', transition: 'in-progress->implemented' } });
  const plan = planHeadPublication({ store: openStore(dir), featureId: FEATURE, model: second, claims: CLAIMS, sources: [{ role: 'be', head: SOURCE }] });
  assert.equal(plan.entry.baseHead, firstEntry.baseHead, 'the base head does not move when a head is republished');
  assert.equal(plan.entry.previousHead, firstEntry.head);
  assert.equal(plan.entry.authorityStatus, 'implemented');
  assert.equal(plan.entry.coverageHead, firstEntry.coverageHead, 'a reconciliation freezes no matrix and carries the one it compared against');
  assert.equal(plan.entry.sources[1].role, 'be', 'a head the caller named no role for keeps the default');
  applyHeadPublication(openStore(dir), plan);
  const registry = JSON.parse(readFileSync(path.join(dir, REGISTRY_FILE), 'utf8'));
  assert.equal(registry.featureHeads[FEATURE].head, contentAddress(second));
  assert.ok(registry.objects.byHash[contentAddress(second)], 'the object map registers every object the publication archived');
  assert.deepEqual(verifyHeadPublication({ store: openStore(dir), featureId: FEATURE, model: second, claims: CLAIMS }), []);
  rmSync(dir, { recursive: true, force: true });
});

test('a plan changes nothing until it is applied, and a dry apply changes nothing at all', () => {
  const dir = root();
  const before = readFileSync(path.join(dir, REGISTRY_FILE), 'utf8');
  const model = modelAt(dir);
  const plan = planHeadPublication({ store: openStore(dir), featureId: FEATURE, model, claims: CLAIMS });
  assert.equal(readFileSync(path.join(dir, REGISTRY_FILE), 'utf8'), before);
  const { registry } = applyHeadPublication(openStore(dir), plan, { dryRun: true });
  assert.equal(readFileSync(path.join(dir, REGISTRY_FILE), 'utf8'), before);
  assert.equal(openStore(dir).hasObject(plan.entry.head), false);
  assert.equal(registry.featureHeads[FEATURE].head, contentAddress(model), 'a dry apply still says what it would have written');
  rmSync(dir, { recursive: true, force: true });
});

test('verification refuses every way a head can be published to one place only', () => {
  const dir = root();
  const store = () => openStore(dir);
  const seed = modelAt(dir, { state: 'in-progress', lineage: { previousHeadRef: null, previousState: null, transition: 'absent->pending' } });
  applyHeadPublication(store(), planHeadPublication({ store: store(), featureId: FEATURE, model: seed, claims: CLAIMS }));
  const seeded = store().entry(FEATURE).head;
  const model = modelAt(dir, { lineage: { previousHeadRef: `${dir}/${objectRelPath(seeded)}`, previousState: 'in-progress', transition: 'in-progress->implemented' } });
  const verify = () => verifyHeadPublication({ store: store(), featureId: FEATURE, model, claims: CLAIMS });
  const only = (needle) => assert.ok(verify().some((e) => e.includes(needle)), `expected ${needle}, got:\n${verify().join('\n') || '(none)'}`);

  only('the index still names the head this one replaced');
  applyHeadPublication(store(), planHeadPublication({ store: store(), featureId: FEATURE, model, claims: CLAIMS }));
  assert.deepEqual(verify(), []);

  const registryFile = path.join(dir, REGISTRY_FILE);
  const registry = JSON.parse(readFileSync(registryFile, 'utf8'));
  const rewrite = (mutate) => { const copy = JSON.parse(JSON.stringify(registry)); mutate(copy); writeFileSync(registryFile, JSON.stringify(copy, null, 2)); };

  rewrite((r) => { r.featureHeads[FEATURE].authorityStatus = 'in-progress'; });
  only('.authorityStatus is in-progress, the published head is implemented');
  rewrite((r) => { r.featureHeads[FEATURE].sources = [{ role: 'be', head: 'f'.repeat(40) }]; });
  only('which no fact claim of claims.json binds');
  only('the index under-names the delivery');
  rewrite((r) => { r.featureHeads[FEATURE].previousHead = 'a'.repeat(64); });
  only('.previousHead is');
  rewrite((r) => { delete r.featureHeads[FEATURE]; });
  only('the index names no head for the feature');
  rewrite(() => {});
  assert.deepEqual(verify(), []);

  writeFileSync(store().objectFile(contentAddress(model)), JSON.stringify({ not: 'the head' }));
  only('the archived object hashes to');
  rmSync(store().objectFile(contentAddress(model)), { force: true });
  only('is archived under no object');

  // The recovery case: the head being replaced was never archived, so the chain is restored by
  // archiving it from the feature directory as it stood, and verification passes again.
  archiveObject(store(), model);
  rmSync(store().objectFile(seeded), { force: true });
  only('names an object the store does not hold');
  assert.equal(archiveObject(store(), seed).created, true);
  assert.deepEqual(verify(), []);

  const strayLineage = modelAt(dir, { lineage: { previousHeadRef: '/x/sessions/s/step-5/parallel-1/response/data/model.json', previousState: 'in-progress', transition: 'in-progress->implemented' } });
  assert.ok(verifyHeadPublication({ store: store(), featureId: FEATURE, model: strayLineage, claims: CLAIMS }).some((e) => e.includes('is not an archived object under objects/sha256')));
  const wrongFingerprint = { ...model, headFingerprint: `sha256:${'e'.repeat(64)}` };
  assert.ok(verifyHeadPublication({ store: store(), featureId: FEATURE, model: wrongFingerprint, claims: CLAIMS }).some((e) => e.includes("is not this document's fingerprint")));
  rmSync(registryFile, { force: true });
  only('no head index under');
  rmSync(dir, { recursive: true, force: true });
});
