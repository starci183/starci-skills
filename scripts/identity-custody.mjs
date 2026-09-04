// Bind before consume. This module has no command that returns a credential or raw HTTP response.
import path from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';

const policyPath = fileURLToPath(new URL('../resources/identity.json', import.meta.url));
export const identityPolicy = JSON.parse(readFileSync(policyPath, 'utf8'));
export const fingerprint = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export class IdentityOperationError extends Error {
  constructor(code) { super(code); this.name = 'IdentityOperationError'; }
}
const requireThat = (ok, code) => { if (!ok) throw new IdentityOperationError(code); };
function origin(value) {
  try {
    const url = new URL(value);
    requireThat(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, 'ENDPOINT_INVALID');
    return url;
  } catch { throw new IdentityOperationError('ENDPOINT_INVALID'); }
}
const normalize = value => {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

export function assertIdentityPlan({ plan, sourceRoot, read = readFileSync }) {
  try {
    const schema = JSON.parse(readFileSync(new URL('../resources/identity-plan.schema.json', import.meta.url), 'utf8'));
    requireThat(validateAgainst(schema, plan).length === 0, 'IDENTITY_PLAN_INVALID');
    const contractPath = path.resolve(sourceRoot, plan.productContract.path);
    requireThat(normalize(contractPath).startsWith(normalize(sourceRoot) + path.sep), 'PRODUCT_CONTRACT_SCOPE');
    const bytes = read(contractPath);
    requireThat(fingerprint(bytes) === plan.productContract.fingerprint, 'PRODUCT_CONTRACT_DRIFT');
    const contract = JSON.parse(bytes.toString());
    requireThat(contract.routeKey === plan.routeKey && contract.clientId === plan.clientId, 'CLIENT_CONTRACT_MISMATCH');
    requireThat(contract.usernameMaxLength === plan.account.usernameMaxLength && plan.account.username.length <= contract.usernameMaxLength, 'ACCOUNT_NAME_LIMIT');
    requireThat(Array.isArray(contract.requiredProfileFields) && ['firstName', 'lastName'].every(field => contract.requiredProfileFields.includes(field) && typeof plan.account[field] === 'string' && plan.account[field].trim()), 'PROFILE_CONTRACT_MISMATCH');
    return { planBound: true, routeKey: plan.routeKey };
  } catch (error) {
    if (error instanceof IdentityOperationError) throw error;
    throw new IdentityOperationError('IDENTITY_PLAN_INVALID');
  }
}

// Provider/container checks happen before a single custody file is opened. The caller obtains the
// Docker inspection through a captured subprocess, never by printing a full inspect into a tool log.
export function assertIdentityCustody({ plan, registryBytes, container, sourceRoot, read = readFileSync, realpath = realpathSync }) {
  try {
    requireThat(plan?.schemaVersion === 1 && typeof plan.routeKey === 'string', 'PLAN_INVALID');
    requireThat(fingerprint(registryBytes) === plan.inventoryFingerprint, 'INVENTORY_DRIFT');
    const registry = JSON.parse(registryBytes.toString());
    const entry = registry.runtimes?.[plan.routeKey];
    requireThat(entry?.identity?.provider === identityPolicy.provider, 'PROVIDER_UNBOUND');
    const provider = origin(plan.provider);
    requireThat(provider.pathname === '/' && provider.origin === origin(entry.identity.adminEndpoint).origin && plan.realm === entry.identity.realm, 'PROVIDER_BINDING');
    const api = origin(plan.api);
    requireThat(api.origin === origin(entry.endpoints.api).origin && api.pathname === '/graphql', 'API_BINDING');
    requireThat(container?.Id === plan.containerId && container?.Image === plan.imageId && container?.State?.Running === true, 'CONTAINER_DRIFT');
    const port = provider.port || (provider.protocol === 'https:' ? '443' : '80');
    requireThat(['localhost', '127.0.0.1', '[::1]'].includes(provider.hostname), 'LOCAL_PROVIDER_REQUIRED');
    const published = Object.values(container.NetworkSettings?.Ports ?? {}).flatMap(value => value ?? []);
    requireThat(published.some(binding => binding.HostPort === port), 'PROVIDER_PORT_BINDING');
    for (const [key, destination] of Object.entries(identityPolicy.adminMounts)) {
      const mount = container.Mounts?.find(value => value.Destination === destination);
      requireThat(mount?.Type === 'bind' && typeof plan.credentials?.[key] === 'string', 'CUSTODY_UNBOUND');
      requireThat(normalize(mount.Source) === normalize(plan.credentials[key]), 'CUSTODY_BINDING');
      requireThat(normalize(realpath(mount.Source)) === normalize(mount.Source), 'CUSTODY_SYMLINK');
    }
    requireThat(/^\.stacks\/[a-z0-9-]+\/secrets\/[a-z0-9-]+\.enc$/.test(plan.credentials?.uat ?? ''), 'SEALED_CREDENTIAL_REQUIRED');
    const files = { username: plan.credentials.username, password: plan.credentials.password, uat: path.resolve(sourceRoot, plan.credentials.uat) };
    for (const [key, file] of Object.entries(files)) {
      requireThat(normalize(realpath(file)) === normalize(file), 'CUSTODY_SYMLINK');
      requireThat(fingerprint(read(file)) === plan.credentialFingerprints?.[key], 'CUSTODY_DRIFT');
    }
    return { routeKey: plan.routeKey, provider: provider.origin, realm: plan.realm, custodyBound: true };
  } catch (error) {
    if (error instanceof IdentityOperationError) throw error;
    // A filesystem/JSON exception can include private bytes or paths. Never forward it.
    throw new IdentityOperationError('CUSTODY_PREFLIGHT_FAILED');
  }
}

// Only trusted fixed operation code consumes the return value, which may contain a token. Nothing
// logs it. Failures expose a fixed code/status, never the provider body or fetch error cause.
export async function privateJsonRequest(url, init = {}, fetcher = fetch) {
  try {
    const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(identityPolicy.timeoutMs) });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    return { ok: true, status: response.status, data: await response.json() };
  } catch { throw new IdentityOperationError('IDENTITY_REQUEST_FAILED'); }
}
