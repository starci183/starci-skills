// Proves validate.mjs on a synthetic session branch: every rung of the ladder climbed lawfully, a
// running head attested where it stands, two sessions sharing one product under the lease, a resolved
// conflict gated green and red, and one mutation per law, each of which must fail with a line that
// names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateRuntimeStep, RUNG_CHECKS, QUEUED_CHECKS, RUNTIME_CHECKS, integrationChangesErrors } from './validate.mjs';

const OPERATOR = 'runtime.serve';
const PLAN = `sha256:${'0'.repeat(64)}`;
const FP = `sha256:${'1'.repeat(64)}`;
const OWNER = 'platform-team';
const APPROVAL = '@worktrees/debts/be.md#runtime-approval';
const ENTRY = 'demo-product/fe';
const SESSION = 's-test';
const OTHER = 's-other';
const UAT_OLD = 'b'.repeat(40);
const UAT_NEW = 'c'.repeat(40);
const WANT = 'd'.repeat(40);
const OTHER_COMMIT = 'e'.repeat(40);
const MERGE_COMMIT = 'f'.repeat(40);
const WORKTREE = '.worktrees/demo-product/uat';

const resource = (ref = ENTRY, revision = 'g-6') => ({ resourceRef: ref, kind: 'runtime', revision, ownerRef: OWNER });
const mutation = (effect, over = {}) => ({ effect, resourceRef: ENTRY, beforeRevision: 'g-5', afterRevision: 'g-6', ...over });
const rtCheck = (name, status = 'passed') => ({ name, resourceRef: ENTRY, status, evidenceRef: `probes/${name}.json` });
const capabilities = () => [{ capability: 'runtime:registry-write', custodyEvidenceRef: 'custody/runtime.json' }];

function delta({ effects, runtimeLadder, convergence = 'converged', mutations, appliedEffects, allowedEffects, resources = [resource()], portHolders = [], portClaims = [], planSha256 = PLAN, approvalRef = APPROVAL, mutableResourceRefs = [ENTRY], serviceRef = ENTRY, caps = capabilities() } = {}) {
  const muts = mutations ?? effects.map((e) => mutation(e));
  return {
    ...(runtimeLadder ? { runtimeLadder } : {}),
    serviceRef, serviceKind: 'runtime', ownerRef: OWNER, approvalRef, planSha256,
    inventoryFingerprint: FP, generation: 7, observedAt: '2026-01-10T00:00:00.000Z',
    inventoriedResources: resources, observedPortHolders: portHolders, portClaims,
    mutableResourceRefs, observationOnlyResourceRefs: [],
    allowedEffects: allowedEffects ?? effects, appliedEffects: appliedEffects ?? [...new Set(muts.map((m) => m.effect))],
    capabilities: caps, convergence, mutations: muts,
  };
}
function checksJson({ required, list, findings, serviceRef = ENTRY, serviceKind = 'runtime' } = {}) {
  return { serviceRef, serviceKind, requiredCheckNames: required, checks: list, findings };
}
function responseMd({ effects, list, findings, convergence = 'converged', approval = APPROVAL, plan = PLAN, service = ENTRY, kind = 'runtime', operator = OPERATOR, portHolders = [], mutations } = {}) {
  const muts = mutations ?? effects.map((e) => mutation(e));
  return `# platform-operation-receipt — ${kind} ${service}

The route's entry was inventoried, the named rung was climbed and attested, and the rung's proof set
was proved on its own evidence.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`${operator}\` |
| Step | \`step-1/parallel-1\` |
| Project | \`demo-product\` |
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
| \`${ENTRY}\` | ${kind} | g-6 | \`${OWNER}\` |

## Port holders

| Port | Holder | Evidence |
| --- | --- | --- |
${portHolders.map((h) => `| ${h.port} | \`${h.holderRef}\` | \`${h.evidenceRef}\` |`).join('\n')}

## Mutations

| Effect | Resource | Before | After |
| --- | --- | --- | --- |
${muts.map((m) => `| \`${m.effect}\` | \`${m.resourceRef}\` | ${m.beforeRevision ?? '—'} | ${m.afterRevision} |`).join('\n')}

## Checks

| Check | Resource | Status | Evidence |
| --- | --- | --- | --- |
${list.map((c) => `| \`${c.name}\` | \`${c.resourceRef}\` | ${c.status} | \`${c.evidenceRef}\` |`).join('\n')}

## Findings

