// scripts/api/fs/lib.mjs — what the fs call files beside it share: the error codes Windows returns while another
// process holds a path open, and the verified unlink of one link. The call files (safe-remove.mjs, remove-links-under.mjs,
// rename-over.mjs, zip-write.mjs, ...) each name one filesystem use.
import fs from 'node:fs';

/** The rename and unlink errors Windows returns while another process holds the target open: retried, never final. */
export const FS_BUSY = Object.freeze(['EPERM', 'EBUSY', 'EACCES']);

/** Remove a link itself, never its target. True when nothing is left at `p`. */
export function unlinkOnly(p) {
  try { fs.lstatSync(p); } catch (error) { return error?.code === 'ENOENT'; }
  try { fs.unlinkSync(p); } catch { try { fs.rmdirSync(p); } catch { /* verified below */ } }
  try { fs.lstatSync(p); return false; } catch (error) { return error?.code === 'ENOENT'; }
}

/** Construct an archive-reader refusal with its existing error code. */
export const zipRefuse = (message, code = 'zip-corrupt') => Object.assign(new Error(message), { code });

/** Relative ZIP entry names exclude traversal, drive roots and control characters. */
export const validZipName=name=>Boolean(name)&&!name.startsWith('/')&&!/^[A-Za-z]:/.test(name)&&!/[\0\r\n\\]/.test(name)&&!name.split('/').includes('..');
