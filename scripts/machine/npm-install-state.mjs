// npm-install-state.mjs - whether one checkout's node_modules is a finished install of its current lockfile.
//
// `npm ci` deletes node_modules before it installs, so a run that stops half way (a native .node file held open by a running
// process, a killed install) leaves a tree that looks present and is missing packages. The runtime therefore trusts an install
// only through a marker written AFTER npm finished, inside node_modules: the marker goes with the tree when npm wipes it, and a
// tree without it is "incomplete", never "installed". The marker names the digest of package.json and package-lock.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const INSTALL_MARKER = '.starci-install.json';
const MARKER_SCHEMA = 'starci/npm-install-marker@1';

const markerFile = (cwd) => path.join(cwd, 'node_modules', INSTALL_MARKER);

/** The digest of the manifest and lockfile an install is made from, or null when either is missing. */
export function manifestDigest(cwd, read = fs.readFileSync) {
  try {
    const hash = crypto.createHash('sha256');
    for (const name of ['package.json', 'package-lock.json']) hash.update(name).update(read(path.join(cwd, name)));
    return hash.digest('hex');
  } catch { return null; }
}

/**
 * The state of the checkout's node_modules: `installed` (marker matches the current digest and npm's own completion file stands),
 * `stale` (a finished install of other manifests), `incomplete` (a tree with no marker: a half-finished install or one older than
 * the marker), `absent` (no node_modules), or `unknown` (no manifest to compare with). Pure over the filesystem seam.
 */
export function installStateOf(cwd, { exists = fs.existsSync, read = fs.readFileSync } = {}) {
  const digest = manifestDigest(cwd, read);
  if (!exists(path.join(cwd, 'node_modules'))) return { state: 'absent', digest };
  if (!digest) return { state: 'unknown', digest };
  let marker = null;
  try { marker = JSON.parse(String(read(markerFile(cwd)))); } catch { marker = null; }
  if (marker?.schema !== MARKER_SCHEMA) return { state: 'incomplete', digest };
  if (marker.digest !== digest) return { state: 'stale', digest, installedDigest: marker.digest ?? null };
  return exists(path.join(cwd, 'node_modules', '.package-lock.json')) ? { state: 'installed', digest, at: marker.at ?? null } : { state: 'incomplete', digest };
}

/** Record that npm finished installing the current manifests in `cwd`; false when the marker cannot be written. */
export function writeInstallMarker(cwd, { at = Date.now(), write = fs.writeFileSync, read = fs.readFileSync } = {}) {
  const digest = manifestDigest(cwd, read);
  if (!digest) return false;
  try { write(markerFile(cwd), JSON.stringify({ schema: MARKER_SCHEMA, digest, at })); return true; } catch { return false; }
}

/** Remove the marker before an install begins, so a run that stops half way never leaves a tree that reads as installed. */
export function clearInstallMarker(cwd, remove = fs.rmSync) {
  try { remove(markerFile(cwd), { force: true }); return true; } catch { return false; }
}

/** Whether a lockfile entry is installed only on some platforms or only as an optional dependency, so its absence from node_modules is no drift. */
const platformBound = (entry) => entry.optional === true || entry.os !== undefined || entry.cpu !== undefined;

/**
 * Why the root install of `root` is not the one its lockfile declares, or null: every package of package-lock.json that is not optional or platform-bound must be in node_modules/.package-lock.json at the same version.
 * Reads two files; no process is started.
 */
export function rootInstallProblem(root) {
  const read = (file) => { try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).packages ?? null; } catch { return null; } };
  const wanted = read('package-lock.json'), installed = read('node_modules/.package-lock.json');
  if (!wanted) return null;
  if (!installed) return 'node_modules holds no install record (node_modules/.package-lock.json)';
  const drift = Object.entries(wanted).filter(([key, entry]) => key !== '' && !entry.link && !platformBound(entry) && installed[key]?.version !== entry.version).map(([key]) => key.slice(key.lastIndexOf('node_modules/') + 13));
  return drift.length ? `${drift.length} package(s) of package-lock.json are missing or at another version in node_modules (${drift.slice(0, 5).join(', ')})` : null;
}

/** Whether node_modules holds the install the lockfile declares: the lockfile is readable and rootInstallProblem finds no drift. Two files read. */
export function lockfileInstallPresent(cwd, { read = fs.readFileSync } = {}) {
  try { JSON.parse(read(path.join(cwd, 'package-lock.json'), 'utf8')); } catch { return false; }
  return rootInstallProblem(cwd) === null;
}
