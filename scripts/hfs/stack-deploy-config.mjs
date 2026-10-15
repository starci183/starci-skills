// stack-deploy-config.mjs - the ONE reader of `environments.<env>.deploy` in .starcistacks/application-stacks.yaml (R294).
// `starci app stack ...` (packages/hfs/stack) normalises the block through it and `starci app check` (rules/stacks-deploy.mjs)
// judges the same block through it, so the verbs and the rule can never disagree. Pure given the block and a probe of the app tree.
import path from 'node:path';
import { isPlainObject as plain } from '../../engine/plain-object.mjs';
import { normalizeIngress } from './stack-ingress-config.mjs';

export const DEPLOY_CONFIG_CODE = 'STACKS_DEPLOY_CONFIG_INVALID';

export const NAME = /^[a-z][a-z0-9-]*$/u;
export const KEY = /^[A-Z][A-Z0-9_]*$/u;
const VOLUME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u;
const HOST_ALIAS = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const REMOTE_BASE = /^\/[A-Za-z0-9._/-]+$/u;
const HTTP_URL = /^https?:\/\/[^\s]+$/u;
const PINNED_HELPER_IMAGE = /^[a-z0-9./_-]+(?::[A-Za-z0-9._-]+)?@sha256:(?!0{64}$)[0-9a-f]{64}$/u;
const ARGUMENT = /^[A-Za-z0-9_@%+=:,./-]+$/u;
const UPPER_ENV = KEY;

const FIELDS = {
  deploy: ['stack', 'remote', 'images', 'volumes', 'secrets', 'environment', 'configs', 'passEnv', 'verify', 'jobs', 'backup', 'ingress'],
  remote: ['host', 'releasesBase', 'sealed'],
  sealed: ['ops', 'sshKey', 'knownHosts'],
  image: ['app', 'buildArgs'],
  buildArgs: ['values', 'sealed'],
  secrets: ['grants', 'settings'],
  grant: ['service', 'filePointers', 'from'],
  source: ['member', 'keys', 'required', 'fill'],
  settings: ['member', 'keys'],
  environment: ['files', 'values', 'settings'],
  setting: ['key', 'default'],
  config: ['name', 'file', 'env'],
  verify: ['http', 'exec'],
  http: ['name', 'url', 'method', 'body', 'status', 'json', 'contains', 'retry'],
  exec: ['name', 'service', 'command', 'stdout'],
  jobs: ['service', 'command'],
  backup: ['image', 'keepDays', 'dir', 'volumes'],
  backupVolume: ['name', 'volume'],
};

/** Collects problems with the path they concern; `problem(at, message)` is the only way to add one. */
function collector() {
  const problems = [];
  return { problems, problem: (at, message) => { problems.push({ at, message }); } };
}

const text = (value) => typeof value === 'string' && value.length > 0;
const list = (value) => (Array.isArray(value) ? value : []);

function closedFields(c, at, value, allowed) {
  if (!plain(value)) { c.problem(at, 'must be a mapping'); return false; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) c.problem(`${at}.${key}`, 'is not a field of the deploy block');
  return true;
}

function nameField(c, at, value, pattern = NAME) {
  if (typeof value !== 'string' || !pattern.test(value)) { c.problem(at, `must match ${pattern}`); return false; }
  return true;
}

/** A path inside .starcistacks/<env>/ : relative, forward slashes, no `..`, and present in the tree. */
function treeFile(c, at, value, probe) {
  if (!text(value) || path.posix.isAbsolute(value) || value.includes('\\') || path.posix.normalize(value).split('/').includes('..')) {
    c.problem(at, 'must be a relative path inside the environment directory'); return;
  }
  if (!probe.exists(value)) c.problem(at, `${value} does not exist under the environment directory`);
}

function stringList(c, at, value, itemPattern, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) { c.problem(at, 'must be a list'); return []; }
  value.forEach((item, index) => { if (typeof item !== 'string' || !itemPattern.test(item)) c.problem(`${at}[${index}]`, `must match ${itemPattern}`); });
  return value;
}

