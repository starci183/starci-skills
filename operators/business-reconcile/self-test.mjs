// Proves validate.mjs on a synthetic session branch: one reconciliation against delivered source that
// republishes the head as implemented, one that stops on a standing discrepancy and publishes nothing,
// one blocked on a head that cannot be reconciled, and one mutation per law, each of which must fail
// with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateReconcileStep } from './validate.mjs';

const OPERATOR = 'business.reconcile';
const head = 'c'.repeat(40);
const claimsFingerprint = `sha256:${'a'.repeat(64)}`;
const coverageFingerprint = `sha256:${'b'.repeat(64)}`;
const ROOT_REF = '.worktrees/businesses';
const FEATURE = 'paid-access';
const HEAD_REF = `${ROOT_REF}/features/${FEATURE}`;
const DELIVERED = 'step-1/parallel-2/response/response.md';
const DIMENSIONS = ['actor-eligibility', 'offer-entry', 'read-entry', 'purchase-side-effect', 'settlement', 'idempotency', 'entitlement-consumer', 'denial'];

const CLAIMS = [
  { claimId: 'c-fact', kind: 'fact', role: 'the guard the delivered source enforces the promise with', path: 'src/entitlement/guard.ts', lineStart: 10, lineEnd: 24, sourceHead: head },
  { claimId: 'c-settle', kind: 'fact', role: 'the settlement the delivered webhook writes', path: 'src/settlement/webhook.ts', lineStart: 3, lineEnd: 40, sourceHead: head },
];
const claimsDoc = (overrides = {}) => ({ featureId: FEATURE, sourceHead: head, fingerprint: claimsFingerprint, claims: CLAIMS, ...overrides });
function modelDoc({ state = 'implemented', transition = 'in-progress->implemented', previousHeadRef = HEAD_REF, previousState = 'in-progress', headRef = HEAD_REF, mode = 'reconcile', coverage = coverageFingerprint, claimsFp = claimsFingerprint, reconciliation = { deliveredEvidenceRefs: ['src/entitlement/guard.ts', 'src/settlement/webhook.ts'], discrepancies: [] } } = {}) {
  return {
    featureId: FEATURE, mode, headRef, headFingerprint: `sha256:${'d'.repeat(64)}`, state,
    promise: { statement: 'a paying learner reads every course in the plan', actorStatement: 'a learner with a settled purchase', eligibilityStatement: 'the purchase settled and has not expired' },
    lineage: { previousHeadRef, previousState, transition },
    claimsFingerprint: claimsFp, coverageFingerprint: coverage, reconciliation,
  };
}
function responseMd({ state = 'implemented', transition = 'in-progress->implemented', previousHead = `\`${HEAD_REF}\``, previousState = 'in-progress', coverage = coverageFingerprint, claimsFp = claimsFingerprint, headRef = HEAD_REF, delivered = DELIVERED, feature = FEATURE, rows = DIMENSIONS.map((d) => [d, '`src/entitlement/guard.ts`', '—']), findings = [], claims = [['c-fact', 'fact'], ['c-settle', 'fact']] } = {}) {
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
| Previous head | ${previousHead} |
| Previous state | ${previousState} |
| Transition | ${transition} |

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

const reconciled = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/claims.json': claimsDoc(),
  'response/data/model.json': modelDoc(),
  ...over,
});
const DISCREPANT_ROWS = DIMENSIONS.map((d) => [d, '`src/entitlement/guard.ts`', d === 'settlement' ? 'the webhook still writes the legacy row' : '—']);
const discrepant = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'RECONCILIATION_DISCREPANCY', fields: { 'business-reconciliation': 'response/response.md', claims: 'response/data/claims.json' }, next: [] }),
  'response/response.md': responseMd({ rows: DISCREPANT_ROWS }),
  'response/data/claims.json': claimsDoc(),
  ...over,
});

await expectValid(reconciled(), 'a head reconciled against delivered source and republished as implemented');
await expectValid(reconciled({ 'request/request.json': requestJson({ targetState: 'in-progress' }), 'response/response.md': responseMd({ state: 'in-progress', transition: 'implemented->in-progress', previousState: 'implemented' }), 'response/data/model.json': modelDoc({ state: 'in-progress', transition: 'implemented->in-progress', previousState: 'implemented' }) }), 'an implemented head republished as in-progress after a delivery narrowed it');
await expectValid(discrepant(), 'a standing discrepancy stops the branch and publishes no head');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'HEAD_NOT_RECONCILABLE', next: [] }) }, 'a feature with no published head handed back to the person');

