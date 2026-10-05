// publish-secret.mjs — preserve private file bytes under the caller's existing cooperative lease.
import nodeFs from 'node:fs';
import path from 'node:path';
import { samePath } from '../../lib/path-key.mjs';

const REASONS = new Set(['invalid-request', 'lease-lost', 'root-custody', 'file-custody', 'preimage-changed', 'postcheck-failed']);
const refuse = reason => { throw Object.assign(new Error(reason), { publicationReason: reason }); };
const sameNode = (a, b) => a.dev === b.dev && a.ino === b.ino;

/** before is null for exclusive creation, or the exact privately retained preimage for append. */
export function publishSecret({ root, name, before, addition, maxBytes, assertLease } = {}, { fs = nodeFs, platform = process.platform } = {}) {
  if (!['win32', 'linux', 'darwin'].includes(platform) || typeof root !== 'string' || !path.isAbsolute(root) ||
      typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/:\0]/.test(name) ||
      (before !== null && !Buffer.isBuffer(before)) || !Buffer.isBuffer(addition) || addition.length === 0 ||
      !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || typeof assertLease !== 'function' ||
      (before?.length ?? 0) + addition.length > maxBytes) {
    return { ok: false, effectState: 'none', reason: 'invalid-request' };
  }
  const original = before === null ? null : Buffer.from(before);
  const suffix = Buffer.from(addition);
  const expected = Buffer.concat([original ?? Buffer.alloc(0), suffix]);
  const file = path.join(root, name);
  let fd = null, parentFd = null, mutated = false, outcome;
  const lease = () => { if (assertLease() !== true) refuse('lease-lost'); };
  const stat = p => fs.lstatSync(p, { bigint: true });
  const canonical = p => samePath(path.resolve(fs.realpathSync(p)), path.resolve(p));
  const plainFile = st => st.isFile() && !st.isSymbolicLink() && st.nlink === 1n;
  const matches = bytes => {
    const st = fs.fstatSync(fd, { bigint: true });
    if (!plainFile(st) || st.size !== BigInt(bytes.length)) return false;
    const read = Buffer.alloc(bytes.length);
    try {
      let offset = 0;
      while (offset < read.length) {
        const n = fs.readSync(fd, read, offset, read.length - offset, offset);
        if (!Number.isSafeInteger(n) || n <= 0) return false;
        offset += n;
      }
      const after = fs.fstatSync(fd, { bigint: true });
      return sameNode(st, after) && after.size === st.size && read.equals(bytes);
    } finally { read.fill(0); }
  };
  try {
    lease();
    const rootStat = stat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || !canonical(root)) refuse('root-custody');
    if (platform !== 'win32') {
      parentFd = fs.openSync(root, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY ?? 0) | (fs.constants.O_NOFOLLOW ?? 0));
      if (!sameNode(rootStat, fs.fstatSync(parentFd, { bigint: true }))) refuse('root-custody');
    }
    const rootCurrent = () => {
      const st = stat(root);
      if (!st.isDirectory() || st.isSymbolicLink() || !sameNode(rootStat, st) || !canonical(root)) refuse('root-custody');
    };
    let admitted;
    if (original !== null) {
      admitted = stat(file);
      if (!plainFile(admitted) || !canonical(file)) refuse('file-custody');
    }
    const flags = fs.constants.O_RDWR | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW ?? 0) |
      (original === null ? fs.constants.O_CREAT | fs.constants.O_EXCL : 0);
    mutated = original === null;
    try { fd = fs.openSync(file, flags, 0o600); } catch (error) {
      if (original === null && error?.code === 'EEXIST') { mutated = false; refuse('file-custody'); }
      throw error;
    }
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!plainFile(opened) || (admitted && !sameNode(admitted, opened))) refuse('file-custody');
    const fileCurrent = () => {
      const st = stat(file);
      if (!plainFile(st) || !sameNode(opened, st) || !canonical(file)) refuse('file-custody');
    };
    lease(); rootCurrent(); fileCurrent();
    if (!matches(original ?? Buffer.alloc(0))) refuse('preimage-changed');
    let offset = 0;
    mutated = true;
    while (offset < suffix.length) {
      const n = fs.writeSync(fd, suffix, offset, suffix.length - offset, null);
      if (!Number.isSafeInteger(n) || n <= 0) refuse('postcheck-failed');
      offset += n;
    }
    fs.fsyncSync(fd);
    if (original === null && parentFd !== null) fs.fsyncSync(parentFd);
    lease(); rootCurrent(); fileCurrent();
    if (!matches(expected)) refuse('postcheck-failed');
    outcome = { ok: true, effectState: 'complete', created: original === null,
      durability: original === null ? (parentFd === null ? 'file-fsync-namespace-unqualified' : 'file-and-parent-fsync') : 'file-fsync' };
  } catch (error) {
    outcome = { ok: false, effectState: mutated ? 'unknown' : 'none',
      reason: REASONS.has(error?.publicationReason) ? error.publicationReason : 'io-failed' };
  } finally {
    for (const handle of [fd, parentFd]) {
      if (handle === null) continue;
      try { fs.closeSync(handle); } catch {
        outcome = { ok: false, effectState: mutated ? 'unknown' : 'none', reason: 'close-failed' };
      }
    }
    original?.fill(0); suffix.fill(0); expected.fill(0);
  }
  return outcome;
}
