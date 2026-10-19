import { revParse } from '../api/git/rev-parse.mjs';
import { provisionApp } from '../api/process/provision-app.mjs';
import { appProvisionEntry } from '../api/process/app-provision-entry.mjs';
import { appProvisionEnv, isAppWorkspaceId } from '../lib/provision-workspace-contract.mjs';
import { isPlainObject } from '../../engine/plain-object.mjs';
import { argThrow as fail } from '../lib/cli-arg.mjs';
import { resolveProvisionTarget } from './provision-target.mjs';
import { runProvisionOperation } from './provision-operation.mjs';

const INPUT_ROLES = new Set(['principal', 'owner-password', 'manager-password', 'staff-password']);
const RESOURCE_KEYS = new Set(['revision', 'entrySha256', 'publicEnvironment', 'timeoutMs']);
const ACTIONS = { ensure: 'app.workspace.ensure', role: 'app.workspace.member.role' };
const RESULT_CODES = new Set(['APP_ACCESS_PUBLIC_READBACK', 'APP_ACCESS_PROCESS_UNKNOWN', 'APP_ACCESS_RECEIPT_UNKNOWN']);

function accountInput(args, role) {
  const email = args[`${role}-email`], name = args[`${role}-name`];
  if (typeof email !== 'string' || email.length > 254 || /\s/.test(email)
    || typeof name !== 'string' || !name.trim() || name.length > 120) fail('APP_ACCESS_ACCOUNT_INPUT_INVALID');
  const parts = email.split('@'), domain = parts[1];
  if (parts.length !== 2 || !parts[0] || !domain || domain.indexOf('.') <= 0 || domain.endsWith('.')) fail('APP_ACCESS_ACCOUNT_INPUT_INVALID');
  return { email: email.toLowerCase(), name: name.trim() };
}

function publicInput(ctx, action) {
  const args = ctx.args, input = { schema: 'starci/app-workspace-input@1', action };
  if (action === 'role') {
    if (args['bootstrap-owner'] || args['workspace-name'] || ['owner', 'manager', 'staff'].some(role => args[`${role}-email`] || args[`${role}-name`])) fail('APP_ACCESS_ROLE_INPUT_INVALID');
    if (!isAppWorkspaceId(args.workspace) || !isAppWorkspaceId(args.member) || !['owner', 'manager', 'staff'].includes(args.role)) fail('APP_ACCESS_ROLE_INPUT_INVALID');
    return { ...input, workspaceId: args.workspace, memberId: args.member, role: args.role };
  }
  if (args.member || args.role) fail('APP_ACCESS_ACCOUNT_INPUT_INVALID');
  if (Boolean(args.workspace) === Boolean(args['workspace-name'])) fail('APP_ACCESS_WORKSPACE_REQUIRED');
  if (args.workspace && !isAppWorkspaceId(args.workspace)) fail('APP_ACCESS_WORKSPACE_INVALID');
  const workspace = args.workspace ? { workspaceId: args.workspace } : { workspaceName: args['workspace-name'] };
  const accounts = {};
  for (const role of ['owner', 'manager', 'staff']) accounts[role] = accountInput(args, role);
  if (new Set(Object.values(accounts).map(account => account.email)).size !== 3) fail('APP_ACCESS_ACCOUNTS_MUST_DIFFER');
  if (workspace.workspaceName && (typeof workspace.workspaceName !== 'string' || !workspace.workspaceName.trim() || workspace.workspaceName.length > 120)) fail('APP_ACCESS_WORKSPACE_INVALID');
  if (workspace.workspaceName) workspace.workspaceName = workspace.workspaceName.trim();
  return { ...input, ...workspace, ...accounts, bootstrapOwner: args['bootstrap-owner'] === true };
}

function resourceOf(target, ctx) {
  const resource = target.resource;
  if (!isPlainObject(resource) || Object.keys(resource).some(key => !RESOURCE_KEYS.has(key))
    || !/^[a-f0-9]{40}$/.test(resource.revision ?? '') || !isPlainObject(resource.publicEnvironment)
    || !Number.isInteger(resource.timeoutMs) || resource.timeoutMs <= 0) fail('APP_ACCESS_TARGET_INVALID');
  if (revParse(target.repoRoot, 'HEAD') !== resource.revision) fail('APP_ACCESS_SOURCE_DRIFT');
  if (resource.publicEnvironment.SUPABASE_URL !== target.origin) fail('APP_ACCESS_AUTH_ORIGIN_MISMATCH');
  if (target.destination !== null) fail('APP_ACCESS_DESTINATION_REFUSED');
  appProvisionEntry(target.repoRoot, resource.entrySha256);
  const declaredEnv = {};
  for (const [role, ref] of Object.entries(target.credentials)) {
    if (!INPUT_ROLES.has(role) && (typeof ref.env !== 'string' || !ref.env)) fail('APP_ACCESS_ENV_BINDING_REQUIRED');
    if (!INPUT_ROLES.has(role)) {
      if (Object.hasOwn(declaredEnv, ref.env)) fail('APP_ACCESS_ENV_BINDING_REFUSED');
      declaredEnv[ref.env] = 'declared-private-binding';
    }
  }
  appProvisionEnv(resource.publicEnvironment, declaredEnv, ctx.env);
  return resource;
}

