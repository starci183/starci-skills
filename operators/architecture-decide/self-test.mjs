// Proves validate.mjs on a synthetic session branch: one conforming branch under the defaults
// (alternatives = 1, automatic) with its critique exchange, one with three alternatives under
// approval-required, one blocked on a terminate code, and one mutation per law, each of which must
// fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateArchitectureStep } from './validate.mjs';

const head = 'b'.repeat(40);
const fp = `sha256:${'a'.repeat(64)}`;
const ev = (p) => `${p}@${head}`;

function currentState() {
  return {
    observedHead: head, fingerprint: fp,
    components: [
      { componentId: 'nestjs', layer: 'framework', name: 'NestJS', version: '10.4.0', evidence: ev('package.json:12') },
      { componentId: 'postgres', layer: 'persistence', name: 'PostgreSQL', version: '16.2', evidence: ev('compose.yaml:30-41') },
    ],
    boundaries: [{ boundaryId: 'entitlement', responsibility: 'answers who may read a course', stores: ['entitlement-store'], evidence: ev('src/entitlement/index.ts:1-40') }],
  };
}
const verdicts = () => ['runtime-version', 'deployable-unit', 'communication-failure', 'datastore-ownership', 'backup-restore'].map((axis) => ({ axis, verified: true, evidence: ev('compose.yaml:30') }));
function stackModel({ alternatives = 1 } = {}) {
  const alts = [{ alternativeId: 'shared-boundary', status: 'selected', scores: { cost: 4, complexity: 3, reversibility: 4 }, rejectedBecause: null }];
  if (alternatives > 1) alts.push({ alternativeId: 'per-feature-guards', status: 'rejected', scores: { cost: 2, complexity: 2, reversibility: 3 }, rejectedBecause: 'three boundaries derive one answer' });
  if (alternatives > 2) alts.push({ alternativeId: 'edge-cache', status: 'rejected', scores: { cost: 3, complexity: 1, reversibility: 1 }, rejectedBecause: 'stale claims after revocation' });
  return {
    decisionId: 'entitlement-read-path', selectedAlternativeId: 'shared-boundary', alternatives: alts,
    boundaries: [
      { boundaryId: 'entitlement', responsibility: 'one entitlement answer', owner: 'platform-team', interfaces: ['EntitlementQuery'], ownsData: true },
      { boundaryId: 'course-api', responsibility: 'serves course content', owner: 'learning-team', interfaces: ['CourseQuery'], ownsData: false },
    ],
    stores: [{ storeId: 'entitlement-store', owningBoundaryId: 'entitlement', writers: ['entitlement'], readers: ['course-api'], migrators: ['entitlement'], transactionScope: 'per request', backup: 'nightly snapshot', restore: 'tested weekly', sharedWriteJustification: null }],
    operations: [
      {
        operationId: 'grant-entitlement', name: 'grantEntitlement', transport: 'graphql-mutation',
        writerRef: 'src/entitlement/graphql/mutations/grant-entitlement.ts', storeRefs: ['entitlement-store'],
        transactionBoundary: 'single-transaction', idempotencyKind: 'request-token', migrationRefs: [],
        authorityDimensionIds: ['effective-access'],
      },
    ],
    components: [
      { componentId: 'nestjs', status: 'existing', justification: 'observed-evidence', evidence: ev('package.json:12'), compatibility: verdicts() },
      { componentId: 'postgres', status: 'existing', justification: 'measured-constraint', evidence: ev('compose.yaml:30'), compatibility: verdicts() },
      { componentId: 'redis-cache', status: 'removed', justification: null, evidence: null, compatibility: [] },
    ],
  };
}
function responseMd({ alternatives = 1, policy = 'automatic', handoffDetail = 'EntitlementQuery contract returns one answer per viewer' } = {}) {
  const altRows = ['| `shared-boundary` | selected | cost 4 · complexity 3 · reversibility 4 | — |'];
  if (alternatives > 1) altRows.push('| `per-feature-guards` | rejected | cost 2 · complexity 2 · reversibility 3 | three boundaries derive one answer |');
  if (alternatives > 2) altRows.push('| `edge-cache` | rejected | cost 3 · complexity 1 · reversibility 1 | stale claims after revocation |');
  return `# architecture-decision — entitlement-read-path

## Decision

| Field | Value |
| --- | --- |
| Objective | one entitlement read path |
| Decision id | \`entitlement-read-path\` |
| Selected alternative | \`shared-boundary\` |
| Selection policy | \`${policy}\` |

## Current state

| Boundary | Responsibility | Stores | Evidence |
| --- | --- | --- | --- |
| \`entitlement\` | answers who may read a course | \`entitlement-store\` | \`src/entitlement/index.ts:1-40@${head}\` |

## Alternatives

| Alternative | Status | Assessment | Rejected because |
| --- | --- | --- | --- |
${altRows.join('\n')}

## Boundaries

| Boundary | Responsibility | Owner | Interfaces | Owns data |
| --- | --- | --- | --- | --- |
| \`entitlement\` | one entitlement answer | platform-team | EntitlementQuery | yes |
| \`course-api\` | serves course content | learning-team | CourseQuery | no |

## Data ownership

| Store | Owning boundary | Writers | Readers | Migrators | Transaction scope | Backup | Restore |
| --- | --- | --- | --- | --- | --- | --- | --- |
| \`entitlement-store\` | \`entitlement\` | \`entitlement\` | \`course-api\` | \`entitlement\` | per request | nightly snapshot | tested weekly |

## Stack delta

| Component | Status | Justification | Evidence | Compatibility |
| --- | --- | --- | --- | --- |
| \`nestjs\` | existing | observed-evidence | \`package.json:12@${head}\` | 5/5 verified |
| \`postgres\` | existing | measured-constraint | \`compose.yaml:30@${head}\` | 5/5 verified |
| \`redis-cache\` | removed | — | — | — |

## Operations

| Operation | Transport | Writer | Stores | Transaction | Idempotency | Dimensions |
| --- | --- | --- | --- | --- | --- | --- |
| \`grant-entitlement\` | graphql-mutation | \`src/entitlement/graphql/mutations/grant-entitlement.ts\` | \`entitlement-store\` | single-transaction | request-token | effective-access |

## Handoff

| Item | Kind | Detail |
| --- | --- | --- |
| one answer per viewer | invariant | every entitlement read returns the same answer within one request |
| entitlement query | contract | ${handoffDetail} |
| cache removal | migration | drop the cache after the shared boundary serves all readers |
| revert | rollback | restore the cache reader behind a flag |
| proof | proof | integration test asserting one answer across three readers |

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}
function critiqueMd({ failing = false, selection = 'keep', inherited = 'none' } = {}) {
  const paths = ['partial-failure', 'retry-idempotency', 'concurrency', 'stale-state', 'deletion', 'recovery', 'dependency-outage', 'rollback'];
  return `# independent-critique — entitlement-read-path

## Execution

| Field | Value |
| --- | --- |
| Reviewer execution | exec://critique-7f3a |
| Inherited turns | ${inherited} |
| Given | response/data/stack-model.json |

## Attacks

| Adverse path | Attack | Resolution | Verdict |
| --- | --- | --- | --- |
${paths.map((p, i) => `| ${p} | what if ${p} hits the shared boundary | idempotent read, single writer | ${failing && i === 3 ? 'fails' : 'holds'} |`).join('\n')}

## Verdict

| Field | Value |
| --- | --- |
| Selection | ${selection} |
`;
}
const requestJson = ({ alternatives = 1, policy = 'automatic', approval = null, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'architecture.decide', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/be', head }, { alias: '@worktrees/businesses/pro-subscription', head: null }],
  requirements: { objective: 'one entitlement read path', decisionId: 'entitlement-read-path', alternatives, tradeoffAxes: ['cost', 'complexity', 'reversibility'], constraints: [{ id: 'fi-1', kind: 'fixed-intent', statement: 'one answer per viewer' }, { id: 'm-1', kind: 'measurable', statement: 'p95 read under 50ms' }], selectionPolicy: policy, approval, resume: null, ...extra },
  inputs: {}, resume: null,
});
const critiqueRequest = (inputs = { 'stack-model': 'step-1/parallel-1/response/data/stack-model.json' }) => ({ schemaVersion: 9, operatorId: 'architecture.decide', step: 1, parallel: 1, sessionId: 's-test', exchange: 'critique', contexts: [], requirements: {}, inputs, resume: null });
const critiqueResponse = () => ({ schemaVersion: 9, operatorId: 'architecture.decide', step: 1, parallel: 1, exchange: 'critique', status: 'done', fallbacks: [], fields: { 'independent-critique': 'response/critique.md' }, commits: [], next: [] });
function responseJson({ status = 'done', stop, fallbacks = [], withAlternatives = false, next = ['backend.generate'] } = {}) {
  const fields = { 'architecture-decision': 'response/response.md', 'current-state': 'response/data/current-state.json', 'stack-model': 'response/data/stack-model.json' };
  if (withAlternatives) fields.alternatives = 'response/artifacts/entitlement-read-path-alternatives.html';
  return { schemaVersion: 9, operatorId: 'architecture.decide', step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks, fields, commits: [], next };
}

// `branch` places the branch under test; `state` patches state.json; `session` writes session-relative files.
function writeBranch(files, { branch: branchRel = 'step-1/parallel-1', state = {}, session: sessionFiles = {} } = {}) {
  const session = mkdtempSync(path.join(tmpdir(), 'arch-session-'));
  const branch = path.join(session, ...branchRel.split('/'));
  for (const d of ['request', 'response/data', 'response/artifacts', 'critique/request', 'critique/response']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': 'architecture.decide' }, current: '1/1', status: 'running', ...state }));
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

// The restatement gate. Every fixture below is first-run shaped (step 1, no recorded choice), which
// is what the consumers of migrationFixture expect of a producer; a branch that gets past step 2 is a
// re-entry of a blocked restatement branch, so `confirmed` turns a fixture into that re-entry at 2/1
// with the person's choice recorded in state.json and the blocked 1/1 request beside it, while
// `firstRun` places a fixture as it is.
const OBJECTIVE = 'one entitlement read path';
const ID = 'entitlement-read-path';
const restatementMd = ({ id = ID, field = 'objective', quoted = OBJECTIVE, lines = ['every reader of a course entitlement gets the same answer from one place', 'the answer is served fast enough that no reader caches its own copy'] } = {}) => `# restatement — ${id}

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
const restatementQuestion = (decisionId = `restatement:${ID}`) => ({ kind: 'restatement-confirm', decisionId, options: [{ id: 'as-stated', label: 'The reading is right', tradeoff: 'the architecture is decided on the objective as restated' }, { id: 'corrected', label: 'Correct the reading', tradeoff: 'the corrected objective re-enters this branch and is restated again' }] });
const firstRun = (files, opts = {}) => [files, opts];
export function confirmed(files, { selected = 'as-stated', objective = null, blockedObjective = OBJECTIVE, id = ID } = {}) {
  const out = structuredClone(files);
  const decisionId = `restatement:${id}`;
  const move = (p) => String(p).replace('step-1/parallel-1/', 'step-2/parallel-1/');
  for (const name of ['request/request.json', 'response/response.json', 'critique/request/request.json', 'critique/response/response.json']) if (out[name]) out[name].step = 2;
  // The re-entry keeps the fixture's own objective unless the case supplies a corrected one.
  objective ??= out['request/request.json']?.requirements?.objective ?? OBJECTIVE;
  if (out['request/request.json']) Object.assign(out['request/request.json'], { decisionId, selectedOption: selected, resume: { step: 1, parallel: 1, token: 't-1' }, requirements: { ...out['request/request.json'].requirements, objective, resume: 't-1' } });
  if (out['response/response.json']?.fields) out['response/response.json'].fields.restatement = 'response/restatement.md';
  if (out['critique/request/request.json']) out['critique/request/request.json'].inputs = Object.fromEntries(Object.entries(out['critique/request/request.json'].inputs).map(([k, v]) => [k, move(v)]));
  out['response/restatement.md'] ??= restatementMd({ id, quoted: objective });
  return [out, {
    branch: 'step-2/parallel-1',
    state: { chain: [['1/1'], ['2/1']], steps: { '1/1': 'architecture.decide', '2/1': 'architecture.decide' }, current: '2/1', resumes: { '2/1': { resumes: '1/1', stop: 'RESTATEMENT_UNCONFIRMED' } }, choices: { [decisionId]: { selected, selectedBy: 'user', sourceRef: 'message:42' } } },
    session: { 'step-1/parallel-1/request/request.json': requestJson({ extra: { objective: blockedObjective } }) },
  }];
}
// A fixture handed in bare is a lawful branch only as a confirmed re-entry; one handed in as a pair was placed on purpose.
const placed = (files) => (Array.isArray(files) ? files : confirmed(files));
export const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/current-state.json': currentState(),
  'response/data/stack-model.json': stackModel(),
  'critique/request/request.json': critiqueRequest(),
  'critique/response/response.json': critiqueResponse(),
  'critique/response/critique.md': critiqueMd(),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(...placed(files));
  const { errors } = await validateArchitectureStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(...placed(files));
  const { errors } = await validateArchitectureStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const threeAlts = (policy, approval, extraResponse = {}) => ({
  ...baseline(),
  'request/request.json': requestJson({ alternatives: 3, policy, approval }),
  'response/response.md': responseMd({ alternatives: 3, policy }),
  'response/data/stack-model.json': stackModel({ alternatives: 3 }),
  'response/response.json': responseJson({ withAlternatives: true, ...extraResponse }),
  'response/artifacts/entitlement-read-path-alternatives.html': '<!doctype html><title>alternatives</title>',
});

export function migrationFixture(patch = {}) {
  const files = baseline();
  const model = files['response/data/stack-model.json'];
  const op = { ...model.operations[0], transport: 'migration', writerRef: 'src/persistence/migrations/add-scope.ts', migrationRefs: ['src/persistence/migrations/add-scope.ts'], idempotencyKind: 'natural-key', ...patch };
  model.operations = [op];
  files['response/response.md'] = files['response/response.md'].replace(/\| `grant-entitlement` \|[^\n]+/, `| \`${op.operationId}\` | ${op.transport} | \`${op.writerRef}\` | ${op.storeRefs.join(', ') || '—'} | ${op.transactionBoundary} | ${op.idempotencyKind} | ${op.authorityDimensionIds.join(', ')} |`);
  return files;
}

async function runSelfTests() {
await expectValid(migrationFixture(), 'standalone migration with owned stores and an independent critique');
await expectValid(migrationFixture({ transactionBoundary: 'none' }), 'migration runner with explicit nontransactional behavior');
await expectError(migrationFixture({ migrationRefs: [] }), 'migrationRefs: array is too short', 'standalone migration without a migration');
await expectError(migrationFixture({ storeRefs: [] }), 'storeRefs: array is too short', 'standalone migration without a store');
await expectError(migrationFixture({ writerRef: 'src/other.ts' }), 'writer must be one of its migrationRefs', 'standalone migration with another writer');
await expectError(migrationFixture({ transactionBoundary: 'read-only' }), 'transactionBoundary: value is outside the allowed enum', 'read-only standalone migration');
await expectError(migrationFixture({ idempotencyKind: 'none' }), 'idempotencyKind: expected "natural-key"', 'standalone migration without its journal identity');
await expectError(migrationFixture({ writerRef: '/tmp/migration.ts', migrationRefs: ['/tmp/migration.ts'] }), 'relative to the bound checkout', 'absolute standalone migration path');
await expectValid(baseline(), 'defaults (one alternative, automatic, critique exchange done)');
await expectValid(threeAlts('approval-required', 'shared-boundary'), 'three alternatives under approval-required');
await expectValid({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'DATA_OWNERSHIP_UNASSIGNED', next: [] }), 'critique/request/request.json': null, 'critique/response/response.json': null, 'critique/response/critique.md': null }, 'blocked before the critique on a terminate code');
await expectValid({ ...baseline(), 'response/response.json': { ...responseJson({ next: [] }), status: 'waiting', awaiting: { exchange: 'critique', kind: 'independent-critique' }, fields: { 'current-state': 'response/data/current-state.json', 'stack-model': 'response/data/stack-model.json' } }, 'response/response.md': null, 'critique/request/request.json': null, 'critique/response/response.json': null, 'critique/response/critique.md': null }, 'waiting for the critique');
await expectValid({ ...threeAlts('approval-required', null, { status: 'blocked', stop: 'CHOICE_REQUIRED', next: [] }), 'critique/request/request.json': null, 'critique/response/response.json': null, 'critique/response/critique.md': null }, 'CHOICE_REQUIRED terminates under approval-required');

