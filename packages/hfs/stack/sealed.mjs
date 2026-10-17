// sealed.mjs - opens the sealed custody members in memory and derives, from names and keyed hashes only, which Swarm secret each
// service is granted (the shared half of the release tools). No value is ever written to disk, printed or put in an argument list:
// callers receive `value` and must keep it in memory. Config objects (non-secret files mounted into services) are versioned by content.
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { secretRoots } from '../runtime/scripts/hfs/secret-files.mjs';
import { readMap } from '../runtime/scripts/hfs/secret-store.mjs';
import { refusal } from './errors.mjs';

const KEY_NAME = /^[A-Z][A-Z0-9_]*$/u;
const UNSAFE_SETTING = /[\r\n"'\\]/u;
const MAX_NAME = 64;

/** sha256 of the bytes, as lowercase hex. */
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const CR = String.fromCodePoint(13);
const LF = String.fromCodePoint(10);

/** True for content that is not text: a NUL byte in the first 8 KiB. Binary files are never rewritten. */
const isBinary = (bytes) => bytes.subarray(0, 8192).includes(0);

/** Every CRLF of a string becomes LF. */
const lfText = (text) => text.replaceAll(CR + LF, LF);

/**
 * Line endings of a text file as the services need them: every CRLF becomes LF (a script rendered from a Windows checkout failed with
 * `set: Illegal option -`). Binary content is returned untouched. Takes and returns a Buffer.
 */
function lfBytes(bytes) {
  if (isBinary(bytes) || !bytes.includes(13)) return bytes;
  return Buffer.from(lfText(bytes.toString('latin1')), 'latin1');
}

/** The bytes of a config file as they are hashed and created: LF-normalised text, untouched binary. */
export const configBytes = (file) => lfBytes(fs.readFileSync(file));

/** The key that makes the version suffix of a secret name unguessable from the name alone: a local fixture key or the age identity. */
function versionKeyOf(ctx) {
  const key = ctx.env.STARCI_SECRET_VERSION_KEY || ctx.env.SOPS_AGE_KEY;
  if (!key) throw refusal('STACK_VERSION_KEY_MISSING', 'STARCI_SECRET_VERSION_KEY (a local fixture) or SOPS_AGE_KEY is needed to version the secret names');
  return key;
}

/** `<stack>-<key>-v<10 hex of HMAC(versionKey, key NUL value)>`: a changed value is a new name, an unchanged one keeps its name. */
function secretRuntimeName(stack, key, value, versionKey) {
  const version = createHmac('sha256', versionKey).update(`${key}\0${value}`).digest('hex').slice(0, 10);
  const name = `${stack}-${key.toLowerCase().replaceAll('_', '-')}-v${version}`;
  if (name.length > MAX_NAME) throw refusal('STACK_SECRET_NAME_TOO_LONG', `the Swarm secret name for ${key} would exceed ${MAX_NAME} characters`);
  return name;
}

const AGE_IDENTITY_ENV = /^SOPS_AGE_KEY(?:_FILE)?$/iu;
const AGE_HINT = 'load the age identity into SOPS_AGE_KEY (the secret.env of the owner machine, or the CI secret) and retry';

/** True when an age identity is reachable: SOPS_AGE_KEY or SOPS_AGE_KEY_FILE in the environment, the repository's .claude/secret.env or the per-user keys.txt. */
export function hasAgeIdentity(ctx, config) {
  const named = Object.entries(ctx.env).some(([name, value]) => AGE_IDENTITY_ENV.test(name) && value);
  return named || fs.existsSync(path.join(config.repoRoot, '.claude', 'secret.env')) || fs.existsSync(secretRoots(ctx.env).identity);
}

/** Refuses up front, before any work, when sealed custody must be opened and no age identity is reachable. */
export function requireAgeIdentity(ctx, config, purpose) {
  if (!hasAgeIdentity(ctx, config)) throw refusal('STACK_AGE_IDENTITY_MISSING', `${purpose} needs the sealed members, and no age identity is available: ${AGE_HINT}`);
}

/** Opens one sealed member (`<secretsDir>/<member>.enc`) into a { KEY: value } map. Names the member only on failure. */
export function openMember(ctx, config, member) {
  try {
    const map = readMap(path.join(config.secretsDir, `${member}.enc`), ctx.sops);
    return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, typeof value === 'string' && !value.includes(String.fromCodePoint(0)) ? lfText(value) : value]));
  } catch {
    throw refusal('STACK_SECRET_MEMBER_UNREADABLE', `the sealed member ${member} cannot be opened${hasAgeIdentity(ctx, config) ? ' (is the age identity a recipient of this member?)' : `: no age identity is available, ${AGE_HINT}`}`);
  }
}