function remote(c, block) {
  if (block === undefined) return { host: 'vps', releasesBase: null, sealed: null };
  if (!closedFields(c, 'deploy.remote', block, FIELDS.remote)) return { host: 'vps', releasesBase: null, sealed: null };
  if (block.host !== undefined) nameField(c, 'deploy.remote.host', block.host, HOST_ALIAS);
  if (block.releasesBase !== undefined && (!REMOTE_BASE.test(String(block.releasesBase)) || String(block.releasesBase).includes('..')))
    c.problem('deploy.remote.releasesBase', 'must be an absolute path without ..');
  let sealed = null;
  if (block.sealed !== undefined && closedFields(c, 'deploy.remote.sealed', block.sealed, FIELDS.sealed)) {
    for (const key of FIELDS.sealed) nameField(c, `deploy.remote.sealed.${key}`, block.sealed[key]);
    sealed = { ...block.sealed };
  }
  return { host: block.host ?? 'vps', releasesBase: block.releasesBase ?? null, sealed };
}

function imageBuildArgs(c, at, block, members) {
  const out = { values: {}, sealed: null };
  if (block === undefined) return out;
  if (!closedFields(c, at, block, FIELDS.buildArgs)) return out;
  for (const [key, value] of Object.entries(block.values ?? {})) {
    if (!KEY.test(key) || typeof value !== 'string') c.problem(`${at}.values.${key}`, 'must be KEY: "string"');
    else out.values[key] = value;
  }
  if (block.sealed !== undefined && closedFields(c, `${at}.sealed`, block.sealed, FIELDS.settings)) {
    memberRef(c, `${at}.sealed.member`, block.sealed.member, members);
    out.sealed = { member: block.sealed.member, keys: stringList(c, `${at}.sealed.keys`, block.sealed.keys, KEY, { nonEmpty: true }) };
  }
  return out;
}

function memberRef(c, at, member, members) {
  if (!nameField(c, at, member)) return;
  if (members.size > 0 && !members.has(member)) c.problem(at, `sealed member ${member} has no .starcistacks/<env>/secrets/${member}.enc`);
}

function images(c, block, services, members) {
  const out = {};
  if (block === undefined) return out;
  if (!plain(block)) { c.problem('deploy.images', 'must be a mapping of service to image'); return out; }
  for (const [service, entry] of Object.entries(block)) {
    const at = `deploy.images.${service}`;
    nameField(c, at, service);
    if (services.size > 0 && !services.has(service)) c.problem(at, `${service} is not a service of the stack source`);
    if (!closedFields(c, at, entry, FIELDS.image)) continue;
    nameField(c, `${at}.app`, entry.app);
    out[service] = { app: entry.app, buildArgs: imageBuildArgs(c, `${at}.buildArgs`, entry.buildArgs, members) };
  }
  return out;
}

function sourceEntry(c, at, entry, members) {
  if (!closedFields(c, at, entry, FIELDS.source)) return null;
  memberRef(c, `${at}.member`, entry.member, members);
  const keys = entry.keys === undefined ? null : stringList(c, `${at}.keys`, entry.keys, KEY, { nonEmpty: true });
  for (const flag of ['required', 'fill']) if (entry[flag] !== undefined && typeof entry[flag] !== 'boolean') c.problem(`${at}.${flag}`, 'must be true or false');
  if (entry.required === true && keys === null) c.problem(`${at}.required`, 'needs an explicit keys list');
  return { member: entry.member, keys, required: entry.required === true, fill: entry.fill === true };
}

function grants(c, block, services, members) {
  const out = [];
  list(block).forEach((grant, index) => {
    const at = `deploy.secrets.grants[${index}]`;
    if (!closedFields(c, at, grant, FIELDS.grant)) return;
    nameField(c, `${at}.service`, grant.service);
    if (services.size > 0 && !services.has(grant.service)) c.problem(`${at}.service`, `${grant.service} is not a service of the stack source`);
    if (grant.filePointers !== undefined && typeof grant.filePointers !== 'boolean') c.problem(`${at}.filePointers`, 'must be true or false');
    if (!Array.isArray(grant.from) || grant.from.length === 0) { c.problem(`${at}.from`, 'must list at least one sealed source'); return; }
    const from = grant.from.map((entry, at2) => sourceEntry(c, `${at}.from[${at2}]`, entry, members)).filter(Boolean);
    out.push({ service: grant.service, filePointers: grant.filePointers === true, from });
  });
  return out;
}

function secretSettings(c, block, members) {
  if (block === undefined) return null;
  if (!closedFields(c, 'deploy.secrets.settings', block, FIELDS.settings)) return null;
  memberRef(c, 'deploy.secrets.settings.member', block.member, members);
  return { member: block.member, keys: stringList(c, 'deploy.secrets.settings.keys', block.keys, KEY, { nonEmpty: true }) };
}