await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), stop: 'CHOICE_REQUIRED' } }, 'only a blocked response carries a stop', 'done with stop');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', next: [] }) }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'CHOICE_REQUIRED', next: [] }) }, 'has disposition fallback under these requirements', 'terminating on a fallback code under automatic');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['DATA_OWNERSHIP_UNASSIGNED'] }) }, 'has disposition terminate under these requirements; it cannot be taken as a fallback', 'fallback on a terminate code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['COMPATIBILITY_UNVERIFIED'] }) }, 'not recorded under ## Fallbacks taken', 'fallback missing from response');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { objective: '' } }) }, 'required field objective has no value', 'missing required objective');
await expectError({ ...baseline(), 'request/request.json': requestJson({ approval: 'shared-boundary' }) }, 'approval is bound under automatic policy', 'approval under automatic');
await expectError({ ...baseline(), 'critique/response/critique.md': critiqueMd().replace('| rollback |', '| rollbak |') }, 'lacks a row for rollback', 'critique missing an adverse path');
await expectError({ ...baseline(), 'critique/response/critique.md': critiqueMd({ failing: true }) }, 'attacks stale-state fail', 'done with a failing attack');
await expectError({ ...baseline(), 'critique/response/critique.md': critiqueMd({ inherited: 'author thread' }) }, 'no inherited turns', 'critique inherited turns');
await expectError({ ...baseline(), 'critique/request/request.json': critiqueRequest({ 'stack-model': 'step-1/parallel-1/response/data/stack-model.json', 'architecture-decision': 'step-1/parallel-1/response/response.md' }) }, "may not be given the author's response.md", 'critique given the rationale');
await expectError({ ...baseline(), 'critique/request/request.json': null, 'critique/response/response.json': null, 'critique/response/critique.md': null }, 'the branch is done, but it never ran', 'done without the critique exchange');
await expectError({ ...baseline(), 'response/data/stack-model.json': { ...stackModel(), stores: [{ ...stackModel().stores[0], writers: ['course-api'] }] } }, 'is not among its writers', 'owner does not write its store');
await expectError({ ...baseline(), 'response/data/stack-model.json': { ...stackModel(), stores: [{ ...stackModel().stores[0], writers: ['entitlement', 'course-api'] }] } }, 'no shared-write justification', 'unjustified second writer');
await expectError({ ...baseline(), 'response/data/stack-model.json': { ...stackModel(), components: stackModel().components.map((c) => (c.componentId === 'nestjs' ? { ...c, compatibility: c.compatibility.slice(0, 4) } : c)) } }, 'compatibility unverified on backup-restore', 'retained component missing an axis');
await expectError({ ...baseline(), 'response/data/stack-model.json': { ...stackModel(), alternatives: [{ ...stackModel().alternatives[0], status: 'rejected', rejectedBecause: 'x' }] } }, 'exactly one alternative must be selected', 'no selected alternative');
await expectError({ ...baseline(), 'response/data/stack-model.json': stackModel({ alternatives: 2 }) }, 'but the request asked for 1', 'more alternatives than asked');
await expectError({ ...baseline(), 'response/response.md': responseMd({ handoffDetail: 'src/entitlement/query.ts returns one answer' }) }, 'names an implementation file', 'handoff names a file');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| Selected alternative | `shared-boundary` |', '| Selected alternative | `edge-cache` |') }, 'Decision names edge-cache', 'response and model disagree on the selection');
await expectError({ ...baseline(), 'response/data/stack-model.json': (() => { const m = stackModel(); m.operations = [{ ...m.operations[0], storeRefs: ['ghost-store'] }]; return m; })() }, 'which this decision does not own', 'an operation writing a store the decision does not own');
await expectError({ ...baseline(), 'response/data/stack-model.json': (() => { const m = stackModel(); m.operations = [{ ...m.operations[0], transport: 'event-consumer', idempotencyKind: 'none' }]; return m; })() }, 'a redelivery applies it twice', 'an event consumer with no idempotency');
await expectError({ ...baseline(), 'response/data/stack-model.json': (() => { const m = stackModel(); m.operations = [{ ...m.operations[0], authorityDimensionIds: ['another-dimension'] }]; return m; })() }, 'does not restate declared dimension another-dimension', 'a receipt that drops a declared dimension');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Handoff', '## Hand-off') }, 'missing section ^## Handoff$', 'response section renamed');
await expectError({ ...baseline(), 'response/data/current-state.json': { ...currentState(), observedHead: 'nope' } }, 'observedHead', 'current-state schema');
await expectError({ ...baseline(), 'response/response.json': (() => { const o = responseJson(); delete o.fields['stack-model']; return o; })() }, 'required output stack-model is not in fields', 'missing required output');
await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), status: 'waiting', awaiting: { exchange: 'review', kind: 'independent-critique' } } }, 'awaiting exchange review is declared by no Output', 'waiting on an undeclared exchange');