| Code | Resource | Port | Holder | Statement |
| --- | --- | --- | --- | --- |
${findings.map((f) => `| \`${f.code}\` | \`${f.resourceRef}\` | ${f.port ?? '—'} | ${f.holderRef ? `\`${f.holderRef}\`` : '—'} | ${f.statement} |`).join('\n')}
`;
}

const requestJson = ({ effects, operation = 'serve', commit = null, env, approval = APPROVAL, portClaims = [], resourceRefs = [ENTRY], mutableResourceRefs = [ENTRY], observationOnlyResourceRefs = [], plan = PLAN, kind = 'runtime', routeKey = ENTRY, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: SESSION,
  contexts: [{ alias: '@worktrees/sessions/central-runtime', head: null }, { alias: `@workspaces/ports/demo-product`, head: null }, { alias: '@workspaces/device-state', head: null }, { alias: `@workspaces/projects/${ENTRY}`, head: null }],
  requirements: {
    routeKey, operation, commit, ...(env ? { env } : {}), approval, portClaims, resume: null,
    desiredState: { planSha256: plan, serviceKind: kind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs },
    ...extra,
  },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, next = ['interface.audit'], changes = false } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [],
  fields: status === 'blocked' ? {} : { 'platform-operation-receipt': 'response/response.md', delta: 'response/data/delta.json', checks: 'response/data/checks.json', ...(changes ? { changes: 'response/changes.md' } : {}) },
  commits: [], next,
});

// The build-cache decision a start records: kept because the manifests did not move, or cleared with
// the reason that made it go.
const CACHE_KEPT = { cleared: false, reason: 'unchanged', directories: [], previousHead: UAT_OLD };
const CACHE_CLEARED = (reason, previousHead = UAT_OLD) => ({ cleared: true, reason, directories: ['apps/app/.next'], previousHead });
const server = (over = {}) => ({ pid: 4200, previousPid: 4100, port: 3067, command: 'npm run dev', logRef: 'logs/uat.log', pidFileRef: 'logs/uat.pid', startedAt: '2026-01-10T00:02:00.000Z', cache: CACHE_KEPT, ...over });
const ladder = (over = {}) => ({
  routeKey: ENTRY, operation: 'serve', rung: 'serve', reused: false, sessionId: SESSION,
  wantedCommit: WANT, servedHead: UAT_NEW, contains: [OTHER_COMMIT, WANT],
  integration: { worktreeRef: WORKTREE, branch: 'uat', createdFrom: null, merges: [{ ref: 'session/s-test', commit: WANT, mergeCommit: MERGE_COMMIT, kind: 'session', resolutions: [] }], conflict: false },
  infra: null, locations: [],
  observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] },
  server: server(), queuePosition: null,
  lease: { sessionId: SESSION, since: '2026-01-10T00:01:00.000Z', operation: 'serve', queue: [] },
  ...over,
});
const SERVED = { code: 'RUNTIME_HEAD_SERVED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the session commit was merged into the integration branch and the server restarted on the result' };
const SERVE_EFFECTS = ['merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'];

const rungBranch = ({ rung = 'serve', effects = SERVE_EFFECTS, ladderOver = {}, checkNames, findings = [SERVED], extra = {}, status = 'done', approval = APPROVAL } = {}) => {
  const lad = ladder({ operation: rung, rung, ...ladderOver });
  const list = (checkNames ?? RUNG_CHECKS[rung]).map((n) => rtCheck(n));
  return {
    'request/request.json': requestJson({ effects, operation: rung, approval, extra }),
    'response/response.json': responseJson({ status }),
    'response/response.md': responseMd({ effects, list, findings, approval }),
    'response/data/delta.json': delta({ effects, runtimeLadder: lad, approvalRef: approval }),
    'response/data/checks.json': checksJson({ required: checkNames ?? RUNG_CHECKS[rung], list, findings }),
  };
};

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'runtime-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: SESSION, project: 'demo-product', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function expectValid(files, label, options = {}) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateRuntimeStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, options = {}) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateRuntimeStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const withDelta = (files, ladderOver, effects = SERVE_EFFECTS) => ({ ...files, 'response/data/delta.json': delta({ effects, runtimeLadder: ladder(ladderOver) }) });

