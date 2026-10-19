// Selected structured custody is opened only inside an admitted operation's private callback.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { byCodeUnit } from '../../engine/by-code-unit.mjs';
import { sopsIdentityEnv } from '../../engine/secrets.mjs';
import { readMap, setSecretValues } from '../hfs/secret-store.mjs';
import { defaultSops } from '../hfs/secret-sops.mjs';
import { resolveDeclaredRepository, resolveCustodyFile, runtimeSecretEnv } from './runtime-host.mjs';
import { canonicalPath, insidePath, pathKey } from '../lib/path-key.mjs';
import { repositoryName } from '../hfs/repo-identity.mjs';

const failures = new WeakSet();
const refusal = code => { const error = Object.assign(new Error(code), { code }); failures.add(error); return error; };
const SOPS_ENV = new Set(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'HOME', 'LOCALAPPDATA', 'APPDATA', 'SOPS_AGE_KEY', 'SOPS_AGE_KEY_FILE']);
const PROVISION_ENV_KEYS = new Set([...SOPS_ENV].filter(key => !key.startsWith('SOPS_')).concat(['ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'JAVA_HOME']));
const PROVISION_NATIVE_ENV_KEYS = new Set(['ORCA_TERMINAL_HANDLE', 'STARCI_LOCAL_ROOT', 'STARCI_GUARDS_ROOT']);
const privateEnv = env => Object.fromEntries(Object.entries(env ?? {}).filter(([key]) => SOPS_ENV.has(key) || /^SOPS_AGE_KEY(?:_FILE)?$/iu.test(key)));
const sopsEnvironment = env => {
  try { return privateEnv(runtimeSecretEnv(privateEnv(env))); }
  catch { throw refusal('credential-custody-unavailable'); }
};

/** Recognize only failures created by this custody owner, never a provider's arbitrary error.code. */
export const isProvisionCustodyFailure = error => typeof error === 'object' && error !== null && failures.has(error);

/** The public OS/tool environment for a fixed child; provider credentials are added explicitly. */
export function provisionChildEnvironment(env) {
  return Object.fromEntries(Object.entries(env ?? {}).filter(([key]) => PROVISION_ENV_KEYS.has(key)));
}

function admittedAgeEnvironment(env) {
  const selected = sopsEnvironment(env);
  const identity = sopsIdentityEnv(selected, { required: true });
  if (identity.error && identity.error.identityRefusal !== 'inline-context-unqualified')
    throw refusal('credential-custody-unavailable');
  return selected;
}

/** A fixed native consumer calls this only after admission and its own public capability checks. */
export function provisionNativeChildEnvironment(env, nativeContext, { age = false } = {}) {
  if (nativeContext?.schema !== 'starci/native-provision-context@1'
    || Object.keys(nativeContext).sort(byCodeUnit).join(',') !== 'guardsRoot,schema,stateRoot,terminal'
    || nativeContext.terminal !== (env?.ORCA_TERMINAL_HANDLE ?? null)
    || typeof nativeContext.stateRoot !== 'string' || typeof nativeContext.guardsRoot !== 'string'
    || !path.isAbsolute(nativeContext.stateRoot) || !path.isAbsolute(nativeContext.guardsRoot)
    || typeof age !== 'boolean') throw refusal('credential-native-context-unverified');
  const result = { ...provisionChildEnvironment(env), ...(age ? admittedAgeEnvironment(env) : null) };
  const binding = { ORCA_TERMINAL_HANDLE: nativeContext.terminal, STARCI_LOCAL_ROOT: nativeContext.stateRoot,
    STARCI_GUARDS_ROOT: nativeContext.guardsRoot };
  for (const key of PROVISION_NATIVE_ENV_KEYS) if (typeof binding[key] === 'string' && binding[key]) result[key] = binding[key];
  return result;
}

function ordinaryMember(root, file) {
  const parts = path.relative(root, file).split(path.sep);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error?.code === 'ENOENT') return;
      throw refusal('credential-custody-scope-refused');
    }
    if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() || stat.nlink !== 1 : !stat.isDirectory()))
      throw refusal('credential-custody-scope-refused');
  }
}

