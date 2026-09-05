// This fixed operation never exposes a generic secret resolver or arbitrary authenticated request.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertIdentityPlan, assertIdentityCustody, privateJsonRequest, fingerprint, identityPolicy, IdentityOperationError } from './identity-custody.mjs';
import { validateRequest, loadEnvironmentSchema, parseDeclarationReference } from './validate-request.mjs';
import { platformAuthorityErrors } from './platform-authority.mjs';
import { operationClasses, KIND_CAPABILITIES } from '../operators/identity-provision/validate.mjs';
import { validateAgainst } from './json-schema.mjs';
const requireThat = (value, code) => { if (!value) throw new IdentityOperationError(code); };
const normalized = value => { const resolved = path.resolve(value).replaceAll('\\', '/'); return process.platform === 'win32' ? resolved.toLowerCase() : resolved; };
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function hasUserAdminCapability(claims, realm, serverProof) {
  const realmRoles = claims?.realm_access?.roles;
  const userRoles = claims?.resource_access?.[realm + '-realm']?.roles;
  return (Array.isArray(realmRoles) && realmRoles.includes('admin')) ||
    (Array.isArray(userRoles) && userRoles.includes('manage-users')) ||
    (serverProof?.status === 200 && serverProof?.rolesStatus === 200 &&
      typeof claims?.sub === 'string' && serverProof.principalId === claims.sub && serverProof.manage === true &&
      Array.isArray(serverProof.effectiveRealmRoles) && serverProof.effectiveRealmRoles.includes('admin'));
}
// A provider may omit role claims. Only its own authenticated master-principal endpoint and
// effective global administrator role can supply this fallback; target-user self access cannot.
export async function proveUserAdminCapability({ claims, realm, provider, username, headers, requireServerProof = false, requestJson = privateJsonRequest }) {
  if (!requireServerProof && hasUserAdminCapability(claims, realm)) return { authorized: true, source: 'returned-token' };
  const users = await requestJson(provider + '/admin/realms/master/users?username=' + encodeURIComponent(username) + '&exact=true', { headers });
  const match = users.ok && Array.isArray(users.data) && users.data.length === 1 &&
    typeof users.data[0].username === 'string' && users.data[0].username.toLowerCase() === username.toLowerCase() && users.data[0].id === claims?.sub;
  if (!match) return { authorized: false, source: 'bound-master-principal', queryStatus: users.status, principalMatches: false };
  const principalId = users.data[0].id;
  const detail = await requestJson(provider + '/admin/realms/master/users/' + encodeURIComponent(principalId), { headers });
  const roles = await requestJson(provider + '/admin/realms/master/users/' + encodeURIComponent(principalId) + '/role-mappings/realm/composite', { headers });
  const serverProof = { status: detail.status, rolesStatus: roles.status, principalId, manage: detail.data?.id === principalId && detail.data?.access?.manage === true, effectiveRealmRoles: Array.isArray(roles.data) ? roles.data.map(role => role.name) : [] };
  return { authorized: hasUserAdminCapability({ sub: claims?.sub }, realm, serverProof), source: 'bound-master-principal', queryStatus: users.status, detailStatus: detail.status, rolesStatus: roles.status, principalMatches: true, principalId, manage: serverProof.manage, effectiveGlobalAdmin: serverProof.effectiveRealmRoles.includes('admin') };
}
export const privateStatusRequest = async (url, init, fetcher = fetch) => {
  try { const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(identityPolicy.timeoutMs) }); return { ok: response.ok, status: response.status }; }
  catch { throw new IdentityOperationError('IDENTITY_REQUEST_FAILED'); }
};