// An already-running service is attested where it stands: probed, recorded, and never restarted.
const attesting = (over = {}) => ({
  ...rungBranch({
    rung: 'serve', effects: ['attest-runtime-entry'],
    ladderOver: { reused: true, integration: null, servedHead: UAT_OLD, contains: [OTHER_COMMIT, WANT], observed: { head: UAT_OLD, containsWanted: true, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] }, server: server({ pid: 4100, startedAt: '2026-01-10T00:00:00.000Z' }) },
    findings: [{ code: 'RUNTIME_HEAD_REUSED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the running head already contained the wanted commit and its endpoint answered, so nothing was restarted' }],
    extra: { commit: WANT },
  }),
  ...over,
});
const stackUp = () => rungBranch({
  rung: 'stack-up', effects: ['bring-up-infra-stack', 'attest-runtime-entry'],
  ladderOver: { wantedCommit: null, servedHead: null, contains: [], integration: null, server: null, lease: null, infra: { env: 'local', stackRef: '.stacks/local/infra', services: [{ name: 'database', port: 5432, ready: true, evidenceRef: 'probes/database.json' }, { name: 'identity', port: 8089, ready: true, evidenceRef: 'probes/identity.json' }] }, observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] } },
  findings: [{ code: 'RUNTIME_RUNG_CLIMBED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the environment infrastructure came up and its declared origin rule admits the served origin' }],
});
const locating = () => rungBranch({
  rung: 'locate', effects: ['locate-routed-checkouts', 'attest-runtime-entry'],
  ladderOver: { wantedCommit: null, servedHead: null, contains: [], integration: null, server: null, lease: null, locations: [{ role: 'fe', checkoutRef: '@workspaces/demo-product/fe', head: UAT_OLD, devCommand: 'npm run dev' }], observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] } },
  findings: [{ code: 'RUNTIME_RUNG_CLIMBED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the routed checkout resolved through the workspace route and its head was observed' }],
});
const START_LADDER = { sessionId: null, lease: null, integration: { worktreeRef: WORKTREE, branch: 'uat', createdFrom: 'main', merges: [{ ref: 'main', commit: WANT, mergeCommit: MERGE_COMMIT, kind: 'mainline', resolutions: [] }], conflict: false }, contains: [WANT], locations: [{ role: 'fe', checkoutRef: '@workspaces/demo-product/fe', head: WANT, devCommand: 'npm run dev' }], observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] }, server: server({ previousPid: null, cache: CACHE_CLEARED('previous-unknown', null) }) };
const START_EFFECTS = ['merge-into-integration-branch', 'start-role-runtime', 'attest-runtime-entry'];
const startingRole = () => rungBranch({ rung: 'start-role', effects: START_EFFECTS, ladderOver: START_LADDER });
const servingFirst = (over = {}) => ({ ...rungBranch({ rung: 'serve', extra: { commit: WANT } }), ...over });
const queuedBehind = () => rungBranch({
  rung: 'serve', effects: ['queue-runtime-lease', 'attest-runtime-entry'], checkNames: QUEUED_CHECKS,
  ladderOver: { sessionId: SESSION, wantedCommit: OTHER_COMMIT, servedHead: UAT_OLD, contains: [WANT], integration: null, server: null, queuePosition: 1, observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: OTHER, queue: [] }, lease: { sessionId: OTHER, since: '2026-01-10T00:01:00.000Z', operation: 'serve', queue: [SESSION] } },
  extra: { commit: OTHER_COMMIT },
  findings: [{ code: 'RUNTIME_LEASE_BUSY', resourceRef: ENTRY, port: null, holderRef: null, statement: 'another session holds the lease while it merges, so this session is queued behind it' }],
});
const servingSecond = () => rungBranch({
  rung: 'serve',
  ladderOver: { wantedCommit: OTHER_COMMIT, contains: [WANT, OTHER_COMMIT], integration: { worktreeRef: WORKTREE, branch: 'uat', createdFrom: null, merges: [{ ref: 'main', commit: UAT_OLD, mergeCommit: MERGE_COMMIT, kind: 'mainline', resolutions: [] }, { ref: 'session/s-other', commit: OTHER_COMMIT, mergeCommit: UAT_NEW, kind: 'session', resolutions: [] }], conflict: false } },
  extra: { commit: OTHER_COMMIT },
});
const stopping = () => rungBranch({
  rung: 'stop', effects: ['stop-runtime-server', 'attest-runtime-entry'],
  ladderOver: { wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: null, lease: null, observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: SESSION, queue: [] } },
  findings: [{ code: 'RUNTIME_SERVER_STOPPED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the pid the entry recorded was stopped and the lease released' }],
});
const RESTART_EFFECTS = ['restart-runtime-server', 'attest-runtime-entry'];
const RESET_EFFECTS = ['reset-runtime-server', 'attest-runtime-entry'];
const restarting = () => rungBranch({ rung: 'restart', effects: RESTART_EFFECTS, ladderOver: { wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server({ cache: CACHE_CLEARED('manifests-changed') }) }, findings: [{ code: 'RUNTIME_SERVER_RESTARTED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the same head was started again; a lockfile moved since the previous record, so the build cache was cleared first' }] });
const resetting = () => rungBranch({ rung: 'reset', effects: RESET_EFFECTS, ladderOver: { wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server({ cache: CACHE_CLEARED('asked') }) }, findings: [{ code: 'RUNTIME_SERVER_RESET', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the server was stopped, the build cache cleared by name, and the same head started again' }] });

await expectValid(stackUp(), 'the stack-up rung on a machine with nothing running');
await expectValid(locating(), 'the locate rung resolving the routed checkout through its route');
await expectValid(startingRole(), 'the start-role rung starting the one server from the integration worktree');
await expectValid(servingFirst(), 'one session merged into the integration branch and served');
await expectValid(queuedBehind(), 'a second session queued behind the lease instead of given a second server');
await expectValid(servingSecond(), 'the second session served after the release: same port, both commits inside the head');
await expectValid(stopping(), 'a stop that kills the pid the entry recorded and releases the lease');
await expectValid(attesting(), 'a running runtime attested where it stands, with no restart');
await expectValid(restarting(), 'a restart that cleared the build cache because the manifests moved');
await expectValid(resetting(), 'a reset that cleared the build cache by name');
await expectValid({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, extra: { commit: WANT } }), 'response/response.json': responseJson({ status: 'blocked', stop: 'PORT_CONFLICT', next: [] }), 'response/response.md': null, 'response/data/delta.json': null, 'response/data/checks.json': null }, 'blocked on a port conflict before anything changed');

// The request gate.
await expectError(servingFirst({ 'response/response.json': { ...responseJson(), stop: 'PROOF_FAILED' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(servingFirst({ 'response/response.json': responseJson({ status: 'blocked', stop: 'PORT_SEIZED', next: [] }) }), 'not a registered code', 'unknown stop code');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, extra: { commit: WANT, credential: 'token: abcdefghijklmnop' } }) }), 'requirements.credential is not a field', 'a credential has nowhere to go in the request');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, approval: null, extra: { commit: WANT } }) }), 'required field approval has no value', 'a shared runtime change nobody approved');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, extra: { commit: WANT, service: ENTRY } }) }), 'requirements.service is not a field', 'the retired service field');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, extra: { commit: WANT, flow: 'paid-enrolment' } }) }), 'requirements.flow is not a field', 'a flow named where no account is provisioned');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: ['provision-identity'], extra: { commit: WANT } }) }), 'does not belong to the runtime ladder', 'an identity effect filed under the runtime ladder');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, kind: 'identity', extra: { commit: WANT } }) }), 'this operator climbs the runtime ladder and nothing else', 'another service kind');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, routeKey: 'demo-product', extra: { commit: WANT } }) }), 'is not a <project>/<role> registry entry', 'a route key that names no route');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, mutableResourceRefs: ['other/service'], resourceRefs: [ENTRY], extra: { commit: WANT } }) }), 'must be inside desiredState.mutableResourceRefs', 'the entry outside its own mutable ceiling');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, observationOnlyResourceRefs: [ENTRY], extra: { commit: WANT } }) }), 'cannot be both mutable and observation-only', 'a resource in both scope sets');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, portClaims: [{ port: 3067, resourceRef: 'product/web' }], extra: { commit: WANT } }) }), 'which this rung does not own', 'a port claimed for a foreign resource');
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, portClaims: [{ port: 3067, resourceRef: ENTRY }, { port: 3067, resourceRef: ENTRY }], extra: { commit: WANT } }) }), 'must not claim the same port twice', 'the same port claimed twice');