// The restatement gate.
const blockedOnRestatement = ({ interaction = restatementQuestion(), restatement = restatementMd(), request = requestJson() } = {}) => ({
  'request/request.json': request,
  'response/response.json': { ...responseJson({ status: 'blocked', stop: 'RESTATEMENT_UNCONFIRMED', next: [] }), fields: { restatement: 'response/restatement.md' }, ...(interaction ? { interaction } : {}) },
  'response/restatement.md': restatement,
});
const MODEL_INPUT = { model: 'step-1/parallel-2/response/data/model.json' };
const modelFile = { 'step-1/parallel-2/response/data/model.json': { featureId: 'pro-subscription' } };
await expectValid(firstRun(blockedOnRestatement()), 'a first run restates the objective and holds for the person');
await expectValid(confirmed(baseline(), { selected: 'corrected', objective: 'one entitlement read path served by one boundary' }), 'a re-entry carrying the recorded corrected choice with a changed objective');
await expectValid(confirmed({ ...baseline(), 'request/request.json': requestJson({ extra: { decisionId: null } }) }, { id: 'one-entitlement-read-path' }), 'the choice keyed by the slug of the objective when decisionId is left to its default');
await expectError(firstRun(baseline()), 'ends blocked with RESTATEMENT_UNCONFIRMED', 'a first run designing on an objective nobody confirmed');
await expectError(firstRun({ ...baseline(), 'request/request.json': { ...requestJson(), inputs: MODEL_INPUT } }, { session: modelFile }), 'ends blocked with RESTATEMENT_UNCONFIRMED', 'a first run carrying a confirmed promise as the model input still owes its own restatement');
await expectError(firstRun(blockedOnRestatement({ interaction: null })), 'carries interaction', 'blocked on the restatement without the typed question');
await expectError(firstRun(blockedOnRestatement({ interaction: restatementQuestion('restatement:another-decision') })), 'interaction.decisionId is restatement:another-decision', 'the question keyed by another decision');
await expectError(firstRun(blockedOnRestatement({ restatement: restatementMd({ lines: ['one', 'two', 'three', 'four', 'five', 'six'] }) })), 'table takes at most 5 rows', 'a restatement of six lines');
await expectError(firstRun(blockedOnRestatement({ restatement: restatementMd({ quoted: 'one entitlement write path' }) })), 'quoted verbatim', 'a restatement misquoting the person');
await expectError(firstRun(blockedOnRestatement({ restatement: restatementMd({ id: 'another-decision' }) })), 'the title names entitlement-read-path', 'a restatement titled by another decision');
await expectError(firstRun({ ...blockedOnRestatement(), 'response/response.json': { ...blockedOnRestatement()['response/response.json'], fields: { restatement: 'response/restatement.md', 'current-state': 'response/data/current-state.json' } }, 'response/data/current-state.json': currentState() }), 'written before the restatement is confirmed', 'the current state observed on an unconfirmed reading');
await expectError(confirmed(baseline(), { selected: 'corrected' }), 'carries the same objective as the blocked branch', 'corrected with the objective unchanged');
await expectError(confirmed(baseline(), { selected: 'as-stated', objective: 'one entitlement read path served by one boundary' }), 'differs from the blocked branch', 'as-stated with the objective changed');
await expectError(confirmed(blockedOnRestatement()), 'does not ask again', 'a re-entry asking the recorded question again');

process.stdout.write('architecture.decide self-test: 10 valid branches, 42 rejected mutations\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runSelfTests();
