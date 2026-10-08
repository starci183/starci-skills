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