// The delta.
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), resources: [resource('other/service')] }) }), 'was not inventoried before the rung', 'the entry never inventoried');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), planSha256: `sha256:${'9'.repeat(64)}` }) }), 'planSha256 must equal the approved plan hash', 'a plan hash nobody approved');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), approvalRef: '@worktrees/debts/be.md#other' }) }), 'the bound approval is not the one the request declared', 'an approval borrowed from another plan');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), allowedEffects: ['attest-runtime-entry'] }) }), 'is outside the approved effect set', 'an effect outside the approval');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), caps: [] }) }), 'requires the runtime:registry-write capability', 'a rung running without its capability');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), caps: [{ capability: 'identity:account-admin', custodyEvidenceRef: 'custody/identity.json' }] }) }), 'is not used by the runtime ladder', 'a capability of another operator');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), mutations: [mutation('merge-into-integration-branch'), mutation('serve-runtime-head'), mutation('attest-runtime-entry', { resourceRef: 'ghost/service' })] }) }), 'was mutated without being inventoried first', 'a mutation on a resource nobody inventoried');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), portHolders: [{ port: 3067, holderRef: ENTRY, evidenceRef: 'ss.txt' }] }) }), 'holds a claimed port and must never be mutated to free it', 'a port freed by mutating its holder');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), appliedEffects: [...SERVE_EFFECTS, 'restart-runtime-server'] }) }), 'records no mutation', 'an applied effect with no mutation');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), convergence: 'already-converged' }) }), 'already-converged operation cannot report a mutation', 'a no-op that mutated');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), mutations: [mutation('merge-into-integration-branch'), mutation('serve-runtime-head'), mutation('attest-runtime-entry', { resourceRef: 'demo-product/be' })], resources: [resource(), resource('demo-product/be')], mutableResourceRefs: [ENTRY, 'demo-product/be'] }) }), 'which is not the registry entry', 'a rung that wrote a sibling route entry');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS }) }), 'this delta carries none', 'a rung that never said which rung it climbed');
await expectError(servingFirst({ 'response/data/delta.json': delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder(), caps: [{ capability: 'runtime:registry-write', custodyEvidenceRef: 'capability://runtime/registry' }] }) }), 'records a credential, which the receipt refuses', 'a capability handle inside the delta');
await expectError(servingFirst({ 'response/data/delta.json': { ...delta({ effects: SERVE_EFFECTS, runtimeLadder: ladder() }), inventoryFingerprint: 'nope' } }), 'inventoryFingerprint', 'delta schema');

