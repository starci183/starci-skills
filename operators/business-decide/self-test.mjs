// Proves validate.mjs on a synthetic session branch: one conforming publication of a first head under
// mode model, one reconcile pass against delivered source, one branch blocked on a terminate code, and
// one mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateBusinessStep } from './validate.mjs';

const head = 'c'.repeat(40);
const claimsFingerprint = `sha256:${'a'.repeat(64)}`;
const coverageFingerprint = `sha256:${'b'.repeat(64)}`;
const ROOT_REF = '.worktrees/businesses';
const FEATURE = 'paid-access';
const CONSUMER = { consumerId: 'course-guard', dimension: 'entitlement-consumer', sourceRef: 'src/course/guard.ts' };
const DELIVERED = 'step-1/parallel-2/response/response.md';

const DISPOSITIONS = [
  ['actor-eligibility', 'preserve'], ['offer-entry', 'preserve'], ['read-entry', 'preserve'],
  ['purchase-side-effect', 'preserve'], ['settlement', 'preserve'], ['idempotency', 'preserve'],
  ['entitlement-consumer', 'preserve'], ['denial', 'preserve'], ['renewal', 'defer'],
  ['refund', 'not-applicable'], ['legacy-create', 'retire'], ['legacy-read', 'preserve'],
  ['legacy-settle', 'preserve'],
];
const DIMENSIONS = DISPOSITIONS.map(([d]) => d);

const proof = (name) => `tests/${name}.spec.ts`;
const row = (dimension, disposition, extra = {}) => {
  const base = { dimension, disposition, statement: `how ${dimension} is answered`, enforcementOwner: null, sourceRef: null, positiveProofRef: null, negativeProofRef: null, deferralRef: null, consumerIds: [], claimIds: [] };
  if (disposition === 'preserve' || disposition === 'replace') Object.assign(base, { enforcementOwner: 'entitlement', sourceRef: `src/${dimension}.ts`, positiveProofRef: proof(`${dimension}-granted`), negativeProofRef: proof(`${dimension}-denied`), claimIds: ['c-fact'] });
  if (disposition === 'retire') Object.assign(base, { enforcementOwner: 'entitlement', sourceRef: `src/${dimension}.ts`, positiveProofRef: proof(`${dimension}-closed`), claimIds: ['c-fact'] });
  if (disposition === 'defer') Object.assign(base, { deferralRef: `objective:${dimension}-later` });
  return { ...base, ...extra };
};
function coverageMatrix(overrides = {}) {
  return {
    featureId: FEATURE,
    fingerprint: coverageFingerprint,
    dimensions: DIMENSIONS,
    discoveredConsumers: [CONSUMER],
    discoveredLifecycleBranches: ['renewal'],
    rows: DISPOSITIONS.map(([dimension, disposition]) => row(dimension, disposition, dimension === 'entitlement-consumer' ? { consumerIds: [CONSUMER.consumerId] } : {})),
    ...overrides,
  };
}
function withRow(dimension, patch) {
  const matrix = coverageMatrix();
  matrix.rows = matrix.rows.map((r) => (r.dimension === dimension ? { ...r, ...patch } : r));
  return matrix;
}
const CLAIMS = [
  { claimId: 'c-fact', kind: 'fact', role: 'the guard that enforces the promise', path: 'src/entitlement/guard.ts', lineStart: 10, lineEnd: 24, sourceHead: head },
  { claimId: 'c-intent', kind: 'intent', role: "the owner's stated intent", path: 'docs/paid-access.md', lineStart: 3, lineEnd: 9, sourceHead: null },
];
const claimsDoc = (overrides = {}) => ({ featureId: FEATURE, sourceHead: head, fingerprint: claimsFingerprint, claims: CLAIMS, ...overrides });

function modelDoc({ mode = 'model', state = 'pending', transition = 'absent->pending', previousHeadRef = null, previousState = null, headRef = `${ROOT_REF}/features/${FEATURE}`, coverage = coverageFingerprint, reconciliation = null } = {}) {
  return {
    featureId: FEATURE, mode, headRef, headFingerprint: `sha256:${'d'.repeat(64)}`, state,
    promise: { statement: 'a paying learner reads every course in the plan', actorStatement: 'a learner with a settled purchase', eligibilityStatement: 'the purchase settled and has not expired' },
    lineage: { previousHeadRef, previousState, transition },
    claimsFingerprint, coverageFingerprint: coverage, reconciliation,
  };
}

