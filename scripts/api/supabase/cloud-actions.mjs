import { isPlainObject } from '../../../engine/plain-object.mjs';
import { SUPABASE_MANAGEMENT_ORIGIN, isSupabaseProjectRef } from '../../lib/supabase-cloud-spec.mjs';
import { supabaseActionResult as safeResult, supabaseApiKeyKind } from '../../lib/supabase-contract.mjs';

const hasValue = (value) => typeof value === 'string' && value.length > 0 && !/[\r\n]/u.test(value);
const isWrite = (method) => method !== 'GET';

/** Keep responses private and classify an interrupted write conservatively; no provider body or error is emitted. */
async function call(request, credentials, method, endpoint, body) {
  try {
    return await request({
      origin: SUPABASE_MANAGEMENT_ORIGIN, path: endpoint, method,
      headers: { authorization: `Bearer ${credentials.management}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    return { ok: false, status: null, data: null, effect: isWrite(method) ? 'unknown' : 'none' };
  }
}

function unsuccessful(response, { writeAck = false } = {}) {
  if (writeAck) return safeResult('partial', 'supabase-readback-unavailable', { writeAck });
  const unknown = response?.effect === 'unknown';
  return safeResult(unknown ? 'unknown' : 'failed', unknown ? 'supabase-write-unknown' : 'supabase-request-failed');
}

const projectPath = (spec, suffix) => `/v1/projects/${spec.projectRef}${suffix}`;

function configPatch(spec, credentials) {
  const config = spec.config;
  if (spec.action === 'smtp-set') return {
    smtp_host: config.host, smtp_port: String(config.port), smtp_admin_email: config.adminEmail,
    smtp_sender_name: config.senderName, smtp_user: credentials.username, smtp_pass: credentials.source,
  };
  const prefix = `external_${config.provider}`;
  return {
    [`${prefix}_enabled`]: config.enabled, [`${prefix}_client_id`]: config.clientId,
    [`${prefix}_secret`]: credentials.source,
  };
}

function configMatches(spec, data) {
  if (!isPlainObject(data)) return false;
  const config = spec.config;
  if (spec.action === 'smtp-set') return data.smtp_host === config.host
    && String(data.smtp_port) === String(config.port)
    && data.smtp_admin_email === config.adminEmail && data.smtp_sender_name === config.senderName;
  const prefix = `external_${config.provider}`;
  return data[`${prefix}_enabled`] === config.enabled && data[`${prefix}_client_id`] === config.clientId;
}

async function setAuthConfig(spec, context) {
  const { credentials, request, acknowledge, checkpoint, reconcile } = context;
  if (!reconcile && (!hasValue(credentials.source)
    || spec.action === 'smtp-set' && !hasValue(credentials.username))) {
    return safeResult('failed', 'supabase-credential-unavailable');
  }
  const endpoint = projectPath(spec, '/config/auth');
  if (reconcile) {
    const read = await call(request, credentials, 'GET', endpoint);
    if (!read.ok) return unsuccessful(read);
    // Masked password/client-secret readback cannot establish that the intended value was accepted.
    return safeResult('unknown', configMatches(spec, read.data)
      ? 'supabase-public-config-matches-secret-unverified' : 'supabase-config-reconcile-unresolved', {
      publicReadback: configMatches(spec, read.data), resourceId: spec.projectRef,
    });
  }
  await checkpoint({ phase: 'auth-config-write', resourceId: spec.projectRef });
  const write = await call(request, credentials, 'PATCH', endpoint, configPatch(spec, credentials));
  if (!write.ok) return unsuccessful(write);
  await acknowledge({ phase: 'auth-config-acknowledged', resourceId: spec.projectRef });
  const read = await call(request, credentials, 'GET', endpoint);
  if (!read.ok) return unsuccessful(read, { writeAck: true });
  const matches = configMatches(spec, read.data);
  return safeResult(matches ? 'applied' : 'partial', matches
    ? 'supabase-config-applied-consumer-unverified' : 'supabase-config-readback-mismatch', {
    writeAck: true, publicReadback: matches, resourceId: spec.projectRef,
  });
}

async function setEdgeSecret(spec, context) {
  const { credentials, request, acknowledge, checkpoint, reconcile } = context;
  if (!reconcile && !hasValue(credentials.source)) return safeResult('failed', 'supabase-credential-unavailable');
  const consumer = await call(request, credentials, 'GET', projectPath(spec, `/functions/${encodeURIComponent(spec.config.consumer.slug)}`));
  if (!consumer.ok || !isPlainObject(consumer.data) || consumer.data.slug !== spec.config.consumer.slug) {
    return safeResult('failed', 'supabase-declared-consumer-unavailable');
  }
  const endpoint = projectPath(spec, '/secrets');
  if (!reconcile) {
    await checkpoint({ phase: 'edge-secret-write', resourceId: spec.projectRef });
    const write = await call(request, credentials, 'POST', endpoint, [{ name: spec.config.name, value: credentials.source }]);
    if (!write.ok) return unsuccessful(write);
    await acknowledge({ phase: 'edge-secret-acknowledged', resourceId: spec.projectRef });
  }
  const read = await call(request, credentials, 'GET', endpoint);
  if (!read.ok) return unsuccessful(read, { writeAck: !reconcile });
  const matches = Array.isArray(read.data) && read.data.filter((item) => item?.name === spec.config.name).length === 1;
  // The provider's listing is presence evidence only, even when its value field looks like a digest.
  let outcome = matches ? 'applied' : 'partial';
  if (reconcile) outcome = 'unknown';
  return safeResult(outcome, matches
    ? 'supabase-edge-secret-present-consumer-unverified' : 'supabase-edge-secret-readback-mismatch', {
    writeAck: !reconcile, publicReadback: matches, resourceId: spec.projectRef,
  });
}

function projectMatches(project, config) {
  return isPlainObject(project) && isSupabaseProjectRef(project.ref ?? project.id)
    && project.organization_slug === config.organizationSlug && project.name === config.name
    && project.region === config.region;
}

async function findProject(spec, context) {
  const { credentials, request } = context;
  if (spec.projectRef) {
    const read = await call(request, credentials, 'GET', `/v1/projects/${spec.projectRef}`);
    if (!read.ok) return { error: unsuccessful(read) };
    return projectMatches(read.data, spec.config) && (read.data.ref ?? read.data.id) === spec.projectRef
      ? { existing: read.data } : { error: safeResult('failed', 'supabase-project-identity-mismatch') };
  }
  const read = await call(request, credentials, 'GET', '/v1/projects');
  if (!read.ok) return { error: unsuccessful(read) };
  if (!Array.isArray(read.data) || read.data.some((item) => !isPlainObject(item)
    || typeof item.organization_slug !== 'string' || typeof item.name !== 'string'
    || !isSupabaseProjectRef(item.ref ?? item.id))) {
    return { error: safeResult('failed', 'supabase-project-list-invalid') };
  }
  const sameName = read.data.filter((item) => item?.organization_slug === spec.config.organizationSlug
    && item?.name === spec.config.name);
  if (sameName.length > 1 || sameName.some((item) => !projectMatches(item, spec.config))) {
    return { error: safeResult('failed', 'supabase-project-identity-ambiguous') };
  }
  return { existing: sameName[0] ?? null };
}

async function ensureProject(spec, context) {
  const found = await findProject(spec, context);
  if (found.error) return found.error;
  if (found.existing) return safeResult('applied', 'supabase-project-present', {
    publicReadback: true, resourceId: found.existing.ref ?? found.existing.id,
  });
  if (context.reconcile) return safeResult('unknown', 'supabase-project-create-unresolved');
  if (!hasValue(context.credentials['database-password'])) return safeResult('failed', 'supabase-credential-unavailable');
  await context.checkpoint({ phase: 'project-create' });
  const write = await call(context.request, context.credentials, 'POST', '/v1/projects', {
    organization_slug: spec.config.organizationSlug, name: spec.config.name, region: spec.config.region,
    db_pass: context.credentials['database-password'],
  });
  if (!write.ok) return unsuccessful(write);
  if (!projectMatches(write.data, spec.config)) {
    return safeResult('partial', 'supabase-project-created-identity-unresolved', { writeAck: true });
  }
  const resourceId = write.data.ref ?? write.data.id;
  await context.acknowledge({ phase: 'project-created', resourceId });
  const read = await call(context.request, context.credentials, 'GET', `/v1/projects/${resourceId}`);
  if (!read.ok) return unsuccessful(read, { writeAck: true });
  const matches = projectMatches(read.data, spec.config) && (read.data.ref ?? read.data.id) === resourceId;
  return safeResult(matches ? 'applied' : 'partial', matches
    ? 'supabase-project-created-readback' : 'supabase-project-readback-mismatch', {
    writeAck: true, publicReadback: matches, resourceId,
  });
}

async function captureKey(spec, context) {
  const response = await call(context.request, context.credentials, 'GET', projectPath(spec, '/api-keys?reveal=true'));
  if (!response.ok) return unsuccessful(response);
  if (!Array.isArray(response.data)) return safeResult('failed', 'supabase-api-key-list-invalid');
  const selected = response.data.filter((item) => item?.id === spec.config.id);
  if (selected.length !== 1 || !supabaseApiKeyKind(selected[0].api_key)) {
    return safeResult('failed', 'supabase-selected-api-key-unavailable');
  }
  if (context.reconcile) {
    let matches;
    try { matches = await context.compareDestination(selected[0].api_key); }
    catch { matches = null; }
    return safeResult(matches === true ? 'applied' : 'unknown', matches === true
      ? 'supabase-api-key-custody-matches' : 'supabase-api-key-custody-unresolved', {
      publicReadback: matches === true, resourceId: spec.projectRef,
    });
  }
  await context.checkpoint({ phase: 'api-key-custody-write', resourceId: spec.projectRef });
  let sealed;
  try { sealed = await context.seal(selected[0].api_key); }
  catch { return safeResult('partial', 'supabase-api-key-custody-unknown', { publicReadback: true }); }
  if (sealed?.ok !== true) return safeResult('partial', 'supabase-api-key-custody-failed', { publicReadback: true });
  await context.acknowledge({ phase: 'api-key-sealed', resourceId: spec.projectRef });
  return safeResult('applied', 'supabase-api-key-captured', {
    writeAck: true, publicReadback: true, resourceId: spec.projectRef,
  });
}

const actions = Object.freeze({
  'smtp-set': setAuthConfig, 'auth-provider-set': setAuthConfig, 'secret-set': setEdgeSecret,
  'project-ensure': ensureProject, 'keys-capture': captureKey,
});

/** Execute one validated provider action with private inputs and fixed transport; reconciliation never repeats remote writes. */
export async function cloudActions(spec, context) {
  if (!spec?.ok || !actions[spec.action] || typeof context?.request !== 'function') {
    return safeResult('failed', 'supabase-action-invalid');
  }
  if (!hasValue(context.credentials?.management)) {
    return safeResult('failed', 'supabase-credential-unavailable');
  }
  const run = actions[spec.action];
  return run(spec, context);
}
