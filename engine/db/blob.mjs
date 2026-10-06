// blob.mjs — the content-addressed blob store (operational evidence and agent output) beside the two SQLite stores:
// putBlob/getBlob/statBlob/putJson write and read it; blob bytes are immutable and never removed here.
//
// Reading agent output back out of the blob store. A Work record and the
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
// Each materialized view is verified against its cited digest before reuse.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { starciLocalRoot, runtimeStateDir } from '../runtime-root.mjs';
import { isSpecRun } from '../../scripts/lib/env.mjs';
import { canonicalPath, insidePath, pathKey } from '../../scripts/lib/path-key.mjs';
import { byCodeUnit } from '../by-code-unit.mjs';

export const ARTIFACT_ROOT_ENV = 'STARCI_ARTIFACT_ROOT';
/**
 * The blob store: ARTIFACT_ROOT_ENV, else <starciLocalRoot>/artifacts (<runtime root>/.runtime/artifacts on a host). Inside a node --test
 * process tree a default outside the OS temp directory is replaced by a temp one, so a bare spec never writes into the checkout.
 */
export const artifactRoot = (env = process.env) => {
  if (env[ARTIFACT_ROOT_ENV]) return path.resolve(env[ARTIFACT_ROOT_ENV]);
  const root = path.resolve(path.join(starciLocalRoot(env), 'artifacts'));
  return isSpecRun(env) && !insidePath(os.tmpdir(), root, { key: pathKey }) ? path.join(os.tmpdir(), 'starci-test-artifacts') : root;
};
const SHA = /^[a-f0-9]{64}$/;
const assertSha = sha => {
  if (typeof sha !== 'string' || !SHA.test(sha)) throw new TypeError('blob sha must be a lowercase sha256 hex digest');
  return sha;
};
// An explicit root scopes READs only; writers continue to use the default external root.
const location = (sha, root = null, suffix = '') => {
  if (root !== null && (typeof root !== 'string' || !root || !path.isAbsolute(root)))
    throw new TypeError('blob read root must be an absolute path');
  const file = path.join(root === null ? artifactRoot() : path.resolve(root), assertSha(sha).slice(0, 2), `${sha}${suffix}`);
  if (root !== null) {
    regularParents(file, { strict: true, base: root });
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink()
      || fs.realpathSync.native(file) !== path.join(fs.realpathSync.native(path.dirname(file)), path.basename(file))
      || !fs.readdirSync(path.dirname(file)).includes(path.basename(file))))
      throw new Error(`blob read path is not a contained regular file: ${file}`);
  }
  return file;
};
const metadataPath = (sha, root = null) => location(sha, root, '.json');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// The last matching rule of a file wins, a negation un-ignores, and .gitignore outranks .git/info/exclude (git's own precedence).
const ignoreVerdict = (file, forms) => {
  let verdict = null;
  try {
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const negated = line.startsWith('!');
      if (forms.has(negated ? line.slice(1) : line)) verdict = !negated;
    }
  } catch { /* absent or unreadable: no rule */ }
  return verdict;
};
// The state dir relative to the checkout that actually holds it (<top>/.runtime on the source, <app>/.claude/.runtime in an app repo).
const stateIgnored = (top, stateDir) => {
  const rel = path.relative(top, stateDir).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return false;
  const forms = new Set([rel, `${rel}/`, `/${rel}`, `/${rel}/`]);
  return (ignoreVerdict(path.join(top, '.gitignore'), forms) ?? ignoreVerdict(path.join(top, '.git', 'info', 'exclude'), forms)) === true;
};
// A writer root is outside every checkout (including worktrees whose .git is a file), or it is under this runtime's own
// .runtime directory AND that directory is listed in the checkout's .gitignore (or .git/info/exclude), so a blob store can
// never be committed. Fail closed: a root under any other path in a checkout, or a .runtime nobody ignores, refuses.
export function ensureExternalRoot(root, stateDirectory = runtimeStateDir()) {
  const real = canonicalPath(root), stateDir = canonicalPath(stateDirectory); // canonical on both sides: a link into a checkout cannot hide it
  let cursor = real;
  while (true) {
    if (fs.existsSync(path.join(cursor, '.git'))) {
      if (!insidePath(stateDir, real, { key: pathKey, includeSelf: true })) throw new Error(`artifact root is inside a git checkout: ${root}`);
      if (!stateIgnored(cursor, stateDir)) throw new Error(`artifact root is inside a git checkout and not git-ignored: ${root}`);
      return;
    }
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
  let owned=false;
  try {
    const fd=fs.openSync(temp,'wx');
    owned=true;
    try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    try { fs.linkSync(temp, destination); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  } finally { if(owned)fs.rmSync(temp,{force:true}); }
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
  // Reuse must verify bytes, including a corrupt same-size destination.
  getBlob(sha);
  const info = statBlob(sha);
  // Flush reused files too. Directory/link persistence remains platform-specific;
  // this local profile does not promise power-loss recovery of acknowledged refs.
  for(const file of [destination,metadataPath(sha)]){const fd=fs.openSync(file,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
  return { sha, size: info.size, mediaType: info.mediaType };
}

export function blobPath(sha, { root = null } = {}) {
  const file = location(sha, root);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

export function getBlob(sha, { root = null, verifyBundle = false } = {}) {
  const file = blobPath(sha, { root });
  if (!file) throw Object.assign(new Error(`blob not found: ${sha}`), { code: 'ENOENT' });
  const bytes = fs.readFileSync(file);
  if (digest(bytes) !== sha) throw new Error(`blob hash mismatch: ${sha}`);
  if (root !== null) statBlob(sha, { root });
  if (verifyBundle) {
    let manifest;
    try { manifest = JSON.parse(bytes.toString('utf8')); } catch { /* ordinary blobs need not be JSON */ }
    if (typeof manifest?.schema === 'string' && manifest.schema.startsWith('starci/blob-bundle@')
      && !bundleDir(sha, { root }))
      throw Object.assign(new Error(`blob bundle cannot be verified: ${sha}`), { code: 'EINVALBUNDLE' });
  }
  return bytes;
}

export function statBlob(sha, { root = null } = {}) {
  const file = blobPath(sha, { root });
  if (!file) return null;
  const { size } = fs.statSync(file);
  const metadata = JSON.parse(fs.readFileSync(metadataPath(sha, root), 'utf8'));
  if (metadata.size !== size) throw new Error(`blob sidecar size mismatch: ${sha}`);
  if(typeof metadata.mediaType!=='string'||!metadata.mediaType.trim()||!Number.isFinite(Date.parse(metadata.createdAt)))throw Error(`blob sidecar metadata invalid: ${sha}`);
  return { sha, size, mediaType: metadata.mediaType, createdAt: metadata.createdAt };
}

function canonical(value) {
  if (value && typeof value === 'object') {
    if (typeof value.toJSON === 'function') return canonical(value.toJSON());
    if (Array.isArray(value)) return value.map(item => item === undefined ? null : canonical(item));
    return Object.fromEntries(Object.keys(value).sort(byCodeUnit).filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  }
  return value;
}

/* ------------------------------------------------------------ citations, views and bundles */

const BUNDLE_SCHEMA = 'starci/blob-bundle@1';
// Read-only views (files with an extension, materialized bundles) live beside the store, e.g. <runtime root>/.runtime/artifacts-views.
const viewRoot = (root = null) => `${root === null ? artifactRoot() : path.resolve(root)}-views`;
const slash = (p) => String(p).replace(/\\/g, '/');

/** The sha256 a citation names: {sha256}, 'blob:<sha>' or a bare sha; an {artifact} alone needs `db`. */
function shaOfRef(ref, { db = null } = {}) {
  if (typeof ref === 'string') { const s = ref.trim().replace(/^blob:/, ''); return SHA.test(s) ? s : null; }
  if (!ref || typeof ref !== 'object') return null;
  if (typeof ref.sha256 === 'string' && SHA.test(ref.sha256)) return ref.sha256;
  if (ref.artifact != null && db) return db.prepare('SELECT sha256 FROM job_artifacts WHERE artifact_id=?').get(Number(ref.artifact))?.sha256 ?? null;
  return null;
}

/** {sha256, file} of a citation whose bytes are in the local store, else null. */
export function resolveBlob(ref, { db = null, root = null } = {}) {
  const sha = shaOfRef(ref, { db });
  const file = sha ? blobPath(sha, { root }) : null;
  return file ? { sha256: sha, file } : null;
}

/** A read-only copy of the blob with `ext` (e.g. '.png'), cached beside the store; null when missing. */
export function blobAsFile(ref, { ext = '', db = null, root = null } = {}) {
  const hit = resolveBlob(ref, { db, root });
  if (!hit) return null;
  if (typeof ext !== 'string' || (ext !== '' && !/^\.[a-z0-9]{1,16}$/i.test(ext))) throw new TypeError('blob view extension must be a simple suffix');
  const bytes = getBlob(hit.sha256, { root });
  const file = path.join(viewRoot(root), 'files', `${hit.sha256}${ext}`);
  regularParents(file, { strict: root !== null, base: path.dirname(viewRoot(root)) });
  publishOnce(file, bytes);
  if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink() || digest(fs.readFileSync(file)) !== hit.sha256)
    throw new Error(`blob view hash mismatch: ${hit.sha256}`);
  if (root !== null && (fs.realpathSync.native(file) !== path.join(fs.realpathSync.native(path.dirname(file)), path.basename(file))
    || !fs.readdirSync(path.dirname(file)).includes(path.basename(file))))
    throw new Error(`blob view path is linked or has a different spelling: ${file}`);
  return file;
}

// The trusted base (the read root, or the directory holding the store and its views) is canonicalised once; only directories BELOW it must be regular and exactly spelled.
function regularParents(file, { strict = false, base }) {
  const top = path.resolve(base), levels = []; let real = null;
  for (let at = path.dirname(path.resolve(file)); at !== top; at = path.dirname(at)) {
    if (!insidePath(top, at)) throw new Error(`blob path is outside its trusted root: ${file}`); else levels.unshift(at);
  }
  for (const cursor of levels) {
    const stat = fs.lstatSync(cursor, { throwIfNoEntry: false }), name = path.basename(cursor);
    if (!stat) return;
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`blob view parent is not a regular directory: ${cursor}`);
    if (!strict) continue;
    real = path.join(real ?? fs.realpathSync.native(top), name);
    if (fs.realpathSync.native(cursor) !== real || !fs.readdirSync(path.dirname(cursor)).includes(name))
      throw new Error(`blob read parent is linked or has a different spelling: ${cursor}`);
  }
}

function bundleEntries(manifest) {
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw new TypeError('blob bundle files must be a mapping');
  const entries = Object.entries(manifest.files);
  const names = new Set();
  for (const [rel, sha] of entries) {
    const parts = rel.split('/');
    if (!rel || rel.includes('\\') || path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel)
      || parts.some(part => !part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part)
        || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) || parts[0] === '.complete')
      throw new TypeError(`unsafe blob bundle path: ${rel}`);
    assertSha(sha);
    const key = rel.toLowerCase();
    if (names.has(key)) throw new TypeError(`blob bundle path collision: ${rel}`);
    names.add(key);
  }
  for (const name of names) {
    const parts = name.split('/');
    for (let index = 1; index < parts.length; index += 1) if (names.has(parts.slice(0, index).join('/')))
      throw new TypeError(`blob bundle file is also a directory: ${name}`);
  }
  return entries;
}

function verifiedBundle(dir, entries, opts) {
  const { strict } = opts; regularParents(path.join(dir, '.complete'), opts);
  if (!fs.existsSync(dir)) return false;
  const expected = new Map(entries);
  const seen = new Set();
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      const rel = slash(path.relative(dir, file));
      if (entry.isSymbolicLink()) throw new Error(`blob bundle view contains a link: ${rel}`);
      if (strict && fs.realpathSync.native(file) !== path.join(fs.realpathSync.native(current), entry.name))
        throw new Error(`blob bundle view contains a redirected path: ${rel}`);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.isFile()) throw new Error(`blob bundle view contains a special file: ${rel}`);
      if (rel === '.complete') continue;
      if (!expected.has(rel) || digest(fs.readFileSync(file)) !== expected.get(rel)) throw new Error(`blob bundle view hash mismatch: ${rel}`);
      seen.add(rel);
    }
  };
  walk(dir);
  return seen.size === entries.length && fs.existsSync(path.join(dir, '.complete'));
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
function bundleManifest(ref, { db = null, root = null } = {}) {
  const hit = resolveBlob(ref, { db, root });
  if (!hit) return null;
  const bytes = getBlob(hit.sha256, { root });
  let doc;
  try { doc = JSON.parse(bytes.toString('utf8')); } catch { return null; }
  return doc?.schema === BUNDLE_SCHEMA ? doc : null;
}