// The request gate: delivered source is bound, and business.decide's fields are not here.
await expectError(reconciled({ 'request/request.json': requestJson({ inputs: {} }) }), 'required input backend-source-application is absent', 'a reconciliation with no delivered source');
await expectError(reconciled({ 'request/request.json': requestJson({ extra: { mode: 'reconcile' } }) }), 'requirements.mode is not a field', 'the retired mode field');
await expectError(reconciled({ 'request/request.json': requestJson({ extra: { promise: 'a paying learner reads every course' } }) }), 'requirements.promise is not a field', 'a promise supplied to a reconciliation');
await expectError(reconciled({ 'request/request.json': requestJson({ targetState: 'rejected' }) }), 'is not one a reconciliation publishes', 'a reconciliation asked to reject');
await expectError(reconciled({ 'request/request.json': requestJson({ contexts: [{ alias: '@workspaces/be', head }, { alias: `@worktrees/businesses/${FEATURE}`, head: null }, { alias: '@workspaces/fe', head: null }] }) }), 'is covered by no Context row', 'an isolated agent handed an alias its Context table never declared');
await expectError(reconciled({ 'response/response.json': { ...responseJson(), stop: 'RECONCILIATION_DISCREPANCY' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(reconciled({ 'response/response.json': responseJson({ status: 'blocked', stop: 'COVERAGE_INCOMPLETE', next: [] }) }), 'not a registered code business.reconcile may emit', 'a modelling stop on a reconciliation');
await expectError(reconciled({ 'response/response.json': responseJson({ fields: { ...ALL_FIELDS, 'coverage-matrix': 'response/data/coverage-matrix.json' } }) }), 'is not an Output of business.reconcile', 'a reconciliation that froze a matrix');

// The head, the model and the lineage.
await expectError(reconciled({ 'response/data/model.json': modelDoc({ mode: 'model' }) }), 'is not reconcile', 'a model that claims to have modelled');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ headRef: `${ROOT_REF}/features/starci/${FEATURE}` }) }), 'no project segment below the businesses root', 'a project segment below the businesses root');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ headRef: `.worktrees/authority/features/${FEATURE}` }) }), 'is not under a .worktrees/businesses root', 'head outside the businesses root');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ transition: 'pending->in-progress' }) }), 'contradicts previous state in-progress', 'transition contradicts the previous state');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ transition: 'absent->pending', previousHeadRef: null, previousState: null, state: 'pending' }), 'request/request.json': requestJson({ targetState: 'in-progress' }) }), 'republishes an existing head', 'a first publication by a reconciliation');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ coverage: null }) }), 'carries the coverage fingerprint of the matrix it was compared against', 'a reconciled head with no matrix behind it');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ reconciliation: null }) }), 'carries the reconciliation it performed', 'a reconciliation that recorded none');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ reconciliation: { deliveredEvidenceRefs: ['src/settlement.ts'], discrepancies: [{ dimension: 'settlement', statement: 'the webhook still writes the legacy row' }] } }) }), 'discrepancy or discrepancies remain', 'a head published with a discrepancy');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ claimsFp: `sha256:${'e'.repeat(64)}` }), 'response/response.md': responseMd({ claimsFp: `sha256:${'e'.repeat(64)}` }) }), 'claimsFingerprint must equal the frozen claims fingerprint', 'a head naming another claims fingerprint');
await expectError(reconciled({ 'response/response.json': responseJson({ fields: { 'business-reconciliation': 'response/response.md', claims: 'response/data/claims.json' } }) }), 'a done reconciliation republishes the head', 'a done branch that published nothing');
await expectError(discrepant({ 'response/response.json': responseJson({ status: 'blocked', stop: 'RECONCILIATION_DISCREPANCY', fields: { ...ALL_FIELDS }, next: [] }), 'response/data/model.json': modelDoc() }), 'a blocked branch cannot publish a head', 'a discrepancy that published anyway');

// The claims and the receipt.
await expectError(reconciled({ 'response/data/claims.json': claimsDoc({ claims: [{ ...CLAIMS[0], kind: 'intent', sourceHead: null }] }), 'response/response.md': responseMd({ claims: [['c-fact', 'intent']] }) }), 'carries at least one fact claim', 'a reconciliation resting on intent alone');
await expectError(reconciled({ 'response/data/claims.json': claimsDoc({ claims: [{ ...CLAIMS[0], sourceHead: null }, CLAIMS[1]] }) }), 'must bind the observed source head', 'a fact claim with no head');
await expectError(reconciled({ 'response/data/claims.json': claimsDoc({ claims: [CLAIMS[0], { ...CLAIMS[0], kind: 'intent' }] }) }), 'is declared more than once', 'a duplicated claim');
await expectError(reconciled({ 'response/response.md': responseMd({ claims: [['c-fact', 'fact']] }) }), 'which Cited claims omits', 'a claim the receipt never cites');
await expectError(reconciled({ 'response/response.md': responseMd({ delivered: 'step-1/parallel-9/response/response.md' }) }), 'is not the backend-source-application input', 'a receipt reconciled against a source the request never bound');
await expectError(reconciled({ 'response/response.md': responseMd({ coverage: `sha256:${'e'.repeat(64)}` }) }), 'Coverage fingerprint must equal the model coverageFingerprint', 'a receipt naming another matrix');
await expectError(reconciled({ 'response/response.md': responseMd({ rows: [...DIMENSIONS.map((d) => [d, '`src/entitlement/guard.ts`', '—']), ['denial', '`src/x.ts`', '—']] }) }), 'is reconciled more than once', 'a dimension reconciled twice');
await expectError(reconciled({ 'response/response.md': responseMd({ rows: DISCREPANT_ROWS }) }), 'cannot carry the unresolved reconciliation discrepancy', 'a republished head over a standing discrepancy');
await expectError(discrepant({ 'response/response.md': responseMd() }), 'names no discrepancy; a stop names what stands', 'a discrepancy stop whose receipt shows none');
await expectError(discrepant({ 'response/response.json': responseJson({ status: 'blocked', stop: 'RECONCILIATION_DISCREPANCY', fields: { claims: 'response/data/claims.json' }, next: [] }) }), 'carries the reconciliation that names the discrepancy', 'a discrepancy stop with no receipt');
await expectError(reconciled({ 'response/response.md': responseMd({ findings: [['LEGACY_COEXISTENCE', 'error', 'legacy-create', 'the legacy sale path still creates rights']] }) }), 'is still an open error, so the head cannot be republished', 'republished with an open error finding');
await expectError(reconciled({ 'response/response.md': responseMd({ rows: [] }) }), 'table needs at least 1 rows', 'a reconciliation with no row');
await expectError(reconciled({ 'response/response.md': responseMd().replace('## Reconciliation', '## Comparison') }), 'missing section ^## Reconciliation$', 'receipt section renamed');

process.stdout.write('business.reconcile self-test: 4 valid branches, 31 rejected mutations\n');
