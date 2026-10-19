import { isPlainObject } from '../../../engine/plain-object.mjs';
import { supabaseActionResult as safeResult, supabaseApiKeyKind } from '../../lib/supabase-contract.mjs';

const PAGE_SIZE = 50;
const MAX_PAGES = 100;
const validId = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
const sameEmail = (left, right) => typeof left === 'string' && typeof right === 'string'
  && left.toLowerCase() === right.toLowerCase();

function authHeaders(key) {
  const kind = supabaseApiKeyKind(key);
  // New secret keys are API keys, not JWTs. Sending them as bearer credentials breaks Auth verification.
  if (kind === 'secret') return { apikey: key, 'content-type': 'application/json' };
  if (kind === 'legacy') {
    return { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  }
  return null;
}

async function call(context, method, suffix, body) {
  const headers = authHeaders(context.credentials?.['service-role']);
  if (!headers) return { ok: false, status: null, effect: 'none' };
  try {
    return await context.request({
      origin: context.origin, path: `/auth/v1${suffix}`, method, headers,
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    return { ok: false, status: null, effect: method === 'GET' ? 'none' : 'unknown' };
  }
}

function unavailable(response, acknowledged = false) {
  if (acknowledged) return safeResult('partial', 'supabase-user-readback-unavailable', { writeAck: true });
  if (response?.effect === 'unknown') return safeResult('unknown', 'supabase-user-create-unknown');
  return safeResult('failed', 'supabase-auth-request-failed');
}

async function findUser(config, context, page = 1, selected = null) {
  if (page > MAX_PAGES) return { error: safeResult('failed', 'supabase-user-list-incomplete') };
  const response = await call(context, 'GET', `/admin/users?page=${page}&per_page=${PAGE_SIZE}`);
  if (!response.ok) return { error: unavailable(response) };
  const users = response.data?.users;
  if (!Array.isArray(users)) return { error: safeResult('failed', 'supabase-user-list-invalid') };
  const matches = users.filter((user) => sameEmail(user?.email, config.email));
  if (matches.length > 1 || matches.some((user) => !validId(user.id)) || selected && matches.length) {
    return { error: safeResult('failed', 'supabase-user-identity-ambiguous') };
  }
  const nextSelected = matches.length === 1 ? matches[0] : selected;
  if (users.length < PAGE_SIZE) return { user: nextSelected };
  return findUser(config, context, page + 1, nextSelected);
}

function matchesUser(config, user) {
  return isPlainObject(user) && validId(user.id) && sameEmail(user.email, config.email)
    && (!config.emailConfirmed || typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.length > 0);
}

/** Ensure an Auth account without resetting an existing password or assigning application workspace roles. */
export async function authUser(config, context) {
  const found = await findUser(config, context);
  if (found.error) return found.error;
  if (found.user) {
    if (!matchesUser(config, found.user)) return safeResult('failed', 'supabase-user-confirmation-mismatch');
    return safeResult('applied', 'supabase-user-present', { resourceId: found.user.id, publicReadback: true });
  }
  if (context.reconcile) return safeResult('unknown', 'supabase-user-create-unresolved');
  const password = context.credentials?.['user-password'];
  if (typeof password !== 'string' || password.length === 0) {
    return safeResult('failed', 'supabase-new-user-password-required');
  }
  await context.checkpoint({ phase: 'auth-user-create' });
  const write = await call(context, 'POST', '/admin/users', {
    email: config.email, password, email_confirm: config.emailConfirmed,
  });
  if (!write.ok) return unavailable(write);
  const user = isPlainObject(write.data?.user) ? write.data.user : write.data;
  if (!matchesUser(config, user)) return safeResult('partial', 'supabase-created-user-unresolved', { writeAck: true });
  await context.acknowledge({ phase: 'auth-user-created', resourceId: user.id });
  const read = await call(context, 'GET', `/admin/users/${user.id}`);
  if (!read.ok) return unavailable(read, true);
  const matches = matchesUser(config, read.data) && read.data.id === user.id;
  return safeResult(matches ? 'applied' : 'partial', matches
    ? 'supabase-user-created-login-unverified' : 'supabase-user-readback-mismatch', {
    writeAck: true, publicReadback: matches, resourceId: user.id,
  });
}
