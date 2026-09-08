import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { provisionAccount, provisionAccounts, privateStatusRequest } from './identity-provision.mjs';
import { assertIdentityPlan, privateJsonRequest, fingerprint } from './identity-custody.mjs';
import { platformAuthorityErrors } from './platform-authority.mjs';
import { operationClasses } from '../operators/identity-provision/validate.mjs';

const secret = 'test-private-value-never-in-evidence';
const owner = () => ({ alias: 'owner', username: 'uat-test-owner', email: 'uat-test@example.test', firstName: 'Test', lastName: 'Owner', usernameMaxLength: 40 });
const stranger = () => ({ alias: 'stranger', username: 'uat-test-stranger', email: 'uat-stranger@example.test', firstName: 'Test', lastName: 'Stranger', usernameMaxLength: 40 });
const plan = () => ({ provider: 'http://localhost:8900', realm: 'test', api: 'http://localhost:8901/graphql', clientId: 'test-web', accounts: [owner()] });
function transport({ existing = false, createThrows = false, productToken = true, refuse = null } = {}) {
  let createCalls = 0;
  const seen = new Map();
  const known = { 'uat-test-owner': { id: 'test-account-id', username: 'uat-test-owner', email: 'uat-test@example.test', enabled: true }, 'uat-test-stranger': { id: 'test-stranger-id', username: 'uat-test-stranger', email: 'uat-stranger@example.test', enabled: true } };
  return {
    get createCalls() { return createCalls; },
    requestStatus: async () => { createCalls++; if (createThrows) throw new Error(secret); return { ok: true, status: 201 }; },
    requestJson: async (url, init) => {
      if (url.includes('/users?')) {
        const name = decodeURIComponent(/username=([^&]*)/.exec(url)[1]);
        const n = (seen.get(name) ?? 0) + 1; seen.set(name, n);
        return { ok: true, status: 200, data: existing || n > 1 ? [known[name]] : [] };
      }
      if (refuse && String(init?.body ?? '').includes(refuse)) return { ok: false, status: 401, data: null };
      if (url.endsWith('/token')) return { ok: true, status: 200, data: { access_token: 'provider-' + secret } };
      return { ok: true, status: 200, data: { data: { signIn: { success: true, data: { accessToken: productToken ? 'product-' + secret : null, requiresTwoFactor: false } } } } };
    },
  };
}
const run = (adapter, input = plan()) => provisionAccount({ plan: input, account: input.accounts[0], password: secret, headers: { authorization: 'Bearer ' + secret }, frontend: 'http://localhost:8902', requestJson: adapter.requestJson, requestStatus: adapter.requestStatus });
const runAll = (adapter, input = plan()) => provisionAccounts({ plan: input, password: secret, headers: { authorization: 'Bearer ' + secret }, frontend: 'http://localhost:8902', requestJson: adapter.requestJson, requestStatus: adapter.requestStatus });

