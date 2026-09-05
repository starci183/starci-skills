// The head index of a businesses root, in one place. A feature directory is what a reader opens; the
// index and the object store are what a reader trusts, and an operator that writes the first without
// the other two publishes a head that no other reader can find. This module owns the whole
// publication — the canonical form a document is addressed by, the object archived under that
// address, the `featureHeads` entry that names it, and the verification a validator runs over the
// three — so business.decide and business.reconcile cannot disagree about what publishing a head is.
//
// Two hashes live here and they are not the same number:
//
// - a document's **content address** is the sha256 of its canonical form exactly as it is stored,
//   its own fingerprint field included; it is the object filename and the `head`, `claimsHead` and
//   `coverageHead` the index carries, and it is what makes `objects/sha256/<hash>.json` hash to its
//   own name.
// - a document's **self-fingerprint** is the sha256 of its canonical form with its own fingerprint
//   field removed, written `sha256:<hex>`; it is what the document carries in `headFingerprint` or
//   `fingerprint`, and what a receipt correlates a matrix by.
//
// Reading one where the other is meant is how a head is published under a name the store does not
// hold, so both are computed here and nowhere else.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const REGISTRY_FILE = 'business-registry-v1.json';
export const OBJECT_SEGMENT = 'objects/sha256';
export const HASH_ALGORITHM = 'sha256';
export const CANONICALIZATION = 'RFC8785-JCS';
export const FEATURE_SEGMENT = '/features/';
const BUSINESSES_ROOT = /\.worktrees\/businesses$/;
const HEX64 = /^[0-9a-f]{64}$/;
const OBJECT_REF = /(?:^|\/)objects\/sha256\/([0-9a-f]{64})\.json$/;
const fail = (message) => { throw new Error(message); };

