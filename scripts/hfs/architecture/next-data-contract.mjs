import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { canonical, exactKeys, isInside, slash } from './config.mjs';

const CONTRACT_SCHEMA = 'starci/next-data-lifecycle@1';
const SOURCE = /\.[cm]?[jt]sx?$/i;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const BINDING = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const TOP_KEYS = new Set(['schema', 'swr', 'hooks']);
const SWR_KEYS = new Set(['package', 'major']);
const HOOK_KEYS = new Set(['id', 'path', 'export', 'kind', 'resultBinding', 'identities']);
const IDENTITY_KEYS = new Set(['id', 'binding', 'gatesRequest', 'resource']);
function relativeSource(repository, value, label) {
  repository = path.resolve(repository);
  if (typeof value !== 'string' || !value.trim() || path.isAbsolute(value)) throw Error(`${label} must be a non-empty repository-relative source path.`);
  const relative = slash(value.trim()).replace(/^\.\//, '');
  if (relative.split('/').includes('..') || !SOURCE.test(relative) || /\.d\.[cm]?[jt]s$/i.test(relative)) {
    throw Error(`${label} must be a production TypeScript or JavaScript source path.`);
  }
  const absolute = path.resolve(repository, ...relative.split('/'));
  if (!isInside(repository, absolute)) throw Error(`${label} must stay inside the repository.`);
  for (let current = absolute; current !== repository; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw Error(`${label} must not cross a symbolic-link or junction ancestor.`);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || !isInside(canonical(repository), canonical(absolute))) throw Error(`${label} must be a regular source file inside the repository.`);
  return relative;
}

export function parseContract(config) {
  // The contract is declared in the app's one package.json (the app root; config.root is the fe side folder).
  const manifest = JSON.parse(fs.readFileSync(path.join(config.packageRoot ?? config.root, 'package.json'), 'utf8'));
  const next = manifest?.starci?.codePatterns?.next;
  const value = next?.dataLifecycle;
  if (value === undefined) return null;
  if (next.schema !== 'starci/next-code-pattern-contract@1') throw Error('package.json#starci.codePatterns.next must use starci/next-code-pattern-contract@1.');
  exactKeys(value, TOP_KEYS, 'package.json#starci.codePatterns.next.dataLifecycle');
  if (value.schema !== CONTRACT_SCHEMA) throw Error(`dataLifecycle.schema must be ${CONTRACT_SCHEMA}.`);
  exactKeys(value.swr, SWR_KEYS, 'dataLifecycle.swr');
  if (value.swr.package !== 'swr' || !Number.isInteger(value.swr.major) || value.swr.major < 1) {
    throw Error('dataLifecycle.swr must bind package swr and one positive integer major version.');
  }
  if (!Array.isArray(value.hooks) || value.hooks.length === 0) throw Error('dataLifecycle.hooks must contain at least one declared lifecycle call.');
  const ids = new Set();
  const hooks = value.hooks.map((hook, index) => {
    const label = `dataLifecycle.hooks[${index}]`;
    exactKeys(hook, HOOK_KEYS, label);
    if (typeof hook.id !== 'string' || !hook.id.trim() || ids.has(hook.id.trim())) throw Error(`${label}.id must be unique and non-empty.`);
    ids.add(hook.id.trim());
    const source = relativeSource(config.root, hook.path, `${label}.path`);
    if (typeof hook.export !== 'string' || !/^use[A-Z0-9_$][\w$]*$/.test(hook.export)) throw Error(`${label}.export must name one exported use* hook.`);
    if (!['query', 'mutation'].includes(hook.kind)) throw Error(`${label}.kind must be query or mutation.`);
    if (hook.resultBinding !== undefined && (typeof hook.resultBinding !== 'string' || !IDENTIFIER.test(hook.resultBinding))) {
      throw Error(`${label}.resultBinding must be one local identifier.`);
    }
    if (!Array.isArray(hook.identities)) throw Error(`${label}.identities must be an array.`);
    const identityIds = new Set(), bindings = new Set();
    const identities = hook.identities.map((identity, identityIndex) => {
      const identityLabel = `${label}.identities[${identityIndex}]`;
      exactKeys(identity, IDENTITY_KEYS, identityLabel);
      if (typeof identity.id !== 'string' || !identity.id.trim() || identityIds.has(identity.id.trim())) throw Error(`${identityLabel}.id must be unique and non-empty.`);
      if (typeof identity.binding !== 'string' || !BINDING.test(identity.binding) || bindings.has(identity.binding)) throw Error(`${identityLabel}.binding must be a unique identifier or property path.`);
      if (typeof identity.gatesRequest !== 'boolean' || typeof identity.resource !== 'boolean') throw Error(`${identityLabel} must explicitly declare gatesRequest and resource booleans.`);
      identityIds.add(identity.id.trim());
      bindings.add(identity.binding);
      return { id: identity.id.trim(), binding: identity.binding, gatesRequest: identity.gatesRequest, resource: identity.resource };
    });
    if (hook.kind === 'mutation' && !identities.some(identity => identity.resource)) throw Error(`${label} mutation must declare at least one resource identity.`);
    return { id: hook.id.trim(), path: source, export: hook.export, kind: hook.kind,
      ...(hook.resultBinding === undefined ? {} : { resultBinding: hook.resultBinding }), identities };
  });
  return { schema: value.schema, swr: { package: 'swr', major: value.swr.major }, hooks };
}

export function installedSWR(repository) {
  const require = createRequire(path.join(repository, 'package.json'));
  let manifest;
  try { manifest = require.resolve('swr/package.json'); } catch {
    let entry;
    try { entry = require.resolve('swr'); } catch { throw Error('Installed swr package is unavailable.'); }
    let current = path.dirname(entry);
    while (isInside(repository, current) && current !== repository) {
      const candidate = path.join(current, 'package.json');
      if (fs.existsSync(candidate)) { manifest = candidate; break; }
      current = path.dirname(current);
    }
  }
  if (!manifest) throw Error('Installed swr package.json is unavailable.');
  const actualManifest = canonical(manifest);
  const parsed = JSON.parse(fs.readFileSync(actualManifest, 'utf8'));
  const major = Number.parseInt(String(parsed.version ?? '').split('.')[0], 10);
  if (parsed.name !== 'swr' || !Number.isInteger(major)) throw Error('Installed swr package identity or version is invalid.');
  return { name: parsed.name, version: parsed.version, major, root: canonical(path.dirname(actualManifest)) };
}