function responseMd({ mode = 'model', state = 'pending', transition = 'absent->pending', previousHead = '—', previousState = '—', coverage = coverageFingerprint, claimsFp = claimsFingerprint, headRef = `${ROOT_REF}/features/${FEATURE}`, dispositions = DISPOSITIONS, reconciliation = [], findings = [], claims = [['c-fact', 'fact'], ['c-intent', 'intent']] } = {}) {
  const coverageRows = dispositions.map(([dimension, disposition]) => `| \`${dimension}\` | ${disposition} | how ${dimension} is answered | ${dimension === 'entitlement-consumer' ? `\`${CONSUMER.consumerId}\`` : '—'} |`).join('\n');
  const claimRows = claims.map(([id, kind]) => `| \`${id}\` | ${kind} | what ${id} observes | \`src/entitlement/guard.ts\` | 10-24 | ${kind === 'fact' ? `\`${head}\`` : '—'} |`).join('\n');
  const reconciliationRows = reconciliation.map(([dimension, delivered, discrepancy]) => `| \`${dimension}\` | ${delivered} | ${discrepancy} |`).join('\n');
  const findingRows = findings.map(([code, severity, dimension, statement]) => `| \`${code}\` | ${severity} | \`${dimension}\` | ${statement} |`).join('\n');
  return `# business-promise-authority — ${FEATURE}

The paid access promise, decided from the frozen evidence of the routed backend checkout.

## Binding

| Field | Value |
| --- | --- |
| Feature | \`${FEATURE}\` |
| Mode | ${mode} |
| Target state | ${state} |
| Head | \`${headRef}\` |
| Claims fingerprint | \`${claimsFp}\` |
| Coverage fingerprint | \`${coverage}\` |

## Promise

| Field | Value |
| --- | --- |
| Promise | a paying learner reads every course in the plan |
| Actor | a learner with a settled purchase |
| Eligibility | the purchase settled and has not expired |

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

## Coverage

| Dimension | Disposition | Statement | Consumers |
| --- | --- | --- | --- |
${coverageRows}${coverageRows ? '\n' : ''}
## Reconciliation

| Dimension | Delivered evidence | Discrepancy |
| --- | --- | --- |
${reconciliationRows}${reconciliationRows ? '\n' : ''}
## Findings

| Code | Severity | Dimension | Statement |
| --- | --- | --- | --- |
${findingRows}${findingRows ? '\n' : ''}`;
}

// `choice` turns the request into a re-entry of the blocked restatement branch 1/1 that answers
// restatement:<feature> with the given option; the branch then lives at step 2.
const requestJson = ({ mode = 'model', targetState = 'pending', inputs = {}, extra = {}, choice = null, step = choice ? 2 : 1 } = {}) => ({
  schemaVersion: 9, operatorId: 'business.decide', step, parallel: 1, sessionId: 's-test',
  ...(choice ? { decisionId: RESTATEMENT_ID, selectedOption: choice } : {}),
  contexts: [{ alias: '@workspaces/be', head }, { alias: '@worktrees/businesses/paid-access', head: null }],
  requirements: { featureId: FEATURE, mode, targetState, dimensions: DIMENSIONS, approval: null, resume: choice ? 't-1' : null, ...extra },
  inputs, resume: choice ? { step: 1, parallel: 1, token: 't-1' } : null,
});
const ALL_FIELDS = { 'business-promise-authority': 'response/response.md', claims: 'response/data/claims.json', 'coverage-matrix': 'response/data/coverage-matrix.json', model: 'response/data/model.json' };
function responseJson({ status = 'done', stop, fallbacks = [], fields = null, next = ['backend.source.apply'], step = 1 } = {}) {
  return {
    schemaVersion: 9, operatorId: 'business.decide', step, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks,
    fields: fields ?? ALL_FIELDS,
    commits: [], next,
  };
}