// The checks and the receipt.
await expectError(servingFirst({ 'response/data/checks.json': checksJson({ required: RUNG_CHECKS.serve.slice(0, 3), list: RUNG_CHECKS.serve.slice(0, 3).map((n) => rtCheck(n)), findings: [SERVED] }), 'response/response.md': responseMd({ effects: SERVE_EFFECTS, list: RUNG_CHECKS.serve.slice(0, 3).map((n) => rtCheck(n)), findings: [SERVED] }) }), 'must require the generation-advanced check', 'a narrowed proof set');
await expectError(servingFirst({ 'response/data/checks.json': checksJson({ required: RUNG_CHECKS.serve, list: RUNG_CHECKS.serve.map((n) => rtCheck(n, n === 'endpoints-served' ? 'failed' : 'passed')), findings: [SERVED] }), 'response/response.md': responseMd({ effects: SERVE_EFFECTS, list: RUNG_CHECKS.serve.map((n) => rtCheck(n, n === 'endpoints-served' ? 'failed' : 'passed')), findings: [SERVED] }) }), 'a status nobody probed is an assertion', 'an entry reported ready over a failed probe');
await expectError(servingFirst({ 'response/data/checks.json': checksJson({ required: RUNG_CHECKS.serve, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [{ code: 'PORT_COORDINATION_REQUIRED', resourceRef: ENTRY, port: 3067, holderRef: 'product/web', statement: 'the port is held elsewhere' }] }), 'response/response.md': responseMd({ effects: SERVE_EFFECTS, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [{ code: 'PORT_COORDINATION_REQUIRED', resourceRef: ENTRY, port: 3067, holderRef: 'product/web', statement: 'the port is held elsewhere' }] }) }), 'cannot end in an operated outcome', 'a port coordination finding on an operated receipt');
await expectError(servingFirst({ 'response/data/checks.json': checksJson({ required: RUNG_CHECKS.serve, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [SERVED, { code: 'IDENTITY_PROVISIONED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'x' }] }), 'response/response.md': responseMd({ effects: SERVE_EFFECTS, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [SERVED, { code: 'IDENTITY_PROVISIONED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'x' }] }) }), 'belongs to identity.provision', 'an account provisioned by the runtime ladder');
await expectError(servingFirst({ 'response/response.md': responseMd({ effects: SERVE_EFFECTS, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [SERVED], service: 'other/service' }) }), 'Binding names an entry the request did not climb', 'a receipt for another entry');
await expectError(servingFirst({ 'response/response.md': responseMd({ effects: SERVE_EFFECTS, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [SERVED], operator: 'platform.operate' }) }), 'this receipt is written by runtime.serve', 'a receipt signed by the retired operator');
await expectError(servingFirst({ 'response/response.md': servingFirst()['response/response.md'].replace('## Checks', '## Proofs') }), 'missing section ^## Checks$', 'receipt section renamed');
await expectError(servingFirst({ 'response/response.json': (() => { const o = responseJson(); delete o.fields.checks; return o; })() }), 'required output checks is not in fields', 'missing required output');

