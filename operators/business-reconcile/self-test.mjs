// Proves validate.mjs on a synthetic session branch: one reconciliation against delivered source that
// republishes the head as implemented, one that stops on a standing discrepancy and publishes nothing,
// one blocked on a head that cannot be reconciled, and one mutation per law, each of which must fail
// with a line that names the defect.
//
// The businesses root is real here rather than a string: every lawful branch archives its head under
// the content address the index names, through the same scripts/business-registry.mjs the operator
// writes with, so publishing and verifying are proved against each other and a head written to a
// feature directory alone is refused the way it now is in the tree.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateReconcileStep } from './validate.mjs';
import { REGISTRY_FILE, applyHeadPublication, archiveObject, contentAddress, objectRef, objectRelPath, openStore, planHeadPublication, selfFingerprint } from '../../scripts/business-registry.mjs';

const OPERATOR = 'business.reconcile';
const head = 'c'.repeat(40);
const FEATURE = 'paid-access';
const DELIVERED = 'step-1/parallel-2/response/response.md';
const DIMENSIONS = ['actor-eligibility', 'offer-entry', 'read-entry', 'purchase-side-effect', 'settlement', 'idempotency', 'entitlement-consumer', 'denial'];
const PROMISE = { statement: 'a paying learner reads every course in the plan', actorStatement: 'a learner with a settled purchase', eligibilityStatement: 'the purchase settled and has not expired' };
const EMPTY_REGISTRY = { schemaVersion: 1, project: 'starci-academy', hashAlgorithm: 'sha256', canonicalization: 'RFC8785-JCS', featureHeads: {}, objects: { immutable: true, byHash: {} } };
const posix = (p) => p.split(path.sep).join('/');
const fingerprinted = (document, field) => ({ ...document, [field]: selfFingerprint(document, field) });

const COVERAGE = fingerprinted({ featureId: FEATURE, dimensions: DIMENSIONS, rows: [], discoveredConsumers: [], discoveredLifecycleBranches: [] }, 'fingerprint');
const coverageFingerprint = COVERAGE.fingerprint;

const CLAIMS = [
  { claimId: 'c-fact', kind: 'fact', role: 'the guard the delivered source enforces the promise with', path: 'src/entitlement/guard.ts', lineStart: 10, lineEnd: 24, sourceHead: head },
  { claimId: 'c-settle', kind: 'fact', role: 'the settlement the delivered webhook writes', path: 'src/settlement/webhook.ts', lineStart: 3, lineEnd: 40, sourceHead: head },
];
const claimsDoc = (overrides = {}) => fingerprinted({ featureId: FEATURE, sourceHead: head, claims: CLAIMS, ...overrides }, 'fingerprint');

// One businesses root with the head this branch is about to replace already archived and indexed, the
// way business.decide left it.
function businesses({ previousState = 'in-progress' } = {}) {
  const root = posix(path.join(mkdtempSync(path.join(tmpdir(), 'reconcile-businesses-')), '.worktrees', 'businesses'));
  mkdirSync(path.join(root, 'objects', 'sha256'), { recursive: true });
  mkdirSync(path.join(root, 'features', FEATURE), { recursive: true });
  writeFileSync(path.join(root, REGISTRY_FILE), JSON.stringify(EMPTY_REGISTRY, null, 2));
  const store = openStore(root);
  const previous = fingerprinted({
    featureId: FEATURE, mode: 'model', headRef: `${root}/features/${FEATURE}`, state: previousState, promise: PROMISE,
    lineage: { previousHeadRef: null, previousState: null, transition: 'absent->pending' },
    claimsFingerprint: `sha256:${'0'.repeat(64)}`, coverageFingerprint, reconciliation: null,
  }, 'headFingerprint');
  const coverage = archiveObject(store, COVERAGE);
  const archived = archiveObject(store, previous);
  const registry = JSON.parse(JSON.stringify(EMPTY_REGISTRY));
  registry.objects.byHash[archived.hash] = { hash: archived.hash, path: objectRelPath(archived.hash) };
  registry.objects.byHash[coverage.hash] = { hash: coverage.hash, path: objectRelPath(coverage.hash) };
  registry.featureHeads[FEATURE] = { featureId: FEATURE, head: archived.hash, authorityStatus: previousState, baseHead: archived.hash, previousHead: null, sources: [], claimsHead: null, coverageHead: coverage.hash };
  writeFileSync(path.join(root, REGISTRY_FILE), JSON.stringify(registry, null, 2));
  return { root, headRef: `${root}/features/${FEATURE}`, previousRef: archived.ref, previousHash: archived.hash };
}