// The only mutating identity transport. Adapters exist for contract tests; returned data is closed
// status evidence, never a provider response, credential, cookie or token.
export async function provisionAccount({ plan, account, password, headers, frontend, requestJson = privateJsonRequest, requestStatus = privateStatusRequest }) {
  const result = { status: 'blocked', stage: 'account-validation', checks: [], mutations: [], partialMutation: false };
  let attempted = false, confirmed = false, lookup;
  try {
    const schema = JSON.parse(fs.readFileSync(new URL('../resources/identity-plan.schema.json', import.meta.url), 'utf8'));
    requireThat(validateAgainst(schema.properties.accounts.items, account).length === 0 && account.username.length <= account.usernameMaxLength && ['firstName', 'lastName'].every(field => account[field].trim()), 'ACCOUNT_PROFILE_INVALID');
    lookup = async () => {
      const response = await requestJson(plan.provider + '/admin/realms/' + plan.realm + '/users?username=' + encodeURIComponent(account.username) + '&exact=true', { headers });
      requireThat(response.ok && Array.isArray(response.data), 'ACCOUNT_QUERY_FAILED'); return response.data;
    };
    requireThat((await lookup()).length === 0, 'ACCOUNT_ALREADY_EXISTS');
    result.stage = 'account-create'; attempted = true;
    const created = await requestStatus(plan.provider + '/admin/realms/' + plan.realm + '/users', { method: 'POST', headers, body: JSON.stringify({ username: account.username, email: account.email, firstName: account.firstName, lastName: account.lastName, enabled: true, emailVerified: true, requiredActions: [], credentials: [{ type: 'password', temporary: false, value: password }] }) });
    requireThat(created.ok && created.status === 201, 'ACCOUNT_CREATE_UNCONFIRMED');
    const accounts = await lookup();
    requireThat(accounts.length === 1 && accounts[0].username === account.username && accounts[0].email === account.email && accounts[0].enabled, 'ACCOUNT_NOT_PROVED');
    confirmed = true; result.accountId = accounts[0].id;
    result.mutations.push({ effect: 'provision-identity', accountId: accounts[0].id, username: accounts[0].username });
    result.checks.push({ name: 'account-exists', passed: true, account: account.username });
    result.stage = 'provider-sign-in';
    const grant = await requestJson(plan.provider + '/realms/' + plan.realm + '/protocol/openid-connect/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: plan.clientId, grant_type: 'password', scope: 'openid', username: account.username, password }) });
    requireThat(grant.ok && typeof grant.data?.access_token === 'string', 'PROVIDER_SIGNIN_FAILED');
    result.stage = 'product-sign-in';
    const login = await requestJson(plan.api, { method: 'POST', headers: { 'content-type': 'application/json', origin: frontend }, body: JSON.stringify({ query: 'mutation IdentityLogin($input: SignInInput!) { signIn(input: $input) { success error data { accessToken requiresTwoFactor } } }', variables: { input: { email: account.email, password } } }) });
    const auth = login.data?.data?.signIn;
    requireThat(login.ok && !login.data?.errors?.length && auth?.success && typeof auth.data?.accessToken === 'string' && auth.data.requiresTwoFactor === false, 'PRODUCT_SIGNIN_FAILED');
    result.checks.push({ name: 'account-signs-in', passed: true, account: account.username });
    result.status = 'done'; result.partialMutation = true;
    requireThat(![password, grant.data.access_token, auth.data.accessToken].some(value => value.length >= 8 && JSON.stringify(result).includes(value)), 'OUTPUT_SECRET_DETECTED');
    return result;
  } catch (error) {
    if (attempted && !confirmed && lookup) {
      try { const observed = await lookup(); result.reconciliation = { accountCount: observed.length }; if (observed.length === 1 && observed[0].username === account.username && observed[0].email === account.email) { confirmed = true; result.accountId = observed[0].id; } }
      catch { /* An ambiguous create never retries; its exact uncertainty is durable. */ }
    }
    result.failureCode = error instanceof IdentityOperationError ? error.message : 'PRIVATE_OPERATION_FAILED';
    result.partialMutation = confirmed ? true : attempted ? (result.reconciliation?.accountCount === 0 ? false : 'unknown') : false;
    return result;
  }
}

// Every alias the flow names, in the plan's order, under one plan and one admin session. The first
// account that fails ends the run: what was created before it stands and is reported as a mutation,
// because an identity that exists at the provider is never quietly unreported.
export async function provisionAccounts({ plan, password, headers, frontend, requestJson = privateJsonRequest, requestStatus = privateStatusRequest }) {
  const all = { status: 'done', stage: 'accounts', checks: [], mutations: [], partialMutation: false, accounts: [] };
  for (const account of plan.accounts) {
    const one = await provisionAccount({ plan, account, password, headers, frontend, requestJson, requestStatus });
    all.checks.push(...one.checks);
    all.mutations.push(...one.mutations);
    if (one.accountId) all.accounts.push({ alias: account.alias ?? null, username: account.username, email: account.email, accountId: one.accountId });
    if (one.partialMutation === true || all.partialMutation === true) all.partialMutation = true;
    else if (one.partialMutation === 'unknown') all.partialMutation = 'unknown';
    if (one.status !== 'done') {
      all.status = 'blocked'; all.stage = one.stage; all.failureCode = one.failureCode;
      if (one.reconciliation) all.reconciliation = one.reconciliation;
      return all;
    }
  }
  return all;
}

export async function provisionIdentity(sourceRoot, branchDir) {
  const source = path.resolve(sourceRoot), branch = path.resolve(branchDir);
  const result = { schemaVersion: 1, status: 'blocked', stage: 'gate', checks: [], mutations: [], partialMutation: false };
  let lock, lockToken, lockOwned = false, attempted = false, confirmed = false;
  let resolvedValues = [], outputDir;
  const writeResult = () => {
    const payload = JSON.stringify(result, null, 2) + '\n';
    requireThat(!resolvedValues.some(value => value.length >= 8 && payload.includes(value)), 'OUTPUT_SECRET_DETECTED');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = 'identity-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    fs.writeFileSync(path.join(outputDir, filename), payload, { flag: 'wx' });
    return filename;
  };
  try {
    requireThat(normalized(branch).startsWith(normalized(path.join(source, '.worktrees/sessions')) + '/'), 'SESSION_SCOPE');
    const gate = await validateRequest(path.join(source, '.claude'), branch);
    requireThat(gate.errors.length === 0, 'REQUEST_INVALID');
    const request = json(path.join(branch, 'request/request.json'));
    requireThat(request.operatorId === 'identity.provision' && request.requirements?.desiredState?.serviceKind === 'identity', 'OPERATOR_SCOPE');
    const planPath = path.join(branch, 'request/identity-plan.json'), bytes = fs.readFileSync(planPath), plan = JSON.parse(bytes);
    assertIdentityPlan({ plan, sourceRoot: source });
    requireThat(fingerprint(bytes) === request.requirements.desiredState.planSha256, 'PLAN_DRIFT');
    requireThat(plan.sessionId === request.sessionId && plan.routeKey === request.requirements.routeKey && plan.flow === request.requirements.flow, 'PLAN_SCOPE');
    requireThat(request.requirements.desiredState.effects.includes('provision-identity'), 'PROVISION_UNAUTHORIZED');
    requireThat(request.requirements.desiredState.mutableResourceRefs.includes(plan.routeKey), 'RESOURCE_UNAUTHORIZED');
    const runtime = path.join(source, '.claude');
    const authority = await platformAuthorityErrors({ root: runtime, hostRoot: source, requirements: request.requirements, kind: 'identity', desiredEffects: request.requirements.desiredState.effects, operationClasses });
    requireThat(authority.length === 0, 'PLATFORM_AUTHORITY_INVALID');
    requireThat(parseDeclarationReference(await loadEnvironmentSchema(runtime), request.requirements.approval), 'DECLARED_AUTHORITY_REQUIRED');
    requireThat(KIND_CAPABILITIES.identity.every(capability => plan.capabilities.some(value => value.capability === capability)), 'CAPABILITY_UNBOUND');
    requireThat(Array.isArray(plan.accounts) && plan.accounts.length > 0, 'ACCOUNT_NAMESPACE');
    requireThat(new Set(plan.accounts.map(account => account.alias)).size === plan.accounts.length, 'ACCOUNT_NAMESPACE');
    for (const account of plan.accounts) {
      requireThat(/^uat-[A-Za-z0-9._-]+$/.test(account?.username ?? ''), 'ACCOUNT_NAMESPACE');
      requireThat(Number.isInteger(account.usernameMaxLength) && account.usernameMaxLength > 0 && account.username.length <= account.usernameMaxLength, 'ACCOUNT_NAME_LIMIT');
      requireThat(typeof account.email === 'string' && /^[^\s@]+@[^\s@]+$/.test(account.email), 'ACCOUNT_EMAIL');
    }
    requireThat(typeof plan.clientId === 'string' && /^[A-Za-z0-9._-]+$/.test(plan.clientId), 'CLIENT_UNBOUND');
    outputDir = path.join(branch, 'response/artifacts');
    result.sessionId = plan.sessionId; result.routeKey = plan.routeKey;
    result.planned = plan.accounts.map(account => ({ alias: account.alias, username: account.username, email: account.email }));
    lock = path.join(source, '.worktrees/sessions/central-runtime', 'identity-' + plan.routeKey.replace('/', '-') + '.lease.json');
    lockToken = crypto.randomUUID();
    fs.writeFileSync(lock, JSON.stringify({ sessionId: plan.sessionId, token: lockToken, operation: 'provision-identity' }), { flag: 'wx' });
    lockOwned = true;
    const mine = json(lock); requireThat(mine.token === lockToken && mine.sessionId === plan.sessionId, 'LEASE_OWNERSHIP');
    const registryBytes = fs.readFileSync(path.join(source, '.worktrees/sessions/central-runtime/owner.json'));
    const container = JSON.parse(execFileSync('docker', ['inspect', plan.container], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))[0];
    assertIdentityCustody({ plan, registryBytes, container, sourceRoot: source });
    const entry = JSON.parse(registryBytes).runtimes[plan.routeKey];
    requireThat(!entry.lease, 'RUNTIME_BUSY');
    result.stage = 'provider-reachability';
    const discovery = await privateJsonRequest(plan.provider + '/realms/' + plan.realm + '/.well-known/openid-configuration');
    requireThat(discovery.ok, 'PROVIDER_UNAVAILABLE');
    result.checks.push({ name: 'provider-reachable', passed: true });
    const apiProbe = await privateJsonRequest(plan.api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ __typename }' }) });
    requireThat(apiProbe.ok && apiProbe.data?.data?.__typename, 'PRODUCT_UNAVAILABLE');
    result.stage = 'credential-resolution';
    const masterRef = json(path.join(source, '.workspaces/device-state.json')).encryption.masterIdentity;
    const masterFile = masterRef.startsWith('~/') ? path.join(os.homedir(), masterRef.slice(2)) : path.resolve(source, masterRef);
    const username = fs.readFileSync(plan.credentials.username, 'utf8').trim();
    const adminPassword = fs.readFileSync(plan.credentials.password, 'utf8').trim();
    const password = execFileSync('sops', ['--decrypt', '--input-type', 'binary', '--output-type', 'binary', path.resolve(source, plan.credentials.uat)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SOPS_AGE_KEY_FILE: masterFile } }).trim();
    resolvedValues = [adminPassword, password];
    requireThat(username && adminPassword && password, 'CREDENTIAL_EMPTY');
    result.checks.push({ name: 'credential-resolvable', passed: true });
    result.stage = 'admin-auth';
    const admin = await privateJsonRequest(plan.provider + '/realms/master/protocol/openid-connect/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username, password: adminPassword }) });
    requireThat(admin.ok && typeof admin.data?.access_token === 'string', 'ADMIN_AUTH_FAILED');
    resolvedValues.push(admin.data.access_token);
    // This is the token just returned by the bound provider, never caller-supplied claims.
    const claims = JSON.parse(Buffer.from(admin.data.access_token.split('.')[1], 'base64url').toString());
    const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + admin.data.access_token };
    requireThat((await proveUserAdminCapability({ claims, realm: plan.realm, provider: plan.provider, username, headers })).authorized, 'CAPABILITY_MISSING');
    const clients = await privateJsonRequest(plan.provider + '/admin/realms/' + plan.realm + '/clients?clientId=' + encodeURIComponent(plan.clientId), { headers });
    requireThat(clients.ok && Array.isArray(clients.data) && clients.data.length === 1 && clients.data[0].clientId === plan.clientId && clients.data[0].enabled && clients.data[0].publicClient && clients.data[0].directAccessGrantsEnabled, 'CLIENT_PROVIDER_MISMATCH');
    const completed = await provisionAccounts({ plan, password, headers, frontend: entry.endpoints.frontend });
    const priorChecks = result.checks;
    Object.assign(result, completed);
    result.checks = [...priorChecks, ...completed.checks];
    attempted = completed.partialMutation !== false;
    confirmed = completed.partialMutation === true;
    if (completed.status !== 'done') throw new IdentityOperationError(completed.failureCode);
    const output = writeResult(); return { status: 'done', output, accounts: result.accounts };
  } catch (error) {
    result.failureCode = error instanceof IdentityOperationError ? error.message : 'PRIVATE_OPERATION_FAILED';
    result.partialMutation = confirmed ? true : attempted ? (result.reconciliation?.accountCount === 0 ? false : 'unknown') : false;
    const output = outputDir ? writeResult() : null;
    return { status: 'blocked', stage: result.stage, code: result.failureCode, partialMutation: result.partialMutation, output };
  } finally {
    resolvedValues = [];
    if (lockOwned) {
      try { const current = json(lock); if (current.token === lockToken) fs.unlinkSync(lock); }
      catch { /* Never remove a lease whose ownership cannot be verified. */ }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, branch] = process.argv.slice(2);
  if (!source || !branch) { process.stdout.write('{"status":"blocked","code":"USAGE"}\n'); process.exitCode = 2; }
  else { const result = await provisionIdentity(source, branch); process.stdout.write(JSON.stringify(result) + '\n'); if (result.status !== 'done') process.exitCode = 1; }
}