/**
 * Remove a staging directory this call made: the files it wrote, then the directories above them, deepest first. It never walks a tree: the link-safe
 * recursive delete is scripts/api/fs/safe-remove.mjs, which the db tier cannot import, and a staging tree holds only what this call created.
 */
function dropStaging(staging, written) {
  const dirs = new Set([staging]);
  for (const file of written) {
    if (fs.existsSync(file)) fs.rmSync(file);
    for (let dir = path.dirname(file); dir !== staging && !dirs.has(dir); dir = path.dirname(dir)) dirs.add(dir);
  }
  for (const dir of [...dirs].sort((a, b) => b.length - a.length)) if (fs.existsSync(dir)) fs.rmdirSync(dir);
}

/** The bundle as a directory beside the store (cached by sha), or null when it or one file is missing. */
export function bundleDir(ref, { db = null, root = null } = {}) {
  const sha = shaOfRef(ref, { db });
  const manifest = sha ? bundleManifest(sha, { root }) : null;
  if (!manifest) return null;
  const entries = bundleEntries(manifest);
  const members = [];
  for (const [rel, fileSha] of entries) {
    try { members.push([rel, getBlob(fileSha, { root })]); }
    catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  }
  const dir = path.join(viewRoot(root), 'bundles', sha), opts = { strict: root !== null, base: path.dirname(viewRoot(root)) };
  if (verifiedBundle(dir, entries, opts)) return dir;
  if (fs.existsSync(dir)) throw new Error(`blob bundle view is incomplete: ${sha}`);
  regularParents(dir, opts);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(dir), `.${sha}-`));
  const written = [];
  try {
    for (const [rel, bytes] of members) {
      const to = path.resolve(staging, ...rel.split('/'));
      const relative = path.relative(staging, to);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`unsafe blob bundle target: ${rel}`);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      written.push(to);
      fs.writeFileSync(to, bytes, { flag: 'wx' });
    }
    written.push(path.join(staging, '.complete'));
    fs.writeFileSync(written.at(-1), sha, { flag: 'wx' });
    try { fs.renameSync(staging, dir); }
    catch (error) { if (!fs.existsSync(dir) || !verifiedBundle(dir, entries, opts)) throw error; }
  } finally {
    dropStaging(staging, written);
  }
  if (!verifiedBundle(dir, entries, opts)) throw new Error(`blob bundle publication is incomplete: ${sha}`);
  return dir;
}

/**
 * The readable file of one record asset: a product asset kept in the tree ({path}, a ui direction the owner accepted,
 * decision Q2) resolves against the record's directory; agent output ({artifact?, sha256, name}) resolves in the blob
 * store as a copy carrying the extension of its artifact name. Null when neither is readable.
 */
export function assetFileOf(recordDir, asset, { db = null, root = null } = {}) {
  if (!asset || typeof asset !== 'object') return null;
  if (typeof asset.path === 'string' && asset.path) { const file = path.resolve(recordDir, asset.path); return fs.existsSync(file) ? file : null; }
  return blobAsFile(asset, { ext: path.extname(String(asset.name ?? '')).toLowerCase(), db, root });
}
