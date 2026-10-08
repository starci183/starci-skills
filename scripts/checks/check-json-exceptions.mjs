#!/usr/bin/env node
/**
 * Fail if any authored *.json under the skill root is outside the json-exceptions
 * section of modules/kernel/allowlist.yaml (the ONE allowlist of the runtime).
 * Inventory-only helper.
 *
 * The allowlist names exact files (`exceptions[]`) and exact directories (`directories[]`). A registered
 * directory admits the *.json files directly inside it, for an append-only record kept as one JSON file per
 * entry (benchmark/snapshots/<date>-<N>h.json): the next snapshot needs no new line. It is not a wildcard -
 * the path is exact, subdirectories stay in the inventory, and the directory must exist.
 *
 * Usage:
 *   starci runtime check --only json-exceptions
 *   starci runtime check --only json-exceptions -- --ignore-lockfiles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_STATE_DIR } from '../../engine/runtime-root.mjs';
import { ALLOWLIST_FILE, readAllowlistFile } from '../lib/allowlist.mjs';
import { isMain } from '../lib/is-main.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ignoreLockfiles = process.argv.includes('--ignore-lockfiles');

/** Directories never treated as authored skill JSON. */
const SKIP_DIR_NAMES = new Set([
  '.git',
  'dist',
  'storybook-static',
  'node_modules',
  '.next',
  // The turbo task cache an example's build writes (manifest and meta JSON per task); build output like .next, never authored.
  '.turbo',
  'out',
  '.venv',
  'worktrees',
  'coverage',
  // Scratch files (lint reports, perf baselines) under examples/; not authored source.
  'ex-testing',
  // Gitignored local credentials (ui/.secrets); never authored source and never committed.
  '.secrets',
]);

/**
 * Generated JSON that is runtime output, not authored declarative source: site build output
 * regenerated from source YAML.
 */
export const GENERATED = Object.freeze([
  'sites/skills/src/catalog.generated.json',
]);

const GENERATED_SET = new Set(GENERATED);

/**
 * A blob-store metadata sidecar: engine/db/blob.mjs writes `<sha256>.json` ({size, mediaType, createdAt}) beside each
 * content-addressed blob `artifacts/<sha[0:2]>/<sha256>`. The curated sample runtimes under examples/.runtimes track
 * their blobs, so the sidecars are tracked too; they are machine-written store records, not authored source.
 */
const BLOB_SIDECAR = /^examples\/\.runtimes\/[^/]+\/artifacts\/[0-9a-f]{2}\/[0-9a-f]{64}\.json$/;

/**
 * Local runtime preferences; gitignored; not skill-authored declarative source. The nested paths are the exact
 * project-scope files an agent launch writes into its worktree through scripts/agent/trust.mjs projectTargets
 * (.claude/settings.local.json and .devin/config.local.json — the third target, .codex/config.toml, is not JSON):
 * git-ignored local state wherever they land, wrongly blocked when scanned. A same-named file at any other path
 * stays authored.
 */
const LOCAL_ONLY = new Set(['config.json', 'settings.local.json', '.claude/settings.local.json', '.devin/config.local.json']);

/**
 * Runtime-owned storage at the skill root. These exact roots contain workflow state and sealed
 * runtime packets and the git-ignored host state directory (RUNTIME_STATE_DIR: blob sidecars, service records), not authored declarative source. A same-named directory nested anywhere else
 * remains part of the authored-source inventory.
 */
const RUNTIME_OWNED_ROOTS = new Set(['.starciwork', 'runtime', RUNTIME_STATE_DIR]);

/**
 * The skill-root spec tree: its synthetic checker fixtures (tests/fixtures) must not pollute the walk. Only this
 * exact root is skipped; a product or template `tests` directory (src/tests/tsconfig.json, a fake's payloads) is
 * authored source and stays in the inventory.
 */
const SPEC_ROOT = 'tests';

/**
 * Generated mirrors of runtime files that the published packages carry: scripts/hfs/sync-runtime.mjs writes each
 * tree byte for byte from the runtime (its BUNDLES) and `sync-runtime --check` fails on any missing, stale or extra file.
 * The authored originals stay in the inventory; only these exact skill-root paths are skipped, not a same-named tree elsewhere.
 */
export const GENERATED_MIRROR_ROOTS = Object.freeze([
  'packages/eslint/be/runtime',
  'packages/eslint/fe/runtime',
  'packages/hfs/runtime',
]);

const GENERATED_MIRROR_SET = new Set(GENERATED_MIRROR_ROOTS);

/** One allowlist entry's path: a non-empty relative skill path, forward slashes, no wildcard. */
function entryPath(entry, list) {
  if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) {
    throw new Error(`Each json-exceptions ${list} entry needs a non-empty path string`);
  }
  if (entry.path.includes('*') || entry.path.includes('?') || entry.path.includes('[')) {
    throw new Error(`Wildcards are not allowed in json-exceptions: ${entry.path}`);
  }
  if (path.isAbsolute(entry.path) || entry.path.split(/[/\\]/).includes('..')) {
    throw new Error(`json-exceptions path must be a relative skill path: ${entry.path}`);
  }
  const normalized = entry.path.replaceAll('\\', '/');
  if (normalized !== entry.path) {
    throw new Error(`json-exceptions path must use forward slashes: ${entry.path}`);
  }
  if (normalized.endsWith('/') || normalized.split('/').includes('.')) {
    throw new Error(`json-exceptions path must be exact, without a trailing slash or '.': ${entry.path}`);
  }
  if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
    throw new Error(`json-exceptions entry needs reason: ${entry.path}`);
  }
  return normalized;
}

