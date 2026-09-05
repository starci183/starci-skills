// Proves validate.mjs on a synthetic session branch: one flow whose account was created and published as
// names, the same under the environment's own declaration, one administrator rotation, one branch
// blocked on an unreachable provider, and one mutation per law, each of which must fail with a line
// that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateIdentityStep, IDENTITY_CHECKS, identityRotationErrors } from './validate.mjs';

const OPERATOR = 'identity.provision';
const PLAN = `sha256:${'0'.repeat(64)}`;
const FP = `sha256:${'1'.repeat(64)}`;
const OWNER = 'platform-team';
const APPROVAL = '@worktrees/debts/be.md#identity-approval';
const ENTRY = 'demo-product/fe';
const FLOW = 'paid-enrolment';
const ENV = 'dev';
const PROVISION = ['provision-identity'];
const ROTATE = ['rotate-admin-credential'];

const resource = () => ({ resourceRef: ENTRY, kind: 'identity', revision: 'g-6', ownerRef: OWNER });
const mutation = (effect) => ({ effect, resourceRef: ENTRY, beforeRevision: 'g-5', afterRevision: 'g-6' });
const check = (name, status = 'passed') => ({ name, resourceRef: ENTRY, status, evidenceRef: `probes/${name}.json` });
const PROVISIONED = { code: 'IDENTITY_PROVISIONED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the flow had no account, so one was created and its password set from the sealed name' };
const INVENTORIED = { code: 'SHARED_SERVICE_INVENTORIED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'the entry was inventoried before anything changed' };

function delta({ effects = PROVISION, convergence = 'converged', mutations, appliedEffects, allowedEffects, approvalRef = APPROVAL, planSha256 = PLAN, caps = [{ capability: 'identity:account-admin', custodyEvidenceRef: 'custody/identity.json' }], resources = [resource()], serviceRef = ENTRY, serviceKind = 'identity', extra = {} } = {}) {
  const muts = mutations ?? effects.map((e) => mutation(e));
  return {
    serviceRef, serviceKind, ownerRef: OWNER, approvalRef, planSha256,
    inventoryFingerprint: FP, generation: 7, observedAt: '2026-01-10T00:00:00.000Z',
    inventoriedResources: resources, observedPortHolders: [], portClaims: [],
    mutableResourceRefs: [ENTRY], observationOnlyResourceRefs: [],
    allowedEffects: allowedEffects ?? effects, appliedEffects: appliedEffects ?? [...new Set(muts.map((m) => m.effect))],
    capabilities: caps, convergence, mutations: muts, ...extra,
  };
}
const checksJson = ({ list = IDENTITY_CHECKS.map((n) => check(n)), findings = [PROVISIONED], required = IDENTITY_CHECKS, serviceKind = 'identity' } = {}) => ({ serviceRef: ENTRY, serviceKind, requiredCheckNames: required, checks: list, findings });
function responseMd({ effects = PROVISION, list = IDENTITY_CHECKS.map((n) => check(n)), findings = [PROVISIONED], approval = APPROVAL, convergence = 'converged', operator = OPERATOR, service = ENTRY, kind = 'identity' } = {}) {
  return `# platform-operation-receipt — ${kind} ${service}

The flow's account was created at the provider the entry declares, its password set from the sealed
name, and the identity proof set was proved on its own evidence.

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
| Desired state | \`${PLAN}\` |
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

## Mutations

| Effect | Resource | Before | After |
| --- | --- | --- | --- |
${effects.map((e) => `| \`${e}\` | \`${ENTRY}\` | g-5 | g-6 |`).join('\n')}

## Checks

| Check | Resource | Status | Evidence |
| --- | --- | --- | --- |
${list.map((c) => `| \`${c.name}\` | \`${c.resourceRef}\` | ${c.status} | \`${c.evidenceRef}\` |`).join('\n')}

## Findings

