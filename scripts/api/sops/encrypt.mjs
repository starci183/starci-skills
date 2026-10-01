// encrypt.mjs — one `sops --encrypt` of a plaintext file: the extension custody seal (scripts/checks/sonar-ext-custody.mjs
// sealExtCustody). The plaintext path is the caller's 0600 temp file; the ciphertext comes back on stdout over a pipe.
import { spawnSync } from 'node:child_process';

/**
 * Run `<bin> <args>` with SOPS_AGE_KEY_FILE set to `identity` when given. {status, stdout, stderr, error}.
 */
export function encrypt(bin, args, { identity = null, env = process.env, timeout = undefined, maxBuffer = 1024 * 1024 } = {}) {
  const r = spawnSync(bin, args, {
    encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer, timeout,
    env: identity ? { ...env, SOPS_AGE_KEY_FILE: identity } : env,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}
