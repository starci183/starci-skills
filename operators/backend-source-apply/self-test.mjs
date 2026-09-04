// Proves validate.mjs on a synthetic session branch: one conforming implementation of a frozen
// contract committed once on the session branch, with its change record, one conformance file per
// facet and one proof file per proof kind, one dry run that plans the same write set and commits,
// measures and writes nothing, one branch blocked on a terminate code, and one mutation per law,
// each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { migrationFixture } from '../architecture-decide/self-test.mjs';
import { validateBackendStep } from './validate.mjs';

const BASE = 'f'.repeat(40);
const COMMIT = 'a1b2'.repeat(10);
const BRANCH = 'session/s-test';
const hash = (c) => `sha256:${c.repeat(64)}`;
const CONTRACT_FP = hash('a');
const OP = 'enrol-course';
const WRITER = 'src/features/api/core/graphql/mutations/enrol-course.handler.ts';
const SPEC = 'src/features/api/core/graphql/mutations/enrol-course.handler.spec.ts';
const FACETS = ['transport', 'writer', 'transaction', 'idempotency', 'exception-identity', 'authorization'];
const PROOF_KINDS = ['unit', 'integration'];

const operation = (overrides = {}) => ({
  operationId: OP, name: 'enrolCourse', transport: 'graphql-mutation', writerRef: WRITER,
  storeRefs: ['enrollments'], transactionBoundary: 'single-transaction', idempotencyKind: 'request-token',
  migrationRefs: [], authorityDimensionIds: ['effective-access'], facets: FACETS, proofKinds: PROOF_KINDS,
  ...overrides,
});
const CHANGES = [
  { path: WRITER, change: 'added', operationId: OP, beforeHash: null, afterHash: hash('1') },
  { path: SPEC, change: 'added', operationId: OP, beforeHash: null, afterHash: hash('2') },
];
const DRY_CHANGES = CHANGES.map((c) => ({ ...c, afterHash: null }));
const mutationsJson = ({ operations = [operation()], changes = CHANGES, commit = COMMIT, base = BASE, branch = BRANCH, mode = 'apply' } = {}) => ({
  mode, contractFingerprint: CONTRACT_FP, base, branch, commit, operations, changes,
});
const conformanceRecord = (facet, overrides = {}) => ({ operationId: OP, facet, verdict: 'conforms', evidenceRef: `${SPEC}:40`, statement: `the ${facet} of the operation matches the contract`, contractFingerprint: CONTRACT_FP, ...overrides });
const proofRecord = (proofKind, overrides = {}) => ({ operationId: OP, proofKind, commandRef: `npm run test:${proofKind}`, exitCode: 0, result: 'passed', output: `${proofKind} suite: 12 passed`, statement: `the ${proofKind} proof ran and passed`, contractFingerprint: CONTRACT_FP, ...overrides });
const conformancePath = (operationId, facet) => `response/data/conformance/${operationId}.${facet}.json`;
const proofPath = (operationId, proofKind) => `response/data/proofs/${operationId}.${proofKind}.json`;

