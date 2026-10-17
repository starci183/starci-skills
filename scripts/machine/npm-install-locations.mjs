// npm-install-locations.mjs - plan canon moves from local package declarations only.
import fs from 'node:fs';
import path from 'node:path';

const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];

/** Read only package manifests; absent workspace manifests are not install locations. */
function readManifest(root, workspace = '') {
  try {
    return { workspace, manifest: JSON.parse(fs.readFileSync(path.join(root, workspace, 'package.json'), 'utf8')) };
  } catch (error) {
    if (workspace && error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Keep workspace expansion inside this tree and out of node_modules. */
function workspacePath(value) {
  if (typeof value !== 'string' || path.isAbsolute(value)) return null;
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.split('/').includes('node_modules')) return null;
  return normalized;
}

/** Expand literal paths and one trailing wildcard directory without traversing package contents. */
function expandWorkspace(root, pattern) {
  const workspace = workspacePath(pattern);
  if (!workspace) return [];
  if (!workspace.includes('*')) return [workspace];
  if (!workspace.endsWith('/*') || workspace.slice(0, -2).includes('*')) throw new Error(`unsupported workspace pattern: ${pattern}`);
  const parent = workspace.slice(0, -2);
  try {
    return fs.readdirSync(path.join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
      .map((entry) => `${parent}/${entry.name}`).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** Locations are the root plus each unique workspace declared by either npm workspace syntax. */
function installLocations(root) {
  const location = readManifest(root);
  const workspaces = location.manifest.workspaces;
  const patterns = Array.isArray(workspaces) ? workspaces : workspaces?.packages ?? [];
  const names = new Set(patterns.flatMap((pattern) => expandWorkspace(root, pattern)));
  names.delete('.');
  const locations = [...names].map((name) => readManifest(root, name)).filter(Boolean);
  return [location, ...locations];
}

/** Each non-CLI pin moves only in its existing section, once per location and section; undeclared pins are skipped. */
export function canonInstallPlan(root, family) {
  const locations = installLocations(root);
  const declared = new Set();
  const groups = [];
  for (const { workspace, manifest } of locations) {
    for (const section of SECTIONS) {
      const specs = family.filter(([name]) => name !== '@starci/cli' && Object.hasOwn(manifest[section] ?? {}, name))
        .map(([name, version]) => { declared.add(name); return `${name}@${version}`; });
      if (specs.length) groups.push({ specs, options: { dev: section === 'devDependencies', optional: section === 'optionalDependencies', workspace: workspace || undefined } });
    }
  }
  const skipped = family.filter(([name]) => name !== '@starci/cli' && !declared.has(name))
    .map(([name, version]) => ({ package: `${name}@${version}`, status: 'skipped', reason: 'not declared in this tree' }));
  return { groups, skipped };
}
