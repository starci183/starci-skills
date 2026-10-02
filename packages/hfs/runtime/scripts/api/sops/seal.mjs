// seal.mjs - one `sops encrypt` of a plaintext document held in memory: the canon command `hfs secret set` and `hfs secret gen`
// (scripts/hfs/secret.mjs). The plaintext travels on the child's stdin and never on its argument list, so it is not visible in a
// process listing; the ciphertext comes back on stdout.
import { spawnSync } from 'node:child_process';

/**
 * Run `<bin> encrypt` over `plaintext` of format `inputType` (json, yaml or dotenv). Sops reads stdin only with a `--filename-override`, the path the sealed
 * file will have: recipients are age keys (`--age`), and when none are given sops picks them from the repository's .sops.yaml for that path. {status, stdout, stderr, error}.
 */
export function sopsSeal(bin, { inputType, plaintext, recipients = [], filenameOverride }, { env = process.env, cwd = undefined, maxBuffer = 16 * 1024 * 1024 } = {}) {
  const args = ['encrypt', '--input-type', inputType, '--output-type', inputType, '--filename-override', filenameOverride];
  if (recipients.length) args.push('--age', recipients.join(','));
  const r = spawnSync(bin, args, { cwd, env, input: plaintext, encoding: 'utf8', windowsHide: true, maxBuffer });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error ?? null };
}