function responseMd({ operations = null, changes = null, findings = null, contractFingerprint = CONTRACT_FP, commit = COMMIT, base = BASE, branch = BRANCH, mode = 'apply' } = {}) {
  const operationRows = (operations ?? [[OP, 'graphql-mutation', WRITER, 'single-transaction', 'request-token', 'effective-access']]).map((r) => `| \`${r[0]}\` | ${r[1]} | \`${r[2]}\` | ${r[3]} | ${r[4]} | ${r[5]} |`).join('\n');
  const changeRows = (changes ?? [[WRITER, 'added', OP, '—', hash('1')], [SPEC, 'added', OP, '—', hash('2')]]).map((r) => `| \`${r[0]}\` | ${r[1]} | \`${r[2]}\` | ${r[3]} | ${r[4]} |`).join('\n');
  const findingRows = (findings ?? [['PATTERN_BOUND', OP, WRITER, 'the mutation handler mirrors the published command family']]).map(([code, op, file, statement]) => `| \`${code}\` | ${op === null ? '—' : `\`${op}\``} | ${file === null ? '—' : `\`${file}\``} | ${statement} |`).join('\n');
  return `# backend-source-application — enrol-course

The enrolment mutation, filled inside the frozen contract and measured on every declared facet.

## Binding

| Field | Value |
| --- | --- |
| Outcome | one enrolment mutation behind the paid access promise |
| Feature | paid-access |
| Mode | ${mode} |
| Contract fingerprint | ${contractFingerprint} |
| Base | ${base} |
| Branch | ${branch} |
| Commit | ${commit} |

## Operations

| Operation | Transport | Writer | Transaction | Idempotency | Decisions |
| --- | --- | --- | --- | --- | --- |
${operationRows}

## Changes

| Path | Change | Operation | Before | After |
| --- | --- | --- | --- | --- |
${changeRows}

## Findings

| Code | Operation | File | Statement |
| --- | --- | --- | --- |
${findingRows}
`;
}

const changesMd = ({ files = null, checkout = `\`@workspaces/be\` at \`${BASE}\` → \`${COMMIT}\` on \`${BRANCH}\`` } = {}) => {
  const rows = (files ?? [[WRITER, 'created'], [SPEC, 'created']]).map(([p, kind, why]) => `| \`${p}\` | ${kind} | ${why ?? 'the decision this file carries'} | BE-1 |`).join('\n');
  return `# changes — backend.source.apply step-1/parallel-1

The enrolment mutation and its unit spec were written into the session branch of the routed backend
checkout and committed once.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`backend.source.apply\` |
| Step | \`step-1/parallel-1\` |
| Checkout | ${checkout} |
| Predecessor | \`step-1/parallel-2/response/response.md\` |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
${rows}

## What the next step must know

- Gates to run: the backend lint, type and test gates the checkout pins for these paths.
- Surfaces to observe: the enrolment mutation of the api.
- Not changed on purpose: the legacy checkout path, which the contract does not carry.
`;
};

