// seal.mjs - one `sops encrypt` of a plaintext document held in memory: the canon command `starci app secret set` and `starci app secret gen`
// (scripts/hfs/secret.mjs). The plaintext travels on the child's stdin and never on its argument list, so it is not visible in a
// process listing; the ciphertext comes back on stdout.
import { spawnSync } from 'node:child_process';
import { resolveSops } from './lib.mjs';

/**
 * Run `<bin> encrypt` (bin null: the sops resolveSops finds) over `plaintext` of format `inputType` (json, yaml or dotenv). Sops reads stdin only with a `--filename-override`, the path the sealed
 * file will have: recipients are age keys (`--age`), and when none are given sops picks them from the repository's .sops.yaml for that path. {status, stdout, stderr, error}.
 */
export function seal(bin, { inputType, plaintext, recipients = [], filenameOverride }, { env = process.env, cwd = undefined, maxBuffer = 16 * 1024 * 1024 } = {}) {
  const args = ['encrypt', '--input-type', inputType, '--output-type', inputType, '--filename-override', filenameOverride];
  if (recipients.length) args.push('--age', recipients.join(','));
  const exe = bin ?? resolveSops(env);
  if (!exe) return { status: null, stdout: '', stderr: '', error: Object.assign(new Error('sops is not installed (Windows: winget install Mozilla.SOPS)'), { code: 'SOPS_MISSING' }) };
  const r = spawnSync(exe, args, { cwd, env, input: plaintext, encoding: 'utf8', windowsHide: true, maxBuffer });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}