function modelDoc({ root, previousRef, state = 'implemented', transition = 'in-progress->implemented', previousState = 'in-progress', headRef, mode = 'reconcile', coverage = coverageFingerprint, claimsFp, reconciliation = { deliveredEvidenceRefs: ['src/entitlement/guard.ts', 'src/settlement/webhook.ts'], discrepancies: [] }, previousHeadRef, headFingerprint } = {}) {
  const model = {
    featureId: FEATURE, mode, headRef: headRef ?? `${root}/features/${FEATURE}`, state, promise: PROMISE,
    lineage: { previousHeadRef: previousHeadRef === undefined ? previousRef : previousHeadRef, previousState, transition },
    claimsFingerprint: claimsFp, coverageFingerprint: coverage, reconciliation,
  };
  return { ...model, headFingerprint: headFingerprint ?? selfFingerprint(model, 'headFingerprint') };
}

// The publication the operator's step 5 performs: the object, the index entry and the object map, in
// one call, from the documents the branch wrote.
function publishHead(root, model, claims) {
  const store = openStore(root);
  applyHeadPublication(store, planHeadPublication({ store, featureId: FEATURE, model, claims, coverage: COVERAGE }));
}

function responseMd({ state = 'implemented', transition = 'in-progress->implemented', previousHead, previousArchived = 'before this branch', previousState = 'in-progress', coverage = coverageFingerprint, claimsFp, headRef, headObject, delivered = DELIVERED, feature = FEATURE, rows = DIMENSIONS.map((d) => [d, '`src/entitlement/guard.ts`', '—']), findings = [], claims = [['c-fact', 'fact'], ['c-settle', 'fact']] } = {}) {
  const claimRows = claims.map(([id, kind]) => `| \`${id}\` | ${kind} | what ${id} observes | \`src/entitlement/guard.ts\` | 10-24 | ${kind === 'fact' ? `\`${head}\`` : '—'} |`).join('\n');
  const reconciliationRows = rows.map(([dimension, evidence, discrepancy]) => `| \`${dimension}\` | ${evidence} | ${discrepancy} |`).join('\n');
  const findingRows = findings.map(([code, severity, dimension, statement]) => `| \`${code}\` | ${severity} | \`${dimension}\` | ${statement} |`).join('\n');
  return `# business-reconciliation — ${feature}

The published promise compared, dimension by dimension, against the source the backend run delivered.

## Binding

| Field | Value |
| --- | --- |
| Feature | \`${feature}\` |
| Target state | ${state} |
| Head | \`${headRef}\` |
| Claims fingerprint | \`${claimsFp}\` |
| Coverage fingerprint | \`${coverage}\` |
| Delivered source | \`${delivered}\` |

## Lineage

| Field | Value |
| --- | --- |
| Previous head | \`${previousHead}\` |
| Previous head archived | ${previousArchived} |
| Previous state | ${previousState} |
| Transition | ${transition} |
| Head object | \`${headObject}\` |

## Cited claims

| Claim | Kind | Role | Source | Lines | Head |
| --- | --- | --- | --- | --- | --- |
${claimRows}

## Reconciliation

| Dimension | Delivered evidence | Discrepancy |
| --- | --- | --- |
${reconciliationRows}

## Findings

| Code | Severity | Dimension | Statement |
| --- | --- | --- | --- |
${findingRows}${findingRows ? '\n' : ''}`;
}
const requestJson = ({ targetState = 'implemented', inputs = { 'backend-source-application': DELIVERED }, extra = {}, contexts } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: contexts ?? [{ alias: '@workspaces/be', head }, { alias: `@worktrees/businesses/${FEATURE}`, head: null }],
  requirements: { featureId: FEATURE, targetState, approval: null, resume: null, ...extra },
  inputs, resume: null,
});
const ALL_FIELDS = { 'business-reconciliation': 'response/response.md', claims: 'response/data/claims.json', model: 'response/data/model.json' };
const responseJson = ({ status = 'done', stop, fields = null, next = ['git.publish'] } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [],
  fields: fields ?? (status === 'done' ? ALL_FIELDS : {}), commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'reconcile-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  mkdirSync(path.join(session, 'step-1', 'parallel-2', 'response'), { recursive: true });
  writeFileSync(path.join(session, DELIVERED), '# backend-source-application — delivered source\n');
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateReconcileStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateReconcileStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

// One branch: a businesses root of its own, the head published into it, and the three files that say
// so. `store` runs after the publication, so a test can put the index or the object store back into
// the state a defect leaves them in.
function reconciled({ previousState = 'in-progress', targetState = 'implemented', model: modelOver = {}, claims: claimsOver = {}, md: mdOver = {}, request: requestOver = {}, response: responseOver = null, publish = true, store = null, files = {} } = {}) {
  const b = businesses({ previousState });
  const claims = claimsDoc(claimsOver);
  const model = modelDoc({ root: b.root, previousRef: b.previousRef, previousState, claimsFp: claims.fingerprint, ...modelOver });
  if (publish) publishHead(b.root, model, claims);
  if (store) store(openStore(b.root), { model, claims, ...b });
  return {
    'request/request.json': requestJson({ targetState, ...requestOver }),
    'response/response.json': responseOver ?? responseJson(),
    'response/response.md': responseMd({
      state: model.state, transition: model.lineage.transition, previousState, previousHead: model.lineage.previousHeadRef,
      claimsFp: model.claimsFingerprint, coverage: model.coverageFingerprint, headRef: model.headRef,
      headObject: objectRef(b.root, contentAddress(model)), ...mdOver,
    }),
    'response/data/claims.json': claims,
    'response/data/model.json': model,
    ...files,
  };
}
const DISCREPANT_ROWS = DIMENSIONS.map((d) => [d, '`src/entitlement/guard.ts`', d === 'settlement' ? 'the webhook still writes the legacy row' : '—']);
function discrepant({ md: mdOver = {}, response: responseOver = null, files = {} } = {}) {
  const b = businesses();
  const claims = claimsDoc();
  const model = modelDoc({ root: b.root, previousRef: b.previousRef, claimsFp: claims.fingerprint });
  return {
    'request/request.json': requestJson(),
    'response/response.json': responseOver ?? responseJson({ status: 'blocked', stop: 'RECONCILIATION_DISCREPANCY', fields: { 'business-reconciliation': 'response/response.md', claims: 'response/data/claims.json' }, next: [] }),
    'response/response.md': responseMd({ rows: DISCREPANT_ROWS, previousHead: model.lineage.previousHeadRef, claimsFp: claims.fingerprint, headRef: model.headRef, headObject: objectRef(b.root, contentAddress(model)), ...mdOver }),
    'response/data/claims.json': claims,
    ...files,
    ...(files['response/data/model.json'] === '<model>' ? { 'response/data/model.json': model } : {}),
  };
}

await expectValid(reconciled(), 'a head reconciled against delivered source and republished as implemented');
await expectValid(reconciled({ previousState: 'implemented', targetState: 'in-progress', model: { state: 'in-progress', transition: 'implemented->in-progress' } }), 'an implemented head republished as in-progress after a delivery narrowed it');
await expectValid(discrepant(), 'a standing discrepancy stops the branch and publishes no head');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'HEAD_NOT_RECONCILABLE', next: [] }) }, 'a feature with no published head handed back to the person');
// A rebinding: the delivered source moved after the head was implemented; the head is republished implemented with no discrepancy.
await expectValid(reconciled({ previousState: 'implemented', model: { transition: 'implemented->implemented' } }), 'an implemented head reconciled again at a moved delivery');

