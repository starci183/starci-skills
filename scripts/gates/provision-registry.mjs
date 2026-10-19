import { inspectRegistryNative } from '../api/process/inspect-registry-native.mjs';
import { provisionRegistry } from '../api/process/provision-registry.mjs';
import { resolveProvisionTarget } from './provision-target.mjs';
import { runProvisionOperation } from './provision-operation.mjs';
import { argThrow as fail } from '../lib/cli-arg.mjs';

const KEYS = new Set(['username', 'dockerConfig', 'dockerEndpoint', 'helper', 'timeoutMs']);
const RESULT_CODES = new Set(['GHCR_NATIVE_CUSTODY_HELD', 'GHCR_NATIVE_CONFLICT', 'GHCR_NATIVE_CREDENTIAL_REUSED',
  'GHCR_LOGIN_UNCONFIRMED', 'GHCR_LOGIN_READBACK_UNCONFIRMED', 'GHCR_LOGIN_NATIVE_READBACK']);

/** Binds one accepted GHCR identity to the existing native Docker helper without a second credential store. */
export async function runRegistryLogin(ctx) {
  if (ctx.positionals[0] !== 'login') fail('GHCR_ACTION_REFUSED');
  const target = resolveProvisionTarget({ cwd: ctx.cwd, targetId: ctx.args.target, provider: 'ghcr' });
  if (target.origin !== 'https://ghcr.io' || target.destination !== null || !target.resource
    || typeof target.resource !== 'object' || Array.isArray(target.resource)
    || Object.keys(target.resource).some(key => !KEYS.has(key))) fail('GHCR_TARGET_INVALID');
  if (Object.keys(target.credentials).length !== 1 || !target.credentials['registry-password']
    || target.credentials['registry-password'].optional) fail('GHCR_CREDENTIAL_REFUSED');
  const resource = target.resource;
  const expected = inspectRegistryNative(resource, ctx.env);
  const invoke = ({ credentials, checkpoint, acknowledge }, reconcile) => provisionRegistry({
    resource, expected, parentEnv: ctx.env, credential: () => credentials['registry-password'],
    reconcile, checkpoint, acknowledge,
  });
  return await runProvisionOperation(ctx, { action: 'registry.ghcr.login', target,
    requestId: ctx.args.operation, execute: ctx.args.execute, credentialRefs: target.credentials,
    resultCodes: RESULT_CODES, publicResource: { ...resource, native: expected },
    plan: { host: target.origin, username: resource.username, native: expected,
      credentialRoles: Object.keys(target.credentials), conflictingEntry: 'held',
      reconciliation: 'native-custody-readback-without-login', providerAccepted: 'docker-login-acknowledgement',
      consumerVerified: false },
    apply: state => invoke(state, false), reconcile: state => invoke(state, true),
  });
}
