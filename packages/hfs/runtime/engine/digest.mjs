// digest.mjs — the one SHA-256 the runtime hashes with. A leaf: every file's integrity digest,
// every ledger input ref and every stamped asset is this function, so a byte stream and a file
// never disagree about what their digest is.
import { createHash } from 'node:crypto';
import fs from 'node:fs';

/** The lowercase hex SHA-256 of `value` (string, Buffer or TypedArray). */
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
/** The SHA-256 of the file's exact bytes; throws when the file cannot be read. */
export const sha256File = (file) => sha256(fs.readFileSync(file));