// The request gate: delivered source is bound, and business.decide's fields are not here.
await expectError(reconciled({ request: { inputs: {} } }), 'required input backend-source-application is absent', 'a reconciliation with no delivered source');
await expectError(reconciled({ request: { extra: { mode: 'reconcile' } } }), 'requirements.mode is not a field', 'the retired mode field');
await expectError(reconciled({ request: { extra: { promise: 'a paying learner reads every course' } } }), 'requirements.promise is not a field', 'a promise supplied to a reconciliation');
await expectError(reconciled({ targetState: 'rejected' }), 'is not one a reconciliation publishes', 'a reconciliation asked to reject');
await expectError(reconciled({ request: { contexts: [{ alias: '@workspaces/be', head }, { alias: `@worktrees/businesses/${FEATURE}`, head: null }, { alias: '@workspaces/fe', head: null }] } }), 'is covered by no Context row', 'an isolated agent handed an alias its Context table never declared');
await expectError(reconciled({ response: { ...responseJson(), stop: 'RECONCILIATION_DISCREPANCY' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(reconciled({ response: responseJson({ status: 'blocked', stop: 'COVERAGE_INCOMPLETE', next: [] }) }), 'not a registered code business.reconcile may emit', 'a modelling stop on a reconciliation');
await expectError(reconciled({ response: responseJson({ fields: { ...ALL_FIELDS, 'coverage-matrix': 'response/data/coverage-matrix.json' } }) }), 'is not an Output of business.reconcile', 'a reconciliation that froze a matrix');

// The head, the model and the lineage.
await expectError(reconciled({ model: { mode: 'model' } }), 'is not reconcile', 'a model that claims to have modelled');
await expectError(reconciled({ model: { headRef: `.worktrees/businesses/features/starci/${FEATURE}` } }), 'no project segment below the businesses root', 'a project segment below the businesses root');
await expectError(reconciled({ model: { headRef: `.worktrees/authority/features/${FEATURE}` } }), 'is not under a .worktrees/businesses root', 'head outside the businesses root');
await expectError(reconciled({ model: { transition: 'pending->in-progress' } }), 'contradicts previous state in-progress', 'transition contradicts the previous state');
await expectError(reconciled({ targetState: 'in-progress', model: { transition: 'absent->pending', previousHeadRef: null, previousState: null, state: 'pending' } }), 'republishes an existing head', 'a first publication by a reconciliation');
await expectError(reconciled({ model: { coverage: null } }), 'carries the coverage fingerprint of the matrix it was compared against', 'a reconciled head with no matrix behind it');
await expectError(reconciled({ model: { reconciliation: null } }), 'carries the reconciliation it performed', 'a reconciliation that recorded none');
await expectError(reconciled({ model: { reconciliation: { deliveredEvidenceRefs: ['src/settlement.ts'], discrepancies: [{ dimension: 'settlement', statement: 'the webhook still writes the legacy row' }] } } }), 'discrepancy or discrepancies remain', 'a head published with a discrepancy');
await expectError(reconciled({ model: { claimsFp: `sha256:${'e'.repeat(64)}` } }), 'claimsFingerprint must equal the frozen claims fingerprint', 'a head naming another claims fingerprint');
await expectError(reconciled({ response: responseJson({ fields: { 'business-reconciliation': 'response/response.md', claims: 'response/data/claims.json' } }) }), 'a done reconciliation republishes the head', 'a done branch that published nothing');
await expectError(discrepant({ response: responseJson({ status: 'blocked', stop: 'RECONCILIATION_DISCREPANCY', fields: { ...ALL_FIELDS }, next: [] }), files: { 'response/data/model.json': '<model>' } }), 'a blocked branch cannot publish a head', 'a discrepancy that published anyway');

// The head is published, not merely written: the object, the index entry and the lineage chain.
await expectError(reconciled({ publish: false }), 'is archived under no object', 'a head written to the feature directory and archived nowhere');
await expectError(reconciled({ store: (store, { previousHash }) => { const r = store.registry; r.featureHeads[FEATURE].head = previousHash; writeFileSync(store.registryFile, JSON.stringify(r, null, 2)); } }), 'the index still names the head this one replaced', 'a head whose index entry was never advanced');
await expectError(reconciled({ store: (store) => { const r = store.registry; r.featureHeads[FEATURE].authorityStatus = 'in-progress'; writeFileSync(store.registryFile, JSON.stringify(r, null, 2)); } }), '.authorityStatus is in-progress, the published head is implemented', 'an index that names the head with the state it left behind');
await expectError(reconciled({ store: (store, { model }) => writeFileSync(store.objectFile(contentAddress(model)), JSON.stringify({ featureId: FEATURE, mode: 'reconcile' }, null, 2)) }), 'the archived object hashes to', 'an archived object that is not the head it is filed under');
await expectError(reconciled({ model: { previousHeadRef: 'D:/sessions/20260905/step-5/parallel-1/response/data/model.json' } }), 'is not an archived object under objects/sha256', 'a lineage that names a session file instead of an object');
await expectError(reconciled({ store: (store, { previousHash }) => rmSync(store.objectFile(previousHash), { force: true }) }), 'names an object the store does not hold', 'a lineage that names an object nobody archived');
await expectError(reconciled({ store: (store) => { const r = store.registry; r.featureHeads[FEATURE].sources = [{ role: 'be', head: 'f'.repeat(40) }]; writeFileSync(store.registryFile, JSON.stringify(r, null, 2)); } }), 'which no fact claim of claims.json binds', 'an index resting the promise on a source the claims never bound');
await expectError(reconciled({ store: (store) => { const r = store.registry; r.featureHeads[FEATURE].sources = []; writeFileSync(store.registryFile, JSON.stringify(r, null, 2)); } }), 'the index under-names the delivery', 'an index naming no source at all');
await expectError(reconciled({ store: (store) => rmSync(store.registryFile, { force: true }) }), 'no head index under', 'a head published where no index exists');
await expectError(reconciled({ model: { headFingerprint: `sha256:${'d'.repeat(64)}` } }), "is not this document's fingerprint", 'a head carrying a fingerprint of some other document');
await expectError(reconciled({ md: { headObject: '.worktrees/businesses/objects/sha256/0000000000000000000000000000000000000000000000000000000000000000.json' } }), 'is not the archived object of the published head', 'a receipt naming another object as the head');
await expectError(reconciled({ md: { previousHead: '.worktrees/businesses/features/paid-access' } }), 'Previous head .worktrees/businesses/features/paid-access differs from the model', 'a receipt naming a previous head the model does not');

// The claims and the receipt.
await expectError(reconciled({ claims: { claims: [{ ...CLAIMS[0], kind: 'intent', sourceHead: null }] }, md: { claims: [['c-fact', 'intent']] } }), 'carries at least one fact claim', 'a reconciliation resting on intent alone');
await expectError(reconciled({ claims: { claims: [{ ...CLAIMS[0], sourceHead: null }, CLAIMS[1]] } }), 'must bind the observed source head', 'a fact claim with no head');
await expectError(reconciled({ claims: { claims: [CLAIMS[0], { ...CLAIMS[0], kind: 'intent' }] } }), 'is declared more than once', 'a duplicated claim');
await expectError(reconciled({ md: { claims: [['c-fact', 'fact']] } }), 'which Cited claims omits', 'a claim the receipt never cites');
await expectError(reconciled({ md: { delivered: 'step-1/parallel-9/response/response.md' } }), 'is not the backend-source-application input', 'a receipt reconciled against a source the request never bound');
await expectError(reconciled({ md: { coverage: `sha256:${'e'.repeat(64)}` } }), 'Coverage fingerprint must equal the model coverageFingerprint', 'a receipt naming another matrix');
await expectError(reconciled({ md: { rows: [...DIMENSIONS.map((d) => [d, '`src/entitlement/guard.ts`', '—']), ['denial', '`src/x.ts`', '—']] } }), 'is reconciled more than once', 'a dimension reconciled twice');
await expectError(reconciled({ md: { rows: DISCREPANT_ROWS } }), 'cannot carry the unresolved reconciliation discrepancy', 'a republished head over a standing discrepancy');
await expectError(discrepant({ md: { rows: DIMENSIONS.map((d) => [d, '`src/entitlement/guard.ts`', '—']) } }), 'names no discrepancy; a stop names what stands', 'a discrepancy stop whose receipt shows none');
await expectError(discrepant({ response: responseJson({ status: 'blocked', stop: 'RECONCILIATION_DISCREPANCY', fields: { claims: 'response/data/claims.json' }, next: [] }) }), 'carries the reconciliation that names the discrepancy', 'a discrepancy stop with no receipt');
await expectError(reconciled({ md: { findings: [['LEGACY_COEXISTENCE', 'error', 'legacy-create', 'the legacy sale path still creates rights']] } }), 'is still an open error, so the head cannot be republished', 'republished with an open error finding');
await expectError(reconciled({ md: { rows: [] } }), 'table needs at least 1 rows', 'a reconciliation with no row');
await expectError(reconciled({ files: { 'response/response.md': responseMd({ previousHead: 'x', claimsFp: 'x', headRef: 'x', headObject: 'x' }).replace('## Reconciliation', '## Comparison') } }), 'missing section ^## Reconciliation$', 'receipt section renamed');

process.stdout.write('business.reconcile self-test: 5 valid branches, 42 rejected mutations\n');