| Code | Resource | Port | Holder | Statement |
| --- | --- | --- | --- | --- |
${findings.map((f) => `| \`${f.code}\` | \`${f.resourceRef}\` | — | — | ${f.statement} |`).join('\n')}
`;
}
const accountRecord = ({ accounts, env = ENV, ...over } = {}) => ({
  env, flow: FLOW, identity: ENTRY, plaintextRecorded: false,
  accounts: accounts ?? { learner: { username: `uat-${FLOW}-learner`, role: 'learner', credentialName: 'uat-shared', sealed: `.stacks/${env}/secrets/uat.enc`, provisionedBy: '20260110-000000-1111111', createdAt: '2026-01-10T00:05:00.000Z' } },
  ...over,
});
const requestJson = ({ effects = PROVISION, flow = FLOW, env = ENV, approval = APPROVAL, kind = 'identity', routeKey = ENTRY, resourceRefs = [ENTRY], mutableResourceRefs = [ENTRY], extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@worktrees/sessions/central-runtime', head: null }, { alias: '@workspaces/device-state', head: null }],
  requirements: { routeKey, flow, env, approval, resume: null, desiredState: { planSha256: PLAN, serviceKind: kind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs: [] }, ...extra },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, next = ['data.seed'], account = true } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [],
  fields: status === 'blocked' ? {} : { 'platform-operation-receipt': 'response/response.md', delta: 'response/data/delta.json', checks: 'response/data/checks.json', ...(account ? { 'uat-account': 'response/data/account.json' } : {}) },
  commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'identity-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'demo-product', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function expectValid(files, label, options = {}) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateIdentityStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, options = {}) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateIdentityStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

// A flow with no account is a flow nobody has run yet: the account is created and published as names.
const provisioning = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/delta.json': delta(),
  'response/data/checks.json': checksJson(),
  'response/data/account.json': accountRecord(),
  ...over,
});
// The administrator custody rotated under one bound principal: no flow, no account, an approval id.
const ROTATION_BINDING = { provider: 'https://identity.example', realm: 'master', credentialName: 'identity-admin', principalFingerprint: `sha256:${'a'.repeat(64)}`, custodyRefs: [`.stacks/${ENV}/runtime/files/identity-admin.json.enc`], stagingRefs: [`.stacks/${ENV}/runtime/files/identity-admin.rotation-pending.enc`] };
const ROTATION_PROOF = { provider: ROTATION_BINDING.provider, realm: ROTATION_BINDING.realm, credentialName: ROTATION_BINDING.credentialName, principalFingerprint: ROTATION_BINDING.principalFingerprint, principalId: 'principal-1', custodyRefs: ROTATION_BINDING.custodyRefs, newCredentialWorks: true, oldCredentialRejected: true, sessionsInvalidated: true, custodyConsistent: true };
const rotating = (over = {}) => ({
  'request/request.json': requestJson({ effects: ROTATE, flow: null, extra: { identityRotation: ROTATION_BINDING } }),
  'response/response.json': responseJson({ next: ['uat.verify'], account: false }),
  'response/response.md': responseMd({ effects: ROTATE, findings: [INVENTORIED] }),
  'response/data/delta.json': delta({ effects: ROTATE, extra: { identityRotation: ROTATION_PROOF } }),
  'response/data/checks.json': checksJson({ findings: [INVENTORIED] }),
  ...over,
});
const failing = (name, stop) => {
  const list = IDENTITY_CHECKS.map((n) => check(n, n === name ? 'failed' : 'passed'));
  return { 'request/request.json': requestJson(), 'response/response.json': { ...responseJson({ status: 'blocked', stop, next: [] }), fields: { delta: 'response/data/delta.json', checks: 'response/data/checks.json' } }, 'response/data/delta.json': delta(), 'response/data/checks.json': checksJson({ list }) };
};

await expectValid(provisioning(), 'a flow that had no account: one created and published as names');
await expectValid(rotating(), 'the administrator custody rotated under one bound principal');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'PROVISIONING_UNAVAILABLE', next: [] }) }, 'blocked on a provider that cannot be reached before anything changed');
await expectValid(failing('provider-reachable', 'PROVISIONING_UNAVAILABLE'), 'a provider that stopped answering after the inventory: the proof set names it and the branch stops unavailable');
await expectValid(failing('account-signs-in', 'IDENTITY_UNPROVEN'), 'an account that was created and does not sign in: unproved, not provisioned');

// The request gate.
await expectError(provisioning({ 'response/response.json': { ...responseJson(), stop: 'IDENTITY_UNPROVEN' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(provisioning({ 'request/request.json': requestJson({ extra: { credential: 'token: abcdefghijklmnop' } }) }), 'requirements.credential is not a field', 'a credential has nowhere to go in the request');
await expectError(provisioning({ 'request/request.json': requestJson({ approval: null }) }), 'required field approval has no value', 'an identity change nobody approved');
await expectError(provisioning({ 'request/request.json': requestJson({ extra: { operation: 'serve' } }) }), 'requirements.operation is not a field', 'a runtime rung named where no runtime is served');
await expectError(provisioning({ 'request/request.json': requestJson({ effects: ['provision-identity', 'seed-flow-fixtures'] }) }), 'a seed is placed by data.seed', 'a seed effect filed under identity provisioning');
await expectError(provisioning({ 'request/request.json': requestJson({ effects: ['attest-runtime-entry'] }) }), 'does not belong to identity provisioning', 'a runtime effect filed under identity provisioning');
await expectError(provisioning({ 'request/request.json': requestJson({ kind: 'runtime' }) }), 'this operator provisions identity and nothing else', 'another service kind');
await expectError(provisioning({ 'request/request.json': requestJson({ flow: null }) }), 'flow names none', 'provisioning for no flow at all');
await expectError(provisioning({ 'request/request.json': requestJson({ routeKey: 'demo-product' }) }), 'is not a <project>/<role> registry entry', 'a route key that names no route');
await expectError(provisioning({ 'request/request.json': requestJson({ env: 'no-such-stack' }) }), 'which this installation does not have', 'an env with no stack');

// The delta and the checks.
await expectError(provisioning({ 'response/data/delta.json': delta({ caps: [] }) }), 'requires the identity:account-admin capability', 'provisioning without its capability');
await expectError(provisioning({ 'response/data/delta.json': delta({ caps: [{ capability: 'runtime:registry-write', custodyEvidenceRef: 'custody/runtime.json' }] }) }), 'is not used by identity provisioning', 'a capability of another operator');
await expectError(provisioning({ 'response/data/delta.json': delta({ allowedEffects: [] }) }), 'is outside the approved effect set', 'an effect outside the approval');
await expectError(provisioning({ 'response/data/delta.json': delta({ approvalRef: '@worktrees/debts/be.md#other' }) }), 'the bound approval is not the one the request declared', 'an approval borrowed from another plan');
await expectError(provisioning({ 'response/data/delta.json': delta({ extra: { runtimeLadder: { routeKey: ENTRY, operation: 'serve', rung: 'serve', reused: false, sessionId: null, wantedCommit: null, servedHead: null, contains: [], integration: null, infra: null, locations: [], observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] }, server: null, queuePosition: null, lease: null } } }) }), 'runtimeLadder belongs to runtime.serve', 'a ladder filed under identity provisioning');
await expectError(provisioning({ 'response/data/delta.json': delta({ caps: [{ capability: 'identity:account-admin', custodyEvidenceRef: 'capability://identity/admin' }] }) }), 'records a credential, which the receipt refuses', 'a capability handle inside the delta');
await expectError(provisioning({ 'response/data/checks.json': checksJson({ required: IDENTITY_CHECKS.slice(0, 3), list: IDENTITY_CHECKS.slice(0, 3).map((n) => check(n)) }), 'response/response.md': responseMd({ list: IDENTITY_CHECKS.slice(0, 3).map((n) => check(n)) }) }), 'must require the account-signs-in check', 'a narrowed proof set');
await expectError(provisioning({ 'response/data/checks.json': checksJson({ list: IDENTITY_CHECKS.map((n) => check(n, n === 'account-signs-in' ? 'failed' : 'passed')) }), 'response/response.md': responseMd({ list: IDENTITY_CHECKS.map((n) => check(n, n === 'account-signs-in' ? 'failed' : 'passed')) }) }), 'cannot be reported as provisioned', 'a provisioned outcome over an account that does not sign in');
await expectError(failing('account-signs-in', 'PROVISIONING_UNAVAILABLE'), 'stops with IDENTITY_UNPROVEN, not PROVISIONING_UNAVAILABLE', 'an account that does not sign in reported as an unreachable provider');
await expectError(provisioning({ 'response/data/checks.json': checksJson({ findings: [INVENTORIED] }), 'response/response.md': responseMd({ findings: [INVENTORIED] }) }), 'records the IDENTITY_PROVISIONED finding', 'a provisioning the receipt never names');
await expectError(provisioning({ 'response/data/checks.json': checksJson({ findings: [PROVISIONED, { code: 'RUNTIME_HEAD_SERVED', resourceRef: ENTRY, port: null, holderRef: null, statement: 'x' }] }), 'response/response.md': responseMd({ findings: [PROVISIONED, { code: 'RUNTIME_HEAD_SERVED', resourceRef: ENTRY, statement: 'x' }] }) }), 'belongs to runtime.serve', 'a runtime finding on an identity receipt');

// The account record: names only, for this flow, this entry and this environment.
await expectError(provisioning({ 'response/response.json': responseJson({ account: false }), 'response/data/account.json': null }), 'the account record it wrote is published with it', 'an account created and never published');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ identity: 'demo-product/be' }) }), 'belongs to registry entry', 'an account filed under another registry entry');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ flow: 'other-flow' }) }), 'belongs to flow other-flow', 'an account filed under another flow');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ env: 'staging' }) }), 'belongs to environment staging', 'an account of another environment');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ accounts: { learner: { username: `uat-${FLOW}-learner`, role: 'learner', credentialName: 'uat-shared', sealed: `.stacks/${ENV}/secrets/uat.enc`, provisionedBy: null, createdAt: '2026-01-10T00:05:00.000Z' } } }) }), 'names the run that provisioned it', 'an account this run created and left unattributed');
await expectError(provisioning({ 'response/data/account.json': accountRecord({ accounts: { learner: { username: `uat-${FLOW}-learner`, role: 'password: hunter2-hunter2', credentialName: 'uat-shared', sealed: `.stacks/${ENV}/secrets/uat.enc`, provisionedBy: '20260110-000000-1111111', createdAt: '2026-01-10T00:05:00.000Z' } } }) }), 'carries a credential', 'a secret filed in the account record');
await expectError(provisioning({ 'response/data/account.json': { ...accountRecord(), password: 'x' } }), 'unexpected property', 'an account record with a place to hold a secret');

// One branch, the flow's whole cast: the plan lists every alias and the record publishes every one.
const castAccount = (alias) => ({ username: `uat-${FLOW}-${alias}`, role: alias, credentialName: 'uat-shared', sealed: `.stacks/${ENV}/secrets/uat.enc`, provisionedBy: '20260110-000000-1111111', createdAt: '2026-01-10T00:05:00.000Z' });
const castPlan = (aliases) => ({ accounts: aliases.map((alias) => ({ alias, username: `uat-${FLOW}-${alias}`, email: `uat-${FLOW}-${alias}@example.test`, firstName: 'Uat', lastName: alias, usernameMaxLength: 40 })) });
const cast = (planned, published, over = {}) => provisioning({
  'request/identity-plan.json': castPlan(planned),
  'response/data/account.json': accountRecord({ accounts: Object.fromEntries(published.map((alias) => [alias, castAccount(alias)])) }),
  ...over,
});
await expectValid(cast(['learner', 'reviewer'], ['learner', 'reviewer']), 'a two-alias flow provisioned by one branch');
await expectError(cast(['learner', 'reviewer'], ['learner']), 'the record publishes no such alias', 'a cast the plan named and the branch left half-created');
await expectError(cast(['learner'], ['learner', 'reviewer']), 'the plan does not name it', 'an alias published as provisioned that no plan asked for');
await expectError(cast(['learner'], ['learner'], { 'request/identity-plan.json': { accounts: [{ alias: 'learner', username: 'uat-someone-else', email: 'x@example.test', firstName: 'Uat', lastName: 'Learner', usernameMaxLength: 40 }] } }), 'in the plan', 'an alias published under a name the plan did not ask for');
await expectError(provisioning({ 'response/response.md': responseMd({ operator: 'platform.operate' }) }), 'this receipt is written by identity.provision', 'a receipt signed by the retired operator');
await expectError(provisioning({ 'response/response.md': responseMd().replace('## Checks', '## Proofs') }), 'missing section ^## Checks$', 'receipt section renamed');
await expectError(provisioning({ 'response/response.json': (() => { const o = responseJson(); delete o.fields.checks; return o; })() }), 'required output checks is not in fields', 'missing required output');

// Rotation.
await expectError(rotating({ 'request/request.json': requestJson({ effects: ROTATE, flow: FLOW, extra: { identityRotation: ROTATION_BINDING } }) }), 'a rotation runs alone and provisions no flow', 'a rotation that also names a flow');
await expectError(rotating({ 'request/request.json': requestJson({ effects: ROTATE, flow: null }) }), 'rotation requires exact provider, principal and protected custody', 'a rotation with no bound principal');
await expectError(rotating({ 'request/request.json': requestJson({ effects: ['provision-identity', 'rotate-admin-credential'], flow: null, extra: { identityRotation: ROTATION_BINDING } }) }), 'rotation cannot combine other identity effects', 'a rotation combined with provisioning');
await expectError(rotating({ 'response/data/delta.json': delta({ effects: ROTATE, extra: { identityRotation: { ...ROTATION_PROOF, oldCredentialRejected: false } } }) }), 'requires oldCredentialRejected proof', 'a rotation whose old credential still works');
await expectError(rotating({ 'response/data/delta.json': delta({ effects: ROTATE }) }), 'rotation requires its bound proof record', 'a rotation with no proof record');
await expectError(rotating({ 'response/response.json': responseJson({ next: ['uat.verify'], account: true }), 'response/data/account.json': accountRecord() }), 'a rotation creates no account', 'a rotation that published an account record');
assert.deepEqual(identityRotationErrors({ desiredState: { effects: PROVISION } }, undefined), []);
assert.ok(identityRotationErrors({ desiredState: { effects: PROVISION }, identityRotation: ROTATION_BINDING }, undefined).some((e) => e.includes('requires the rotation effect')));

// Authority from the environment's own declaration. A synthetic host holds one declaration per case;
// the reference a request carries is the declaration's path and the hash of its bytes.
const HOST = mkdtempSync(path.join(tmpdir(), 'identity-host-'));
const declare = (env, body) => {
  mkdirSync(path.join(HOST, '.stacks', env), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(body, null, 2));
  writeFileSync(path.join(HOST, '.stacks', env, 'environment.json'), bytes);
  return `.stacks/${env}/environment.json#sha256:${createHash('sha256').update(bytes).digest('hex')}`;
};
const DEV_REF = declare('dev', { schemaVersion: 9, env: 'dev', production: false });
const TIGHT_REF = declare('tight', { schemaVersion: 9, env: 'tight', production: false, authorization: { 'identity-provisioning': 'person' } });
const PROD_REF = declare('production', { schemaVersion: 9, env: 'production', production: true });
const LOOSE_REF = declare('loose', { schemaVersion: 9, env: 'loose', production: true, authorization: { release: 'declared', 'identity-provisioning': 'declared' } });
const onHost = { hostRoot: HOST };
const provisioningDeclared = ({ approval = DEV_REF, env = 'dev', effects = PROVISION } = {}) => provisioning({
  'request/request.json': requestJson({ effects, env, approval }),
  'response/response.md': responseMd({ effects, approval }),
  'response/data/delta.json': delta({ effects, approvalRef: approval }),
  'response/data/account.json': accountRecord({ env }),
});
await expectValid(provisioningDeclared(), 'dev provisioning approved by the environment declaration itself, no person asked', onHost);
await expectError(provisioningDeclared({ approval: PROD_REF, env: 'production' }), 'marks identity-provisioning as person', 'a declaration reference for production provisioning, which the production defaults keep with a person', onHost);
await expectError(provisioningDeclared({ approval: LOOSE_REF, env: 'loose' }), 'the environment schema refuses', 'a production declaration that loosened release to declared', onHost);
await expectError(provisioningDeclared({ approval: TIGHT_REF, env: 'tight' }), 'marks identity-provisioning as person', 'a declaration reference for a class the declaration tightened to person', onHost);
await expectError(provisioningDeclared({ approval: DEV_REF.replace(/[0-9a-f]{64}$/, '9'.repeat(64)) }), 'the declaration moved since it was read', 'a declaration reference whose hash no longer matches the file', onHost);
await expectError(provisioningDeclared({ approval: DEV_REF, env: 'tight' }), 'authorises its own environment only', 'a dev declaration offered as approval for another environment', onHost);
await expectError(rotating({ 'request/request.json': requestJson({ effects: ROTATE, flow: null, approval: DEV_REF, extra: { identityRotation: ROTATION_BINDING } }) }), 'belongs to no operation class', 'a rotation offered a declaration where only an approval id counts', onHost);
rmSync(HOST, { recursive: true, force: true });

process.stdout.write('identity.provision self-test: 6 valid branches, 40 rejected mutations\n');
