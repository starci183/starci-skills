#!/usr/bin/env node
/**
 * Fail if any authored *.json under the skill root is outside
 * schemas/json-exceptions.yaml. Inventory-only migration helper.
 *
 * Usage:
 *   node scripts/check-json-exceptions.mjs
 *   node scripts/check-json-exceptions.mjs --ignore-lockfiles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../core/yaml.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoreLockfiles = process.argv.includes('--ignore-lockfiles');

/** Directories never treated as authored skill JSON. */
const SKIP_DIR_NAMES = new Set([
  '.git',
  '.dist',
  'dist',
  'node_modules',
  '.next',
  'out',
  '.venv',
  'worktrees',
  'coverage',
  // Synthetic checker fixtures under tests/fixtures must not pollute the skill-root walk.
  'tests',
]);

/**
 * Generated JSON that currently may still sit outside `.dist`.
 * Not authored; excluded from the allowlist check until relocated to `.dist` only.
 */
export const GENERATED = Object.freeze([
  'docs/catalog.json',
  'ops/architecture.decide/authority.json',
  'ops/backend.implement/authority.json',
  'ops/basic-ops.json',
  'ops/business.decide/authority.json',
  'ops/catalog.json',
  'ops/consolidation.json',
  'ops/content.generate/authority.json',
  'ops/interface.draw/authority.json',
  'ops/interface.implement/authority.json',
  'ops/knowledge.repair/authority.json',
  'ops/release.deliver/authority.json',
  'ops/review.verify/authority.json',
  'ops/runtime.operate/authority.json',
  'ops/scope.retire/authority.json',
  'ops/task.execute/authority.json',
  'ops/uat.verify/authority.json',
  'ops/workspace.manage/authority.json',
  'sites/skills/src/catalog.generated.json',
]);

const GENERATED_SET = new Set(GENERATED);

/** Local runtime preferences; gitignored; not skill-authored declarative source. */
const LOCAL_ONLY = new Set(['config.json']);

function loadAllowlist(allowlistFile) {
  if (!fs.existsSync(allowlistFile)) {
    throw Error(`JSON exceptions allowlist is required: ${path.relative(root, allowlistFile).replaceAll('\\', '/')}`);
  }
  const doc = parseYaml(fs.readFileSync(allowlistFile, 'utf8'));
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.exceptions)) {
    throw Error('schemas/json-exceptions.yaml must define exceptions[]');
  }
  const paths = [];
  for (const entry of doc.exceptions) {
    if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) {
      throw Error('Each json-exceptions entry needs a non-empty path string');
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
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
      throw Error(`json-exceptions entry needs reason: ${entry.path}`);
    }
    paths.push(normalized);
  }
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  if (paths.some((p, i) => p !== sorted[i])) {
    throw Error('json-exceptions paths must be uniquely sorted (localeCompare)');
  }
  if (new Set(paths).size !== paths.length) {
    throw Error('json-exceptions paths must be unique');
  }
  return Object.freeze(sorted);
}

function shouldSkipDir(relativePosix, name) {
  if (SKIP_DIR_NAMES.has(name)) return true;
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
  const listFile = allowlistFile ?? path.join(skillRoot, 'schemas', 'json-exceptions.yaml');
  const allowlist = loadAllowlist(listFile);
  const allow = new Set(allowlist);
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
    if (!allow.has(rel)) offenders.push(rel);
  }

  for (const rel of allowlist) {
    if (ignoreLocks && /(^|\/)package-lock\.json$/.test(rel)) continue;
    const abs = path.join(skillRoot, rel);
    if (!fs.existsSync(abs)) missingAllowlist.push(rel);
  }

  return {
    ok: offenders.length === 0 && missingAllowlist.length === 0,
    offenders,
    missingAllowlist,
    generatedPresent,
    allowed: allowlist,
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
      `Authored JSON outside schemas/json-exceptions.yaml (${result.offenders.length}):\n` +
        result.offenders.map(p => `  ${p}`).join('\n') +
        '\n'
    );
  }
  if (!result.ok) {
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `OK: no authored JSON outside allowlist (${result.allowed.length} exceptions` +
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
