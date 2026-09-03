// Proves validate.mjs on a synthetic session branch: one converged observability operation, one
// already-converged no-op, one blocked on a port conflict, and one mutation per law, each of which
// must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validatePlatformStep, KIND_CHECKS, RUNG_CHECKS, QUEUED_CHECKS } from './validate.mjs';

const PLAN = `sha256:${'0'.repeat(64)}`;
const FP = `sha256:${'1'.repeat(64)}`;
const SERVICE = 'prometheus/shared';
const OWNER = 'platform-team';
const APPROVAL = '@worktrees/debts/be.md#metrics-approval';
const EFFECTS = ['update-config', 'update-remote-write'];
const CAPABILITIES = [{ capability: 'metrics:remote-write', custodyEvidenceRef: 'custody/metrics.json' }];

const resource = (ref = SERVICE, kind = 'observability', revision = 'r-14') => ({ resourceRef: ref, kind, revision, ownerRef: OWNER });
const mutation = (effect, over = {}) => ({ effect, resourceRef: SERVICE, beforeRevision: 'r-14', afterRevision: 'r-15', ...over });
const check = (name, status = 'passed') => ({ name, resourceRef: SERVICE, status, evidenceRef: `logs/${name}.txt` });
const checkList = (names = KIND_CHECKS.observability, status = 'passed') => names.map((n) => check(n, status));

function delta({
  convergence = 'converged', mutations = EFFECTS.map((e) => mutation(e)), appliedEffects, allowedEffects = EFFECTS,
  capabilities = CAPABILITIES, resources = [resource()], portHolders = [], portClaims = [], serviceKind = 'observability',
  planSha256 = PLAN, approvalRef = APPROVAL, mutableResourceRefs = [SERVICE], serviceRef = SERVICE, runtimeLadder,
} = {}) {
  return {
    ...(runtimeLadder ? { runtimeLadder } : {}),
    serviceRef, serviceKind, ownerRef: OWNER, approvalRef, planSha256,
    inventoryFingerprint: FP, generation: 7, observedAt: '2026-01-10T00:00:00.000Z',
    inventoriedResources: resources, observedPortHolders: portHolders, portClaims,
    mutableResourceRefs, observationOnlyResourceRefs: [],
    allowedEffects, appliedEffects: appliedEffects ?? [...new Set(mutations.map((m) => m.effect))],
    capabilities, convergence, mutations,
  };
}

function checksJson({ serviceKind = 'observability', required = KIND_CHECKS.observability, list = checkList(), findings, serviceRef = SERVICE } = {}) {
  return {
    serviceRef, serviceKind, requiredCheckNames: required, checks: list,
    findings: findings ?? [{ code: 'SHARED_SERVICE_INVENTORIED', resourceRef: SERVICE, port: null, holderRef: null, statement: 'the service was inventoried before anything changed' }],
  };
}

function responseMd({ convergence = 'converged', mutations = EFFECTS.map((e) => mutation(e)), list = checkList(), findings = [['SHARED_SERVICE_INVENTORIED', SERVICE, '—', '—', 'the service was inventoried before anything changed']], service = SERVICE, kind = 'observability', plan = PLAN, approval = APPROVAL, resources = [resource()], portHolders = [] } = {}) {
  return `# platform-operation-receipt — ${kind} ${service}

The shared service was inventoried, the approved delta was applied, and the branch's complete proof
set was proved on its own evidence.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`platform.operate\` |
| Step | \`step-1/parallel-1\` |
| Project | \`starci-academy\` |
| Service | ${service} |
| Service kind | ${kind} |
| Owner | \`${OWNER}\` |
| Approval | ${approval} |
| Desired state | \`${plan}\` |
| Inventory fingerprint | \`${FP}\` |

## Convergence

| Field | Value |
| --- | --- |
| Convergence | ${convergence} |

## Inventoried resources

| Resource | Kind | Revision | Owner |
| --- | --- | --- | --- |
${resources.map((r) => `| \`${r.resourceRef}\` | ${r.kind} | ${r.revision} | \`${r.ownerRef}\` |`).join('\n')}

## Port holders

| Port | Holder | Evidence |
| --- | --- | --- |
${portHolders.map((h) => `| ${h.port} | \`${h.holderRef}\` | \`${h.evidenceRef}\` |`).join('\n')}

## Mutations

| Effect | Resource | Before | After |
| --- | --- | --- | --- |
${mutations.map((m) => `| \`${m.effect}\` | \`${m.resourceRef}\` | ${m.beforeRevision ?? '—'} | ${m.afterRevision} |`).join('\n')}

## Checks

| Check | Resource | Status | Evidence |
| --- | --- | --- | --- |
${list.map((c) => `| \`${c.name}\` | \`${c.resourceRef}\` | ${c.status} | \`${c.evidenceRef}\` |`).join('\n')}

## Findings