test('existing account is refused without resetting or creating it', async () => {
  const adapter = transport({ existing: true }); const result = await run(adapter);
  assert.equal(result.failureCode, 'ACCOUNT_ALREADY_EXISTS'); assert.equal(adapter.createCalls, 0);
});
test('missing profile and overlong username are refused before mutation', async () => {
  for (const edit of [p => { delete p.accounts[0].firstName; }, p => { p.accounts[0].lastName = ''; }, p => { p.accounts[0].usernameMaxLength = 2; }]) {
    const p = plan(); edit(p); const adapter = transport(); const result = await run(adapter, p);
    assert.equal(result.failureCode, 'ACCOUNT_PROFILE_INVALID'); assert.equal(adapter.createCalls, 0);
  }
});
test('201 empty response is accepted without reading or parsing its body', async () => {
  let bodyRead = false;
  const result = await privateStatusRequest('http://localhost:8900/test', {}, async (_url, init) => { assert.equal(init.redirect, 'error'); assert.ok(init.signal); return { ok: true, status: 201, json: () => { bodyRead = true; throw new Error(secret); } }; });
  assert.deepEqual(result, { ok: true, status: 201 }); assert.equal(bodyRead, false);
});
test('ambiguous create is reconciled and never retried', async () => {
  const adapter = transport({ createThrows: true }); const result = await run(adapter);
  assert.equal(adapter.createCalls, 1); assert.equal(result.status, 'blocked'); assert.equal(result.partialMutation, true);
  assert.equal(result.reconciliation.accountCount, 1); assert.ok(!JSON.stringify(result).includes(secret));
});
test('401 body and network error payload are never returned', async () => {
  let read = false;
  const result = await privateJsonRequest('http://localhost:8900/test', {}, async () => ({ ok: false, status: 401, json: () => { read = true; return { error: secret }; } }));
  assert.deepEqual(result, { ok: false, status: 401, data: null }); assert.equal(read, false);
  await assert.rejects(privateStatusRequest('http://localhost:8900/test', {}, async () => { throw new Error(secret); }), error => error.message === 'IDENTITY_REQUEST_FAILED');
});
test('provider existence and token do not replace product sign-in proof', async () => {
  const rejected = await run(transport({ productToken: false })); assert.equal(rejected.failureCode, 'PRODUCT_SIGNIN_FAILED'); assert.equal(rejected.partialMutation, true);
  const accepted = await run(transport()); assert.equal(accepted.status, 'done'); assert.ok(accepted.checks.some(c => c.name === 'account-signs-in' && c.passed)); assert.ok(!JSON.stringify(accepted).includes(secret));
});
// One branch provisions the flow's whole cast. A flow that is only true when two roles meet used to
// need two branches, because the plan carried one account and the branch's plan hash carried one plan.
test('one branch provisions every alias the plan names, and stops at the first that fails', async () => {
  const two = { ...plan(), accounts: [owner(), stranger()] };
  const adapter = transport();
  const all = await runAll(adapter, two);
  assert.equal(all.status, 'done');
  assert.equal(adapter.createCalls, 2);
  assert.deepEqual(all.accounts.map(a => a.alias), ['owner', 'stranger']);
  assert.deepEqual(all.accounts.map(a => a.accountId), ['test-account-id', 'test-stranger-id']);
  assert.equal(all.mutations.length, 2, 'one provision-identity mutation per account');
  assert.equal(all.checks.filter(c => c.name === 'account-signs-in' && c.passed).length, 2);
  assert.ok(!JSON.stringify(all).includes(secret));

  // The second alias fails its product sign-in: the first stands, is reported as a mutation, and the
  // run is blocked rather than reporting a cast it never created.
  const partial = await runAll(transport({ refuse: 'uat-stranger@example.test' }), { ...plan(), accounts: [owner(), stranger()] });
  assert.equal(partial.status, 'blocked');
  assert.equal(partial.failureCode, 'PRODUCT_SIGNIN_FAILED');
  assert.equal(partial.partialMutation, true);
  assert.deepEqual(partial.accounts.map(a => a.alias), ['owner', 'stranger']);
  assert.equal(partial.checks.filter(c => c.name === 'account-signs-in').length, 1);
});
test('closed plan binds client, profile and username limit to a fingerprinted product contract', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-contract-'));
  try {
    const contract = Buffer.from(JSON.stringify({ routeKey: 'test/fe', clientId: 'test-web', usernameMaxLength: 40, requiredProfileFields: ['firstName', 'lastName'] }));
    const p = { ...plan(), schemaVersion: 1, sessionId: 's-test', routeKey: 'test/fe', flow: 'test-flow', container: 'identity', containerId: 'a'.repeat(64), imageId: 'sha256:' + 'b'.repeat(64), inventoryFingerprint: 'sha256:' + 'c'.repeat(64), credentials: { username: '/mounted/user', password: '/mounted/password', uat: '.stacks/dev/secrets/uat.enc' }, credentialFingerprints: { username: 'sha256:' + 'd'.repeat(64), password: 'sha256:' + 'e'.repeat(64), uat: 'sha256:' + 'f'.repeat(64) }, productContract: { path: 'contract.json', fingerprint: fingerprint(contract) }, capabilities: [{ capability: 'identity:account-admin', custodyEvidenceRef: 'mounts.json' }] };
    const read = file => { assert.equal(file, path.join(root, 'contract.json')); return contract; };
    assert.equal(assertIdentityPlan({ plan: p, sourceRoot: root, read }).planBound, true);
    for (const edit of [v => { v.clientId = 'other-client'; }, v => { v.accounts[0].usernameMaxLength = 100; }, v => { v.accounts[0].firstName = ' '; }, v => { v.extra = 'unknown'; }, v => { v.accounts.push({ ...v.accounts[0], alias: 'twin' }); }]) {
      const mutated = structuredClone(p); edit(mutated); assert.throws(() => assertIdentityPlan({ plan: mutated, sourceRoot: root, read }));
    }
  } finally { fs.rmSync(root, { recursive: true }); }
});
test('shared platform authority check rejects declaration drift before execution', async () => {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-authority-'));
  try {
    const runtime = path.join(host, '.claude'); fs.mkdirSync(path.join(runtime, 'readiness/initialization/stacks'), { recursive: true }); fs.mkdirSync(path.join(host, '.stacks/dev'), { recursive: true });
    fs.copyFileSync(new URL('../readiness/initialization/stacks/environment.schema.json', import.meta.url), path.join(runtime, 'readiness/initialization/stacks/environment.schema.json'));
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 9, env: 'dev', production: false })); fs.writeFileSync(path.join(host, '.stacks/dev/environment.json'), bytes);
    const requirements = { env: 'dev', approval: '.stacks/dev/environment.json#' + fingerprint(bytes) };
    assert.deepEqual(await platformAuthorityErrors({ root: runtime, hostRoot: host, requirements, kind: 'identity', desiredEffects: ['provision-identity'], operationClasses }), []);
    requirements.approval = '.stacks/dev/environment.json#sha256:' + '0'.repeat(64);
    assert.ok((await platformAuthorityErrors({ root: runtime, hostRoot: host, requirements, kind: 'identity', desiredEffects: ['provision-identity'], operationClasses })).some(e => e.includes('AUTHORITY_DRIFT')));
  } finally { fs.rmSync(host, { recursive: true }); }
});
