import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from '../../../engine/digest.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { isPlainObject as record } from '../../../engine/plain-object.mjs';
import { argThrow as fail } from '../../lib/cli-arg.mjs';
import { resolveRealTool } from './resolve-real-tool.mjs';
import { secretHits } from '../../lib/secret-patterns.mjs';

const HOST = 'ghcr.io';
const HELPERS = new Set(['desktop', 'wincred', 'osxkeychain', 'pass', 'secretservice']);
const REGISTRY_ENV_KEYS = ['SystemRoot', 'WINDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'DBUS_SESSION_BUS_ADDRESS', 'GNUPGHOME', 'PASSWORD_STORE_DIR'];

function nativeFile(file) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) fail('GHCR_NATIVE_TOOL_REFUSED');
  const real = fs.realpathSync(file);
  if (path.resolve(real) !== path.resolve(file)) fail('GHCR_NATIVE_TOOL_REFUSED');
  if (process.platform === 'win32' && path.extname(real).toLowerCase() !== '.exe') fail('GHCR_NATIVE_TOOL_REFUSED');
  return { path: real, sha256: sha256File(real) };
}

function readConfiguration(file) {
  let value;
  try {
    const source = fs.readFileSync(file, 'utf8');
    value = JSON.parse(source);
    parseYaml(source);
  }
  catch { fail('GHCR_DOCKER_CONFIG_REFUSED'); }
  if (!record(value)) fail('GHCR_DOCKER_CONFIG_REFUSED');
  if (Object.keys(value).some(key => /[^\x00-\x7F]/.test(key))) fail('GHCR_DOCKER_CONFIG_REFUSED');
  const keys = { credsstore: 'credsStore', credhelpers: 'credHelpers', auths: 'auths' };
  if (Object.keys(value).some(key => Object.hasOwn(keys, key.toLowerCase()) && keys[key.toLowerCase()] !== key)) fail('GHCR_DOCKER_CONFIG_REFUSED');
  return value;
}

function refusePlaintext(value) {
  for (const [server, entry] of Object.entries(record(value.auths) ? value.auths : {})) {
    if ((server === HOST || server === `https://${HOST}` || server === `https://${HOST}/v1/`) && record(entry)
      && Object.keys(entry).some(key => ['auth', 'password', 'identitytoken', 'registrytoken'].includes(key.toUpperCase().toLowerCase()))) fail('GHCR_PLAINTEXT_AUTH_REFUSED');
  }
}

function settings(directory, helper) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) fail('GHCR_DOCKER_CONFIG_REQUIRED');
  const root = fs.realpathSync(directory), file = path.join(root, 'config.json');
  if (path.resolve(root) !== path.resolve(directory) || fs.lstatSync(file).isSymbolicLink()) fail('GHCR_DOCKER_CONFIG_REFUSED');
  const value = readConfiguration(file);
  if (value.credHelpers !== undefined && !record(value.credHelpers)) fail('GHCR_DOCKER_CONFIG_REFUSED');
  const specific = record(value.credHelpers) && Object.hasOwn(value.credHelpers, HOST);
  const selected = specific ? value.credHelpers[HOST] : value.credsStore;
  if (typeof selected !== 'string' || selected !== helper) fail('GHCR_NATIVE_HELPER_MISMATCH');
  refusePlaintext(value);
  return { directory: root, helper, selection: specific ? 'credHelpers' : 'credsStore' };
}

function validateResource(resource) {
  if (!record(resource) || !HELPERS.has(resource.helper) || typeof resource.username !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(resource.username)
    || !Number.isInteger(resource.timeoutMs) || resource.timeoutMs <= 0) fail('GHCR_TARGET_INVALID');
  if (typeof resource.dockerEndpoint !== 'string' || !(process.platform === 'win32'
    ? /^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/.test(resource.dockerEndpoint)
    : resource.dockerEndpoint.startsWith('unix:///') && !/[\r\n\0]/.test(resource.dockerEndpoint))) fail('GHCR_LOCAL_DAEMON_REQUIRED');
}

function publicEnvironment(parentEnv) {
  const result = {};
  for (const key of REGISTRY_ENV_KEYS) {
    const value = parentEnv[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value) || secretHits('native-environment', value).length) fail('GHCR_TARGET_INVALID');
    if (key === 'DBUS_SESSION_BUS_ADDRESS') {
      if (!value.startsWith('unix:')) fail('GHCR_TARGET_INVALID');
    } else if (!path.isAbsolute(value)) fail('GHCR_TARGET_INVALID');
    result[key] = value;
  }
  return result;
}

function environmentOf(parentEnv, docker, helper, config) {
  const nativeEnvironment = publicEnvironment(parentEnv);
  const separator = process.platform === 'win32' ? ';' : ':';
  const pathKey = Object.keys(parentEnv).find(key => key.toLowerCase() === 'path');
  const entries = String(parentEnv[pathKey] ?? '').split(separator).filter(Boolean).map(entry => entry.replace(/^"(.*)"$/, '$1'));
  if (entries.some(entry => !path.isAbsolute(entry) || /[\r\n\0]/.test(entry) || secretHits('native-path', entry).length)) fail('GHCR_TARGET_INVALID');
  nativeEnvironment.PATH = [path.dirname(helper.path), path.dirname(docker.path), ...entries].join(separator);
  nativeEnvironment.DOCKER_CONFIG = config.directory;
  return nativeEnvironment;
}

/** Resolves only fixed native programs and public helper configuration; no helper credential is opened here. */
export function inspectRegistryNative(resource, parentEnv = {}) {
  validateResource(resource);
  const dockerPath = resolveRealTool('docker', { env: parentEnv });
  const helperPath = resolveRealTool(`docker-credential-${resource.helper}`, { env: parentEnv });
  if (!dockerPath || !helperPath) fail('GHCR_NATIVE_TOOL_UNAVAILABLE');
  const docker = nativeFile(dockerPath), helper = nativeFile(helperPath);
  const config = settings(resource.dockerConfig, resource.helper);
  const nativeEnvironment = environmentOf(parentEnv, docker, helper, config);
  return { host: HOST, docker, helper, config, nativeEnvironment, endpoint: resource.dockerEndpoint };
}
