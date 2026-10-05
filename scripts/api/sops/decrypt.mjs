// decrypt.mjs — the public SOPS file-decrypt call.
import { runSopsFile } from './lib.mjs';

/**
 * Decrypt one custody file from caller-supplied SOPS arguments; the shared file owner requires the caller's original identity selection.
 * @param {string|null} bin Explicit SOPS executable, or null to use the selected environment's resolver.
 * @param {string[]} args SOPS arguments forwarded unchanged to the file operation.
 * @param {object} options Identity, invocation, environment and capture options owned by runSopsFile.
 * @returns {{status: number|null, stdout: string|null, stderr: string|null, error: Error|null}} The observed child result or typed identity refusal.
 */
export function decrypt(bin, args, options = {}) {
  return runSopsFile(bin, args, 'decrypt', options);
}
