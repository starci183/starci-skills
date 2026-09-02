// Proves validate.mjs on a synthetic session branch: one converged observability operation, one
// already-converged no-op, one blocked on a port conflict, and one mutation per law, each of which
// must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validatePlatformStep, KIND_CHECKS } from './validate.mjs';

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
  planSha256 = PLAN, approvalRef = APPROVAL, mutableResourceRefs = [SERVICE], serviceRef = SERVICE,
} = {}) {
  return {
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

const responseJson = ({ status = 'done', stop, next = ['release.deploy'] } = {}) => ({
  schemaVersion: 9, operatorId: 'platform.operate', step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [],
  fields: status === 'blocked' ? {} : { 'platform-operation-receipt': 'response/response.md', delta: 'response/data/delta.json', checks: 'response/data/checks.json' },
  commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'platform-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', chain: [['1/1']], steps: { '1/1': 'platform.operate' }, current: '1/1', status: 'running' }));
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

process.stdout.write('platform.operate self-test: 3 valid branches, 28 rejected mutations\n');