// The ladder, rung by rung, and the two sessions that share one product.
await expectError(withDelta(resetting(), { operation: 'reset', rung: 'reset', wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server() }, RESET_EFFECTS), 'clears the build cache by definition', 'a reset that kept the build cache');
await expectError(withDelta(restarting(), { operation: 'restart', rung: 'restart', wantedCommit: null, servedHead: UAT_OLD, contains: [WANT], integration: null, server: server({ cache: { ...CACHE_KEPT, reason: 'manifests-changed' } }) }, RESTART_EFFECTS), 'exactly when a reason to clear it was recorded', 'a restart that saw the manifests move and kept the cache anyway');
await expectError(withDelta(startingRole(), { operation: 'start-role', rung: 'start-role', ...START_LADDER, server: server({ previousPid: null, cache: { ...CACHE_KEPT, previousHead: null } }) }, START_EFFECTS), 'nothing proves the manifests unchanged', 'a first start that trusted a cache nothing had recorded');
await expectError(withDelta(servingFirst(), { server: server({ cache: { ...CACHE_KEPT, previousHead: UAT_NEW } }) }), 'other than the one the entry recorded', 'a cache decision made against a head the entry never served');
await expectError(withDelta(servingFirst(), { server: (() => { const s = server(); delete s.cache; return s; })() }), 'runtimeLadder.server', 'a started server that never said what became of the build cache');
await expectError(withDelta(servingFirst(), { sessionId: 'someone-else' }), 'and this branch belongs to s-test', 'a rung run for another session');
await expectError(withDelta(servingFirst(), { observed: { head: UAT_OLD, containsWanted: false, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: OTHER, queue: [] } }), 'may only queue behind it', 'a serve that wrote through another session lease');
await expectError(withDelta(servingFirst(), { observed: { head: UAT_OLD, containsWanted: true, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] } }), 'rather than restarting a healthy server', 'a healthy server restarted although the head already contained the commit');
await expectError(withDelta(attesting(), { reused: true, integration: null, servedHead: UAT_OLD, observed: { head: UAT_OLD, containsWanted: true, pid: 4100, pidAlive: true, probeAnswered: true, leaseSessionId: null, queue: [] }, server: server({ pid: 4300 }) }, ['attest-runtime-entry']), 'no new pid appears', 'a reused head that quietly started a new process');
await expectError(withDelta(servingFirst(), { server: server({ previousPid: 9999 }) }), 'never replaces a process it does not own', 'a rung that replaced a pid the entry never recorded');
await expectError(withDelta(servingFirst(), { contains: [OTHER_COMMIT] }), 'is absent from contains', 'a merged commit no consumer could prove is served');
await expectError(withDelta(servingFirst(), {}, ['serve-runtime-head', 'attest-runtime-entry']), 'without merge-into-integration-branch among the applied effects', 'an integration branch written by no merge');
await expectError(withDelta(servingFirst(), {}, ['merge-into-integration-branch', 'serve-runtime-head']), 'every rung attests', 'a rung that changed the runtime and never probed it');
await expectError(withDelta(stackUp(), { operation: 'stack-up', rung: 'stack-up', wantedCommit: null, servedHead: null, contains: [], integration: null, server: null, lease: null, infra: { env: 'local', stackRef: '.stacks/local/infra', services: [{ name: 'database', port: 5432, ready: false, evidenceRef: 'probes/database.json' }] }, observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] } }, ['bring-up-infra-stack', 'attest-runtime-entry']), 'never reached readiness', 'infra reported up while a service never answered');

