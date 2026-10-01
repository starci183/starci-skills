// exec-env.mjs — the environment `sops exec-env` would give a command, for a custody file named `<name>.<fmt>.enc`.
// sops 3.13.2 `exec-env` has no --input-type flag, so it cannot read such a file (the `.enc` name reads as binary):
// execEnv states the format (lib.mjs custodyInputType) and decrypts with `sops decrypt --output-type json` over a pipe
// (decrypt.mjs). The plaintext stays in this process's memory; the document's top-level scalar keys become the map.
// The operator's helper that runs a command with it is scripts/gates/custody-exec.mjs.
import { sopsDecrypt } from './decrypt.mjs';
import { custodyInputType } from './lib.mjs';
import { resolveSops } from '../../lib/test-secrets.mjs';

/** Decrypts a custody file into a `{ NAME: string }` map held in memory only (top-level scalars). */
export function execEnv(file, { inputType, env = process.env, sops = null } = {}) {
  const bin = sops ?? resolveSops(env);
  if (!bin) throw new Error('sops is not installed (Windows: winget install Mozilla.SOPS)');
  const result = sopsDecrypt(bin, ['decrypt', '--input-type', custodyInputType(file, inputType), '--output-type', 'json', file], { env });
  if (result.status !== 0) throw new Error(`sops could not decrypt ${file} (exit ${String(result.status)}); is the age identity installed?`);
  const values = {};
  for (const [name, value] of Object.entries(JSON.parse(result.stdout))) {
    if (['string', 'number', 'boolean'].includes(typeof value)) values[name] = String(value);
  }
  return values;
}
