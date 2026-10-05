// type-impact.mjs - compiler project impact and byte-bound prerequisite stamps of the code gate.
import fs from 'node:fs';
import path from 'node:path';
import { sha256, sha256File } from '../../engine/digest.mjs';
import { pathKey, posixPath } from '../lib/path-key.mjs';
import { walkFiles, isInside } from '../lib/walk.mjs';

/** The existing gate's TypeScript input suffixes; JavaScript is not silently given a new checkJs contract. */
export const TS_SOURCE = /\.(?:[cm]?tsx?)$/;
const OUTPUT_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', '.turbo', '.starci', '.starciwork', '.starcistacks', '.artifacts']);
const excluded = (name) => OUTPUT_DIRS.has(name) || name.endsWith('.tsbuildinfo');
const regular = (file) => {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`type input is not a regular file: ${file}`);
  return stat;
};
const sourceFiles = (dir) => walkFiles(dir, { sorted: true, exclude: excluded }).sort();

/** Exact current file bytes, path membership and missing scopes; an M-to-M edit never retains a stamp. */
export function inputStamp(root, paths) {
  const top = path.resolve(root), rows = ['type-input-bytes-v1\0'];
  for (const scope of [...new Set(paths.map(posixPath))].sort()) {
    const at = path.resolve(top, scope);
    if (!isInside(top, at)) throw new Error(`type input scope is outside the app: ${scope}`);
    rows.push(`scope\0${scope}\0`);
    if (!fs.existsSync(at)) { rows.push('missing\0'); continue; }
    const stat = fs.lstatSync(at);
    if (stat.isSymbolicLink()) throw new Error(`type input scope is linked: ${scope}`);
    for (const file of stat.isDirectory() ? sourceFiles(at) : [at]) {
      const item = regular(file);
      rows.push(`file\0${posixPath(path.relative(top, file))}\0${item.size}\0${sha256File(file)}\0`);
    }
  }
  return sha256(rows.join(''));
}

/** Whether a workspace exposes built declarations or JavaScript beneath dist/. */
export const exposesDist = (manifest) => /(?:^|["/])dist\//.test(JSON.stringify([manifest?.exports ?? null, manifest?.main ?? null, manifest?.types ?? null, manifest?.module ?? null]));

/** Declared workspace directories; the gate builds only its existing dist-exposing workspace owners. */
export function workspaceDirs(root, manifest) {
  const globs = Array.isArray(manifest?.workspaces) ? manifest.workspaces : manifest?.workspaces?.packages ?? [];
  return globs.flatMap((glob) => {
    const clean = posixPath(glob).replace(/\/$/, '');
    if (!clean.endsWith('/*')) return fs.existsSync(path.join(root, clean, 'package.json')) ? [clean] : [];
    const parent = clean.slice(0, -2);
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, parent), { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    return entries.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, parent, entry.name, 'package.json'))).map((entry) => `${parent}/${entry.name}`);
  });
}

const manifestAt = (dir) => {
  const file = path.join(dir, 'package.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
};
const nearestProject = (root, file) => {
  for (let dir = path.dirname(path.resolve(root, file)); ; dir = path.dirname(dir)) {
    const config = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(config)) return posixPath(path.relative(root, config));
    if (pathKey(dir) === pathKey(root) || path.dirname(dir) === dir) return null;
  }
};
const sharedImpact = (file) => /(?:^|\/)(?:tsconfig[^/]*\.json|package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|turbo\.json|hfs\.json)$/.test(file) || file.startsWith('scripts/');

/**
 * Selected TypeScript keeps its nearest compiler owner. Configuration, install and codegen changes,
 * or a changed dist workspace, affect the actual discovered programs, including typed consumers.
 * Only selected existing TypeScript becomes a required program input; generated assets elsewhere
 * are not turned into source obligations. An unproved selected owner is an error, never a skip.
 */
export function typeImpact(root, files, { deleted = [] } = {}) {
  root = path.resolve(root);
  const projects = new Map(), errors = [], removed = new Set(deleted.map(posixPath));
  const selected = [...new Set(files.map(posixPath))];
  const add = (project, source = null) => {
    if (!projects.has(project)) projects.set(project, []);
    if (source !== null) projects.get(project).push(source);
  };
  let broad = selected.some(sharedImpact);
  const workspaces = workspaceDirs(root, manifestAt(root)).filter((dir) => exposesDist(manifestAt(path.join(root, dir))));
  for (const file of selected) {
    const at = path.resolve(root, file);
    if (!isInside(root, at)) { errors.push(`GATE_TSC_OWNER_UNPROVEN selected input is outside the app: ${file}`); continue; }
    if (!TS_SOURCE.test(file)) continue;
    const exists = fs.existsSync(at), project = nearestProject(root, file);
    if (!exists && !removed.has(file)) { errors.push(`GATE_TSC_SOURCE_MISSING selected TypeScript does not exist: ${file}`); continue; }
    if (!project && exists) { errors.push(`GATE_TSC_CONFIG_MISSING no tsconfig.json owns selected TypeScript ${file}`); continue; }
    if (project) add(project, exists ? file : null);
    if (workspaces.some((dir) => file.startsWith(`${dir}/`))) broad = true;
  }
  if (broad) {
    const inventory = sourceFiles(root);
    for (const config of inventory.filter((file) => path.basename(file) === 'tsconfig.json')) add(posixPath(path.relative(root, config)));
    for (const file of selected.filter((file) => /(?:^|\/)tsconfig\.json$/.test(file) && !fs.existsSync(path.join(root, file)))) {
      const dir = path.dirname(path.join(root, file));
      const stranded = fs.existsSync(dir) && sourceFiles(dir).filter((source) => TS_SOURCE.test(source)).some((source) => {
        const owner = nearestProject(root, posixPath(path.relative(root, source)));
        return !owner || !isInside(dir, path.dirname(path.join(root, owner)));
      });
      if (stranded) errors.push(`GATE_TSC_CONFIG_MISSING removed tsconfig.json still has TypeScript without a retained nested owner: ${file}`);
    }
    if (!projects.size && inventory.some((file) => TS_SOURCE.test(file))) errors.push('GATE_TSC_CONFIG_MISSING configuration/install impact has TypeScript inputs but no tsconfig.json program');
  }
  return { projects: [...projects.keys()].sort(), required: projects, errors };
}

/** Selected source must occur in the compiler's actual program, including an imported excluded root. */
export function requireTypeCoverage(root, project, required, sourceFilesOfProgram) {
  const measured = new Set(sourceFilesOfProgram.map((file) => pathKey(file.fileName)));
  const missing = required.filter((file) => !measured.has(pathKey(path.resolve(root, file))));
  if (missing.length) throw new Error(`GATE_TSC_FILE_EXCLUDED ${project} did not typecheck selected source: ${missing.join(', ')}`);
}