const present = (map, key) => typeof map[key] === 'string' && map[key] !== '';

function sourceKeys(map, source) {
  if (source.keys !== null) return source.keys;
  return Object.keys(map).filter((key) => KEY_NAME.test(key) && !key.endsWith('_FILE'));
}

/** The KEY -> value pairs one grant source contributes, given what the same service already holds. */
function takeFromSource(map, source, held) {
  const taken = {};
  for (const key of sourceKeys(map, source)) {
    if (!present(map, key)) {
      if (source.required) throw refusal('STACK_SECRET_MISSING', `the sealed member ${source.member} has no value for ${key}`);
    } else if (!(source.fill && Object.hasOwn(held, key))) taken[key] = map[key];
  }
  return taken;
}

function serviceValues(grant, memberOf) {
  const held = {};
  for (const source of grant.from) Object.assign(held, takeFromSource(memberOf(source.member), source, held));
  return held;
}

function sealGrants(config, memberOf, versionKey) {
  const grants = {};
  const secrets = {};
  const owner = {};
  for (const grant of config.secrets.grants) {
    const values = { ...grants[grant.service]?.values, ...serviceValues(grant, memberOf) };
    grants[grant.service] = { values };
    for (const [key, value] of Object.entries(values)) {
      if (Object.hasOwn(secrets, key) && secrets[key].value !== value) throw refusal('STACK_SECRET_CONFLICT', `${key} has different values for ${owner[key]} and ${grant.service}`);
      owner[key] ??= grant.service;
      secrets[key] ??= { runtimeName: secretRuntimeName(config.stack, key, value, versionKey), value };
    }
  }
  return { secrets, grants: Object.fromEntries(Object.entries(grants).map(([service, entry]) => [service, Object.keys(entry.values).sort()])) };
}

function sealSettings(config, memberOf) {
  const block = config.secrets.settings;
  if (block === null) return {};
  const map = memberOf(block.member);
  const settings = {};
  for (const key of block.keys.filter((name) => present(map, name))) {
    if (UNSAFE_SETTING.test(map[key])) throw refusal('STACK_SETTING_INVALID', `${key} must be a plain one-line value`);
    settings[key] = map[key];
  }
  return settings;
}

/**
 * Opens the sealed members once each and returns what every service is granted:
 * { secrets: { KEY: { runtimeName, value } }, grants: { service: [KEY...] }, settings: { KEY: value } }. The caller must not log a value.
 */
export function loadSealed(ctx, config) {
  const versionKey = versionKeyOf(ctx);
  const opened = new Map();
  const memberOf = (member) => {
    if (!opened.has(member)) opened.set(member, openMember(ctx, config, member));
    return opened.get(member);
  };
  const { secrets, grants } = sealGrants(config, memberOf, versionKey);
  return { secrets, grants, settings: sealSettings(config, memberOf) };
}

/** The config objects: non-secret files mounted into services, named by the digest of their content. */
export const configObjects = (config) => config.configs.map((entry) => {
  const file = path.join(config.envDir, entry.file);
  return { logical: entry.name, env: entry.env, file, name: `${config.stack}-${entry.name}-c${sha(configBytes(file)).slice(0, 10)}` };
});
