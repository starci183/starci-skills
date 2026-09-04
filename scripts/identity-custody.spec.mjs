import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { assertIdentityCustody, fingerprint, privateJsonRequest } from './identity-custody.mjs';

function fixture() {
  const root = path.resolve('identity-test-root');
  const username = path.join(root, 'provider/admin-user');
  const password = path.join(root, 'provider/admin-password');
  const uat = '.stacks/dev/secrets/uat.enc';
  const bytes = Buffer.from('test-only-fixture');
  const registryBytes = Buffer.from(JSON.stringify({ runtimes: { 'product/fe': { identity: { provider: 'keycloak', adminEndpoint: 'http://localhost:8147', realm: 'product' }, endpoints: { api: 'http://localhost:3068' } } } }));
  const plan = { schemaVersion: 1, routeKey: 'product/fe', provider: 'http://localhost:8147', realm: 'product', api: 'http://localhost:3068/graphql', inventoryFingerprint: fingerprint(registryBytes), containerId: 'container', imageId: 'image', credentials: { username, password, uat }, credentialFingerprints: { username: fingerprint(bytes), password: fingerprint(bytes), uat: fingerprint(bytes) } };
  const container = { Id: 'container', Image: 'image', State: { Running: true }, NetworkSettings: { Ports: { '8080/tcp': [{ HostPort: '8147' }] } }, Mounts: [{ Type: 'bind', Source: username, Destination: '/run/secrets/keycloak-admin-user' }, { Type: 'bind', Source: password, Destination: '/run/secrets/keycloak-admin-password' }] };
  let reads = 0;
  return { plan, registryBytes, container, sourceRoot: root, read: () => { reads++; return bytes; }, realpath: value => value, reads: () => reads };
}
test('the selected provider and its actual mounted custody bind before consumption', () => {
  const f = fixture();
  assert.equal(assertIdentityCustody(f).custodyBound, true);
  assert.equal(f.reads(), 3);
});
test('a same-named Source credential is rejected before any credential read', () => {
  const f = fixture(); f.plan.credentials.password = path.resolve('different-source/admin-password');
  assert.throws(() => assertIdentityCustody(f), /CUSTODY_BINDING/);
  assert.equal(f.reads(), 0);
});
test('wrong provider, realm, API, port, container and stale inventory fail before reads', () => {
  for (const mutate of [
    f => { f.plan.provider = 'http://localhost:8080'; },
    f => { f.plan.realm = 'other'; },
    f => { f.plan.api = 'http://localhost:3001/graphql'; },
    f => { f.container.NetworkSettings.Ports = {}; },
    f => { f.container.Id = 'replaced'; },
    f => { f.plan.inventoryFingerprint = fingerprint('old'); },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => assertIdentityCustody(f)); assert.equal(f.reads(), 0);
  }
});
test('symlinked custody and changed credential bytes fail closed', () => {
  const f = fixture(); f.realpath = value => `${value}-elsewhere`;
  assert.throws(() => assertIdentityCustody(f), /CUSTODY_SYMLINK/);
  assert.equal(f.reads(), 0);
  const changed = fixture(); changed.read = () => Buffer.from('changed');
  assert.throws(() => assertIdentityCustody(changed), /CUSTODY_DRIFT/);
});
test('private transport refuses redirects and never returns failed provider bodies', async () => {
  const secret = 'PRIVATE_TEST_SENTINEL'; let bodyRead = false;
  const result = await privateJsonRequest('http://localhost', { redirect: 'follow' }, async (_url, init) => {
    assert.equal(init.redirect, 'error'); assert.ok(init.signal);
    return { ok: false, status: 401, json: () => { bodyRead = true; return { secret }; } };
  });
  assert.deepEqual(result, { ok: false, status: 401, data: null }); assert.equal(bodyRead, false);
  await assert.rejects(privateJsonRequest('http://localhost', {}, async () => { throw new Error(secret); }), error => error.message === 'IDENTITY_REQUEST_FAILED' && !String(error).includes(secret));
});