function selected(ref, repoRoot) {
  if (!ref || typeof ref !== 'object' || typeof ref.key !== 'string' || !ref.key.trim()) throw refusal('credential-reference-invalid');
  let root, member;
  if (ref.custody && typeof ref.custody === 'object') {
    if (['.', '..'].includes(ref.custody.repository)) throw refusal('credential-custody-scope-refused');
    root = resolveDeclaredRepository(ref.custody.repository, { fromRepo: repoRoot });
    if (root && repositoryName(root) !== ref.custody.repository) throw refusal('credential-custody-scope-refused');
    member = ref.custody.path;
  } else if (ref.env && ref.slug) {
    root = ref.repoRoot ?? ref.repository ?? repoRoot;
    member = `.starcistacks/${ref.env}/secrets/${ref.slug}.enc`;
  }
  if (!root || typeof member !== 'string' || !/^\.starcistacks\/[a-z][a-z0-9-]*\/secrets\//u.test(member))
    throw refusal('credential-custody-scope-refused');
  const file = resolveCustodyFile(root, member.endsWith('.enc') ? member : `${member}.enc`);
  const boundary = path.join(root, '.starcistacks');
  if (!file || !insidePath(canonicalPath(root), canonicalPath(boundary), { key: pathKey })
    || !insidePath(canonicalPath(boundary), canonicalPath(file), { key: pathKey })) throw refusal('credential-custody-scope-refused');
  ordinaryMember(root, file);
  return { root, file, key: ref.key, ref };
}

function projectCredential(ref, { repoRoot, env }) {
  const chosen = selected(ref, repoRoot);
  if (!fs.existsSync(chosen.file)) {
    if (ref.optional === true) return null;
    throw refusal('credential-custody-missing');
  }
  let opened;
  try {
    opened = readMap(chosen.file, defaultSops(sopsEnvironment(env), chosen.root));
    const value = opened[chosen.key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (ref.optional === true && value === undefined) return null;
    throw refusal('credential-member-missing');
  } catch (error) {
    throw refusal(error?.code === 'credential-member-missing' ? error.code : 'credential-custody-unavailable');
  } finally { for (const key of Object.keys(opened ?? {})) delete opened[key]; }
}

function privateCredential(role, ref, options) {
  if (ref.hostConnection === undefined) return projectCredential(ref, options);
  if (typeof options.hostCredentialOwner !== 'function') throw refusal('credential-host-owner-required');
  const value = options.hostCredentialOwner({ ref, role, target: options.target, env: options.env });
  if (typeof value !== 'string' || !value) throw refusal('credential-host-owner-unavailable');
  return value;
}

/**
 * Supply only declared roles to a private callback. Missing optional roles become null;
 * decryption and malformed-member failures remain failures and never trigger ambient fallback.
 */
export async function withProvisionCredentials(refs, options, consume) {
  const values = Object.create(null), cache = Object.create(null);
  try {
    for (const [role, ref] of Object.entries(refs ?? {})) {
      Object.defineProperty(values, role, { enumerable: true, configurable: true, get() {
        if (Object.hasOwn(cache, role)) return cache[role];
        cache[role] = privateCredential(role, ref, options);
        return cache[role];
      } });
    }
    return await consume(values);
  } finally {
    for (const role of Object.keys(values)) delete values[role];
    for (const role of Object.keys(cache)) delete cache[role];
  }
}

/** Refuse generated-output destinations that alias a selected administrative or source input. */
export function assertProvisionCustodyScope(refs, destination, { repoRoot }) {
  for (const ref of Object.values(refs ?? {})) if (ref?.hostConnection === undefined) selected(ref, repoRoot);
  if (!destination) return;
  const sink = selected(destination, repoRoot);
  for (const [role, ref] of Object.entries(refs ?? {})) {
    if (!/admin|management|source|password|service.?role|principal/iu.test(role)) continue;
    if (ref?.hostConnection !== undefined) continue;
    const source = selected(ref, repoRoot);
    if (pathKey(canonicalPath(source.file)) === pathKey(canonicalPath(sink.file)) && source.key === sink.key)
      throw refusal('credential-destination-aliases-input');
  }
}

/**
 * Seal a generated value directly into its declared named member through the existing SOPS owner.
 * Only the selected key changes. The returned reference contains no value or value-derived digest.
 */
export function sealProvisionValues(destination, value, { repoRoot, env } = {}) {
  const chosen = selected(destination, repoRoot);
  const relative = path.relative(chosen.root, chosen.file).replaceAll('\\', '/');
  const match = /^\.starcistacks\/([a-z][a-z0-9-]*)\/secrets\/([a-z0-9][a-z0-9-]*)\.enc$/u.exec(relative);
  if (!match) throw refusal('credential-destination-format-refused');
  const values = typeof value === 'string' ? { [chosen.key]: value } : value;
  if (!values || Object.keys(values).length !== 1 || !Object.hasOwn(values, chosen.key)) throw refusal('credential-destination-key-refused');
  try { setSecretValues(chosen.root, { env: match[1], slug: match[2], values }, { processEnv: sopsEnvironment(env) }); }
  catch { throw refusal('credential-seal-failed'); }
  return { ok: true, destinationRef: sha256(JSON.stringify(destination)) };
}
