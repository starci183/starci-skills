// decrypt.mjs — one `sops` decryption: the custody reads (scripts/api/sops/exec-env.mjs execEnv) and the test
// secrets (scripts/uat/test-secret.mjs testSecret). The plaintext stays in this process's memory (stdout over a pipe).
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveSops } from './lib.mjs';

/**
 * Run `<bin> <args>` (bin null: the sops resolveSops finds) with SOPS_AGE_KEY_FILE defaulted to ~/.starci/master.identity.
 * {status, stdout, stderr, error}; a missing sops is {status: null, error: SOPS_MISSING}.
 */
export function sopsDecrypt(bin, args, { env = process.env, cwd = undefined, maxBuffer = 16 * 1024 * 1024, timeout = undefined } = {}) {
  const exe = bin ?? resolveSops(env);
  if (!exe) return { status: null, stdout: '', stderr: '', error: Object.assign(new Error('sops is not installed (Windows: winget install Mozilla.SOPS)'), { code: 'SOPS_MISSING' }) };
  const r = spawnSync(exe, args, {
    cwd, encoding: 'utf8', windowsHide: true, maxBuffer, timeout,
    env: { ...env, SOPS_AGE_KEY_FILE: env.SOPS_AGE_KEY_FILE || path.join(os.homedir(), '.starci', 'master.identity') },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}
