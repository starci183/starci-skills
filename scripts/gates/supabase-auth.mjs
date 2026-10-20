import fs from 'node:fs';
import path from 'node:path';
import { isPlainObject } from '../../engine/plain-object.mjs';
import { requestJson } from '../api/http/request-json.mjs';
import { authUser } from '../api/supabase/auth-user.mjs';
import { supabaseRefusal, supabaseResultCodes, supabaseEmailAddress } from '../lib/supabase-contract.mjs';
import { parseSupabaseConfig } from '../machine/supabase-stack.mjs';
import { checkPortBlock } from '../machine/supabase-policy.mjs';
import { isProtectedContainer } from '../lib/protected-installations.mjs';
import { resolveProvisionTarget } from './provision-target.mjs';
import { runProvisionOperation } from './provision-operation.mjs';

function validUser(config) {
  return isPlainObject(config) && Object.keys(config).every((key) => ['email', 'emailConfirmed'].includes(key))
    && supabaseEmailAddress(config.email)
    && typeof config.emailConfirmed === 'boolean';
}

function validOrigin(target) {
  const url = new URL(target.origin);
  if (url.origin !== target.origin || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return false;
  if (target.context !== 'local') return url.protocol === 'https:';
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
  const file = path.join(target.repoRoot, 'supabase', 'config.toml');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) return false;
  const config = parseSupabaseConfig(fs.readFileSync(file, 'utf8'));
  return !isProtectedContainer(config.projectId) && config.projectId === target.resource.projectId
    && checkPortBlock(config.ports).ok && String(config.ports.api) === url.port;
}

/** Plan or ensure the declared Auth identity using admitted custody; app membership remains the application's owner. */
export async function runSupabaseAuth(ctx) {
  if (ctx?.positionals?.[0] !== 'user-ensure') return supabaseRefusal('supabase-auth-action-invalid');
  let target;
  try {
    target = resolveProvisionTarget({ cwd: ctx.cwd, targetId: ctx.args?.target, provider: 'supabase-auth' });
    if (!validOrigin(target) || !validUser(target.resource?.user)) return supabaseRefusal('supabase-auth-target-invalid');
  } catch { return supabaseRefusal('supabase-auth-target-unavailable'); }
  const credentialRefs = { 'service-role': target.credentials?.['service-role'] };
  if (target.credentials?.['user-password']) credentialRefs['user-password'] = target.credentials['user-password'];
  const privateRun = (privateContext, reconcile) => authUser(target.resource.user, {
    ...privateContext, reconcile, origin: target.origin,
    request: (request) => requestJson(request, {
      allowedOrigins: [target.origin], allowHttpLoopback: target.context === 'local',
    }),
  });
  return runProvisionOperation(ctx, {
    action: 'supabase.auth.user-ensure', target, requestId: ctx.args?.operation,
    execute: ctx.args?.execute === true, credentialRefs, destination: null,
    publicResource: { user: target.resource.user }, resultCodes: supabaseResultCodes,
    plan: {
      provider: target.provider, origin: target.origin, context: target.context,
      action: 'user-ensure', email: target.resource.user.email, emailConfirmed: target.resource.user.emailConfirmed,
      existingUserPolicy: 'preserve-password-and-confirmation',
      research: { readAt: '2026-10-19', sources: [
        'https://supabase.com/docs/reference/javascript/auth-admin-createuser',
        'https://supabase.com/docs/guides/getting-started/api-keys',
        'https://raw.githubusercontent.com/supabase/auth/master/openapi.yaml',
      ] },
      verification: { accountReadback: 'separate', login: 'not-executed', applicationPermissions: 'not-executed' },
    },
    apply: (privateContext) => privateRun(privateContext, false),
    reconcile: (privateContext) => privateRun(privateContext, true),
  });
}