function secrets(c, block, services, members) {
  if (block === undefined) return { grants: [], settings: null };
  if (!closedFields(c, 'deploy.secrets', block, FIELDS.secrets)) return { grants: [], settings: null };
  if (block.grants !== undefined && !Array.isArray(block.grants)) c.problem('deploy.secrets.grants', 'must be a list');
  return { grants: grants(c, block.grants, services, members), settings: secretSettings(c, block.settings, members) };
}

function serviceEnvironment(c, at, entry, probe) {
  const out = { files: [], values: {}, settings: {} };
  if (!closedFields(c, at, entry, FIELDS.environment)) return out;
  list(entry.files).forEach((file, index) => { treeFile(c, `${at}.files[${index}]`, file, probe); out.files.push(file); });
  for (const [key, value] of Object.entries(entry.values ?? {})) {
    if (!UPPER_ENV.test(key) || typeof value !== 'string') c.problem(`${at}.values.${key}`, 'must be KEY: "string"');
    else out.values[key] = value;
  }
  for (const [key, setting] of Object.entries(entry.settings ?? {})) {
    if (!UPPER_ENV.test(key) || !closedFields(c, `${at}.settings.${key}`, setting, FIELDS.setting) || !nameField(c, `${at}.settings.${key}.key`, setting.key, KEY)) continue;
    out.settings[key] = { key: setting.key, default: setting.default === undefined ? null : String(setting.default) };
  }
  return out;
}

function environmentBlock(c, block, services, probe) {
  const out = {};
  if (block === undefined) return out;
  if (!plain(block)) { c.problem('deploy.environment', 'must be a mapping of service to environment'); return out; }
  for (const [service, entry] of Object.entries(block)) {
    if (services.size > 0 && !services.has(service)) c.problem(`deploy.environment.${service}`, `${service} is not a service of the stack source`);
    out[service] = serviceEnvironment(c, `deploy.environment.${service}`, entry, probe);
  }
  return out;
}

function configs(c, block, probe) {
  const out = [];
  list(block).forEach((entry, index) => {
    const at = `deploy.configs[${index}]`;
    if (!closedFields(c, at, entry, FIELDS.config)) return;
    nameField(c, `${at}.name`, entry.name);
    nameField(c, `${at}.env`, entry.env, KEY);
    treeFile(c, `${at}.file`, entry.file, probe);
    out.push({ name: entry.name, file: entry.file, env: entry.env });
  });
  const seen = new Set();
  for (const entry of out) { if (seen.has(entry.name)) c.problem('deploy.configs', `config name ${entry.name} is declared twice`); seen.add(entry.name); }
  return out;
}

function httpChecks(c, block) {
  return list(block).flatMap((entry, index) => {
    const at = `deploy.verify.http[${index}]`;
    if (!closedFields(c, at, entry, FIELDS.http)) return [];
    if (!text(entry.name)) c.problem(`${at}.name`, 'must be a non-empty string');
    if (!HTTP_URL.test(String(entry.url))) c.problem(`${at}.url`, 'must be an http(s) URL');
    if (entry.method !== undefined && !['GET', 'POST'].includes(entry.method)) c.problem(`${at}.method`, 'must be GET or POST');
    if (entry.status !== undefined && !(Number.isInteger(entry.status) && entry.status >= 100 && entry.status <= 599)) c.problem(`${at}.status`, 'must be an HTTP status code');
    if (entry.json !== undefined && !plain(entry.json)) c.problem(`${at}.json`, 'must be a mapping of expected fields');
    return [{ name: entry.name, url: entry.url, method: entry.method ?? 'GET', body: entry.body ?? null, status: entry.status ?? 200, json: entry.json ?? null, contains: entry.contains ?? null, retry: entry.retry === true }];
  });
}

function command(c, at, value) {
  const items = stringList(c, at, value, ARGUMENT, { nonEmpty: true });
  return items;
}

function execChecks(c, block, services) {
  return list(block).flatMap((entry, index) => {
    const at = `deploy.verify.exec[${index}]`;
    if (!closedFields(c, at, entry, FIELDS.exec)) return [];
    if (!text(entry.name)) c.problem(`${at}.name`, 'must be a non-empty string');
    nameField(c, `${at}.service`, entry.service);
    if (services.size > 0 && !services.has(entry.service)) c.problem(`${at}.service`, `${entry.service} is not a service of the stack source`);
    if (entry.stdout !== undefined) try { new RegExp(entry.stdout, 'u'); } catch { c.problem(`${at}.stdout`, 'must be a valid regular expression'); }
    return [{ name: entry.name, service: entry.service, command: command(c, `${at}.command`, entry.command), stdout: entry.stdout ?? null }];
  });
}

