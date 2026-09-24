#!/usr/bin/env node
/**
 * Fail if any authored *.json under the skill root is outside
 * modules/schemas/json-exceptions.yaml. Inventory-only helper.
 *
 * The allowlist names exact files (`exceptions[]`) and exact directories (`directories[]`). A registered
 * directory admits the *.json files directly inside it, for an append-only record kept as one JSON file per
 * entry (benchmark/snapshots/<date>-<N>h.json): the next snapshot needs no new line. It is not a wildcard -
 * the path is exact, subdirectories stay in the inventory, and the directory must exist.
 *
 * Usage:
 *   node scripts/checks/check-json-exceptions.mjs
 *   node scripts/checks/check-json-exceptions.mjs --ignore-lockfiles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ignoreLockfiles = process.argv.includes('--ignore-lockfiles');

/** Directories never treated as authored skill JSON. */
const SKIP_DIR_NAMES = new Set([
  '.git',
  'dist',
  'storybook-static',
  'node_modules',
  '.next',
  'out',
  '.venv',
  'worktrees',
  'coverage',
  // Synthetic checker fixtures under tests/fixtures must not pollute the skill-root walk.
  'tests',
  // Fleet scratch (lint reports, perf baselines) under examples/; not authored source.
  'ex-testing',
]);

/**
 * Generated JSON that is runtime output, not authored declarative source: site build output
 * regenerated from source YAML.
 */
export const GENERATED = Object.freeze([
  'sites/skills/src/catalog.generated.json',
]);

const GENERATED_SET = new Set(GENERATED);

/** Local runtime preferences; gitignored; not skill-authored declarative source. */
const LOCAL_ONLY = new Set(['config.json', 'settings.local.json']);

/**
 * Runtime-owned storage at the skill root. These exact roots contain workflow state and sealed
 * runtime packets, not authored declarative source. A same-named directory nested anywhere else
 * remains part of the authored-source inventory.
 */
const RUNTIME_OWNED_ROOTS = new Set(['.starciwork', 'runtime']);

/** One allowlist entry's path: a non-empty relative skill path, forward slashes, no wildcard. */
function entryPath(entry, list) {
  if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) {
    throw Error(`Each json-exceptions ${list} entry needs a non-empty path string`);
  }
  if (entry.path.includes('*') || entry.path.includes('?') || entry.path.includes('[')) {
    throw Error(`Wildcards are not allowed in json-exceptions: ${entry.path}`);
  }
  if (path.isAbsolute(entry.path) || entry.path.split(/[/\\]/).includes('..')) {
    throw Error(`json-exceptions path must be a relative skill path: ${entry.path}`);
  }
  const normalized = entry.path.replaceAll('\\', '/');
  if (normalized !== entry.path) {
    throw Error(`json-exceptions path must use forward slashes: ${entry.path}`);
  }
  if (normalized.endsWith('/') || normalized.split('/').includes('.')) {
    throw Error(`json-exceptions path must be exact, without a trailing slash or '.': ${entry.path}`);
  }
  if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
    throw Error(`json-exceptions entry needs reason: ${entry.path}`);
  }
  return normalized;
}

function sortedUnique(paths, list) {
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  if (paths.some((p, i) => p !== sorted[i])) {
    throw Error(`json-exceptions ${list} paths must be uniquely sorted (localeCompare)`);
  }
  if (new Set(paths).size !== paths.length) {
    throw Error(`json-exceptions ${list} paths must be unique`);
  }
  return Object.freeze(sorted);
}

function loadAllowlist(allowlistFile) {
  if (!fs.existsSync(allowlistFile)) {
    throw Error(`JSON exceptions allowlist is required: ${path.relative(root, allowlistFile).replaceAll('\\', '/')}`);
  }
  const doc = parseYaml(fs.readFileSync(allowlistFile, 'utf8'));
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.exceptions)) {
    throw Error('modules/schemas/json-exceptions.yaml must define exceptions[]');
  }
  if (doc.directories !== undefined && !Array.isArray(doc.directories)) {
    throw Error('modules/schemas/json-exceptions.yaml directories must be a list when present');
  }
  return {
    files: sortedUnique(doc.exceptions.map(entry => entryPath(entry, 'exceptions')), 'exceptions'),
    directories: sortedUnique((doc.directories ?? []).map(entry => entryPath(entry, 'directories')), 'directories'),
  };
}