// A conflicting hunk is resolved by rule, recorded on the merge, and the merged head is gated before
// the server restarts on it.
const RESOLUTION = { file: 'apps/app/src/page.tsx', hunkRange: '12-18', rule: 'incoming-session-owned' };
const resolvedMerge = () => ({ worktreeRef: WORKTREE, branch: 'uat', createdFrom: null, merges: [{ ref: 'session/s-test', commit: WANT, mergeCommit: MERGE_COMMIT, kind: 'session', resolutions: [RESOLUTION] }], conflict: true });
const RESOLVED = { code: 'INTEGRATION_RESOLVED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the merge met one conflicting hunk and resolved it by rule before gating the merged head' };
const conflictResolvedGateGreen = () => rungBranch({ rung: 'serve', ladderOver: { integration: resolvedMerge() }, findings: [RESOLVED, SERVED], extra: { commit: WANT } });
await expectValid(conflictResolvedGateGreen(), 'a conflicting merge resolved by rule and gated green before the server restarted');
const conflictResolvedGateRed = () => {
  const applied = ['merge-into-integration-branch', 'attest-runtime-entry'];
  const list = RUNG_CHECKS.serve.map((n) => rtCheck(n, n === 'gates-passed' ? 'failed' : 'passed'));
  const findings = [RESOLVED, { code: 'INTEGRATION_GATE_FAILED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'typecheck failed on the merged head, so the server was not restarted on it' }];
  return {
    'request/request.json': requestJson({ effects: applied, extra: { commit: WANT } }),
    'response/response.json': { schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status: 'blocked', stop: 'INTEGRATION_FAILED', fallbacks: [], fields: { delta: 'response/data/delta.json', checks: 'response/data/checks.json' }, commits: [], next: [] },
    'response/response.md': null,
    'response/data/delta.json': delta({ effects: applied, runtimeLadder: ladder({ servedHead: UAT_OLD, contains: [OTHER_COMMIT], server: null, integration: resolvedMerge() }) }),
    'response/data/checks.json': checksJson({ required: RUNG_CHECKS.serve, list, findings }),
  };
};
await expectValid(conflictResolvedGateRed(), 'the same resolved conflict with a red gate: the server never restarts and INTEGRATION_FAILED names the gate');
await expectError({ ...conflictResolvedGateRed(), 'response/response.json': { schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status: 'done', fallbacks: [], fields: { delta: 'response/data/delta.json', checks: 'response/data/checks.json' }, commits: [], next: ['interface.audit'] } }, 'cannot end in an operated outcome', 'a red delivery gate reported as an operated outcome');
await expectError(withDelta(conflictResolvedGateGreen(), { integration: { ...resolvedMerge(), conflict: false } }), 'conflict must be true exactly when a merge here recorded a resolved hunk', 'a resolved hunk recorded without the conflict flag set');
await expectError({ ...conflictResolvedGateGreen(), 'response/data/checks.json': checksJson({ required: RUNG_CHECKS.serve, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [SERVED] }), 'response/response.md': responseMd({ effects: SERVE_EFFECTS, list: RUNG_CHECKS.serve.map((n) => rtCheck(n)), findings: [SERVED] }) }, 'records the INTEGRATION_RESOLVED finding', 'a resolved conflict the receipt never names');

// Authority from the environment's own declaration: the runtime class is declared in a
// non-production environment, and a person in a production one.
const HOST = mkdtempSync(path.join(tmpdir(), 'runtime-host-'));
const declare = (env, body) => {
  mkdirSync(path.join(HOST, '.stacks', env), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(body, null, 2));
  writeFileSync(path.join(HOST, '.stacks', env, 'environment.json'), bytes);
  return `.stacks/${env}/environment.json#sha256:${createHash('sha256').update(bytes).digest('hex')}`;
};
const DEV_REF = declare('dev', { schemaVersion: 9, env: 'dev', production: false });
const PROD_REF = declare('production', { schemaVersion: 9, env: 'production', production: true });
const onHost = { hostRoot: HOST };
await expectError(servingFirst({ 'request/request.json': requestJson({ effects: SERVE_EFFECTS, env: 'no-such-stack', extra: { commit: WANT } }) }), 'which this installation does not have', 'an env with no stack', onHost);
const servingDeclared = ({ approval = DEV_REF, env = 'dev' } = {}) => rungBranch({ rung: 'serve', extra: { commit: WANT, env }, approval });
await expectValid(servingDeclared(), 'a serve on the dev runtime approved by the environment declaration', onHost);
await expectError(servingDeclared({ approval: PROD_REF, env: 'production' }), 'marks runtime as person', 'a declaration reference for a production runtime, which the production defaults keep with a person', onHost);
await expectError(servingDeclared({ approval: DEV_REF.replace(/[0-9a-f]{64}$/, '9'.repeat(64)) }), 'the declaration moved since it was read', 'a declaration reference whose hash no longer matches the file', onHost);
await expectError(servingDeclared({ approval: DEV_REF, env: 'production' }), 'authorises its own environment only', 'a dev declaration offered as approval for another environment', onHost);
rmSync(HOST, { recursive: true, force: true });

process.stdout.write('runtime.serve self-test: 14 valid branches, 50 rejected mutations\n');

// Integration changes identify an actual two-parent Git merge, including its complete delta.
const integrationFixture = mkdtempSync(path.join(tmpdir(), 'runtime-merge-proof-'));
try {
  const git = (...args) => execFileSync('git', args, { cwd: integrationFixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--initial-branch', 'integration-proof'); git('config', 'user.name', 'Contract fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'core.autocrlf', 'false');
  writeFileSync(path.join(integrationFixture, 'base.txt'), 'base\n'); git('add', '.'); git('commit', '-m', 'base'); git('checkout', '-b', 'session/fixture');
  writeFileSync(path.join(integrationFixture, 'topic.txt'), 'topic\n'); git('add', '.'); git('commit', '-m', 'topic'); const topic = git('rev-parse', 'HEAD'); git('checkout', 'integration-proof');
  writeFileSync(path.join(integrationFixture, 'existing.txt'), 'existing\n'); git('add', '.'); git('commit', '-m', 'integration predecessor'); const prior = git('rev-parse', 'HEAD'); git('merge', '--no-ff', 'session/fixture', '-m', 'integrate'); const head = git('rev-parse', 'HEAD');
  const d = { serviceKind: 'runtime', convergence: 'converged', runtimeLadder: { rung: 'serve', reused: false, servedHead: head, integration: { branch: 'integration-proof', worktreeRef: integrationFixture } } };
  const receipt = `# changes — ${OPERATOR} step-1/parallel-1\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n| Operator | ${OPERATOR} |\n| Base | ${prior} |\n| Head | ${head} |\n| Branch | integration-proof |\n\n## Files\n\n| Path | Change | Why | Claims |\n| --- | --- | --- | --- |\n| topic.txt | created | merged source | — |\n`;
  assert.deepEqual(integrationChangesErrors(d, receipt), []);
  for (const [record, text, needle] of [
    [{ ...d, serviceKind: 'identity' }, receipt, 'only a completed serve'],
    [{ ...d, runtimeLadder: { ...d.runtimeLadder, rung: 'restart' } }, receipt, 'only a completed serve'],
    [d, receipt.replace(prior, topic), 'actual merge first parent'],
    [d, receipt.replace(head, topic), 'head and branch'],
    [d, receipt.replaceAll(`| Operator | ${OPERATOR} |`, '| Operator | platform.operate |'), 'operator, head and branch'],
    [d, receipt.replace('| Branch | integration-proof |', '| Branch | unrelated |'), 'head and branch'],
    [d, receipt.replace('| topic.txt |', '| missing.txt |'), 'actual merged Git diff'],
  ]) assert.ok(integrationChangesErrors(record, text).some((e) => e.includes(needle)), needle);
  git('checkout', '-b', 'session/ff-fixture'); writeFileSync(path.join(integrationFixture, 'ff.txt'), 'forward\n'); git('add', '.'); git('commit', '-m', 'fast-forward'); const forward = git('rev-parse', 'HEAD'); git('checkout', 'integration-proof'); git('merge', '--ff-only', 'session/ff-fixture');
  const fd = { ...d, runtimeLadder: { ...d.runtimeLadder, servedHead: forward, observed: { head } } };
  const fr = receipt.replace(prior, head).replace(`| Head | ${head} |`, `| Head | ${forward} |`).replace('topic.txt', 'ff.txt');
  assert.deepEqual(integrationChangesErrors(fd, fr), []);
  assert.ok(integrationChangesErrors(fd, fr.replace(`| Base | ${head} |`, `| Base | ${prior} |`)).some((e) => e.includes('observed fast-forward predecessor')));
} finally { if (!path.resolve(integrationFixture).startsWith(path.resolve(tmpdir()) + path.sep)) throw Error('unsafe fixture cleanup'); rmSync(integrationFixture, { recursive: true, force: true }); }
process.stdout.write('runtime.serve integration changes: actual merge and rejected provenance mutations passed\n');