const requestJson = ({ extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'backend.source.apply', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/be', head: BASE }, { alias: '@worktrees/businesses/paid-access', head: null }, { alias: '@knowledge/patterns/be', head: null }],
  requirements: {
    featureId: 'paid-access', outcome: 'one enrolment mutation behind the paid access promise',
    mutableFileRefs: [WRITER, SPEC], resume: null, ...extra,
  },
  inputs: { 'architecture-decision': 'step-1/parallel-2/response/response.md' }, resume: null,
});
function responseJson({ status = 'done', stop, fallbacks = [], fields = null, commits = [COMMIT], next = ['quality.verify'] } = {}) {
  return {
    schemaVersion: 9, operatorId: 'backend.source.apply', step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks,
    fields: fields ?? {
      'backend-source-application': 'response/response.md',
      changes: 'response/changes.md',
      mutations: 'response/data/mutations.json',
      conformance: FACETS.map((facet) => conformancePath(OP, facet)),
      proof: PROOF_KINDS.map((kind) => proofPath(OP, kind)),
    },
    commits, next,
  };
}

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'backend-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data/conformance', 'response/data/proofs', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  mkdirSync(path.join(session, 'step-1', 'parallel-2', 'response'), { recursive: true });
  writeFileSync(path.join(session, 'step-1', 'parallel-2', 'response', 'response.md'), '# architecture-decision — enrol-course\n');
  const state = { id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': 'backend.source.apply' }, current: '1/1', status: 'running' };
  if (files.producer) {
    const producer = structuredClone(files.producer);
    for (const [name, content] of Object.entries(producer)) {
      if (content === null) continue;
      const target = path.join(session, 'step-1/parallel-2', name);
      mkdirSync(path.dirname(target), { recursive: true });
      if (name.endsWith('request.json') || name.endsWith('response.json')) content.parallel = 2;
      if (name === 'critique/request/request.json') content.inputs['stack-model'] = 'step-1/parallel-2/response/data/stack-model.json';
      const bytes = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      writeFileSync(target, bytes);
      if (name === 'request/request.json') state.requestHashes['1/2'] = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
    }
    state.steps['1/2'] = 'architecture.decide';
  }
  writeFileSync(path.join(session, 'state.json'), JSON.stringify(state));
  for (const [name, content] of Object.entries(files)) {
    if (content === null || name === 'producer') continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
const records = (conformance = null, proofs = null) => ({
  ...Object.fromEntries((conformance ?? FACETS.map((f) => conformanceRecord(f))).map((r) => [conformancePath(r.operationId, r.facet), r])),
  ...Object.fromEntries((proofs ?? PROOF_KINDS.map((k) => proofRecord(k))).map((r) => [proofPath(r.operationId, r.proofKind), r])),
});
const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/changes.md': changesMd(),
  'response/data/mutations.json': mutationsJson(),
  ...records(),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateBackendStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateBackendStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
// A dry run: the same plan, with nothing committed, nothing measured and nothing moved in the tree.
const dryFiles = () => ({
  'request/request.json': requestJson({ extra: { mode: 'dry' } }),
  'response/response.json': responseJson({
    commits: [],
    fields: { 'backend-source-application': 'response/response.md', changes: 'response/changes.md', mutations: 'response/data/mutations.json' },
  }),
  'response/response.md': responseMd({ mode: 'dry', commit: '—', changes: [[WRITER, 'added', OP, '—', '—'], [SPEC, 'added', OP, '—', '—']] }),
  'response/changes.md': changesMd({
    files: [[WRITER, 'unchanged', 'the mutation handler this run would add'], [SPEC, 'unchanged', 'the unit spec this run would add']],
    checkout: `\`@workspaces/be\` at \`${BASE}\` on \`${BRANCH}\`, nothing written`,
  }),
  'response/data/mutations.json': mutationsJson({ mode: 'dry', commit: null, changes: DRY_CHANGES }),
});
const blockedFiles = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'CONTRACT_WIDENED', fields: {}, commits: [], next: [] }),
});
// One mutation of the frozen contract, with the receipt and the records that must follow it.
const withOperation = (patch) => {
  const op = operation(patch);
  return {
    ...baseline(),
    'response/data/mutations.json': mutationsJson({ operations: [op] }),
    ...records(op.facets.map((f) => conformanceRecord(f)), op.proofKinds.map((k) => proofRecord(k))),
    'response/response.json': responseJson({
      fields: {
        'backend-source-application': 'response/response.md', changes: 'response/changes.md', mutations: 'response/data/mutations.json',
        conformance: op.facets.map((f) => conformancePath(OP, f)), proof: op.proofKinds.map((k) => proofPath(OP, k)),
      },
    }),
    'response/response.md': responseMd({ operations: [[OP, op.transport, op.writerRef, op.transactionBoundary, op.idempotencyKind, op.authorityDimensionIds.join(', ')]] }),
  };
};

const migrationFiles = ({ dry = false } = {}) => {
  const producer = migrationFixture({ operationId: OP, name: 'addIsolationScope' });
  const contract = producer['response/data/stack-model.json'];
  const original = contract.operations[0];
  const writer = original.writerRef;
  const spec = writer.replace('.ts', '.spec.ts');
  const op = { ...original, facets: [...FACETS, 'store', 'migration'], proofKinds: [...PROOF_KINDS, 'migration-replay'] };
  const files = withOperation(op);
  files.producer = producer;
  files['request/request.json'].requirements.mutableFileRefs = [writer, spec];
  const fingerprint = 'sha256:' + createHash('sha256').update(JSON.stringify(contract, null, 2)).digest('hex');
  files['request/request.json'].requirements.contractFingerprint = fingerprint;
  const changes = CHANGES.map((change, index) => ({ ...change, path: index ? spec : writer, ...(dry ? { afterHash: null } : {}) }));
  files['response/data/mutations.json'] = mutationsJson({ operations: [op], changes, ...(dry ? { mode: 'dry', commit: null } : {}) });
  files['response/changes.md'] = changesMd({ files: [[writer, dry ? 'unchanged' : 'created'], [spec, dry ? 'unchanged' : 'created']], ...(dry ? { checkout: `\`@workspaces/be\` at \`${BASE}\` on \`${BRANCH}\`, nothing written` } : {}) });
  files['response/response.md'] = responseMd({ operations: [[OP, op.transport, writer, op.transactionBoundary, op.idempotencyKind, op.authorityDimensionIds.join(', ')]], changes: changes.map(change => [change.path, change.change, OP, '—', change.afterHash ?? '—']), ...(dry ? { mode: 'dry', commit: '—' } : {}) });
  if (dry) {
    files['request/request.json'].requirements.mode = 'dry';
    files['response/response.json'].commits = [];
    delete files['response/response.json'].fields.conformance;
    delete files['response/response.json'].fields.proof;
  }
  for (const key of Object.keys(files)) {
    if (key === 'producer') continue;
    const raw = JSON.stringify(files[key]).replaceAll(CONTRACT_FP, fingerprint);
    files[key] = JSON.parse(raw);
  }
  return files;
};

