// decrypt.mjs — one `sops` decryption: the custody reads (scripts/lib/sops-exec-env.mjs readCustody) and the test
// secrets (scripts/lib/test-secrets.mjs testSecret). The plaintext stays in this process's memory (stdout over a pipe).
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Run `<bin> <args>` with SOPS_AGE_KEY_FILE defaulted to ~/.starci/master.identity. {status, stdout, stderr, error}.
 */
export function sopsDecrypt(bin, args, { env = process.env, cwd = undefined, maxBuffer = 16 * 1024 * 1024 } = {}) {
  const r = spawnSync(bin, args, {
    cwd, encoding: 'utf8', windowsHide: true, maxBuffer,
    env: { ...env, SOPS_AGE_KEY_FILE: env.SOPS_AGE_KEY_FILE || path.join(os.homedir(), '.starci', 'master.identity') },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}
