// deps.mjs - HFS_DEP_VERSION_SKEW (R14): one version per dependency in the workspace.
//   - the root and every workspace package.json declare a dependency at one spec (a `file:`, `link:` or `workspace:` spec is
//     a workspace link, not a version);
//   - a dependency the root `overrides` pins to a version (a string that is not a `$name` reference) is declared at that version everywhere
//     it is declared: an override the manifests disagree with is a second version in disguise;
//   - the lockfile (package-lock.json, read, never installed) holds no nested copy of a dependency the workspace declares:
//     `node_modules/<a>/node_modules/<name>` or `apps/<app>/node_modules/<name>` next to the hoisted `node_modules/<name>`. A
//     bundled copy (`inBundle`: it ships inside its parent's tarball, its bundleDependencies) is not one: no range, override or
//     dedupe of the workspace can move it, so it is the parent's, not a second copy the workspace keeps.
import { found, readJson } from './read.mjs';

const DEP_VERSION_SKEW = 'HFS_DEP_VERSION_SKEW';
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const LINK = /^(?:file|link|workspace|portal):/;
const NESTED = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/;
const HOISTED = /^node_modules\/((?:@[^/]+\/)?[^/]+)$/;

/** Every package.json a repository tracks: the root and each workspace's. */
const manifestsOf = (files) => files.filter((file) => file === 'package.json' || (file.endsWith('/package.json') && !file.includes('node_modules/')));

function recordDependencySpec(specs, file, name, spec) {
  if (typeof spec !== 'string' || LINK.test(spec)) return;
  if (!specs.has(name)) specs.set(name, new Map());
  const at = specs.get(name);
  if (!at.has(spec)) at.set(spec, []);
  at.get(spec).push(file);
}

function collectManifestSpecs(repoRoot, file, specs) {
  const pkg = readJson(repoRoot, file);
  if (!pkg) return;
  for (const section of SECTIONS) {
    for (const [name, spec] of Object.entries(pkg[section] ?? {})) recordDependencySpec(specs, file, name, spec);
  }
}

function versionSkewFindings(specs) {
  const findings = [];
  for (const [name, bySpec] of specs) {
    if (bySpec.size < 2) continue;
    const list = [...bySpec].map(([spec, where]) => `${spec} (${where.join(', ')})`);
    findings.push(found(DEP_VERSION_SKEW, [...bySpec.values()][0][0], `${name} is declared at ${bySpec.size} versions in the workspace: ${list.join('; ')}; keep one`, { dependency: name, versions: [...bySpec.keys()] }));
  }
  return findings;
}

function overrideFindings(specs, overrides) {
  const findings = [];
  for (const [name, pin] of Object.entries(overrides && typeof overrides === 'object' ? overrides : {})) {
    if (typeof pin !== 'string' || pin.startsWith('$') || !specs.has(name)) continue;
    const off = [...specs.get(name)].filter(([spec]) => spec !== pin);
    if (off.length) {
      const declarations = off.map(([spec, where]) => `${spec} (${where.join(', ')})`).join('; ');
      findings.push(found(DEP_VERSION_SKEW, off[0][1][0], `${name} is pinned to ${pin} by the root overrides but declared at ${declarations}; declare the pinned version`, { dependency: name, versions: off.map(([spec]) => spec), pinned: pin }));
    }
  }
  return findings;
}

/** The versions of the top-level (hoisted) packages of a lockfile, by package name. */
function hoistedVersions(packages) {
  const hoisted = new Map();
  for (const [key, entry] of Object.entries(packages)) {
    const top = HOISTED.exec(key);
    if (top && !entry.link) hoisted.set(top[1], entry.version);
  }
  return hoisted;
}

/** The finding for a lockfile entry that nests a second copy of a declared dependency, or null. */
function nestedCopyFinding(key, entry, declared, hoisted) {
  const nested = NESTED.exec(key);
  if (!nested || entry.link || entry.inBundle || HOISTED.test(key) || !declared.has(nested[1])) return null;
  const name = nested[1];
  const versionNote = entry.version ? ` ${entry.version}` : '';
  const hoistedNote = hoisted.has(name) ? ` next to the hoisted ${hoisted.get(name)}` : '';
  return found(DEP_VERSION_SKEW, 'package-lock.json', `${key} is a nested copy of ${name}${versionNote}${hoistedNote}; the workspace keeps one copy (align the ranges or add a root override)`, { dependency: name, lockPath: key, version: entry.version });
}

function nestedLockFindings(specs, lock) {
  if (!lock?.packages) return [];
  const declared = new Set(specs.keys());
  const hoisted = hoistedVersions(lock.packages);
  return Object.entries(lock.packages).map(([key, entry]) => nestedCopyFinding(key, entry, declared, hoisted)).filter(Boolean);
}

/** The findings of R14 over the tracked paths `files` of `repoRoot`. */
export function depFindings({ repoRoot, files }) {
  const specs = new Map();
  for (const file of manifestsOf(files)) collectManifestSpecs(repoRoot, file, specs);
  const findings = versionSkewFindings(specs);
  const overrides = readJson(repoRoot, 'package.json')?.overrides;
  findings.push(...overrideFindings(specs, overrides));
  const lock = files.includes('package-lock.json') ? readJson(repoRoot, 'package-lock.json') : null;
  findings.push(...nestedLockFindings(specs, lock));
  return findings;
}
