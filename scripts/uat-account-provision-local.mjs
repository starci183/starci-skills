import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { validateInput } from '../operators/workspace/uat-account-provision/validate-input.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeFiles = path.join(sourceRoot, '.stacks', 'dev', 'runtime', 'files');
const { Client } = pg;

const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

export function stableUatIdentity(input) {
  const seed = `${input.project}\0${input.feature}\0${input.flow}\0${input.runId}\0${input.fixtureNamespace}`;
  const suffix = createHash('sha256').update(seed).digest('hex').slice(0, 20);
  return {
    username: `uat-${suffix}`,
    email: `uat.${suffix}@starci.local`,
    displayName: `StarCi UAT ${suffix.slice(0, 8)}`,
  };
}

export function candidateAccountRecord(input, provisioningOwnerRef, keycloakUserId, databaseUserId) {
  const principalFingerprint = sha256(`${keycloakUserId}\0${databaseUserId}\0${input.fixtureNamespace}`);
  return {
    accountRef: `account://fresh/${input.feature}/${input.flow}/${input.runId}`,
    provisioningMode: 'control-panel-auto-create',
    provisioningOwnerRef,
    identityRecordRef: `keycloak-user://uat/${encodeURIComponent(keycloakUserId)}`,
    applicationRecordRef: `database-user://uat/${encodeURIComponent(databaseUserId)}`,
    principalFingerprint,
    fixtureNamespace: input.fixtureNamespace,
    credentialCustody: 'control-panel-ephemeral',
  };
}

function parseArgs(argv) {
  const parsed = { preflight: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--preflight') {
      parsed.preflight = true;
      continue;
    }
    if (token !== '--input' && token !== '--provisioning-owner-ref') throw new Error(`unknown argument ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`);
    if (token === '--input') parsed.inputFile = value;
    else parsed.provisioningOwnerRef = value;
    index += 1;
  }
  if (!parsed.inputFile) throw new Error('--input is required');
  if (!parsed.provisioningOwnerRef) throw new Error('--provisioning-owner-ref is required');
  return parsed;
}

async function secret(name, fallbackFile) {
  const direct = process.env[name];
  if (direct !== undefined && direct !== '') return direct;
  const pointer = process.env[`${name}_FILE`] ?? fallbackFile;
  if (!pointer) throw new Error(`${name} or ${name}_FILE is required`);
  return (await readFile(path.resolve(pointer), 'utf8')).trim();
}

async function fetchJson(url, init, expectedStatuses) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  const body = text === '' ? null : JSON.parse(text);
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).origin}${new URL(url).pathname}`);
  }
  return { response, body };
}

function exactUatAttributes(user, input) {
  const attributes = user?.attributes ?? {};
  return attributes.starci_uat?.[0] === 'true'
    && attributes.starci_uat_run_id?.[0] === input.runId
    && attributes.starci_uat_fixture_namespace?.[0] === input.fixtureNamespace;
}

async function keycloakAdminToken(baseUrl, adminRealm, clientId, username, password) {
  const body = new URLSearchParams({ grant_type: 'password', client_id: clientId, username, password });
  const { body: token } = await fetchJson(
    `${baseUrl}/realms/${encodeURIComponent(adminRealm)}/protocol/openid-connect/token`,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
    [200],
  );
  if (!token?.access_token) throw new Error('Keycloak admin token response omitted access_token');
  return token.access_token;
}

async function findKeycloakUser(baseUrl, realm, token, username) {
  const url = new URL(`${baseUrl}/admin/realms/${encodeURIComponent(realm)}/users`);
  url.searchParams.set('username', username);
  url.searchParams.set('exact', 'true');
  const { body } = await fetchJson(url, { headers: { authorization: `Bearer ${token}` } }, [200]);
  return Array.isArray(body) ? body.find((user) => user.username === username) ?? null : null;
}

async function ensureKeycloakUser({ baseUrl, realm, token, identity, password, input }) {
  const existing = await findKeycloakUser(baseUrl, realm, token, identity.username);
  if (existing) {
    if (!exactUatAttributes(existing, input)) throw new Error('Keycloak username collision is not owned by this UAT run');
    return { user: existing, created: false };
  }
  const attributes = {
    starci_uat: ['true'],
    starci_uat_run_id: [input.runId],
    starci_uat_fixture_namespace: [input.fixtureNamespace],
  };
  const { response } = await fetchJson(
    `${baseUrl}/admin/realms/${encodeURIComponent(realm)}/users`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        username: identity.username,
        email: identity.email,
        firstName: 'StarCi',
        lastName: 'UAT',
        enabled: true,
        emailVerified: true,
        attributes,
        credentials: [{ type: 'password', value: password, temporary: false }],
      }),
    },
    [201],
  );
  const locationId = response.headers.get('location')?.split('/').filter(Boolean).at(-1);
  const user = locationId
    ? { id: locationId, username: identity.username, email: identity.email, attributes }
    : await findKeycloakUser(baseUrl, realm, token, identity.username);
  if (!user?.id || !exactUatAttributes(user, input)) throw new Error('Keycloak UAT identity could not be verified after creation');
  return { user, created: true };
}

async function deleteCreatedKeycloakUser(baseUrl, realm, token, user) {
  if (!user?.id) return;
  await fetchJson(
    `${baseUrl}/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(user.id)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    [204],
  );
}