function shouldSkipDir(relativePosix, name) {
  if (SKIP_DIR_NAMES.has(name)) return true;
  if (relativePosix === '' && RUNTIME_OWNED_ROOTS.has(name)) return true;
  if (relativePosix.startsWith('sites/') && (name === '.next' || name === 'out')) return true;
  return false;
}

function walkJsonFiles(dir, relativePosix, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    const childRel = relativePosix ? `${relativePosix}/${name}` : name;
    const childAbs = path.join(dir, name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(relativePosix, name)) continue;
      if (entry.isSymbolicLink()) continue;
      walkJsonFiles(childAbs, childRel, out);
      continue;
    }
    if (!entry.isFile() || entry.isSymbolicLink()) continue;
    if (!name.endsWith('.json')) continue;
    out.push(childRel.replaceAll('\\', '/'));
  }
}

export function checkJsonExceptions({
  root: optionRoot,
  skillRoot: skillRootOption,
  allowlistFile,
  ignoreLockfiles: ignoreLocks = ignoreLockfiles,
} = {}) {
  const skillRoot = optionRoot ?? skillRootOption ?? root;
  const listFile = allowlistFile ?? path.join(skillRoot, 'modules', 'schemas', 'json-exceptions.yaml');
  const { files: allowlist, directories } = loadAllowlist(listFile);
  const allow = new Set(allowlist);
  const allowDirs = new Set(directories);
  const dirOf = rel => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
  const found = [];
  walkJsonFiles(skillRoot, '', found);
  found.sort((a, b) => a.localeCompare(b));

  const offenders = [];
  const generatedPresent = [];
  const missingAllowlist = [];
  for (const rel of found) {
    if (LOCAL_ONLY.has(rel)) continue;
    if (ignoreLocks && /(^|\/)package-lock\.json$/.test(rel)) continue;
    if (GENERATED_SET.has(rel)) {
      generatedPresent.push(rel);
      continue;
    }
    if (!allow.has(rel) && !allowDirs.has(dirOf(rel))) offenders.push(rel);
  }

  for (const rel of allowlist) {
    if (ignoreLocks && /(^|\/)package-lock\.json$/.test(rel)) continue;
    const abs = path.join(skillRoot, rel);
    if (!fs.existsSync(abs)) missingAllowlist.push(rel);
  }
  for (const rel of directories) {
    const abs = path.join(skillRoot, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) missingAllowlist.push(`${rel}/`);
  }

  return {
    ok: offenders.length === 0 && missingAllowlist.length === 0,
    offenders,
    missingAllowlist,
    generatedPresent,
    allowed: allowlist,
    allowedDirectories: directories,
  };
}

function main() {
  const result = checkJsonExceptions();
  if (result.missingAllowlist.length) {
    process.stderr.write(
      `Allowlist path missing on disk (${result.missingAllowlist.length}):\n` +
        result.missingAllowlist.map(p => `  ${p}`).join('\n') +
        '\n'
    );
  }
  if (result.offenders.length) {
    process.stderr.write(
      `Authored JSON outside modules/schemas/json-exceptions.yaml (${result.offenders.length}):\n` +
        result.offenders.map(p => `  ${p}`).join('\n') +
        '\n'
    );
  }
  if (!result.ok) {
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `OK: no authored JSON outside allowlist (${result.allowed.length} exceptions, ` +
      `${result.allowedDirectories.length} registered director${result.allowedDirectories.length === 1 ? 'y' : 'ies'}` +
      (ignoreLockfiles ? ', lockfiles ignored' : '') +
      `; ${result.generatedPresent.length} known generated path(s) skipped).\n`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(String(error?.message || error) + '\n');
    process.exitCode = 1;
  }
}