// `branch` places the branch under test; `state` patches state.json; `session` writes session-relative files.
function writeBranch(files, { branch: branchRel = 'step-1/parallel-1', state = {}, session: sessionFiles = {} } = {}) {
  const session = mkdtempSync(path.join(tmpdir(), 'business-session-'));
  const branch = path.join(session, ...branchRel.split('/'));
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  mkdirSync(path.join(session, 'step-1', 'parallel-2', 'response'), { recursive: true });
  writeFileSync(path.join(session, DELIVERED), '# backend-source-application — delivered source\n');
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': 'business.decide' }, current: '1/1', status: 'running', ...state }));
  for (const [name, content] of Object.entries(sessionFiles)) {
    mkdirSync(path.dirname(path.join(session, name)), { recursive: true });
    writeFileSync(path.join(session, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/claims.json': claimsDoc(),
  'response/data/coverage-matrix.json': coverageMatrix(),
  'response/data/model.json': modelDoc(),
});

// `files` is the branch's files, or a [files, writeBranch options] pair for a branch placed elsewhere.
const placed = (files) => (Array.isArray(files) ? files : [files, undefined]);
async function expectValid(files, label) {
  const { branch, session } = writeBranch(...placed(files));
  const { errors } = await validateBusinessStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(...placed(files));
  const { errors } = await validateBusinessStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

// The restatement gate: the person's promise, restated in their words and put back to them.
const PROMISE = 'a paying learner reads every course in the plan';
const RESTATEMENT_ID = `restatement:${FEATURE}`;
const restatementMd = ({ id = FEATURE, field = 'promise', quoted = PROMISE, lines = ['a learner whose purchase settled can open every course the plan covers', 'a learner outside the plan is turned away at the guard'] } = {}) => `# restatement — ${id}

## Restatement

| Line | Statement |
| --- | --- |
${lines.map((line, i) => `| ${i + 1} | ${line} |`).join('\n')}

## Source

| Field | Value |
| --- | --- |
| Field | \`${field}\` |
| Quoted | ${quoted} |
`;
const restatementQuestion = (decisionId = RESTATEMENT_ID) => ({ kind: 'restatement-confirm', decisionId, options: [{ id: 'as-stated', label: 'The reading is right', tradeoff: 'the promise is modelled as restated' }, { id: 'corrected', label: 'Correct the reading', tradeoff: 'the corrected promise re-enters this branch and is restated again' }] });
// A first run: the promise is supplied, restated, and the branch holds for the person.
const firstRunBlocked = ({ interaction = restatementQuestion(), restatement = restatementMd() } = {}) => ({
  'request/request.json': requestJson({ extra: { promise: PROMISE } }),
  'response/response.json': { ...responseJson({ status: 'blocked', stop: 'RESTATEMENT_UNCONFIRMED', fields: { restatement: 'response/restatement.md' }, next: [] }), ...(interaction ? { interaction } : {}) },
  'response/restatement.md': restatement,
});
// A re-entry at 2/1 of the blocked 1/1, with the person's choice recorded in state.json.
const reentry = ({ selected = 'as-stated', promise = PROMISE, blockedPromise = PROMISE, response = null } = {}) => [{
  ...baseline(),
  'request/request.json': requestJson({ extra: { promise }, choice: selected }),
  'response/response.json': response ?? responseJson({ step: 2, fields: { ...ALL_FIELDS, restatement: 'response/restatement.md' } }),
  'response/restatement.md': restatementMd({ quoted: promise }),
}, {
  branch: 'step-2/parallel-1',
  state: { chain: [['1/1'], ['2/1']], steps: { '1/1': 'business.decide', '2/1': 'business.decide' }, current: '2/1', resumes: { '2/1': { resumes: '1/1', stop: 'RESTATEMENT_UNCONFIRMED' } }, choices: { [RESTATEMENT_ID]: { selected, selectedBy: 'user', sourceRef: 'message:42' } } },
  session: { 'step-1/parallel-1/request/request.json': requestJson({ extra: { promise: blockedPromise } }) },
}];

const RECONCILE_FIELDS = { 'business-promise-authority': 'response/response.md', claims: 'response/data/claims.json', model: 'response/data/model.json' };
const reconciled = (overrides = {}) => ({
  ...baseline(),
  'request/request.json': requestJson({ mode: 'reconcile', targetState: 'implemented', inputs: { 'backend-source-application': DELIVERED } }),
  'response/response.json': responseJson({ fields: RECONCILE_FIELDS }),
  'response/response.md': responseMd({ mode: 'reconcile', state: 'implemented', transition: 'in-progress->implemented', previousHead: `\`${ROOT_REF}/features/${FEATURE}\``, previousState: 'in-progress', coverage: coverageFingerprint, dispositions: [], reconciliation: [['entitlement-consumer', '`src/course/guard.ts`', '—']] }),
  'response/data/coverage-matrix.json': null,
  'response/data/model.json': modelDoc({ mode: 'reconcile', state: 'implemented', transition: 'in-progress->implemented', previousHeadRef: `${ROOT_REF}/features/${FEATURE}`, previousState: 'in-progress', reconciliation: { deliveredEvidenceRefs: ['src/course/guard.ts'], discrepancies: [] } }),
  ...overrides,
});

await expectValid(baseline(), 'a first publication of one feature head under mode model, reusing the previous head\'s promise and owing no restatement');
await expectValid(reconciled(), 'a reconcile pass against delivered source');
await expectValid(firstRunBlocked(), 'a first run restates the supplied promise and holds for the person');
await expectValid(reentry(), 'a re-entry carrying the recorded as-stated choice proceeds to a done head that still carries the restatement');
await expectValid(reentry({ selected: 'corrected', promise: 'a paying learner reads every course in the plan for one year' }), 'a re-entry carrying the recorded corrected choice with a changed promise');
await expectValid({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'CONSUMER_UNPROVEN', fields: {}, next: [] }), 'response/response.md': null, 'response/data/claims.json': null, 'response/data/coverage-matrix.json': null, 'response/data/model.json': null }, 'blocked on an undisposed consumer');

await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), stop: 'CONSUMER_UNPROVEN' } }, 'only a blocked response carries a stop', 'done with a stop');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', fields: {}, next: [] }), 'response/response.md': null, 'response/data/claims.json': null, 'response/data/coverage-matrix.json': null, 'response/data/model.json': null }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['COVERAGE_INCOMPLETE'] }) }, 'has disposition terminate under these requirements; it cannot be taken as a fallback', 'fallback on a terminate code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'CONSUMER_UNPROVEN', next: [] }) }, 'a blocked branch cannot freeze a coverage matrix', 'blocked while freezing the matrix');
await expectError({ ...baseline(), 'request/request.json': requestJson({ mode: 'reconcile', targetState: 'implemented' }) }, 'input backend-source-application is required', 'reconcile with no delivered source');
await expectError({ ...baseline(), 'request/request.json': requestJson({ inputs: { 'backend-source-application': DELIVERED } }) }, 'input backend-source-application is refused', 'model mode reading delivered source');
await expectError(reconciled({ 'response/response.json': responseJson({ fields: { ...RECONCILE_FIELDS, 'coverage-matrix': 'response/data/coverage-matrix.json' } }), 'response/data/coverage-matrix.json': coverageMatrix() }), 'may not freeze a new coverage matrix', 'reconcile freezing a matrix');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { featureId: '' } }) }, 'required field featureId has no value', 'missing required featureId');
await expectError({ ...baseline(), 'response/data/model.json': modelDoc({ headRef: `${ROOT_REF}/features/starci/${FEATURE}` }) }, 'no project segment below the businesses root', 'a project segment below the businesses root');
await expectError({ ...baseline(), 'response/data/model.json': modelDoc({ headRef: `.worktrees/authority/features/${FEATURE}` }) }, 'is not under a .worktrees/businesses root', 'head outside the businesses root');
await expectError({ ...baseline(), 'response/data/model.json': modelDoc({ coverage: `sha256:${'e'.repeat(64)}` }) }, 'must equal the frozen matrix fingerprint', 'model and matrix disagree on the fingerprint');
await expectError({ ...baseline(), 'response/response.md': responseMd({ coverage: `sha256:${'e'.repeat(64)}` }) }, 'must equal the coverage matrix fingerprint', 'response and matrix disagree on the fingerprint');
await expectError({ ...baseline(), 'response/data/model.json': modelDoc({ transition: 'pending->in-progress' }) }, 'contradicts previous state null', 'transition contradicts the previous state');
await expectError({ ...baseline(), 'response/data/model.json': modelDoc({ previousHeadRef: `${ROOT_REF}/features/${FEATURE}` }) }, 'a first publication cannot name a previous head', 'first publication with lineage');
await expectError({ ...baseline(), 'request/request.json': requestJson({ targetState: 'implemented' }), 'response/data/model.json': modelDoc({ state: 'implemented', transition: 'in-progress->implemented', previousHeadRef: `${ROOT_REF}/features/${FEATURE}`, previousState: 'in-progress' }), 'response/response.md': responseMd({ state: 'implemented', transition: 'in-progress->implemented', previousHead: `\`${ROOT_REF}/features/${FEATURE}\``, previousState: 'in-progress' }) }, 'an implemented head requires reconciliation against delivered source', 'implemented without reconciliation');
await expectError(reconciled({ 'response/data/model.json': modelDoc({ mode: 'reconcile', state: 'implemented', transition: 'in-progress->implemented', previousHeadRef: `${ROOT_REF}/features/${FEATURE}`, previousState: 'in-progress', reconciliation: { deliveredEvidenceRefs: ['src/settlement.ts'], discrepancies: [{ dimension: 'settlement', statement: 'the webhook still writes the legacy row' }] } }) }), 'reconciliation discrepancy or discrepancies remain', 'reconcile published with a discrepancy');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('denial', { disposition: 'not-applicable', enforcementOwner: null, sourceRef: null, positiveProofRef: null, negativeProofRef: null, claimIds: [] }), 'response/response.md': responseMd({ dispositions: DISPOSITIONS.map(([d, p]) => (d === 'denial' ? [d, 'not-applicable'] : [d, p])) }) }, 'is mandatory for a published promise and cannot be marked not-applicable', 'mandatory dimension not applicable');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('renewal', { disposition: 'not-applicable', deferralRef: null }), 'response/response.md': responseMd({ dispositions: DISPOSITIONS.map(([d, p]) => (d === 'renewal' ? [d, 'not-applicable'] : [d, p])) }) }, 'was discovered in the source and cannot be marked not-applicable', 'discovered lifecycle branch not applicable');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('settlement', { negativeProofRef: null }) }, 'has no negative proof', 'preserve without a negative proof');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('renewal', { positiveProofRef: proof('renewal-granted') }) }, 'cannot claim proof for work that has not happened', 'deferred row claiming proof');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('settlement', { claimIds: ['c-intent'] }) }, 'without one fact claim', 'enforcement resting on an intent claim');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('settlement', { claimIds: ['c-ghost'] }) }, 'which claims.json does not carry', 'row citing an unlisted claim');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('entitlement-consumer', { consumerIds: [] }) }, 'has no disposition in the coverage matrix', 'discovered consumer never disposed');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('denial', { consumerIds: [CONSUMER.consumerId] }) }, 'is disposed in more than one row', 'consumer disposed twice');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': withRow('offer-entry', { consumerIds: ['ghost-guard'] }) }, 'was never discovered, so no evidence supports it', 'row disposing an undiscovered consumer');
await expectError({ ...baseline(), 'response/data/coverage-matrix.json': coverageMatrix({ rows: coverageMatrix().rows.slice(0, 12) }), 'response/response.md': responseMd({ dispositions: DISPOSITIONS.slice(0, 12) }) }, 'has no disposition', 'a declared dimension missing from the matrix');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { dimensions: DIMENSIONS.slice(0, 12) } }) }, 'was never declared by the request', 'a matrix dimension nobody declared');
await expectError({ ...baseline(), 'response/response.md': responseMd({ dispositions: DISPOSITIONS.map(([d, p]) => (d === 'legacy-read' ? [d, 'defer'] : [d, p])) }) }, 'is defer here and preserve in the matrix', 'the response and the matrix disagree on a disposition');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Coverage', '## Coverage matrix') }, 'missing section ^## Coverage$', 'response section renamed');
await expectError({ ...baseline(), 'response/response.md': responseMd({ findings: [['LEGACY_COEXISTENCE', 'error', 'legacy-create', 'the legacy sale path still creates rights']] }) }, 'is still an open error, so the promise cannot be published', 'published with an open error finding');
await expectError({ ...baseline(), 'response/data/claims.json': claimsDoc({ fingerprint: `sha256:${'b'.repeat(64)}` }) }, 'claimsFingerprint must equal the frozen claims fingerprint', 'a head naming another claims fingerprint');
await expectError({ ...baseline(), 'response/data/claims.json': claimsDoc({ claims: [CLAIMS[0], { ...CLAIMS[0], kind: 'intent' }] }) }, 'is declared more than once', 'a duplicated claim');
await expectError({ ...baseline(), 'response/data/claims.json': claimsDoc({ claims: [{ ...CLAIMS[0], sourceHead: null }, CLAIMS[1]] }) }, 'must bind the observed source head', 'a fact claim with no head');
await expectError({ ...baseline(), 'response/response.md': responseMd({ claims: [['c-fact', 'fact']] }) }, 'which Cited claims omits', 'a claim the response never cites');
await expectError({ ...baseline(), 'response/response.json': (() => { const o = responseJson(); delete o.fields.model; return o; })() }, 'required output model is not in fields', 'missing required output');