async function ensureDatabaseUser(client, identity, keycloakUserId) {
  const id = randomUUID();
  const result = await client.query({
    text: `
      INSERT INTO users (id, username, email, keycloak_id, display_name, authentication_type, is_uat)
      VALUES ($1, $2, $3, $4, $5, 'credentials', true)
      ON CONFLICT (keycloak_id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        authentication_type = 'credentials',
        is_uat = true,
        updated_at = now()
      RETURNING id, keycloak_id, is_uat
    `,
    values: [id, identity.username, identity.email, keycloakUserId, identity.displayName],
  });
  const user = result.rows[0];
  if (!user?.id || user.keycloak_id !== keycloakUserId || user.is_uat !== true) {
    throw new Error('application database UAT identity could not be verified');
  }
  return user;
}

async function loadAndValidateInput(inputFile) {
  const artifact = JSON.parse(await readFile(path.resolve(inputFile), 'utf8'));
  const result = validateInput(artifact);
  if (!result.valid) throw new Error(`invalid operator input: ${result.errors.join('; ')}`);
  return artifact;
}

export async function provisionLocalUatAccount(artifact, provisioningOwnerRef) {
  const input = artifact.input;
  const identity = stableUatIdentity(input);
  const keycloakBaseUrl = (process.env.KEYCLOAK_URL ?? 'http://localhost:8080').replace(/\/$/u, '');
  const realm = process.env.KEYCLOAK_REALM ?? 'master';
  const adminRealm = process.env.KEYCLOAK_ADMIN_REALM ?? 'master';
  const adminClientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'admin-cli';
  const adminUsername = await secret('KEYCLOAK_ADMIN_USERNAME', path.join(runtimeFiles, 'keycloak-admin-user.txt'));
  const adminPassword = await secret('KEYCLOAK_ADMIN_PASSWORD', path.join(runtimeFiles, 'keycloak-admin-password.txt'));
  const password = await secret('UAT_ACCOUNT_PASSWORD', path.join(runtimeFiles, 'uat-account-password.key'));
  const databaseUser = await secret('POSTGRESQL_PRIMARY_USERNAME', path.join(runtimeFiles, 'postgres-user.txt'));
  const databasePassword = await secret('POSTGRESQL_PRIMARY_PASSWORD', path.join(runtimeFiles, 'postgres-password.txt'));
  const adminToken = await keycloakAdminToken(keycloakBaseUrl, adminRealm, adminClientId, adminUsername, adminPassword);
  const keycloak = await ensureKeycloakUser({ baseUrl: keycloakBaseUrl, realm, token: adminToken, identity, password, input });
  const client = new Client({
    host: process.env.POSTGRESQL_PRIMARY_HOST ?? 'localhost',
    port: Number(process.env.POSTGRESQL_PRIMARY_PORT ?? 5432),
    user: databaseUser,
    password: databasePassword,
    database: process.env.POSTGRESQL_PRIMARY_DATABASE ?? 'starci-academy',
  });
  try {
    await client.connect();
    const applicationUser = await ensureDatabaseUser(client, identity, keycloak.user.id);
    const accountCandidate = candidateAccountRecord(input, provisioningOwnerRef, keycloak.user.id, applicationUser.id);
    return {
      schemaVersion: 1,
      outcome: 'ready-for-browser-auth',
      accountRecordRef: input.accountRecordRef,
      accountCandidate,
      brokerInput: {
        origin: input.origin,
        loginIdentifier: identity.email,
        credentialRef: 'control-panel-secret://local-uat-account-password',
      },
      evidenceRefs: [accountCandidate.identityRecordRef, accountCandidate.applicationRecordRef],
    };
  } catch (error) {
    if (keycloak.created) await deleteCreatedKeycloakUser(keycloakBaseUrl, realm, adminToken, keycloak.user);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifact = await loadAndValidateInput(args.inputFile);
  if (args.preflight) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      outcome: 'preflight',
      accountRecordRef: artifact.input.accountRecordRef,
      identity: stableUatIdentity(artifact.input),
      snapshotTargetState: 'prospective',
    }, null, 2)}\n`);
    return;
  }
  const result = await provisionLocalUatAccount(artifact, args.provisioningOwnerRef);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`uat-account-provision failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