function sortedUnique(paths, list) {
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  if (paths.some((p, i) => p !== sorted[i])) {
    throw new Error(`json-exceptions ${list} paths must be uniquely sorted (localeCompare)`);
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error(`json-exceptions ${list} paths must be unique`);
  }
  return Object.freeze(sorted);
}

function loadAllowlist(allowlistFile) {
  if (!fs.existsSync(allowlistFile)) {
    throw new Error(`JSON exceptions allowlist is required: ${path.relative(root, allowlistFile).replaceAll('\\', '/')}`);
  }
  const section = readAllowlistFile('json-exceptions', allowlistFile);
  if (!section || typeof section !== 'object' || !Array.isArray(section.exceptions)) {
    throw new Error(`${ALLOWLIST_FILE} json-exceptions must define exceptions[]`);
  }
  if (section.directories !== undefined && !Array.isArray(section.directories)) {
    throw new Error(`${ALLOWLIST_FILE} json-exceptions.directories must be a list when present`);
  }
  return {
    files: sortedUnique(section.exceptions.map(entry => entryPath(entry, 'exceptions')), 'exceptions'),
    directories: sortedUnique((section.directories ?? []).map(entry => entryPath(entry, 'directories')), 'directories'),
  };
}

function shouldSkipDir(relativePosix, name) {
  if (SKIP_DIR_NAMES.has(name)) return true;
  if (relativePosix === '' && (RUNTIME_OWNED_ROOTS.has(name) || name === SPEC_ROOT)) return true;
  if (GENERATED_MIRROR_SET.has(relativePosix ? `${relativePosix}/${name}` : name)) return true;
  if (relativePosix.startsWith('sites/') && (name === '.next' || name === 'out')) return true;
  return false;
}

/** The relative path of a regular .json file entry, or null when the entry is not one. */
const jsonFileRel = (entry, relativePosix) => {
  const name = entry.name;
  if (!entry.isFile() || entry.isSymbolicLink() || !name.endsWith('.json')) return null;
  return (relativePosix ? `${relativePosix}/${name}` : name).replaceAll('\\', '/');
};

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
    if (entry.isDirectory()) {
      if (shouldSkipDir(relativePosix, name)) continue;
      if (entry.isSymbolicLink()) continue;
      walkJsonFiles(path.join(dir, name), childRel, out);
      continue;
    }
    const rel = jsonFileRel(entry, relativePosix);
    if (rel) out.push(rel);
  }
}

/** The parent directory of a relative path ('' for a root file). */
const dirOf = rel => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');

/** Splits the walked .json files into offenders (unregistered) and generatedPresent. */
function partitionFound(found, ignoreLocks, allow, allowDirs) {
  const offenders = [];
  const generatedPresent = [];
  for (const rel of found) {
    if (LOCAL_ONLY.has(rel)) continue;
    if (ignoreLocks && /(^|\/)package-lock\.json$/.test(rel)) continue;
    if (BLOB_SIDECAR.test(rel)) continue;
    if (GENERATED_SET.has(rel)) {
      generatedPresent.push(rel);
      continue;
    }
    if (!allow.has(rel) && !allowDirs.has(dirOf(rel))) offenders.push(rel);
  }
  return { offenders, generatedPresent };
}

/** The allowlist paths and registered directories that are not on disk under `skillRoot`. */
function missingEntries(skillRoot, allowlist, directories, ignoreLocks) {
  const missing = [];
  for (const rel of allowlist) {
    if (ignoreLocks && /(^|\/)package-lock\.json$/.test(rel)) continue;
    if (!fs.existsSync(path.join(skillRoot, rel))) missing.push(rel);
  }
  for (const rel of directories) {
    const abs = path.join(skillRoot, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) missing.push(`${rel}/`);
  }
  return missing;
}

export function checkJsonExceptions({
  root: optionRoot,
  skillRoot: skillRootOption,
  allowlistFile,
  ignoreLockfiles: ignoreLocks = ignoreLockfiles,
} = {}) {
  const skillRoot = optionRoot ?? skillRootOption ?? root;
  const listFile = allowlistFile ?? path.join(skillRoot, ...ALLOWLIST_FILE.split('/'));
  const { files: allowlist, directories } = loadAllowlist(listFile);
  const found = [];
  walkJsonFiles(skillRoot, '', found);
  found.sort((a, b) => a.localeCompare(b));

  const { offenders, generatedPresent } = partitionFound(found, ignoreLocks, new Set(allowlist), new Set(directories));
  const missingAllowlist = missingEntries(skillRoot, allowlist, directories, ignoreLocks);

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
      `Authored JSON outside ${ALLOWLIST_FILE} (${result.offenders.length}):\n` +
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

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(String(error?.message || error) + '\n');
    process.exitCode = 1;
  }
}
