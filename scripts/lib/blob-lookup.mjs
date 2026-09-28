// blob-lookup.mjs — read agent output back out of the blob store (alpha.3, ARCHITECTURE-DB §5.3). A Work record and the
// draw subsystem cite agent output by {artifact?, sha256}; this is the one place that turns such a citation back into
// bytes, a readable file with an extension, or a directory.
//   resolveBlob(ref, {db})   ref = {artifact?, sha256?} | 'blob:<sha>' | '<sha>' → {sha256, file} | null (an artifact id
//                            alone resolves through the ledger's job_artifacts)
//   readBlobRef(ref)         the verified bytes
//   blobAsFile(ref, {ext})   a read-only copy with an extension beside the store (<artifact root>-views; tools that key on the
//                            extension: an image decoder, a browser), cached by sha
//   putBundle(dir)           every file under `dir` put as a blob + a starci/blob-bundle@1 manifest {files: {rel: sha}}
//                            put as a blob; returns the manifest sha (a draw loop: loop.json and every round)
//   bundleDir(sha)           the bundle materialized as a directory under <artifact root>-views (cached by sha), or null
// Blobs are immutable, so every cache is keyed by sha and never invalidated.
import fs from 'node:fs';
import path from 'node:path';
import { putBlob, blobPath, getBlob, artifactRoot } from './artifact-store.mjs';

export const BUNDLE_SCHEMA = 'starci/blob-bundle@1';
const SHA = /^[a-f0-9]{64}$/;
// Read-only views (files with an extension, materialized bundles) live beside the store, e.g. ~/.starci/artifacts-views.
const viewRoot = () => `${artifactRoot()}-views`;
const slash = (p) => String(p).replace(/\\/g, '/');

/** The sha256 a citation names: {sha256}, 'blob:<sha>' or a bare sha; an {artifact} alone needs `db`. */
export function shaOfRef(ref, { db = null } = {}) {
  if (typeof ref === 'string') { const s = ref.trim().replace(/^blob:/, ''); return SHA.test(s) ? s : null; }
  if (!ref || typeof ref !== 'object') return null;
  if (typeof ref.sha256 === 'string' && SHA.test(ref.sha256)) return ref.sha256;
  if (ref.artifact != null && db) return db.prepare('SELECT sha256 FROM job_artifacts WHERE artifact_id=?').get(Number(ref.artifact))?.sha256 ?? null;
  return null;
}

/** {sha256, file} of a citation whose bytes are in the local store, else null. */
export function resolveBlob(ref, { db = null } = {}) {
  const sha = shaOfRef(ref, { db });
  const file = sha ? blobPath(sha) : null;
  return file ? { sha256: sha, file } : null;
}

/** The verified bytes of a citation (throws when the blob is missing or corrupt). */
export function readBlobRef(ref, { db = null } = {}) {
  const sha = shaOfRef(ref, { db });
  if (!sha) throw Object.assign(new Error('not a blob citation'), { code: 'BLOB_REF_INVALID' });
  return getBlob(sha);
}

/** A read-only copy of the blob with `ext` (e.g. '.png'), cached beside the store; null when missing. */
export function blobAsFile(ref, { ext = '', db = null } = {}) {
  const hit = resolveBlob(ref, { db });
  if (!hit) return null;
  const file = path.join(viewRoot(), 'files', `${hit.sha256}${ext}`);
  if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.copyFileSync(hit.file, file); }
  return file;
}

const filesUnder = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) filesUnder(full, out); else if (e.isFile()) out.push(full);
  }
  return out;
};

/** Put every file under `dir` and its manifest in the blob store; returns the manifest sha. */
export function putBundle(dir, { mediaTypeOf = () => 'application/octet-stream' } = {}) {
  const files = {};
  for (const abs of filesUnder(dir)) files[slash(path.relative(dir, abs))] = putBlob(abs, { mediaType: mediaTypeOf(abs) }).sha;
  return putBlob(Buffer.from(JSON.stringify({ schema: BUNDLE_SCHEMA, files }, null, 2)), { mediaType: 'application/json' }).sha;
}

/** The manifest of a bundle: {schema, files: {rel: sha}} or null. */
export function bundleManifest(ref, { db = null } = {}) {
  const hit = resolveBlob(ref, { db });
  if (!hit) return null;
  try { const doc = JSON.parse(fs.readFileSync(hit.file, 'utf8')); return doc?.schema === BUNDLE_SCHEMA ? doc : null; } catch { return null; }
}

/** The bundle as a directory beside the store (cached by sha), or null when it or one file is missing. */
export function bundleDir(ref, { db = null } = {}) {
  const sha = shaOfRef(ref, { db });
  const manifest = sha ? bundleManifest(sha) : null;
  if (!manifest) return null;
  const dir = path.join(viewRoot(), 'bundles', sha);
  const done = path.join(dir, '.complete');
  if (fs.existsSync(done)) return dir;
  for (const [rel, fileSha] of Object.entries(manifest.files ?? {})) {
    const from = blobPath(fileSha);
    if (!from || rel.split('/').includes('..')) return null;
    const to = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(done, '');
  return dir;
}
