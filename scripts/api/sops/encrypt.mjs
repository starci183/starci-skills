// encrypt.mjs — the public SOPS file-encrypt call.
import { runSopsFile } from './lib.mjs';

/**
 * Encrypt one file from caller-supplied SOPS arguments; the shared file owner preserves recipient-only and original-identity admission.
 * @param {string|null} bin Explicit SOPS executable, or null to use the selected environment's resolver.
 * @param {string[]} args SOPS arguments forwarded unchanged to the file operation.
 * @param {object} options Identity, invocation, environment and capture options owned by runSopsFile.
 * @returns {{status: number|null, stdout: string|null, stderr: string|null, error: Error|null}} The observed child result or typed identity refusal.
 */
export function encrypt(bin, args, options = {}) {
  return runSopsFile(bin, args, 'encrypt', options);
}