// Restatement gate mutations.
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { promise: PROMISE } }) }, 'ends blocked with RESTATEMENT_UNCONFIRMED', 'a first run designing on a promise nobody confirmed');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { promise: PROMISE } }), 'response/response.json': responseJson({ fields: { ...ALL_FIELDS, restatement: 'response/restatement.md' } }), 'response/restatement.md': restatementMd() }, 'ends blocked with RESTATEMENT_UNCONFIRMED', 'a first run done with a restatement but no recorded choice');
await expectError(firstRunBlocked({ interaction: null }), 'carries interaction', 'blocked on the restatement without the typed question');
await expectError(firstRunBlocked({ interaction: restatementQuestion('restatement:other-feature') }), 'interaction.decisionId is restatement:other-feature', 'the question keyed by another feature');
await expectError(firstRunBlocked({ interaction: { ...restatementQuestion(), options: restatementQuestion().options.slice(0, 1).concat([{ id: 'maybe', label: 'Maybe', tradeoff: 'nothing' }]) } }), 'offers exactly as-stated and corrected', 'the question offering another option');
await expectError(firstRunBlocked({ restatement: restatementMd({ lines: ['one', 'two', 'three', 'four', 'five', 'six'] }) }), 'table takes at most 5 rows', 'a restatement of six lines');
await expectError(firstRunBlocked({ restatement: restatementMd({ quoted: 'a paying learner reads some courses' }) }), 'quoted verbatim', 'a restatement misquoting the person');
await expectError(firstRunBlocked({ restatement: restatementMd({ field: 'objective' }) }), 'the restated requirement is promise', 'a restatement of another field');
await expectError({ ...firstRunBlocked(), 'request/request.json': requestJson({ extra: { promise: PROMISE } }), 'response/response.json': { ...firstRunBlocked()['response/response.json'], fields: { restatement: 'response/restatement.md', claims: 'response/data/claims.json' } }, 'response/data/claims.json': claimsDoc() }, 'written before the restatement is confirmed', 'claims normalized on an unconfirmed reading');
await expectError({ ...firstRunBlocked(), 'response/restatement.md': null, 'response/response.json': { ...firstRunBlocked()['response/response.json'], fields: {} } }, 'fields.restatement names response/restatement.md whatever the status', 'blocked on the restatement without writing it');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { ...ALL_FIELDS, restatement: 'response/restatement.md' } }), 'response/restatement.md': restatementMd() }, 'nothing to restate', 'a restatement when the request supplies no promise');
await expectError(reentry({ selected: 'corrected' }), 'carries the same promise as the blocked branch', 'corrected with the promise unchanged');
await expectError(reentry({ selected: 'as-stated', promise: 'a paying learner reads every course in the plan for one year' }), 'differs from the blocked branch', 'as-stated with the promise changed');
await expectError(reentry({ response: { ...responseJson({ step: 2, status: 'blocked', stop: 'RESTATEMENT_UNCONFIRMED', fields: { restatement: 'response/restatement.md' }, next: [] }), interaction: restatementQuestion() } }), 'does not ask again', 'a re-entry asking the recorded question again');

process.stdout.write('business.decide self-test: 6 valid branches, 47 rejected mutations\n');