// RFC 8785 (JCS): object members sorted by their UTF-16 code units, no insignificant whitespace,
// ECMAScript number-to-string. An undefined member is not serialisable and neither is a non-finite
// number: a document that carries one has no canonical form and therefore no address.
export function canonicalize(value) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') {
    if (!Number.isFinite(value)) fail('a non-finite number has no canonical form');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (type === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (type === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => {
      if (value[key] === undefined) fail(`member ${key} is undefined and has no canonical form`);
      return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
    }).join(',')}}`;
  }
  return fail(`a ${type} has no canonical form`);
}

const digest = (text) => createHash(HASH_ALGORITHM).update(text, 'utf8').digest('hex');

// The address a document is archived and indexed under: the whole document as it is stored.
export const contentAddress = (document) => digest(canonicalize(document));

// The fingerprint a document carries about itself: the document without that field.
export function selfFingerprint(document, field) {
  const rest = { ...document };
  delete rest[field];
  return `${HASH_ALGORITHM}:${digest(canonicalize(rest))}`;
}

// A head is `<businesses root>/features/<featureId>`; the root is everything above `features/`.
export function businessesRootOf(headRef) {
  const text = String(headRef ?? '');
  const cut = text.lastIndexOf(FEATURE_SEGMENT);
  if (cut === -1) return null;
  const root = text.slice(0, cut);
  return BUSINESSES_ROOT.test(root) ? root : null;
}

export const objectRelPath = (hash) => `${OBJECT_SEGMENT}/${hash}.json`;
export const objectRef = (root, hash) => `${root}/${objectRelPath(hash)}`;
// The hash an object reference names, or null when the reference is not an archived object at all —
// a session file, a feature directory, a bare path.
export const archivedHashOf = (ref) => (OBJECT_REF.exec(String(ref ?? '')) ?? [])[1] ?? null;

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

// One businesses root, opened for reading. `present` is false when the root holds no index at all,
// which is itself a refusal for a branch that says it published a head there.
export function openStore(root) {
  const registryFile = path.join(root, REGISTRY_FILE);
  const registry = existsSync(registryFile) ? readJson(registryFile) : null;
  const objectFile = (hash) => path.join(root, OBJECT_SEGMENT, `${hash}.json`);
  return {
    root,
    registryFile,
    registry,
    present: registry !== null,
    entry: (featureId) => registry?.featureHeads?.[featureId] ?? null,
    hasObject: (hash) => HEX64.test(String(hash ?? '')) && existsSync(objectFile(hash)),
    readObject: (hash) => (HEX64.test(String(hash ?? '')) && existsSync(objectFile(hash)) ? readJson(objectFile(hash)) : null),
    objectFile,
  };
}

// The delivered source heads a claims document binds, in first-seen order: every distinct head a fact
// claim cites. An index entry names these and nothing else.
export function boundSourceHeads(claims) {
  const heads = [];
  for (const claim of claims?.claims ?? []) {
    if (claim?.kind !== 'fact') continue;
    const head = claim.sourceHead;
    if (typeof head === 'string' && head && !heads.includes(head)) heads.push(head);
  }
  return heads;
}

// What publishing this head writes, computed and returned rather than written, so a caller can print
// it, diff it, or apply it. `sources` is the roles a caller resolved for the bound heads: a head with
// no role named falls back to `defaultRole`, because the index names heads and the role is a label.
export function planHeadPublication({ store, featureId, model, claims, coverage = null, sources = null, defaultRole = 'be' }) {
  if (!featureId) fail('planHeadPublication needs the featureId whose head is published');
  if (!model) fail('planHeadPublication needs the model that is the head');
  if (!claims) fail('planHeadPublication needs the claims the head is frozen behind');
  const previous = store.entry(featureId);
  const head = contentAddress(model);
  const claimsHead = contentAddress(claims);
  const coverageHead = coverage ? contentAddress(coverage) : previous?.coverageHead ?? null;
  const roles = new Map(Array.isArray(sources) ? sources.map((s) => [s.head, s.role]) : []);
  const entry = {
    featureId,
    head,
    authorityStatus: model.state,
    baseHead: previous?.baseHead ?? head,
    previousHead: previous?.head ?? null,
    sources: boundSourceHeads(claims).map((h) => ({ role: roles.get(h) ?? defaultRole, head: h })),
    claimsHead,
    coverageHead,
  };
  const objects = [];
  for (const [role, document, hash] of [['model', model, head], ['claims', claims, claimsHead], ['coverage-matrix', coverage, coverageHead]]) {
    if (!document || !hash) continue;
    objects.push({ role, hash, document, path: objectRelPath(hash), ref: objectRef(store.root, hash), archived: store.hasObject(hash) });
  }
  return { featureId, entry, previous, objects, headObjectRef: objectRef(store.root, head) };
}

// Archive one document under its own address. Idempotent: an object store is immutable, so a document
// already held is left exactly as it stands and reported as such.
export function archiveObject(store, document, { dryRun = false } = {}) {
  const hash = contentAddress(document);
  const file = store.objectFile(hash);
  const archived = store.hasObject(hash);
  if (!archived && !dryRun) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  return { hash, file, ref: objectRef(store.root, hash), created: !archived };
}

// Apply a plan: archive every object it names, register each in the index's object map, and set the
// feature's head entry. One call, so a feature directory, an object and an index entry cannot land in
// three different commits.
export function applyHeadPublication(store, plan, { dryRun = false } = {}) {
  if (!store.present) fail(`${store.registryFile}: no head index to publish into`);
  const registry = JSON.parse(JSON.stringify(store.registry));
  const archived = [];
  for (const object of plan.objects) {
    archived.push(archiveObject(store, object.document, { dryRun }));
    registry.objects ??= { immutable: true, byHash: {} };
    registry.objects.byHash ??= {};
    registry.objects.byHash[object.hash] = { hash: object.hash, path: object.path };
  }
  registry.featureHeads ??= {};
  registry.featureHeads[plan.featureId] = plan.entry;
  if (!dryRun) writeFileSync(store.registryFile, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  return { registry, archived };
}

// The law a published head is read back by: the feature directory, the object store and the index say
// the same thing, and the lineage is a chain of objects rather than of session files. Every message
// names the file it refuses and the two values that disagree.
export function verifyHeadPublication({ store, featureId, model, claims }) {
  const errors = [];
  const at = `${REGISTRY_FILE}#featureHeads[${featureId}]`;
  if (!store.present) return [`${REGISTRY_FILE}: no head index under ${store.root}; a head published to a feature directory alone is a head no reader finds`];
  const head = contentAddress(model);
  const expected = selfFingerprint(model, 'headFingerprint');
  if (model.headFingerprint !== expected) errors.push(`model.json: headFingerprint ${model.headFingerprint} is not this document's fingerprint ${expected}; the fingerprint is the model without that field, and the index names the address of the model with it (${head})`);
  const entry = store.entry(featureId);
  if (!entry) errors.push(`${at}: the index names no head for the feature, so the published head ${head} is reachable only by opening the directory`);
  else {
    if (entry.head !== head) errors.push(`${at}.head is ${entry.head}, the branch published ${head}; the index still names the head this one replaced`);
    if (entry.authorityStatus !== model.state) errors.push(`${at}.authorityStatus is ${entry.authorityStatus}, the published head is ${model.state}`);
  }
  if (!store.hasObject(head)) errors.push(`${objectRelPath(head)}: the published head is archived under no object, so nothing addresses it`);
  else {
    const stored = store.readObject(head);
    const actual = stored === null ? null : contentAddress(stored);
    if (actual !== head) errors.push(`${objectRelPath(head)}: the archived object hashes to ${actual ?? 'nothing parseable'}, not the ${head} it is filed under`);
  }
  const previousRef = model.lineage?.previousHeadRef ?? null;
  const previousHash = archivedHashOf(previousRef);
  if (previousRef === null) errors.push('model.json: lineage.previousHeadRef is null; a reconciliation replaces a head and names the object it replaced');
  else if (previousHash === null) errors.push(`model.json: lineage.previousHeadRef ${previousRef} is not an archived object under ${OBJECT_SEGMENT}/<hash>.json; a lineage is a chain of objects, and a session file is gone the moment the session is`);
  else {
    if (!store.hasObject(previousHash)) errors.push(`${objectRelPath(previousHash)}: lineage.previousHeadRef names an object the store does not hold; the head it replaced is archived first, from the feature directory as it stood`);
    if (entry && entry.previousHead !== previousHash) errors.push(`${at}.previousHead is ${entry.previousHead}, the lineage replaced ${previousHash}`);
  }
  if (entry) {
    const claimsHead = contentAddress(claims);
    if (entry.claimsHead !== claimsHead) errors.push(`${at}.claimsHead is ${entry.claimsHead}, the published claims are addressed ${claimsHead}`);
    else if (!store.hasObject(claimsHead)) errors.push(`${objectRelPath(claimsHead)}: the index names these claims and the store does not hold them`);
    const bound = boundSourceHeads(claims);
    for (const source of entry.sources ?? []) {
      if (!bound.includes(source.head)) errors.push(`${at}.sources names source head ${source.head}, which no fact claim of claims.json binds; the index would rest the promise on evidence nobody read`);
    }
    for (const source of bound) {
      if (!(entry.sources ?? []).some((s) => s.head === source)) errors.push(`${at}.sources omits source head ${source}, which the claims bind; the index under-names the delivery the promise rests on`);
    }
  }
  return errors;
}

