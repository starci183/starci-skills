// scripts/api/fs/lib.mjs — what the fs call files beside it share: the error codes Windows returns while another
// process holds a path open. The call files (safe-remove.mjs, rename-over.mjs, rmdir-link.mjs, zip-write.mjs) each
// name one filesystem use.

/** The rename and unlink errors Windows returns while another process holds the target open: retried, never final. */
export const FS_BUSY = Object.freeze(['EPERM', 'EBUSY', 'EACCES']);