| Code | Resource | Port | Holder | Statement |
| --- | --- | --- | --- | --- |
${findings.map(([code, res, port, holder, statement]) => `| \`${code}\` | \`${res}\` | ${port} | ${holder} | ${statement} |`).join('\n')}
`;
}

const requestJson = ({ kind = 'observability', effects = EFFECTS, resourceRefs = [SERVICE], mutableResourceRefs = [SERVICE], observationOnlyResourceRefs = [], portClaims = [], plan = PLAN, service = SERVICE, approval = APPROVAL, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'platform.operate', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@worktrees/sessions/central-runtime', head: null }],
  requirements: {
    service, approval, portClaims, resume: null,
    desiredState: { planSha256: plan, serviceKind: kind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs },
    ...extra,
  },
  inputs: {}, resume: null,
});

const responseJson = ({ status = 'done', stop, next = ['release.deploy'], account = false } = {}) => ({
  schemaVersion: 9, operatorId: 'platform.operate', step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [],
  fields: status === 'blocked' ? {} : {
    'platform-operation-receipt': 'response/response.md', delta: 'response/data/delta.json', checks: 'response/data/checks.json',
    ...(account ? { 'uat-account': 'response/data/account.json' } : {}),
  },
  commits: [], next,
});

// The two branches that act for one bound project route. The registry holds one entry per
// <project>/<role>, and that entry is the resource both branches operate.
const ENTRY = 'demo-product/fe';
const FLOW = 'paid-enrolment';
const rtCheck = (name, status = 'passed') => ({ name, resourceRef: ENTRY, status, evidenceRef: `probes/${name}.json` });
const entryDelta = (serviceKind, effects, over = {}) => delta({
  serviceKind, serviceRef: ENTRY, mutableResourceRefs: [ENTRY], resources: [resource(ENTRY, serviceKind, 'g-6')],
  allowedEffects: effects, mutations: effects.map((e) => mutation(e, { resourceRef: ENTRY, beforeRevision: 'g-5', afterRevision: 'g-6' })),
  capabilities: (serviceKind === 'runtime' ? ['runtime:registry-write'] : ['identity:account-admin']).map((c) => ({ capability: c, custodyEvidenceRef: `custody/${serviceKind}.json` })),
  ...over,
});
const entryChecks = (serviceKind, findings, list, required) => checksJson({
  serviceKind, serviceRef: ENTRY, required: required ?? KIND_CHECKS[serviceKind],
  list: list ?? KIND_CHECKS[serviceKind].map((n) => rtCheck(n)),
  findings,
});
const entryMd = (serviceKind, effects, findings, list) => responseMd({
  kind: serviceKind, service: ENTRY, resources: [resource(ENTRY, serviceKind, 'g-6')],
  mutations: effects.map((e) => mutation(e, { resourceRef: ENTRY, beforeRevision: 'g-5', afterRevision: 'g-6' })),
  list: list ?? KIND_CHECKS[serviceKind].map((n) => rtCheck(n)), findings,
});
const ENV = 'local';
const accountRecord = ({ accounts, ...over } = {}) => ({
  env: ENV, flow: FLOW, identity: ENTRY, plaintextRecorded: false,
  accounts: accounts ?? {
    learner: {
      username: `uat-${FLOW}-learner`, role: 'learner', credentialName: 'uat-shared', sealed: `.stacks/${ENV}/secrets/uat.enc`,
      provisionedBy: '20260110-000000-1111111', createdAt: '2026-01-10T00:05:00.000Z',
    },
  },
  ...over,
});

// The runtime ladder. One integration branch on one fixed port: a session's commit is merged in and
// the one server is restarted on the result, or the session waits behind the lease that is merging.
const SESSION = 's-test';
const OTHER = 's-other';
const UAT_OLD = 'b'.repeat(40);
const UAT_NEW = 'c'.repeat(40);
const WANT = 'd'.repeat(40);
const OTHER_COMMIT = 'e'.repeat(40);
const MERGE_COMMIT = 'f'.repeat(40);
const WORKTREE = '.worktrees/demo-product/uat';
// The build-cache decision a start records: kept because the manifests did not move, or cleared
// with the reason that made it go.
const CACHE_KEPT = { cleared: false, reason: 'unchanged', directories: [], previousHead: UAT_OLD };
const CACHE_CLEARED = (reason, previousHead = UAT_OLD) => ({ cleared: true, reason, directories: ['apps/app/.next'], previousHead });
const server = (over = {}) => ({ pid: 4200, previousPid: 4100, port: 3067, command: 'npm run dev', logRef: 'logs/uat.log', pidFileRef: 'logs/uat.pid', startedAt: '2026-01-10T00:02:00.000Z', cache: CACHE_KEPT, ...over });

const ladder = (over = {}) => ({
  routeKey: ENTRY, operation: 'serve', rung: 'serve', reused: false, sessionId: SESSION,
  wantedCommit: WANT, servedHead: UAT_NEW, contains: [OTHER_COMMIT, WANT],
  integration: {
    worktreeRef: WORKTREE, branch: 'uat', createdFrom: null,
    merges: [{ ref: 'session/s-test', commit: WANT, mergeCommit: MERGE_COMMIT, kind: 'session', resolutions: [] }],
    conflict: false,
  },
  infra: null, locations: [],
  observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] },
  server: server(),
  queuePosition: null,
  lease: { sessionId: SESSION, since: '2026-01-10T00:01:00.000Z', operation: 'serve', queue: [] },
  ...over,
});

const rungBranch = ({ rung = 'serve', effects, ladderOver = {}, checkNames, findings, extra = {}, status = 'done' } = {}) => {
  const lad = ladder({ operation: rung, rung, ...ladderOver });
  const applied = effects ?? ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'];
  const list = (checkNames ?? RUNG_CHECKS[rung]).map((n) => rtCheck(n));
  const found = findings ?? [{ code: 'RUNTIME_HEAD_SERVED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the session commit was merged into the integration branch and the server restarted on the result' }];
  return {
    'request/request.json': requestJson({ kind: 'runtime', service: ENTRY, effects: applied, resourceRefs: [ENTRY], mutableResourceRefs: [ENTRY], extra: { routeKey: ENTRY, operation: rung, ...extra } }),
    'response/response.json': responseJson({ status, next: ['frontend.surface.audit'] }),
    'response/response.md': entryMd('runtime', applied, found.map((f) => [f.code, f.resourceRef, f.port ?? '—', f.holderRef ?? '—', f.statement]), list),
    'response/data/delta.json': entryDelta('runtime', applied, { runtimeLadder: lad }),
    'response/data/checks.json': entryChecks('runtime', found, list, checkNames ?? RUNG_CHECKS[rung]),
  };
};

// An already-running service is attested where it stands: probed, recorded, and never restarted.
const attesting = (over = {}) => ({
  ...rungBranch({
    rung: 'serve',
    effects: ['attest-runtime-entry'],
    ladderOver: {
      reused: true, integration: null, servedHead: UAT_OLD, contains: [OTHER_COMMIT, WANT],
      observed: { head: UAT_OLD, containsWanted: true, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] },
      server: server({ pid: 4100, startedAt: '2026-01-10T00:00:00.000Z' }),
    },
    findings: [{ code: 'RUNTIME_HEAD_REUSED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the running head already contained the wanted commit and its endpoint answered, so nothing was restarted' }],
  }),
  ...over,
});

// A flow with no account is a flow nobody has run yet: the account is created and published as names.
const provisioning = (over = {}) => ({
  'request/request.json': requestJson({ kind: 'identity', service: ENTRY, effects: ['provision-identity', 'seed-flow-fixtures'], resourceRefs: [ENTRY], mutableResourceRefs: [ENTRY], extra: { routeKey: ENTRY, flow: FLOW } }),
  'response/response.json': responseJson({ next: ['uat.verify'], account: true }),
  'response/response.md': entryMd('identity', ['provision-identity', 'seed-flow-fixtures'], [['IDENTITY_PROVISIONED', ENTRY, '—', '—', 'the flow had no account, so one was created and its password set from the sealed name']]),
  'response/data/delta.json': entryDelta('identity', ['provision-identity', 'seed-flow-fixtures']),
  'response/data/checks.json': entryChecks('identity', [{ code: 'IDENTITY_PROVISIONED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the flow had no account, so one was created and its password set from the sealed name' }]),
  'response/data/account.json': accountRecord(),
  ...over,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'platform-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': 'platform.operate' }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}

const baseline = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/delta.json': delta(),
  'response/data/checks.json': checksJson(),
  ...over,
});

const alreadyConverged = () => baseline({
  'request/request.json': requestJson({ effects: [] }),
  'response/data/delta.json': delta({ convergence: 'already-converged', mutations: [] }),
  'response/data/checks.json': checksJson({ findings: [{ code: 'ALREADY_CONVERGED', resourceRef: SERVICE, port: null, holderRef: null, statement: 'the service already matched the approved plan' }] }),
  'response/response.md': responseMd({ convergence: 'already-converged', mutations: [], findings: [['ALREADY_CONVERGED', SERVICE, '—', '—', 'the service already matched the approved plan']] }),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validatePlatformStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validatePlatformStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

await expectValid(baseline(), 'a converged observability operation with the complete proof set');
await expectValid(alreadyConverged(), 'an already-converged service as a proved no-op');
await expectValid({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'PORT_CONFLICT', next: [] }),
  'response/response.md': null, 'response/data/delta.json': null, 'response/data/checks.json': null,
}, 'blocked on a port conflict before anything changed');

await expectError(baseline({ 'response/response.json': { ...responseJson(), stop: 'PROOF_FAILED' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(baseline({ 'response/response.json': responseJson({ status: 'blocked', stop: 'PORT_SEIZED', next: [] }) }), 'not a registered code', 'unknown stop code');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { credential: 'token: abcdefghijklmnop' } }) }), 'requirements.credential is not a field', 'a credential has nowhere to go in the request');
await expectError(baseline({ 'request/request.json': requestJson({ approval: null }) }), 'required field approval has no value', 'a shared runtime change nobody approved');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { serviceKind: 'observability' } }) }), 'requirements.serviceKind is not a field', 'a field the operator no longer declares');
await expectError(baseline({ 'request/request.json': requestJson({ effects: ['assign-gate'] }) }), 'does not belong to the observability service kind', 'a Sonar effect filed under observability');
await expectError(baseline({ 'request/request.json': requestJson({ mutableResourceRefs: ['other/service'], resourceRefs: [SERVICE] }) }), 'must be inside desiredState.mutableResourceRefs', 'the service outside its own mutable ceiling');
await expectError(baseline({ 'request/request.json': requestJson({ observationOnlyResourceRefs: [SERVICE] }) }), 'cannot be both mutable and observation-only', 'a resource in both scope sets');
await expectError(baseline({ 'request/request.json': requestJson({ portClaims: [{ port: 9090, resourceRef: 'product/web' }] }) }), 'which this operation does not own', 'a port claimed for a foreign resource');
await expectError(baseline({ 'request/request.json': requestJson({ portClaims: [{ port: 9090, resourceRef: SERVICE }, { port: 9090, resourceRef: SERVICE }] }) }), 'must not claim the same port twice', 'the same port claimed twice');
await expectError(baseline({ 'response/data/delta.json': delta({ resources: [resource('other/service')] }) }), 'was not inventoried before the operation', 'the operated service never inventoried');
await expectError(baseline({ 'response/data/delta.json': delta({ resources: [resource(SERVICE, 'sonar')] }) }), 'belongs to the sonar branch and is outside this observability operation', 'a resource from another branch');
await expectError(baseline({ 'response/data/delta.json': delta({ planSha256: `sha256:${'9'.repeat(64)}` }) }), 'planSha256 must equal the approved plan hash', 'a plan hash nobody approved');
await expectError(baseline({ 'response/data/delta.json': delta({ approvalRef: '@worktrees/debts/be.md#other' }) }), 'the bound approval is not the one the request declared', 'an approval borrowed from another plan');
await expectError(baseline({ 'request/request.json': requestJson({ effects: ['update-config', 'restart-service'] }), 'response/data/delta.json': delta({ allowedEffects: EFFECTS }) }), 'is outside the approved effect set', 'an effect outside the approval');
await expectError(baseline({ 'response/data/delta.json': delta({ capabilities: [] }) }), 'requires the metrics:remote-write capability', 'a branch running without its capability');
await expectError(baseline({ 'response/data/checks.json': checksJson({ required: KIND_CHECKS.observability.slice(0, 3), list: checkList(KIND_CHECKS.observability.slice(0, 3)) }) }), 'must require the remote-write-delivery check', 'a narrowed proof set');
await expectError(baseline({ 'response/data/checks.json': checksJson({ list: checkList(KIND_CHECKS.observability.slice(0, 6)) }), 'response/response.md': responseMd({ list: checkList(KIND_CHECKS.observability.slice(0, 6)) }) }), 'cannot be proved without the sensitive-data-filter check', 'an operated outcome missing a check');
await expectError(baseline({ 'response/data/checks.json': checksJson({ list: checkList(KIND_CHECKS.observability, 'failed') }), 'response/response.md': responseMd({ list: checkList(KIND_CHECKS.observability, 'failed') }) }), 'so the operation cannot be reported as operated', 'an operated outcome over a failed check');
await expectError(baseline({ 'response/data/delta.json': delta({ mutations: [mutation('update-config'), mutation('update-remote-write', { resourceRef: 'ghost/service' })] }) }), 'was mutated without being inventoried first', 'a mutation on a resource nobody inventoried');
await expectError(baseline({ 'response/data/delta.json': delta({ portHolders: [{ port: 9090, holderRef: SERVICE, evidenceRef: 'ss.txt' }] }) }), 'holds a claimed port and must never be mutated to free it', 'a port freed by mutating its holder');
await expectError(baseline({ 'response/data/delta.json': delta({ appliedEffects: [...EFFECTS, 'restart-service'] }) }), 'records no mutation', 'an applied effect with no mutation');
await expectError(baseline({ 'response/data/delta.json': delta({ convergence: 'already-converged' }) }), 'already-converged operation cannot report a mutation', 'a no-op that mutated');
await expectError(baseline({ 'response/data/delta.json': delta({ convergence: 'converged', mutations: [] }), 'response/response.md': responseMd({ mutations: [] }) }), 'converged operation must report the mutation that converged it', 'convergence with nothing applied');
await expectError(baseline({ 'response/data/checks.json': checksJson({ findings: [{ code: 'PORT_COORDINATION_REQUIRED', resourceRef: SERVICE, port: 9090, holderRef: 'product/web', statement: 'the port is held elsewhere' }] }), 'response/response.md': responseMd({ findings: [['PORT_COORDINATION_REQUIRED', SERVICE, '9090', '`product/web`', 'the port is held elsewhere']] }) }), 'cannot end in an operated outcome', 'a port coordination finding on an operated receipt');
await expectError(baseline({ 'response/data/checks.json': checksJson({ findings: [{ code: 'SHARED_SERVICE_INVENTORIED', resourceRef: 'ghost/service', port: null, holderRef: null, statement: 'x' }] }) }), 'names an uninventoried resource', 'a finding on a resource nobody inventoried');
await expectError(baseline({ 'response/data/delta.json': delta({ capabilities: [{ capability: 'metrics:remote-write', custodyEvidenceRef: 'capability://metrics/remote-write' }] }) }), 'records a credential, which the receipt refuses', 'a capability handle inside the delta');
await expectError(baseline({ 'response/response.md': responseMd({ service: 'other/service' }) }), 'Binding names a service the request did not operate', 'a receipt for another service');
await expectError(baseline({ 'response/response.md': responseMd().replace('## Checks', '## Proofs') }), 'missing section ^## Checks$', 'receipt section renamed');
await expectError(baseline({ 'response/data/delta.json': { ...delta(), inventoryFingerprint: 'nope' } }), 'inventoryFingerprint', 'delta schema');
await expectError(baseline({ 'response/response.json': (() => { const o = responseJson(); delete o.fields.checks; return o; })() }), 'required output checks is not in fields', 'missing required output');

// The runtime and identity branches.
await expectValid(attesting(), 'a running runtime attested where it stands, with no restart');
await expectValid(provisioning(), 'a flow that had no account: one created, seeded, and published as names');

await expectError(attesting({ 'request/request.json': requestJson({ kind: 'runtime', service: ENTRY, effects: ['attest-runtime-entry'], resourceRefs: [ENTRY], mutableResourceRefs: [ENTRY] }) }), 'routeKey names none', 'an attestation with no registry entry to attest');
await expectError(attesting({ 'request/request.json': requestJson({ kind: 'runtime', service: ENTRY, effects: ['attest-runtime-entry'], resourceRefs: [ENTRY], mutableResourceRefs: [ENTRY], extra: { routeKey: 'demo-product' } }) }), 'is not a <project>/<role> registry entry', 'a route key that names no route');
await expectError(attesting({ 'response/data/delta.json': entryDelta('runtime', ['attest-runtime-entry'], { mutations: [mutation('attest-runtime-entry', { resourceRef: 'demo-product/be', beforeRevision: 'g-5', afterRevision: 'g-6' })], resources: [resource(ENTRY, 'runtime', 'g-6'), resource('demo-product/be', 'runtime', 'g-6')], mutableResourceRefs: [ENTRY, 'demo-product/be'] }) }), 'which is not the registry entry', 'an attestation that wrote a sibling route entry');
await expectError(attesting({ 'response/data/checks.json': entryChecks('runtime', [{ code: 'RUNTIME_ENTRY_ATTESTED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'x' }], KIND_CHECKS.runtime.map((n) => rtCheck(n, n === 'endpoints-served' ? 'failed' : 'passed'))) }), 'a status nobody probed is an assertion', 'an entry reported ready over a failed probe');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { routeKey: ENTRY } }) }), 'operates no project route', 'a shared-service branch carrying a route key');
await expectError(provisioning({ 'request/request.json': requestJson({ kind: 'identity', service: ENTRY, effects: ['provision-identity', 'seed-flow-fixtures'], resourceRefs: [ENTRY], mutableResourceRefs: [ENTRY], extra: { routeKey: ENTRY } }) }), 'flow names none', 'provisioning for no flow at all');
await expectError(provisioning({ 'response/response.json': responseJson({ next: ['uat.verify'] }), 'response/data/account.json': null }), 'the account record it wrote is published with it', 'an account created and never published');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ identity: 'demo-product/be' }) }), 'belongs to registry entry', 'an account filed under another registry entry');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ accounts: { learner: { username: `uat-${FLOW}-learner`, role: 'learner', credentialName: 'uat-shared', sealed: `.stacks/${ENV}/secrets/uat.enc`, provisionedBy: null, createdAt: '2026-01-10T00:05:00.000Z' } } }) }), 'names the run that provisioned it', 'an account this run created and left unattributed');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ accounts: { learner: { username: `uat-${FLOW}-learner`, role: 'password: hunter2-hunter2', credentialName: 'uat-shared', sealed: `.stacks/${ENV}/secrets/uat.enc`, provisionedBy: '20260110-000000-1111111', createdAt: '2026-01-10T00:05:00.000Z' } } }) }), 'carries a credential', 'a secret filed in the account record');
await expectError(provisioning({ 'response/data/account.json': { ...accountRecord(), password: 'x' } }), 'unexpected property', 'an account record with a place to hold a secret');
await expectError(provisioning({ 'response/data/checks.json': entryChecks('identity', [{ code: 'SHARED_SERVICE_INVENTORIED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'x' }]), 'response/response.md': entryMd('identity', ['provision-identity', 'seed-flow-fixtures'], [['SHARED_SERVICE_INVENTORIED', ENTRY, '—', '—', 'x']]) }), 'records the IDENTITY_PROVISIONED finding', 'a provisioning the receipt never names');
await expectError(attesting({ 'request/request.json': requestJson({ kind: 'runtime', service: ENTRY, effects: ['provision-identity'], resourceRefs: [ENTRY], mutableResourceRefs: [ENTRY], extra: { routeKey: ENTRY } }) }), 'does not belong to the runtime service kind', 'an identity effect filed under the runtime branch');


// The ladder, rung by rung, and the two sessions that share one product.
const stackUp = (over = {}) => ({
  ...rungBranch({
    rung: 'stack-up',
    effects: ['bring-up-infra-stack', 'attest-runtime-entry'],
    ladderOver: {
      wantedCommit: null, servedHead: null, contains: [], integration: null, server: null, lease: null,
      infra: { env: 'local', stackRef: '.stacks/local/infra', services: [{ name: 'database', port: 5432, ready: true, evidenceRef: 'probes/database.json' }, { name: 'identity', port: 8089, ready: true, evidenceRef: 'probes/identity.json' }] },
      observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] },
    },
    findings: [{ code: 'RUNTIME_RUNG_CLIMBED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the environment infrastructure came up and its declared origin rule admits the served origin' }],
  }),
  ...over,
});

const locating = (over = {}) => ({
  ...rungBranch({
    rung: 'locate',
    effects: ['locate-routed-checkouts', 'attest-runtime-entry'],
    ladderOver: {
      wantedCommit: null, servedHead: null, contains: [], integration: null, server: null, lease: null,
      locations: [{ role: 'fe', checkoutRef: '@workspaces/demo-product/fe', head: UAT_OLD, devCommand: 'npm run dev' }],
      observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] },
    },
    findings: [{ code: 'RUNTIME_RUNG_CLIMBED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the routed checkout resolved through the workspace route and its head was observed' }],
  }),
  ...over,
});

const startingRole = (over = {}) => ({
  ...rungBranch({
    rung: 'start-role',
    effects: ['merge-into-integration-branch', 'start-role-runtime', 'attest-runtime-entry'],
    ladderOver: {
      sessionId: null, lease: null,
      integration: { worktreeRef: WORKTREE, branch: 'uat', createdFrom: 'main', merges: [{ ref: 'main', commit: WANT, mergeCommit: MERGE_COMMIT, kind: 'mainline', resolutions: [] }], conflict: false },
      contains: [WANT],
      locations: [{ role: 'fe', checkoutRef: '@workspaces/demo-product/fe', head: WANT, devCommand: 'npm run dev' }],
      observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] },
      server: server({ previousPid: null, cache: CACHE_CLEARED('previous-unknown', null) }),
    },
  }),
  ...over,
});

// Session A merges its commit into the integration branch and the one server restarts on the result.
const servingFirst = (over = {}) => ({ ...rungBranch({ rung: 'serve', extra: { commit: WANT } }), ...over });

// Session B asks while A holds the lease: it is queued and told where it stands, never given a
// second server.
const queuedBehind = (over = {}) => ({
  ...rungBranch({
    rung: 'serve',
    effects: ['queue-runtime-lease', 'attest-runtime-entry'],
    checkNames: QUEUED_CHECKS,
    ladderOver: {
      sessionId: SESSION, wantedCommit: OTHER_COMMIT, servedHead: UAT_OLD, contains: [WANT],
      integration: null, server: null, queuePosition: 1,
      observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: OTHER, queue: [] },
      lease: { sessionId: OTHER, since: '2026-01-10T00:01:00.000Z', operation: 'serve', queue: [SESSION] },
    },
    extra: { commit: OTHER_COMMIT },
    findings: [{ code: 'RUNTIME_LEASE_BUSY', resourceRef: ENTRY, port: null, holderRef: null, statement: 'another session holds the lease while it merges, so this session is queued behind it' }],
  }),
  ...over,
});

// The lease is released and session B is served: same port, same branch, both commits inside the head.
const servingSecond = (over = {}) => ({
  ...rungBranch({
    rung: 'serve',
    ladderOver: {
      wantedCommit: OTHER_COMMIT, contains: [WANT, OTHER_COMMIT],
      integration: { worktreeRef: WORKTREE, branch: 'uat', createdFrom: null, merges: [{ ref: 'main', commit: UAT_OLD, mergeCommit: MERGE_COMMIT, kind: 'mainline', resolutions: [] }, { ref: 'session/s-other', commit: OTHER_COMMIT, mergeCommit: UAT_NEW, kind: 'session', resolutions: [] }], conflict: false },
    },
    extra: { commit: OTHER_COMMIT },
  }),
  ...over,
});

const stopping = (over = {}) => ({
  ...rungBranch({
    rung: 'stop',
    effects: ['stop-runtime-server', 'attest-runtime-entry'],
    ladderOver: { wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: null, lease: null, observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: SESSION, queue: [] } },
    findings: [{ code: 'RUNTIME_SERVER_STOPPED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the pid the entry recorded was stopped and the lease released' }],
  }),
  ...over,
});

await expectValid(stackUp(), 'the stack-up rung on a machine with nothing running');
await expectValid(locating(), 'the locate rung resolving the routed checkout through its route');
await expectValid(startingRole(), 'the start-role rung starting the one server from the integration worktree');
await expectValid(servingFirst(), 'one session merged into the integration branch and served');
await expectValid(queuedBehind(), 'a second session queued behind the lease instead of given a second server');
await expectValid(servingSecond(), 'the second session served after the release: same port, both commits inside the head');
await expectValid(stopping(), 'a stop that kills the pid the entry recorded and releases the lease');

// A restart is not a rebuild: the same head started again clears the build cache first when the
// declared manifests or lockfiles moved since the previous record, and reset clears it by name.
const restarting = (over = {}) => ({
  ...rungBranch({
    rung: 'restart',
    effects: ['restart-runtime-server', 'attest-runtime-entry'],
    ladderOver: { wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server({ cache: CACHE_CLEARED('manifests-changed') }) },
    findings: [{ code: 'RUNTIME_SERVER_RESTARTED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the same head was started again; a lockfile moved since the previous record, so the build cache was cleared first' }],
  }),
  ...over,
});
const resetting = (over = {}) => ({
  ...rungBranch({
    rung: 'reset',
    effects: ['reset-runtime-server', 'attest-runtime-entry'],
    ladderOver: { wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server({ cache: CACHE_CLEARED('asked') }) },
    findings: [{ code: 'RUNTIME_SERVER_RESET', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the server was stopped, the build cache cleared by name, and the same head started again' }],
  }),
  ...over,
});
await expectValid(restarting(), 'a restart that cleared the build cache because the manifests moved');
await expectValid(resetting(), 'a reset that cleared the build cache by name');
await expectError(resetting({ 'response/data/delta.json': entryDelta('runtime', ['reset-runtime-server', 'attest-runtime-entry'], { runtimeLadder: ladder({ operation: 'reset', rung: 'reset', wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server() }) }) }), 'clears the build cache by definition', 'a reset that kept the build cache');
await expectError(restarting({ 'response/data/delta.json': entryDelta('runtime', ['restart-runtime-server', 'attest-runtime-entry'], { runtimeLadder: ladder({ operation: 'restart', rung: 'restart', wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server({ cache: { ...CACHE_KEPT, reason: 'manifests-changed' } }) }) }) }), 'exactly when a reason to clear it was recorded', 'a restart that saw the manifests move and kept the cache anyway');
await expectError(startingRole({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'start-role-runtime', 'attest-runtime-entry'], { runtimeLadder: ladder({ operation: 'start-role', rung: 'start-role', sessionId: null, lease: null, integration: { worktreeRef: WORKTREE, branch: 'uat', createdFrom: 'main', merges: [{ ref: 'main', commit: WANT, mergeCommit: MERGE_COMMIT, kind: 'mainline', resolutions: [] }], conflict: false }, contains: [WANT], locations: [{ role: 'fe', checkoutRef: '@workspaces/demo-product/fe', head: WANT, devCommand: 'npm run dev' }], observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] }, server: server({ previousPid: null, cache: { ...CACHE_KEPT, previousHead: null } }) }) }) }), 'nothing proves the manifests unchanged', 'a first start that trusted a cache nothing had recorded');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ server: server({ cache: { ...CACHE_KEPT, previousHead: UAT_NEW } }) }) }) }), 'other than the one the entry recorded', 'a cache decision made against a head the entry never served');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ server: (() => { const s = server(); delete s.cache; return s; })() }) }) }), 'runtimeLadder.server', 'a started server that never said what became of the build cache');
// A conflicting hunk is resolved by rule, recorded on the merge, and the merged head is gated before
// the server restarts on it.
const RESOLUTION = { file: 'apps/app/src/page.tsx', hunkRange: '12-18', rule: 'incoming-session-owned' };
const resolvedMerge = () => ({
  worktreeRef: WORKTREE, branch: 'uat', createdFrom: null,
  merges: [{ ref: 'session/s-test', commit: WANT, mergeCommit: MERGE_COMMIT, kind: 'session', resolutions: [RESOLUTION] }],
  conflict: true,
});
const RESOLVED_FINDING = { code: 'INTEGRATION_RESOLVED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the merge met one conflicting hunk and resolved it by rule before gating the merged head' };

const conflictResolvedGateGreen = (over = {}) => ({
  ...rungBranch({
    rung: 'serve',
    ladderOver: { integration: resolvedMerge() },
    findings: [RESOLVED_FINDING, { code: 'RUNTIME_HEAD_SERVED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the session commit was merged into the integration branch and the server restarted on the result' }],
  }),
  ...over,
});
await expectValid(conflictResolvedGateGreen(), 'a conflicting merge resolved by rule and gated green before the server restarted');

const conflictResolvedGateRed = () => {
  const applied = ['merge-into-integration-branch', 'attest-runtime-entry'];
  const lad = ladder({ servedHead: UAT_OLD, contains: [OTHER_COMMIT], server: null, integration: resolvedMerge() });
  const list = RUNG_CHECKS.serve.map((n) => rtCheck(n, n === 'gates-passed' ? 'failed' : 'passed'));
  const findings = [RESOLVED_FINDING, { code: 'INTEGRATION_GATE_FAILED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'typecheck failed on the merged head, so the server was not restarted on it' }];
  return {
    'request/request.json': requestJson({ kind: 'runtime', service: ENTRY, effects: applied, resourceRefs: [ENTRY], mutableResourceRefs: [ENTRY], extra: { routeKey: ENTRY, operation: 'serve', commit: WANT } }),
    'response/response.json': { schemaVersion: 9, operatorId: 'platform.operate', step: 1, parallel: 1, status: 'blocked', stop: 'INTEGRATION_FAILED', fallbacks: [], fields: { delta: 'response/data/delta.json', checks: 'response/data/checks.json' }, commits: [], next: [] },
    'response/response.md': null,
    'response/data/delta.json': entryDelta('runtime', applied, { runtimeLadder: lad }),
    'response/data/checks.json': entryChecks('runtime', findings, list, RUNG_CHECKS.serve),
  };
};
await expectValid(conflictResolvedGateRed(), 'the same resolved conflict with a red gate: the server never restarts and INTEGRATION_FAILED names the gate');
await expectError({ ...conflictResolvedGateRed(), 'response/response.json': { schemaVersion: 9, operatorId: 'platform.operate', step: 1, parallel: 1, status: 'done', fallbacks: [], fields: { delta: 'response/data/delta.json', checks: 'response/data/checks.json' }, commits: [], next: ['frontend.surface.audit'] } }, 'cannot end in an operated outcome', 'a red delivery gate reported as an operated outcome');
await expectError({ ...conflictResolvedGateGreen(), 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ integration: { ...resolvedMerge(), conflict: false } }) }) }, 'conflict must be true exactly when a merge here recorded a resolved hunk', 'a resolved hunk recorded without the conflict flag set');
await expectError({ ...conflictResolvedGateGreen(), 'response/data/checks.json': entryChecks('runtime', [{ code: 'RUNTIME_HEAD_SERVED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'x' }], RUNG_CHECKS.serve.map((n) => rtCheck(n)), RUNG_CHECKS.serve), 'response/response.md': entryMd('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], [['RUNTIME_HEAD_SERVED', ENTRY, '—', '—', 'x']], RUNG_CHECKS.serve.map((n) => rtCheck(n))) }, 'records the INTEGRATION_RESOLVED finding', 'a resolved conflict the receipt never names');

await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ sessionId: 'someone-else' }) }) }), 'and this branch belongs to s-test', 'a rung run for another session');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: OTHER, queue: [] } }) }) }), 'may only queue behind it', 'a serve that wrote through another session lease');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ observed: { head: UAT_OLD, containsWanted: true, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] } }) }) }), 'rather than restarting a healthy server', 'a healthy server restarted although the head already contained the commit');
await expectError(attesting({ 'response/data/delta.json': entryDelta('runtime', ['attest-runtime-entry'], { runtimeLadder: ladder({ reused: true, integration: null, servedHead: UAT_OLD, observed: { head: UAT_OLD, containsWanted: true, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] }, server: server({ pid: 4300 }) }) }) }), 'no new pid appears', 'a reused head that quietly started a new process');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ server: server({ previousPid: 9999 }) }) }) }), 'never replaces a process it does not own', 'a rung that replaced a pid the entry never recorded');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder({ contains: [OTHER_COMMIT] }) }) }), 'is absent from contains', 'a merged commit no consumer could prove is served');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['serve-runtime-head', 'attest-runtime-entry'], { runtimeLadder: ladder() }) }), 'without merge-into-integration-branch among the applied effects', 'an integration branch written by no merge');
await expectError(servingFirst({ 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head'], { runtimeLadder: ladder() }) }), 'every rung attests', 'a rung that changed the runtime and never probed it');
await expectError(stackUp({ 'response/data/delta.json': entryDelta('runtime', ['bring-up-infra-stack', 'attest-runtime-entry'], { runtimeLadder: ladder({ operation: 'stack-up', rung: 'stack-up', wantedCommit: null, servedHead: null, contains: [], integration: null, server: null, lease: null, infra: { env: 'local', stackRef: '.stacks/local/infra', services: [{ name: 'database', port: 5432, ready: false, evidenceRef: 'probes/database.json' }] }, observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] } }) }) }), 'never reached readiness', 'infra reported up while a service never answered');
await expectError(baseline({ 'response/data/delta.json': delta({ runtimeLadder: ladder() }) }), 'runtimeLadder belongs to the runtime branch', 'a ladder filed under another branch');
await expectError({ ...servingFirst(), 'response/data/delta.json': entryDelta('runtime', ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry']) }, 'this delta carries no runtimeLadder', 'a runtime branch that never said which rung it climbed');

process.stdout.write('platform.operate self-test: 16 valid branches, 63 rejected mutations\n');
