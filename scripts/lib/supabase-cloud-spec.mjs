import { isPlainObject } from '../../engine/plain-object.mjs';
import { supabaseEmailAddress } from './supabase-contract.mjs';

/** Management operations use this fixed provider origin; project Auth origins are a different target kind. */
export const SUPABASE_MANAGEMENT_ORIGIN = 'https://api.supabase.com';

// Read 2026-10-19: provider credentials, administrative authority and destination custody are separate inputs.
const documentation = Object.freeze({
  'smtp-set': ['https://supabase.com/docs/guides/auth/auth-smtp'],
  'auth-provider-set': [
    'https://supabase.com/docs/guides/auth/social-login/auth-google',
    'https://supabase.com/docs/guides/auth/social-login/auth-github',
  ],
  'secret-set': ['https://supabase.com/docs/reference/api/v1-bulk-create-secrets'],
  'project-ensure': ['https://supabase.com/docs/reference/api/v1-create-a-project'],
  'keys-capture': ['https://supabase.com/docs/reference/api/v1-get-project-api-keys'],
});

const scopes = Object.freeze({
  'smtp-set': ['auth:write', 'auth:read'],
  'auth-provider-set': ['auth:write', 'auth:read'],
  'secret-set': ['secrets:write', 'secrets:read', 'functions:read'],
  'project-ensure': ['projects:write', 'projects:read'],
  'keys-capture': ['secrets:read'],
});

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const closed = (value, names) => isPlainObject(value) && Object.keys(value).every((key) => names.includes(key));
/** Recognize the provider's project reference without accepting a path, host or encoded separator. */
export const isSupabaseProjectRef = (value) => typeof value === 'string' && /^[a-z0-9]{20}$/u.test(value);
const publicName = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);

function validSmtp(config) {
  return closed(config, ['host', 'port', 'adminEmail', 'senderName'])
    && typeof config.host === 'string' && /^[A-Za-z0-9.-]+$/u.test(config.host)
    && Number.isInteger(config.port) && config.port > 0 && config.port <= 65535
    && supabaseEmailAddress(config.adminEmail) && nonempty(config.senderName)
    && !/[\r\n]/u.test(config.senderName);
}

function validProvider(config) {
  return closed(config, ['provider', 'clientId', 'enabled'])
    && ['google', 'github'].includes(config.provider)
    && nonempty(config.clientId) && !/[\r\n]/u.test(config.clientId)
    && typeof config.enabled === 'boolean';
}

function validSecret(config) {
  return closed(config, ['name', 'store', 'consumer'])
    && typeof config.name === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/u.test(config.name)
    && !config.name.startsWith('SUPABASE_') && config.store === 'edge-functions'
    && closed(config.consumer, ['kind', 'slug'])
    && config.consumer.kind === 'edge-function' && publicName(config.consumer.slug);
}

function validProject(config) {
  return closed(config, ['name', 'organizationSlug', 'region'])
    && nonempty(config.name) && config.name.length <= 128 && !/[\r\n]/u.test(config.name)
    && publicName(config.organizationSlug) && publicName(config.region);
}

const selectors = Object.freeze({
  'smtp-set': { field: 'smtp', valid: validSmtp },
  'auth-provider-set': { field: 'authProvider', valid: validProvider },
  'secret-set': { field: 'secret', valid: validSecret },
  'project-ensure': { field: 'project', valid: validProject },
  'keys-capture': { field: 'apiKey', valid: (value) => closed(value, ['id']) && publicName(value.id) },
});

/** Validate the selected action before custody reads; plans contain no supplied or returned credential values. */
export function supabaseCloudSpec(action, target) {
  const selector = selectors[action];
  if (!selector || target?.provider !== 'supabase-cloud' || target.origin !== SUPABASE_MANAGEMENT_ORIGIN) {
    return { ok: false, code: 'supabase-target-invalid' };
  }
  const resource = target.resource;
  if (!isPlainObject(resource) || !selector.valid(resource[selector.field])) {
    return { ok: false, code: 'supabase-resource-invalid' };
  }
  if (action !== 'project-ensure' && !isSupabaseProjectRef(resource.projectRef)) {
    return { ok: false, code: 'supabase-project-ref-invalid' };
  }
  if (resource.projectRef !== undefined && !isSupabaseProjectRef(resource.projectRef)) {
    return { ok: false, code: 'supabase-project-ref-invalid' };
  }
  if (action === 'keys-capture' && !target.destination) {
    return { ok: false, code: 'supabase-destination-required' };
  }
  const config = resource[selector.field];
  return {
    ok: true, action, projectRef: resource.projectRef, config,
    plan: {
      provider: target.provider, origin: target.origin, context: target.context,
      projectRef: resource.projectRef ?? null, action, configuration: config,
      ...(action === 'secret-set' ? { store: config.store, consumer: config.consumer, secretName: config.name } : {}),
      ...(action === 'auth-provider-set' ? { authProvider: config.provider } : {}),
      ...(action === 'project-ensure' ? { project: config } : {}),
      ...(action === 'keys-capture' ? { apiKeyId: config.id, destination: target.destination } : {}),
      requiredScopes: scopes[action],
      research: { readAt: '2026-10-19', sources: documentation[action] },
      verification: { writeAck: 'separate', publicReadback: 'separate', consumerBehavior: 'not-executed' },
    },
  };
}
