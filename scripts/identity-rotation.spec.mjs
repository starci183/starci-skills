import test from 'node:test';
import assert from 'node:assert/strict';
import { identityRotationErrors, operationClasses } from '../operators/platform-operate/validate.mjs';
import { platformAuthorityErrors } from './platform-authority.mjs';
import { fileURLToPath } from 'node:url';
import { hasUserAdminCapability, proveUserAdminCapability } from './identity-provision.mjs';
const binding = { provider: 'http://localhost:8099', realm: 'master', credentialName: 'admin', principalFingerprint: 'sha256:' + 'a'.repeat(64), custodyRefs: ['.stacks/dev/runtime/files/admin.enc'], stagingRefs: ['.stacks/dev/runtime/files/admin.pending.enc'] };
const request = { env: 'dev', approval: 'approved-session-rotation', identityRotation: binding, desiredState: { effects: ['rotate-admin-credential'] } };
const proof = { ...binding, principalId: 'principal-id', newCredentialWorks: true, oldCredentialRejected: true, sessionsInvalidated: true, custodyConsistent: true };
test('provisioning and rotation share exact returned realm authority', () => {
  assert.equal(hasUserAdminCapability({ realm_access: { roles: ['admin'] } }, 'master'), true);
  assert.equal(hasUserAdminCapability({ resource_access: { 'master-realm': { roles: ['manage-users'] } } }, 'master'), true);
  assert.equal(hasUserAdminCapability({ resource_access: { 'other-realm': { roles: ['manage-users'] } } }, 'master'), false);
  assert.equal(hasUserAdminCapability({ resource_access: { 'master-realm': { roles: ['view-users'] } } }, 'master'), false);
  assert.equal(hasUserAdminCapability({ realm_access: { roles: 'admin' } }, 'master'), false);
  const serverProof = { status: 200, rolesStatus: 200, principalId: 'user-id', manage: true, effectiveRealmRoles: ['admin'] };
  assert.equal(hasUserAdminCapability({ sub: 'user-id' }, 'master', serverProof), true);
  assert.equal(hasUserAdminCapability({ sub: 'other-id' }, 'master', serverProof), false);
  assert.equal(hasUserAdminCapability({ sub: 'user-id' }, 'master', { ...serverProof, effectiveRealmRoles: [] }), false);
  assert.equal(hasUserAdminCapability({ sub: 'user-id' }, 'master', { ...serverProof, status: 403 }), false);
});
test('rotation binds exact provider and principal', () => {
  assert.deepEqual(identityRotationErrors(request, proof), []);
  assert.ok(identityRotationErrors(request, { ...proof, principalFingerprint: 'sha256:' + 'b'.repeat(64) }).length);
  assert.ok(identityRotationErrors(request, { ...proof, provider: 'http://localhost:8100' }).length);
});
test('omitted token roles require actual bound master subject and effective global admin', async () => {
  const requests = [];
  const make = (roles, id = 'subject') => async url => {
    requests.push(url);
    if (url.includes('?username=')) return { ok: true, status: 200, data: [{ id, username: 'admin' }] };
    if (url.endsWith('/composite')) return { ok: true, status: 200, data: roles.map(name => ({ name })) };
    return { ok: true, status: 200, data: { id, access: { manage: true } } };
  };
  const args = { claims: { sub: 'subject' }, realm: 'target', provider: 'http://localhost:8099', username: 'Admin', headers: {} };
  assert.equal((await proveUserAdminCapability({ ...args, requestJson: make(['admin']) })).authorized, true);
  assert.ok(requests.every(url => url.startsWith(args.provider + '/admin/realms/master/users')));
  assert.equal((await proveUserAdminCapability({ ...args, requestJson: make([]) })).authorized, false);
  assert.equal((await proveUserAdminCapability({ ...args, requestJson: make(['admin'], 'other') })).authorized, false);
});
test('rotation binds protected exact custody and mandatory recovery proofs', () => {
  assert.ok(identityRotationErrors(request, { ...proof, custodyRefs: ['.stacks/dev/runtime/files/other.enc'] }).length);
  assert.ok(identityRotationErrors({ ...request, identityRotation: { ...binding, custodyRefs: ['.stacks/dev/../other'] } }, proof).length);
  for (const field of ['newCredentialWorks','oldCredentialRejected','sessionsInvalidated','custodyConsistent']) assert.ok(identityRotationErrors(request, { ...proof, [field]: false }).length);
});
test('rotation cannot inherit provisioning effects or absent authorization', async () => {
  assert.ok(identityRotationErrors({ ...request, desiredState: { effects: ['provision-identity'] } }, proof).length);
  assert.ok(identityRotationErrors({ ...request, desiredState: { effects: ['rotate-admin-credential','provision-identity'] } }, proof).length);
  assert.deepEqual(operationClasses('identity', ['rotate-admin-credential']).unclassified, ['rotate-admin-credential']);
  const errors = await platformAuthorityErrors({ root: fileURLToPath(new URL('../', import.meta.url)), requirements: { ...request, approval: null }, kind: 'identity', desiredEffects: ['rotate-admin-credential'], operationClasses });
  assert.ok(errors.length);
});
