// Content-addressed operational evidence. Blob bytes are immutable and never removed here.
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