function privateInput(input, credentials) {
  const result = { ...input };
  if (credentials.principal) result.principalToken = credentials.principal;
  if (input.action === 'role') {
    if (!result.principalToken) fail('APP_ACCESS_PRINCIPAL_REQUIRED');
    return result;
  }
  if (!result.principalToken && !credentials['owner-password']) fail('APP_ACCESS_PRINCIPAL_REQUIRED');
  for (const role of ['owner', 'manager', 'staff']) {
    result[role] = { ...input[role], ...(credentials[`${role}-password`] ? { password: credentials[`${role}-password`] } : {}) };
  }
  return result;
}

/**
 * Binds an accepted target to the application's own workspace CLI. The application authenticates the
 * principal and owns business roles; the runtime passes references privately and retains only receipts.
 * Reconciliation invokes domain readback rather than replaying a write. Password authentication opens
 * and locally signs out its owned Auth session; existing-token authentication creates no new session.
 */
export async function runWorkspaceAccess(ctx) {
  const action = ctx.positionals[0], id = ACTIONS[action];
  if (!id) fail('APP_ACCESS_ACTION_INVALID');
  const target = resolveProvisionTarget({ cwd: ctx.cwd, targetId: ctx.args.target, provider: 'app' });
  const principal = target.credentials.principal, password = target.credentials['owner-password'];
  const hasPrincipal = principal && principal.optional !== true;
  if (!hasPrincipal && (action === 'role' || !password || password.optional === true)) fail('APP_ACCESS_PRINCIPAL_REQUIRED');
  const resource = resourceOf(target, ctx), input = publicInput(ctx, action);
  const invoke = (credentials, verify, checkpoint) => {
    if (revParse(target.repoRoot, 'HEAD') !== resource.revision) fail('APP_ACCESS_SOURCE_DRIFT');
    appProvisionEntry(target.repoRoot, resource.entrySha256);
    const privateEnv = {};
    for (const [role, ref] of Object.entries(target.credentials)) {
      if (!INPUT_ROLES.has(role) && credentials[role] !== undefined) privateEnv[ref.env] = credentials[role];
    }
    const inputWithCredentials = privateInput(input, credentials);
    checkpoint({ phase: verify ? 'app-access-reconcile' : 'app-access-write' });
    const result = provisionApp({ repoRoot: target.repoRoot, action: verify ? 'verify' : action,
      entrySha256: resource.entrySha256, publicEnv: resource.publicEnvironment, privateEnv,
      input: inputWithCredentials, parentEnv: ctx.env, timeoutMs: resource.timeoutMs });
    return verify && result.outcome === 'applied' ? { ...result, outcome: 'verified' } : result;
  };
  return await runProvisionOperation(ctx, { action: id, target, requestId: ctx.args.operation,
    execute: ctx.args.execute, credentialRefs: target.credentials,
    resultCodes: RESULT_CODES,
    publicResource: { sourceRevision: resource.revision, entrySha256: resource.entrySha256, publicEnvironment: resource.publicEnvironment },
    plan: { input, sourceRevision: resource.revision, entrySha256: resource.entrySha256,
      publicEnvironment: resource.publicEnvironment, credentialRoles: Object.keys(target.credentials),
      authentication: { existingToken: true, ownedPasswordSession: action === 'ensure', localSessionCleanupRequired: true,
        accessJwtAfterSignout: 'provider-expiry', reconcile: 'authenticated-domain-readback-without-domain-writes' } },
    apply: ({ credentials, checkpoint, acknowledge }) => {
      const result = invoke(credentials, false, checkpoint);
      if (result.writeAck) acknowledge({ resourceId: result.resourceId });
      return result;
    },
    reconcile: ({ credentials, checkpoint }) => invoke(credentials, true, checkpoint),
  });
}
