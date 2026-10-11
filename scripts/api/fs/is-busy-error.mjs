// is-busy-error.mjs - whether an error code is one Windows returns while another process holds the target open (FS_BUSY of lib.mjs).
// The retry loops of the fs call files (rename-over.mjs, safe-remove.mjs) read the list there; a caller outside api/fs, such as the
// reader of an `npm ci` failure, asks here whether a code is a held file and never keeps a list of its own.
import { FS_BUSY } from './lib.mjs';

/** True when `code` is EPERM, EBUSY or EACCES: a file held open, not a missing or broken one. */
export const isBusyError = (code) => FS_BUSY.includes(code);
