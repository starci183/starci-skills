// blob.mjs — the content-addressed blob store (operational evidence and agent output) beside the two SQLite stores:
// putBlob/getBlob/statBlob/putJson write and read it; blob bytes are immutable and never removed here.
//
// Reading agent output back out of the blob store (alpha.3, ARCHITECTURE-DB §5.3). A Work record and the
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
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const ARTIFACT_ROOT_ENV = 'STARCI_ARTIFACT_ROOT';
export const artifactRoot = (env = process.env) => path.resolve(env[ARTIFACT_ROOT_ENV] || path.join(os.homedir(), '.starci', 'artifacts'));
const SHA = /^[a-f0-9]{64}$/;
const assertSha = sha => {
  if (typeof sha !== 'string' || !SHA.test(sha)) throw new TypeError('blob sha must be a lowercase sha256 hex digest');
  return sha;
};
const location = sha => path.join(artifactRoot(), assertSha(sha).slice(0, 2), sha);
const metadataPath = sha => `${location(sha)}.json`;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Reject roots inside a checkout, including worktrees whose .git is a file.
function ensureExternalRoot(root) {
  let cursor = root;
  while (true) {
    if (fs.existsSync(path.join(cursor, '.git'))) throw new Error(`artifact root is inside a git checkout: ${root}`);
    const parent = path.dirname(cursor);
    if (parent === cursor) return;
    cursor = parent;
  }
}

function sourceBytes(bufferOrPath) {
  if (Buffer.isBuffer(bufferOrPath)) return bufferOrPath;
  if (bufferOrPath instanceof Uint8Array) return Buffer.from(bufferOrPath);
  if (typeof bufferOrPath === 'string') return fs.readFileSync(bufferOrPath);
  throw new TypeError('putBlob expects a Buffer, Uint8Array, or file path');
}

function publishOnce(destination, bytes) {
  const dir = path.dirname(destination);
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(destination)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, bytes, { flag: 'wx' });
    try { fs.linkSync(temp, destination); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  } finally { try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}

/** Store original bytes under their sha256. A concurrent or repeated put never replaces published bytes. */
export function putBlob(bufferOrPath, { mediaType = 'application/octet-stream' } = {}) {
  if (typeof mediaType !== 'string' || !mediaType.trim()) throw new TypeError('mediaType must be a nonempty string');
  const root = artifactRoot();
  ensureExternalRoot(root);
  const bytes = sourceBytes(bufferOrPath);
  const sha = digest(bytes);
  const destination = location(sha);
  const metadata = { size: bytes.length, mediaType, createdAt: new Date().toISOString() };
  // Metadata is published first so a visible blob always has a sidecar. A crash can leave an orphan sidecar;
  // the next put completes it. The first published media type and creation time win.
  publishOnce(metadataPath(sha), Buffer.from(JSON.stringify(metadata)));
  publishOnce(destination, bytes);
  const stored = fs.statSync(destination);
  if (stored.size !== bytes.length) throw new Error(`blob size mismatch: ${sha}`);
  const info = statBlob(sha);
  return { sha, size: info.size, mediaType: info.mediaType };
}

export function blobPath(sha) {
  const file = location(sha);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

export const hasBlob = sha => blobPath(sha) !== null;

export function getBlob(sha) {
  const file = blobPath(sha);
  if (!file) throw Object.assign(new Error(`blob not found: ${sha}`), { code: 'ENOENT' });
  const bytes = fs.readFileSync(file);
  if (digest(bytes) !== sha) throw new Error(`blob hash mismatch: ${sha}`);
  return bytes;
}

export function statBlob(sha) {
  const file = blobPath(sha);
  if (!file) return null;
  const { size } = fs.statSync(file);
  const metadata = JSON.parse(fs.readFileSync(metadataPath(sha), 'utf8'));
  if (metadata.size !== size) throw new Error(`blob sidecar size mismatch: ${sha}`);
  return { sha, size, mediaType: metadata.mediaType, createdAt: metadata.createdAt };
}

function canonical(value) {
  if (value && typeof value === 'object') {
    if (typeof value.toJSON === 'function') return canonical(value.toJSON());
    if (Array.isArray(value)) return value.map(item => item === undefined ? null : canonical(item));
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function putJson(obj) {
  const encoded = JSON.stringify(canonical(obj));
  if (encoded === undefined) throw new TypeError('putJson expects a JSON value');
  return putBlob(Buffer.from(encoded), { mediaType: 'application/json' }).sha;
}

/* ------------------------------------------------------------ citations, views and bundles */

export const BUNDLE_SCHEMA = 'starci/blob-bundle@1';
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

/**
 * The readable file of one record asset: a product asset kept in the tree ({path}, a ui direction the owner accepted,
 * decision Q2) resolves against the record's directory; agent output ({artifact?, sha256, name}) resolves in the blob
 * store as a copy carrying the extension of its artifact name. Null when neither is readable.
 */
export function assetFileOf(recordDir, asset, { db = null } = {}) {
  if (!asset || typeof asset !== 'object') return null;
  if (typeof asset.path === 'string' && asset.path) { const file = path.resolve(recordDir, asset.path); return fs.existsSync(file) ? file : null; }
  return blobAsFile(asset, { ext: path.extname(String(asset.name ?? '')).toLowerCase(), db });
}
