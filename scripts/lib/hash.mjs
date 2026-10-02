// hash.mjs — a short stable id for a string: the hex digest of `algo` cut to `n` characters.
import crypto from 'node:crypto';

/** `text` hashed with `algo`, the hex digest cut to `n` characters. */
export const shortHash = (text, { algo = 'sha256', n = 10 } = {}) =>
  crypto.createHash(algo).update(String(text)).digest('hex').slice(0, n);
