#!/usr/bin/env node
/**
 * Fail if any authored *.json under the skill root is not of a declared format (scripts/lib/json-formats.mjs): a JSON file is admitted
 * because a tool requires that format (npm, tsc, turbo, next-intl, Claude Code, the stack tooling) or because it is managed canon
 * (a template a managed slot of the slot manifest names, or its render), never because a path was listed. Authored config is YAML.
 * Inventory-only helper.
 *
 * Usage:
 *   starci runtime check --only json-exceptions
 *   starci runtime check --only json-exceptions -- --ignore-lockfiles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_STATE_DIR } from '../../engine/runtime-root.mjs';
import { JSON_FORMATS, jsonFormatOf } from '../lib/json-formats.mjs';
import { isMain } from '../lib/is-main.mjs';
import { declaredTemplateNames, isManagedRender, managedTemplatesOf } from '../lib/managed-json.mjs';
import { loadSlotManifest } from '../hfs/slots.mjs';

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
  // Turbo's task cache of an example app (examples/<app>/.turbo/cache): build output, git-ignored by the app's own managed .gitignore.
  '.turbo',
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
 * Disposable scratch trees a spec makes at the skill root while it runs (the git-ignored `.gitignore` entries of the same names): a
 * scaffolded app built inside the checkout so its links resolve. A spec running beside the gate that scans the root would otherwise
 * find the scratch app's package.json and refuse a clean tree. Only these exact root prefixes are skipped.
 */
const SPEC_SCRATCH_PREFIXES = Object.freeze(['.starci-wk-spec-', '.tmp-hfs-fe-build-']);

/**
 * Generated mirrors of runtime files that the published packages carry: scripts/hfs/sync-runtime.mjs writes each
 * tree byte for byte from the runtime (its BUNDLES) and `sync-runtime --check` fails on any missing, stale or extra file.
 * The authored originals stay in the inventory; only these exact skill-root paths are skipped, not a same-named tree elsewhere.
 */
const GENERATED_MIRROR_ROOTS = Object.freeze([
  'packages/eslint/be/runtime',
  'packages/eslint/fe/runtime',
  'packages/hfs/runtime',
]);

const GENERATED_MIRROR_SET = new Set(GENERATED_MIRROR_ROOTS);

function shouldSkipDir(relativePosix, name) {
  if (SKIP_DIR_NAMES.has(name)) return true;
  if (relativePosix === '' && (RUNTIME_OWNED_ROOTS.has(name) || SPEC_SCRATCH_PREFIXES.some((prefix) => name.startsWith(prefix)))) return true;
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

/** Where @starci/hfs keeps the templates `starci app sync` renders managed files from. */
const HFS_TEMPLATES = path.join('packages', 'hfs', 'templates');

/**
 * A reader of whether a JSON file is managed canon: a template a managed slot of the slot manifest names, or an example app's render of one (scripts/lib/managed-json.mjs): canon output that
 * `starci app sync` writes and HFS_MANAGED_FILE_DRIFT keeps equal to its template, not authored JSON. Only a file of an app (a folder
 * of examples/ with its hfs.json) is judged; any byte of difference from the template keeps it in the inventory.
 */
function managedRenderReader(skillRoot) {
  let manifest;
  let templateNames;
  const templatesPrefix = `${HFS_TEMPLATES.split(path.sep).join('/')}/`;
  return (rel) => {
    // A template a managed slot of the slot manifest names is that slot's canon source, declared there and nowhere else.
    if (rel.startsWith(templatesPrefix)) {
      manifest ??= loadSlotManifest({ root: skillRoot });
      templateNames ??= declaredTemplateNames(manifest);
      return templateNames.has(rel.slice(templatesPrefix.length));
    }
    const [top, app, ...rest] = rel.split('/');
    if (top !== 'examples' || !app || !rest.length || !fs.existsSync(path.join(skillRoot, top, app, 'hfs.json'))) return false;
    manifest ??= loadSlotManifest({ root: skillRoot });
    const templates = managedTemplatesOf(manifest, rest.join('/'))
      .map((name) => path.join(skillRoot, HFS_TEMPLATES, ...name.split('/')))
      .filter((file) => fs.existsSync(file))
      .map((file) => ({ text: fs.readFileSync(file, 'utf8') }));
    return templates.length > 0 && isManagedRender(fs.readFileSync(path.join(skillRoot, rel), 'utf8'), templates);
  };
}

/** Splits the walked .json files into offenders (unregistered) and generatedPresent. */
function partitionFound(found, ignoreLocks, isManaged = () => false) {
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
    if (!jsonFormatOf(rel) && !isManaged(rel)) offenders.push(rel);
  }
  return { offenders, generatedPresent };
}

function checkJsonExceptions({ root: optionRoot, skillRoot: skillRootOption, ignoreLockfiles: ignoreLocks = ignoreLockfiles } = {}) {
  const skillRoot = optionRoot ?? skillRootOption ?? root;
  const found = [];
  walkJsonFiles(skillRoot, '', found);
  found.sort((a, b) => a.localeCompare(b));
  const { offenders, generatedPresent } = partitionFound(found, ignoreLocks, managedRenderReader(skillRoot));
  return { ok: offenders.length === 0, offenders, generatedPresent };
}

const JSON_FORMATS_COUNT = JSON_FORMATS.length;

function main() {
  const result = checkJsonExceptions();
  if (result.offenders.length) {
    process.stderr.write(
      `Authored JSON of no declared format (${result.offenders.length}); author it as YAML or declare the tool-required format in scripts/lib/json-formats.mjs:\n` +
        result.offenders.map(p => `  ${p}`).join('\n') +
        '\n'
    );
  }
  if (!result.ok) {
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `OK: every JSON file is of a declared format or managed canon (${JSON_FORMATS_COUNT} formats; ${result.generatedPresent.length} known generated path(s) skipped${ignoreLockfiles ? ', lockfiles ignored' : ''}).\n`
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
