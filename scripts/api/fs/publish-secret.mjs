// publish-secret.mjs — preserve private file bytes under the caller's existing cooperative lease.
import nodeFs from 'node:fs';
import path from 'node:path';
import { samePath } from '../../lib/path-key.mjs';

const REASONS = new Set(['invalid-request', 'lease-lost', 'root-custody', 'file-custody', 'preimage-changed', 'postcheck-failed']);
const refuse = reason => { throw Object.assign(new Error(reason), { publicationReason: reason }); };
const sameNode = (a, b) => a.dev === b.dev && a.ino === b.ino;
const plainFile = st => st.isFile() && !st.isSymbolicLink() && st.nlink === 1n;
const invalidName = name => typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/:\0]/.test(name);
const invalidBuffers = (before, addition) => (before !== null && !Buffer.isBuffer(before)) || !Buffer.isBuffer(addition) || addition.length === 0;
const invalidRequest = ({ root, name, before, addition, maxBytes, assertLease }, platform) =>
  !['win32', 'linux', 'darwin'].includes(platform) || typeof root !== 'string' || !path.isAbsolute(root) ||
  invalidName(name) || invalidBuffers(before, addition) ||
  !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || typeof assertLease !== 'function' ||
  (before?.length ?? 0) + addition.length > maxBytes;

const lease = s => { if (s.assertLease() !== true) refuse('lease-lost'); };
const lstatOf = (s, p) => s.fs.lstatSync(p, { bigint: true });
// The caller's root may be spelled through a symlinked prefix or an 8.3 name: it is canonicalised once; the root and its leaf are judged against that.
const canonical = (s, p) => samePath(s.fs.realpathSync(p), p === s.root ? s.realRoot : path.join(s.realRoot, s.name));

function readFully(fs, fd, read) {
  let offset = 0;
  while (offset < read.length) {
    const n = fs.readSync(fd, read, offset, read.length - offset, offset);
    if (!Number.isSafeInteger(n) || n <= 0) return false;
    offset += n;
  }
  return true;
}

const matches = (s, bytes) => {
  const st = s.fs.fstatSync(s.fd, { bigint: true });
  if (!plainFile(st) || st.size !== BigInt(bytes.length)) return false;
  const read = Buffer.alloc(bytes.length);
  try {
    if (!readFully(s.fs, s.fd, read)) return false;
    const after = s.fs.fstatSync(s.fd, { bigint: true });
    return sameNode(st, after) && after.size === st.size && read.equals(bytes);
  } finally { read.fill(0); }
};

function openParent(s, rootStat) {
  if (s.platform === 'win32') return;
  const { fs } = s;
  s.parentFd = fs.openSync(s.root, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY ?? 0) | (fs.constants.O_NOFOLLOW ?? 0));
  if (!sameNode(rootStat, fs.fstatSync(s.parentFd, { bigint: true }))) refuse('root-custody');
}

const rootCurrent = (s, rootStat) => {
  const st = lstatOf(s, s.root);
  if (!st.isDirectory() || st.isSymbolicLink() || !sameNode(rootStat, st) || !canonical(s, s.root)) refuse('root-custody');
};

const fileCurrent = (s, opened) => {
  const st = lstatOf(s, s.file);
  if (!plainFile(st) || !sameNode(opened, st) || !canonical(s, s.file)) refuse('file-custody');
};

// The file an append targets must already be one plain file inside the canonical root.
function admitExisting(s) {
  if (s.original === null) return undefined;
  const admitted = lstatOf(s, s.file);
  if (!plainFile(admitted) || !canonical(s, s.file)) refuse('file-custody');
  return admitted;
}

function openTarget(s, admitted) {
  const { fs, original, file } = s;
  const flags = fs.constants.O_RDWR | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW ?? 0) |
    (original === null ? fs.constants.O_CREAT | fs.constants.O_EXCL : 0);
  s.mutated = original === null;
  try { s.fd = fs.openSync(file, flags, 0o600); } catch (error) {
    if (original === null && error?.code === 'EEXIST') { s.mutated = false; refuse('file-custody'); }
    throw error;
  }
  const opened = fs.fstatSync(s.fd, { bigint: true });
  if (!plainFile(opened) || (admitted && !sameNode(admitted, opened))) refuse('file-custody');
  return opened;
}

function appendSuffix(s) {
  const { fs, suffix } = s;
  let offset = 0;
  while (offset < suffix.length) {
    const n = fs.writeSync(s.fd, suffix, offset, suffix.length - offset, null);
    if (!Number.isSafeInteger(n) || n <= 0) refuse('postcheck-failed');
    offset += n;
  }
  fs.fsyncSync(s.fd);
  if (s.original === null && s.parentFd !== null) fs.fsyncSync(s.parentFd);
}

function durabilityOf(s) {
  if (s.original !== null) return 'file-fsync';
  return s.parentFd === null ? 'file-fsync-namespace-unqualified' : 'file-and-parent-fsync';
}

function performPublication(s) {
  lease(s);
  const rootStat = lstatOf(s, s.root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) refuse('root-custody');
  s.realRoot = s.fs.realpathSync(s.root);
  openParent(s, rootStat);
  const opened = openTarget(s, admitExisting(s));
  lease(s); rootCurrent(s, rootStat); fileCurrent(s, opened);
  if (!matches(s, s.original ?? Buffer.alloc(0))) refuse('preimage-changed');
  s.mutated = true;
  appendSuffix(s);
  lease(s); rootCurrent(s, rootStat); fileCurrent(s, opened);
  if (!matches(s, s.expected)) refuse('postcheck-failed');
  return { ok: true, effectState: 'complete', created: s.original === null, durability: durabilityOf(s) };
}

// A handle that will not close turns the outcome into close-failed.
function closeHandles(s, outcome) {
  let result = outcome;
  for (const handle of [s.fd, s.parentFd]) {
    if (handle === null) continue;
    try { s.fs.closeSync(handle); } catch {
      result = { ok: false, effectState: s.mutated ? 'unknown' : 'none', reason: 'close-failed' };
    }
  }
  return result;
}

/** before is null for exclusive creation, or the exact privately retained preimage for append. */
export function publishSecret(request = {}, { fs = nodeFs, platform = process.platform } = {}) {
  const { root, name, before, addition, assertLease } = request;
  if (invalidRequest(request, platform)) {
    return { ok: false, effectState: 'none', reason: 'invalid-request' };
  }
  const original = before === null ? null : Buffer.from(before);
  const suffix = Buffer.from(addition);
  const expected = Buffer.concat([original ?? Buffer.alloc(0), suffix]);
  const s = { fs, platform, root, name, file: path.join(root, name), original, suffix, expected, assertLease,
    fd: null, parentFd: null, mutated: false, realRoot: undefined };
  let outcome;
  try {
    outcome = performPublication(s);
  } catch (error) {
    outcome = { ok: false, effectState: s.mutated ? 'unknown' : 'none',
      reason: REASONS.has(error?.publicationReason) ? error.publicationReason : 'io-failed' };
  } finally {
    outcome = closeHandles(s, outcome);
    original?.fill(0); suffix.fill(0); expected.fill(0);
  }
  return outcome;
}