function verify(c, block, services) {
  if (block === undefined) return { http: [], exec: [] };
  if (!closedFields(c, 'deploy.verify', block, FIELDS.verify)) return { http: [], exec: [] };
  return { http: httpChecks(c, block.http), exec: execChecks(c, block.exec, services) };
}

function jobs(c, block, services) {
  if (block === undefined) return null;
  if (!closedFields(c, 'deploy.jobs', block, FIELDS.jobs)) return null;
  nameField(c, 'deploy.jobs.service', block.service);
  if (services.size > 0 && !services.has(block.service)) c.problem('deploy.jobs.service', `${block.service} is not a service of the stack source`);
  return { service: block.service, command: command(c, 'deploy.jobs.command', block.command) };
}

function backup(c, block) {
  if (block === undefined) return null;
  if (!closedFields(c, 'deploy.backup', block, FIELDS.backup)) return null;
  if (!PINNED_HELPER_IMAGE.test(String(block.image))) c.problem('deploy.backup.image', 'must be a digest-pinned image reference (no all-zero digest)');
  if (block.keepDays !== undefined && !(Number.isInteger(block.keepDays) && block.keepDays >= 1 && block.keepDays <= 3650)) c.problem('deploy.backup.keepDays', 'must be a whole number of days from 1 to 3650');
  if (block.dir !== undefined && (!REMOTE_BASE.test(String(block.dir)) || String(block.dir).includes('..'))) c.problem('deploy.backup.dir', 'must be an absolute path without ..');
  const volumes = list(block.volumes).flatMap((entry, index) => {
    const at = `deploy.backup.volumes[${index}]`;
    if (!closedFields(c, at, entry, FIELDS.backupVolume)) return [];
    nameField(c, `${at}.name`, entry.name);
    nameField(c, `${at}.volume`, entry.volume, VOLUME);
    return [{ name: entry.name, volume: entry.volume }];
  });
  if (volumes.length === 0) c.problem('deploy.backup.volumes', 'must list at least one volume');
  return { image: block.image, keepDays: block.keepDays ?? 14, dir: block.dir ?? null, volumes };
}

function ingress(c, block, probe) {
  if (block === undefined) return null;
  const result = normalizeIngress(block, { probe });
  for (const item of result.problems) c.problem(item.at, item.message);
  return result.ingress;
}

/**
 * Validates and normalises one `deploy` block.
 *   probe.exists(rel)  does a file exist below .starcistacks/<env>/ ?
 *   probe.services     the service names of the committed stack source (empty set = unknown, service references are not checked)
 *   probe.members      the sealed member slugs of .starcistacks/<env>/secrets (empty set = unknown)
 * Returns { config, problems } ; config is null when a problem was found.
 */
export function normalizeDeploy(block, { project, probe }) {
  const c = collector();
  if (!closedFields(c, 'deploy', block, FIELDS.deploy)) return { config: null, problems: c.problems };
  const services = probe.services ?? new Set();
  const members = probe.members ?? new Set();
  if (block.stack !== undefined) nameField(c, 'deploy.stack', block.stack);
  const config = {
    stack: block.stack ?? project,
    remote: remote(c, block.remote),
    images: images(c, block.images, services, members),
    volumes: block.volumes === undefined ? [] : stringList(c, 'deploy.volumes', block.volumes, VOLUME),
    secrets: secrets(c, block.secrets, services, members),
    environment: environmentBlock(c, block.environment, services, probe),
    configs: configs(c, block.configs, probe),
    passEnv: block.passEnv === undefined ? [] : stringList(c, 'deploy.passEnv', block.passEnv, KEY),
    verify: verify(c, block.verify, services),
    jobs: jobs(c, block.jobs, services),
    backup: backup(c, block.backup),
    ingress: ingress(c, block.ingress, probe),
  };
  if (block.stack === undefined && !NAME.test(String(project))) c.problem('deploy.stack', `the project name ${project} is not a valid stack name (${NAME}); declare deploy.stack`);
  return { config: c.problems.length === 0 ? config : null, problems: c.problems };
}