// `node scripts/business-registry.mjs plan <businesses root> <featureId> [--role <role>]`
// Prints the entry and the object filenames publishing that feature's head would write, and writes
// nothing at all: a person can publish a head by hand from this output, and a reader can see what an
// operator's step 5 is about to do before it does it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, root, featureId, ...rest] = process.argv.slice(2);
  if (command !== 'plan' || !root || !featureId) {
    process.stderr.write('usage: node scripts/business-registry.mjs plan <businesses root> <featureId> [--role <role>]\n');
    process.exit(2);
  }
  const roleAt = rest.indexOf('--role');
  const defaultRole = roleAt === -1 ? 'be' : rest[roleAt + 1];
  const dir = path.join(path.resolve(root), 'features', featureId);
  const load = (name) => { const file = path.join(dir, name); return existsSync(file) ? readJson(file) : null; };
  const model = load('model.json');
  if (!model) { process.stderr.write(`${dir}/model.json: no head to publish\n`); process.exit(2); }
  const store = openStore(path.resolve(root).split(path.sep).join('/'));
  const plan = planHeadPublication({ store, featureId, model, claims: load('claims.json'), coverage: load('coverage-matrix.json'), defaultRole });
  const lines = [
    `plan (dry, nothing written): ${featureId} in ${store.root}`,
    '',
    `${REGISTRY_FILE}#featureHeads[${featureId}]`,
    JSON.stringify(plan.entry, null, 2),
    '',
    'objects',
    ...plan.objects.map((o) => `  ${o.role.padEnd(15)} ${o.path}${o.archived ? '  (already archived)' : '  (new)'}`),
    '',
    `model headFingerprint  ${model.headFingerprint}`,
    `model computed         ${selfFingerprint(model, 'headFingerprint')}`,
    `model content address  ${plan.entry.head}`,
    `lineage previous head  ${model.lineage?.previousHeadRef ?? 'null'}`,
    `  archived object      ${archivedHashOf(model.lineage?.previousHeadRef) ?? 'none — not an objects/sha256 path'}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}