await expectValid(migrationFiles(), 'standalone migration bound to a complete fingerprinted architecture producer');
await expectValid(migrationFiles({ dry: true }), 'standalone migration dry plan with the same frozen producer');
for (const [key, value] of [['transport', 'worker'], ['writerRef', 'src/other.ts'], ['migrationRefs', ['src/other.ts']], ['storeRefs', ['other-store']]]) {
  const files = migrationFiles();
  const op = files['response/data/mutations.json'].operations[0];
  op[key] = value;
  files['response/response.md'] = files['response/response.md'].replace('| migration |', `| ${op.transport} |`).replace('`src/persistence/migrations/add-scope.ts`', `\`${op.writerRef}\``);
  await expectError(files, `changed frozen ${key}`, `coherent output rewrite of frozen ${key}`);
}
{
  const files = migrationFiles(); delete files['request/request.json'].requirements.contractFingerprint;
  await expectError(files, 'contractFingerprint must match', 'migration request without a frozen input digest');
}
{
  const files = migrationFiles(); files.producer['response/data/stack-model.json'].operations[0].transport = 'worker';
  await expectError(files, 'contractFingerprint must match', 'producer transport changed after its consumer request was frozen');
}
{
  const files = migrationFiles(); delete files.producer;
  await expectError(files, 'migration contract:', 'migration output with a heading-only producer');
}
{
  const files = migrationFiles(); files.producer['critique/request/request.json'].operatorId = 'backend.source.apply';
  await expectError(files, 'critique metadata', 'malformed producer critique cannot recurse through the backend gate');
}
{
  const files = migrationFiles(); files['response/data/mutations.json'].operations = [];
  await expectError(files, 'declared operation enrol-course is missing', 'migration output dropped its producer operation');
}
{
  const files = migrationFiles(); files['request/request.json'].requirements.mutableFileRefs = [SPEC];
  await expectError(files, 'outside mutableFileRefs', 'migration writer outside the prewrite ceiling');
}
{
  const files = migrationFiles(); files['response/data/mutations.json'].operations[0].proofKinds = ['unit', 'integration'];
  await expectError(files, 'without declaring the migration-replay proof', 'standalone migration cannot omit replay');
}
{
  const files = migrationFiles(); files['response/data/mutations.json'].operations[0].facets = FACETS;
  await expectError(files, 'without declaring the migration facet', 'standalone migration cannot omit migration conformance');
}

await expectValid(baseline(), 'one operation filled inside the frozen contract and committed once');
await expectValid(dryFiles(), 'a dry run that plans the write set and commits, measures and writes nothing');
await expectValid(blockedFiles(), 'blocked on a contract the outcome would widen');

