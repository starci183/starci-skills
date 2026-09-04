import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { provisionAccount, privateStatusRequest } from './identity-provision.mjs';
import { assertIdentityPlan, privateJsonRequest, fingerprint } from './identity-custody.mjs';
import { platformAuthorityErrors } from './platform-authority.mjs';
import { operationClasses } from '../operators/platform-operate/validate.mjs';

const secret = 'test-private-value-never-in-evidence';
const plan = () => ({ provider: 'http://localhost:8900', realm: 'test', api: 'http://localhost:8901/graphql', clientId: 'test-web', account: { username: 'uat-test-owner', email: 'uat-test@example.test', firstName: 'Test', lastName: 'Owner', usernameMaxLength: 40 } });
function transport({ existing = false, createThrows = false, productToken = true } = {}) {
  let createCalls = 0, lookups = 0;
  const account = { id: 'test-account-id', username: 'uat-test-owner', email: 'uat-test@example.test', enabled: true };
  return {
    get createCalls() { return createCalls; },
    requestStatus: async () => { createCalls++; if (createThrows) throw new Error(secret); return { ok: true, status: 201 }; },
    requestJson: async url => {
      if (url.includes('/users?')) { lookups++; return { ok: true, status: 200, data: existing || lookups > 1 ? [account] : [] }; }
      if (url.endsWith('/token')) return { ok: true, status: 200, data: { access_token: 'provider-' + secret } };
      return { ok: true, status: 200, data: { data: { signIn: { success: true, data: { accessToken: productToken ? 'product-' + secret : null, requiresTwoFactor: false } } } } };
    },
  };
}
const run = (adapter, input = plan()) => provisionAccount({ plan: input, password: secret, headers: { authorization: 'Bearer ' + secret }, frontend: 'http://localhost:8902', requestJson: adapter.requestJson, requestStatus: adapter.requestStatus });

test('existing account is refused without resetting or creating it', async () => {
  const adapter = transport({ existing: true }); const result = await run(adapter);
  assert.equal(result.failureCode, 'ACCOUNT_ALREADY_EXISTS'); assert.equal(adapter.createCalls, 0);
});
test('missing profile and overlong username are refused before mutation', async () => {
  for (const edit of [p => { delete p.account.firstName; }, p => { p.account.lastName = ''; }, p => { p.account.usernameMaxLength = 2; }]) {
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
test('closed plan binds client, profile and username limit to a fingerprinted product contract', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-contract-'));
  try {
    const contract = Buffer.from(JSON.stringify({ routeKey: 'test/fe', clientId: 'test-web', usernameMaxLength: 40, requiredProfileFields: ['firstName', 'lastName'] }));
    const p = { ...plan(), schemaVersion: 1, sessionId: 's-test', routeKey: 'test/fe', flow: 'test-flow', container: 'identity', containerId: 'a'.repeat(64), imageId: 'sha256:' + 'b'.repeat(64), inventoryFingerprint: 'sha256:' + 'c'.repeat(64), credentials: { username: '/mounted/user', password: '/mounted/password', uat: '.stacks/dev/secrets/uat.enc' }, credentialFingerprints: { username: 'sha256:' + 'd'.repeat(64), password: 'sha256:' + 'e'.repeat(64), uat: 'sha256:' + 'f'.repeat(64) }, productContract: { path: 'contract.json', fingerprint: fingerprint(contract) }, capabilities: [{ capability: 'identity:account-admin', custodyEvidenceRef: 'mounts.json' }] };
    const read = file => { assert.equal(file, path.join(root, 'contract.json')); return contract; };
    assert.equal(assertIdentityPlan({ plan: p, sourceRoot: root, read }).planBound, true);
    for (const edit of [v => { v.clientId = 'other-client'; }, v => { v.account.usernameMaxLength = 100; }, v => { v.account.firstName = ' '; }, v => { v.extra = 'unknown'; }]) {
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
