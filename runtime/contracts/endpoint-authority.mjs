import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENDPOINT_BINDING_AUTHORITY = 'workspace-route-port-projection';
export const LEGACY_ACADEMY_ENDPOINTS = Object.freeze({
  frontend: 'http://localhost:3000',
  api: 'http://localhost:3001',
  identity: 'http://localhost:8080',
});

const DEFAULT_SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SERVICE_KEY = /^[A-Za-z][A-Za-z0-9]*$/;

const canonicalValue = (value) => Array.isArray(value)
  ? value.map(canonicalValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
    : value;

const fingerprint = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalValue(value))).digest('hex')}`;
const fail = (message) => { throw new Error(message); };
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const assertObject = (value, label) => { if (!isObject(value)) fail(`${label} must be an object`); };
const assertInteger = (value, label, minimum = 0) => {
  if (!Number.isInteger(value) || value < minimum) fail(`${label} must be an integer >= ${minimum}`);
};

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function samePath(left, right) {
  return comparablePath(left) === comparablePath(right);
}

function readJson(file, label) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`${label} is unavailable at ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is invalid JSON at ${file}: ${error.message}`);
  }
}

function assertPortableDirectory(directory, label) {
  if (typeof directory !== 'string' || directory.length === 0 || path.isAbsolute(directory)) fail(`${label} must be a safe relative directory`);
  const segments = directory.replaceAll('\\', '/').split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) fail(`${label} must not traverse directories`);
}

function validateRoute(sourceRoot, project, role) {
  const portableFile = path.join(sourceRoot, '.workspaces', 'projects', project, `${role}.json`);
  const localFile = path.join(sourceRoot, '.workspaces', 'local', 'routes', project, role, 'config.json');
  const portable = readJson(portableFile, `portable ${project}/${role} route`);
  const local = readJson(localFile, `hydrated ${project}/${role} route`);

  if (portable.project !== project || portable.role !== role) fail(`portable ${project}/${role} route identity differs from its canonical path`);
  if (local.project !== project || local.role !== role) fail(`hydrated ${project}/${role} route identity differs from its canonical path`);
  assertObject(portable.repository, `portable ${project}/${role} repository`);
  assertObject(local.repository, `hydrated ${project}/${role} repository`);
  assertObject(local.source, `hydrated ${project}/${role} source`);
  if (!samePath(local.source.path, sourceRoot)) fail(`hydrated ${project}/${role} route belongs to another Source`);
  if (!samePath(local.source.workspaceRoot, path.join(sourceRoot, '.workspaces'))) fail(`hydrated ${project}/${role} route has a foreign workspace root`);
  if (portable.repository.gitRepository !== local.repository.gitRepository || portable.repository.branch !== local.repository.branch) {
    fail(`hydrated ${project}/${role} repository differs from the portable route`);
  }

  let expectedDiskPath;
  if (portable.repository.kind === 'source') {
    if (portable.repository.directory !== null) fail(`source ${project}/${role} route must use a null directory`);
    expectedDiskPath = sourceRoot;
  } else if (portable.repository.kind === 'sibling') {
    assertPortableDirectory(portable.repository.directory, `portable ${project}/${role} repository.directory`);
    expectedDiskPath = path.resolve(path.dirname(sourceRoot), portable.repository.directory);
  } else {
    fail(`portable ${project}/${role} repository kind is not trusted`);
  }
  if (!samePath(local.repository.diskPath, expectedDiskPath) || !samePath(local.repository.gitRoot, expectedDiskPath)) {
    fail(`hydrated ${project}/${role} repository path differs from the closed portable route`);
  }

  return {
    diskPath: path.resolve(local.repository.diskPath),
    identity: {
      kind: portable.repository.kind,
      directory: portable.repository.directory,
      gitRepository: portable.repository.gitRepository,
      branch: portable.repository.branch,
    },
  };
}

function assertBindingSeed(seed) {
  assertObject(seed, 'endpoint binding');
  if (seed.authority !== ENDPOINT_BINDING_AUTHORITY) fail(`endpoint binding authority must be ${ENDPOINT_BINDING_AUTHORITY}`);
  if (typeof seed.project !== 'string' || !SLUG.test(seed.project)) fail('endpoint binding project must be a canonical slug');
  if (typeof seed.application !== 'string' || !SLUG.test(seed.application)) fail('endpoint binding application must be a canonical slug');
  assertObject(seed.services, 'endpoint binding services');
  for (const role of ['frontend', 'api', 'identity']) {
    if (typeof seed.services[role] !== 'string' || !SERVICE_KEY.test(seed.services[role])) fail(`endpoint binding services.${role} must be a canonical metadata service key`);
  }
  if (new Set(Object.values(seed.services)).size !== 3) fail('endpoint binding service keys must be distinct');
}

function serviceProjection({ metadata, serviceKey, role, application, offset, applicationSlot, slotStep }) {
  const declaration = metadata.portServices?.[serviceKey];
  if (!isObject(declaration)) fail(`metadata service ${serviceKey} is not declared`);
  const expected = role === 'identity'
    ? { scope: 'shared', basePort: 8080 }
    : { scope: 'application', application, basePort: role === 'frontend' ? 3000 : 3001 };
  for (const [key, value] of Object.entries(expected)) {
    if (declaration[key] !== value) fail(`metadata service ${serviceKey} is not the canonical ${role} service for application ${application}`);
  }
  const projectedPort = declaration.basePort + offset + (declaration.scope === 'application' ? applicationSlot * slotStep : 0);
  assertInteger(projectedPort, `projected ${role} port`, 1);
  if (projectedPort > 65535) fail(`projected ${role} port exceeds 65535`);
  if (metadata.ports?.[serviceKey] !== projectedPort) fail(`metadata resolved port for ${serviceKey} differs from the canonical workspace projection`);
  return {
    serviceKey,
    scope: declaration.scope,
    application: declaration.application ?? null,
    basePort: declaration.basePort,
    resolvedPort: projectedPort,
  };
}

function projectEndpointProjection(seed, { sourceRoot = DEFAULT_SOURCE_ROOT } = {}) {
  assertBindingSeed(seed);
  sourceRoot = path.resolve(sourceRoot);
  const frontendRoute = validateRoute(sourceRoot, seed.project, 'fe');
  const backendRoute = validateRoute(sourceRoot, seed.project, 'be');
  const portConfig = readJson(path.join(sourceRoot, '.workspaces', 'ports', 'config.json'), 'workspace port config');
  const projectPorts = readJson(path.join(sourceRoot, '.workspaces', 'ports', `${seed.project}.json`), `${seed.project} port registry`);
  const metadata = readJson(path.join(backendRoute.diskPath, 'metadata.json'), `${seed.project} backend metadata`);

  if (portConfig.version !== 1) fail('workspace port config version is not supported');
  assertInteger(portConfig.slotStep, 'workspace slotStep', 1);
  if (projectPorts.version !== 1 || projectPorts.project !== seed.project) fail(`${seed.project} port registry identity is invalid`);
  assertInteger(projectPorts.offset, `${seed.project} port offset`);
  if (projectPorts.offset >= portConfig.slotStep) fail(`${seed.project} port offset must be smaller than slotStep`);
  assertObject(projectPorts.applications, `${seed.project} application slots`);
  const applicationSlots = Object.values(projectPorts.applications);
  for (const [name, slot] of Object.entries(projectPorts.applications)) {
    if (!SLUG.test(name)) fail(`${seed.project} application name ${name} is not a canonical slug`);
    assertInteger(slot, `${seed.project}/${name} application slot`);
  }
  if (new Set(applicationSlots).size !== applicationSlots.length) fail(`${seed.project} application slots must be unique`);
  const applicationSlot = projectPorts.applications[seed.application];
  assertInteger(applicationSlot, `${seed.project}/${seed.application} application slot`);
  assertObject(metadata.ports, `${seed.project} metadata ports`);
  assertObject(metadata.portServices, `${seed.project} metadata port services`);
  const expectedMetadataProject = seed.project === 'starci-academy' ? 'starci-academy-backend' : seed.project;
  if (metadata.project !== expectedMetadataProject) fail(`${seed.project} backend metadata belongs to project ${metadata.project ?? '<missing>'}, expected ${expectedMetadataProject}`);

  const services = Object.fromEntries(['frontend', 'api', 'identity'].map((role) => [role, serviceProjection({
    metadata,
    serviceKey: seed.services[role],
    role,
    application: seed.application,
    offset: projectPorts.offset,
    applicationSlot,
    slotStep: portConfig.slotStep,
  })]));
  const authority = {
    authority: ENDPOINT_BINDING_AUTHORITY,
    project: seed.project,
    application: seed.application,
    routes: { frontend: frontendRoute.identity, backend: backendRoute.identity },
    portRegistry: {
      version: projectPorts.version,
      offset: projectPorts.offset,
      slotStep: portConfig.slotStep,
      applicationSlot,
    },
    services,
  };
  return {
    authority,
    authorityFingerprint: fingerprint(authority),
    endpoints: Object.fromEntries(Object.entries(services).map(([role, service]) => [role, `http://localhost:${service.resolvedPort}`])),
  };
}

export function createProjectEndpointBinding({ project, application, services }, options = {}) {
  const seed = { authority: ENDPOINT_BINDING_AUTHORITY, project, application, services };
  const projection = projectEndpointProjection(seed, options);
  return {
    endpointBinding: { ...seed, authorityFingerprint: projection.authorityFingerprint },
    endpoints: projection.endpoints,
    authority: projection.authority,
  };
}

export function resolveProjectEndpointBinding(binding, options = {}) {
  assertBindingSeed(binding);
  if (typeof binding.authorityFingerprint !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(binding.authorityFingerprint)) {
    fail('endpoint binding authorityFingerprint is invalid');
  }
  const projection = projectEndpointProjection(binding, options);
  if (binding.authorityFingerprint !== projection.authorityFingerprint) fail('endpoint binding authorityFingerprint is stale or belongs to another workspace projection');
  return projection;
}
