// Public endpoint assertions for admitted native consumers; this module never opens custody.
import fs from 'node:fs';
import path from 'node:path';
import { refusal } from './errors.mjs';

const slug = value => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
const label = value => typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(value);
const host = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(value);
const port = value => Number.isInteger(value) && value > 0 && value <= 65535;
const denied = () => { throw refusal('STACKS_DEPLOY_CONFIG_INVALID', 'the native endpoint binding is invalid or differs from the selected owner target'); };
const exact = (value, fields) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));

function ordinaryInput(root, file) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) denied();
  const relative = path.relative(root, file);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes('..')) denied();
  let current = root;
  const parts = relative.split(path.sep);
  for (let index = 0; index <= parts.length; index += 1) {
    let stat;
    try { stat = fs.lstatSync(current); } catch { denied(); }
    if (stat.isSymbolicLink() || (index === parts.length ? !stat.isFile() || stat.nlink !== 1 : !stat.isDirectory())) denied();
    if (index < parts.length) current = path.join(current, parts[index]);
  }
}

/** A bound native owner opens only an ordinary envelope below its actual app, without ancestor links. */
export const assertBoundCustody = (root, file) => ordinaryInput(root, file);

/** Bound database commands require the app-local launcher; they cannot discover a global replacement. */
export function boundSupabaseLauncher(root) {
  const launcher = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  ordinaryInput(root, launcher);
  return launcher;
}

/** Native custody can use AGE; tools that do not decrypt custody must not inherit that identity. */
export function nativeToolEnvironment(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/^SOPS_/i.test(key)));
}

/** Bound database tools receive only their selected private password and native routing, without ambient libpq or provider credentials. */
export function nativeDatabaseEnvironment(env, binding, selected = {}, omit = []) {
  const omitted = new Set(omit.filter(value => typeof value === 'string').map(value => value.toUpperCase()));
  return { ...Object.fromEntries(Object.entries(nativeToolEnvironment(env)).filter(([key]) => !/^(?:PG[A-Z_]*|SUPABASE_)/i.test(key) && !omitted.has(key.toUpperCase()))),
    'SUPABASE_ENV': binding.environment, ...selected };
}

/** Preserve a logical linked project while selecting a fixed native SQL endpoint without the CLI's linked Management finalizer. */
export function boundLinkedDatabaseUrl(binding, savedPooler = null) {
  if (!binding || binding.mode !== 'linked' || !/^[a-z0-9]{20}$/.test(binding.projectRef)) denied();
  if (savedPooler === null) return `postgresql://postgres@db.${binding.projectRef}.supabase.co:5432/postgres?sslmode=require`;
  let url;
  try {
    if (typeof savedPooler !== 'string' || savedPooler.length > 8192) denied();
    url = new URL(savedPooler.trim());
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !/^[A-Za-z0-9.-]+\.pooler\.supabase\.com$/.test(url.hostname)
      || decodeURIComponent(url.username) !== `postgres.${binding.projectRef}` || url.pathname !== '/postgres'
      || url.port && !['5432', '6543'].includes(url.port) || url.hash
      || [...url.searchParams].some(([key, value]) => key !== 'sslmode' || !['require', 'verify-full'].includes(value))) denied();
  } catch { denied(); }
  url.password = '';
  url.port = '5432';
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
  return url.toString();
}

/** Parse the internal public binding; ordinary commands without this flag retain their native behavior. */
export function parseTargetBinding(text, kind) {
  if (text === undefined) return null;
  let binding;
  try { if (typeof text !== 'string' || text.length > 4096) denied(); binding = JSON.parse(text); } catch { denied(); }
  if (binding?.kind !== kind || !slug(binding.environment)) denied();
  if (kind === 'docker-swarm') {
    if (!exact(binding, ['kind', 'environment', 'stack', 'host', 'user', 'port']) || !slug(binding.stack)
      || !host(binding.host) || !label(binding.user) || binding.port !== 22) denied();
  } else if (kind === 'supabase-db') {
    if (binding.mode === 'local') {
      if (!exact(binding, ['kind', 'mode', 'environment', 'localProject', 'port']) || !label(binding.localProject) || !port(binding.port)) denied();
    } else if (binding.mode === 'linked') {
      if (!exact(binding, ['kind', 'mode', 'environment', 'projectRef']) || !/^[a-z0-9]{20}$/.test(binding.projectRef ?? '')) denied();
    } else if (binding.mode === 'url-env') {
      if (!exact(binding, ['kind', 'mode', 'environment', 'urlEnv', 'host', 'port', 'database', 'user'])
        || !/^[A-Z][A-Z0-9_]*$/.test(binding.urlEnv ?? '') || !host(binding.host) || !port(binding.port)
        || !label(binding.database) || !label(binding.user)) denied();
    } else denied();
  } else denied();
  return Object.freeze(binding);
}

/** Require the selected sealed transport before any fallback can reach an operator's Docker or SSH context. */
export function bindStackTarget(ctx, config, binding) {
  if (!binding) return config;
  if (binding.kind !== 'docker-swarm' || binding.environment !== config.env || binding.stack !== config.stack
    || !config.remote.sealed || ctx.env.DOCKER_HOST || ctx.env.DOCKER_CONTEXT || ctx.env.GITHUB_ACTIONS
    || ctx.env.STARCI_STACK_SEALED_SSH !== undefined) denied();
  for (const member of Object.values(config.remote.sealed)) {
    const file = path.join(config.secretsDir, `${member}.enc`);
    assertBoundCustody(config.repoRoot, file);
  }
  return { ...config, nativeTarget: binding };
}

/** Compare the effective private SSH account before key files, sessions or network effects exist. */
export function assertStackAccount(binding, account, knownHosts) {
  if (!binding) return;
  if (account !== `${binding.user}@${binding.host}` || binding.port !== 22 || !knownHosts.trim()) denied();
}

/** Compare the effective local Supabase identity after its existing config/environment resolver. */
export function assertLocalDatabase(binding, target) {
  if (binding && (binding.mode !== 'local' || binding.localProject !== target.project || binding.port !== target.port)) denied();
}

/** Refuse a selected URL unless its non-secret endpoint exactly matches the accepted target. */
export function assertUrlDatabase(binding, value) {
  if (!binding) return;
  let url;
  try { url = new URL(value); } catch { denied(); }
  if (binding.mode !== 'url-env' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== binding.host || Number(url.port || '5432') !== binding.port
    || decodeURIComponent(url.username) !== binding.user || decodeURIComponent(url.pathname.slice(1)) !== binding.database
    || url.search || url.hash || !url.password) denied();
}