await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), stop: 'CONTRACT_WIDENED' } }, 'only a blocked response carries a stop', 'done with a stop');
await expectError({ ...blockedFiles(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', fields: {}, commits: [], next: [] }) }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['PROOF_UNAVAILABLE'] }) }, 'has disposition terminate under these requirements; it cannot be taken as a fallback', 'fallback on a terminate code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'PROOF_UNAVAILABLE', commits: [], next: [] }) }, 'a blocked branch cannot carry an implementation', 'blocked while reporting an implementation');
await expectError({ ...blockedFiles(), 'response/response.json': responseJson({ status: 'blocked', stop: 'CONTRACT_WIDENED', fields: {}, next: [] }) }, 'a blocked branch commits nothing', 'blocked with a commit');
await expectError({ ...baseline(), 'response/response.json': responseJson({ commits: [] }) }, 'commits its whole write set once, found 0 commits', 'a done branch that never committed');
await expectError({ ...baseline(), 'response/response.json': responseJson({ commits: [COMMIT, hash('9').slice(7, 47)] }) }, 'commits its whole write set once, found 2 commits', 'a done branch with two commits');
await expectError({ ...baseline(), 'response/data/mutations.json': mutationsJson({ commit: 'b'.repeat(40) }) }, 'differs from response.json commits[0]', 'the mutation record names another commit');
await expectError({ ...baseline(), 'response/data/mutations.json': mutationsJson({ commit: BASE }), 'response/response.json': responseJson({ commits: [BASE] }), 'response/response.md': responseMd({ commit: BASE }), 'response/changes.md': changesMd({ checkout: `\`@workspaces/be\` at \`${BASE}\` → \`${BASE}\` on \`${BRANCH}\`` }) }, 'nothing was written on the session branch', 'a commit equal to the base');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ checkout: `\`@workspaces/be\` at \`${BASE}\` → uncommitted` }) }, 'so the next request can pin exactly what was written', 'a change record that pins no commit');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { outcome: '' } }) }, 'required field outcome has no value', 'missing required outcome');
await expectError(withOperation({ writerRef: 'src/other/handler.ts' }), 'outside the mutable ceiling', 'a writer outside the mutable ceiling');
await expectError(withOperation({ migrationRefs: ['1700000000000-AddEnrolment.ts'], facets: [...FACETS, 'migration'] }), 'ships a migration without declaring the migration-replay proof', 'a migration with no replay proof');
await expectError(withOperation({ migrationRefs: ['1700000000000-AddEnrolment.ts'], proofKinds: [...PROOF_KINDS, 'migration-replay'] }), 'ships a migration without declaring the migration facet', 'a migration with no migration facet');
await expectError(withOperation({ transactionBoundary: 'read-only', migrationRefs: ['m.ts'], facets: [...FACETS, 'migration'], proofKinds: [...PROOF_KINDS, 'migration-replay'] }), 'is read-only but ships a migration', 'a read-only operation shipping a migration');
await expectError(withOperation({ transport: 'event-consumer', idempotencyKind: 'none' }), 'will apply twice on redelivery', 'an event consumer with no idempotency');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { ...responseJson().fields, conformance: FACETS.slice(0, 5).map((f) => conformancePath(OP, f)) } }) }, 'the operation declares the authorization facet and no record proves it', 'a declared facet with no record');
await expectError({ ...baseline(), [conformancePath(OP, 'writer')]: conformanceRecord('writer', { verdict: 'widened' }) }, 'reports widened writer conformance in a done branch', 'a widened facet in a done branch');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { ...responseJson().fields, conformance: [...FACETS.map((f) => conformancePath(OP, f)), conformancePath(OP, 'store')] } }), [conformancePath(OP, 'store')]: conformanceRecord('store') }, 'proves undeclared facet store', 'a facet the contract never declared');
await expectError({ ...baseline(), [conformancePath(OP, 'writer')]: conformanceRecord('transport') }, 'must be filed as response/data/conformance/enrol-course.transport.json', 'a conformance record filed under another name');
await expectError({ ...baseline(), [conformancePath(OP, 'writer')]: conformanceRecord('writer', { contractFingerprint: hash('9') }) }, 'measured against another contract fingerprint', 'a facet measured against another contract');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { ...responseJson().fields, proof: [proofPath(OP, 'unit')] } }) }, 'declares the integration proof and never ran it', 'a declared proof that never ran');
await expectError({ ...baseline(), [proofPath(OP, 'unit')]: proofRecord('unit', { result: 'failed', exitCode: 1 }) }, 'reports a failed unit proof in a done branch', 'a failed proof in a done branch');
await expectError({ ...baseline(), [proofPath(OP, 'unit')]: proofRecord('unit', { exitCode: 1 }) }, 'contradicts the passed verdict', 'a passing verdict over a non-zero exit code');
await expectError({ ...baseline(), 'response/data/mutations.json': mutationsJson({ changes: [{ ...CHANGES[0], change: 'modified', beforeHash: hash('1'), afterHash: hash('1') }, CHANGES[1]] }), 'response/response.md': responseMd({ changes: [[WRITER, 'modified', OP, hash('1'), hash('1')], [SPEC, 'added', OP, '—', hash('2')]] }) }, 'records a modification whose hashes are identical', 'a modification that never happened');
await expectError({ ...baseline(), 'response/data/mutations.json': mutationsJson({ changes: [{ ...CHANGES[0], beforeHash: hash('1') }, CHANGES[1]] }) }, 'is added with the wrong before hash', 'an added file carrying a before hash');
await expectError({ ...baseline(), 'response/data/mutations.json': mutationsJson({ changes: [CHANGES[0], { ...CHANGES[1], path: WRITER, afterHash: hash('2') }] }) }, 'carries more than one change record', 'one file changed twice');
await expectError({ ...baseline(), 'response/data/mutations.json': mutationsJson({ changes: [CHANGES[0], { ...CHANGES[1], operationId: 'ghost-op' }] }) }, 'names undeclared operation ghost-op', 'a change owned by no operation');
await expectError({ ...baseline(), 'response/data/mutations.json': mutationsJson({ changes: [CHANGES[0], { ...CHANGES[1], path: 'src/other/thing.ts' }] }) }, 'lies outside the mutable ceiling', 'a change outside the ceiling');
await expectError({ ...baseline(), 'response/response.md': responseMd({ operations: [[OP, 'rest', WRITER, 'single-transaction', 'request-token', 'effective-access']] }) }, 'reports transport rest, the contract froze graphql-mutation', 'a transport the contract did not freeze');
await expectError({ ...baseline(), 'response/response.md': responseMd({ operations: [[OP, 'graphql-mutation', WRITER, 'single-transaction', 'request-token', 'unapproved-dimension']] }) }, 'cites dimension unapproved-dimension, which the contract does not bind', 'an unapproved business dimension');
await expectError({ ...baseline(), 'response/response.md': responseMd({ findings: [['BUSINESS_QUESTION_RAISED', OP, null, 'the voucher rule on a foreign gateway was never decided']] }) }, 'cannot raise an unresolved business question', 'shipping with an open business question');
await expectError({ ...baseline(), 'response/response.md': responseMd({ contractFingerprint: hash('9') }) }, 'differs from the fingerprint the mutations were measured against', 'a receipt measured against another contract');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ files: [[WRITER, 'created']] }) }, 'which the change record omits', 'a changed file missing from the change record');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Changes', '## Change set') }, 'missing section ^## Changes$', 'response section renamed');
await expectError({ ...baseline(), 'response/response.json': (() => { const o = responseJson(); delete o.fields.mutations; return o; })() }, 'required output mutations is not in fields', 'missing required output');
await expectError({ ...baseline(), 'response/response.json': (() => { const o = responseJson(); delete o.fields.conformance; return o; })() }, 'required output conformance is not in fields', 'an applied branch that measured no facet');
await expectError({ ...dryFiles(), 'response/data/mutations.json': mutationsJson({ mode: 'dry', commit: COMMIT, changes: DRY_CHANGES }) }, 'a dry run commits nothing, so commit must be null', 'a dry plan carrying a commit');
await expectError({ ...dryFiles(), 'response/response.json': responseJson({ commits: [COMMIT], fields: { 'backend-source-application': 'response/response.md', changes: 'response/changes.md', mutations: 'response/data/mutations.json' } }) }, 'a dry run records no commit', 'a dry run that committed');
await expectError({ ...dryFiles(), 'response/data/mutations.json': mutationsJson({ mode: 'dry', commit: null }) }, 'reports an after hash under a dry run', 'a dry plan carrying an after hash');
await expectError({ ...dryFiles(), ...records(), 'response/response.json': responseJson({ commits: [], fields: { ...responseJson().fields } }) }, 'a dry run measures nothing', 'a dry run carrying conformance and proof records');
await expectError({ ...dryFiles(), 'response/changes.md': changesMd({ files: [[WRITER, 'created'], [SPEC, 'created']], checkout: `\`@workspaces/be\` at \`${BASE}\` on \`${BRANCH}\`, nothing written` }) }, 'under a dry run, which leaves every path unchanged', 'a dry change record reporting a move');
await expectError({ ...dryFiles(), 'response/data/mutations.json': mutationsJson({ commit: null, changes: DRY_CHANGES }) }, "mode apply differs from the request's dry", 'a plan that re-decides the mode');

process.stdout.write('backend.source.apply self-test: 5 valid branches, 55 rejected mutations\n');
