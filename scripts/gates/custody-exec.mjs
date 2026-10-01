#!/usr/bin/env node
// custody-exec.mjs - `sops exec-env` for a custody file named `<name>.<fmt>.enc` (the one runtime helper; product
// repositories carry no copy).
//
//   node <runtime>/scripts/gates/custody-exec.mjs <file>.<yaml|json|env>.enc '<command>'   run <command> with the keys in its env
//   node <runtime>/scripts/gates/custody-exec.mjs <file>.<fmt>.enc --get NAME               print one value (a pipe consumer)
//   node <runtime>/scripts/gates/custody-exec.mjs <file>.<fmt>.enc --keys                   print the key NAMES only
//   add  --input-type yaml|json|dotenv  to state the format instead of taking it from the name
//
// WHY. Custody members are committed as `<name>.<fmt>.enc` (check-starcistacks refuses any other tracked member under
// `.starcistacks/<env>/secrets/`). sops infers a format from the LAST extension, so `.enc` reads as binary, and
// `sops exec-env` has no `--input-type` flag to say otherwise (sops 3.13.2): on such a file it cannot expose the
// document's keys as environment variables. Every read therefore STATES the format, and this helper is the one place
// that does it for exec-env style use and for single-value reads.
//
// CUSTODY. The document is decrypted into this process's memory only (`sops decrypt --output-type json` over a pipe);
// its top-level scalar keys become the child's environment. Nothing is written to a file, a log or the parent shell, and
// a value is never printed except by `--get`, which writes exactly that one value to stdout for the calling process.
// The age identity is SOPS_AGE_KEY_FILE, default ~/.starci/master.identity. The decryption is scripts/api/sops/exec-env.mjs
// execEnv, the child process scripts/api/process/run-shell.mjs runShellInherit.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execEnv } from '../api/sops/exec-env.mjs';
import { runShellInherit } from '../api/process/run-shell.mjs';

/** Runs `command` with the custody keys added to its environment; returns the child's exit status. */
export function execWithCustody(file, command, options = {}) {
  const values = execEnv(file, options);
  return runShellInherit(command, values);
}

function main(argv) {
  const flag = (name) => { const at = argv.indexOf(name); if (at < 0) return undefined; return argv.splice(at, 2)[1]; };
  const has = (name) => { const at = argv.indexOf(name); if (at < 0) return false; argv.splice(at, 1); return true; };
  const inputType = flag('--input-type');
  const get = flag('--get');
  const keys = has('--keys');
  const [file, ...command] = argv;
  if (!file) throw new Error("usage: custody-exec.mjs <file>.<fmt>.enc ('<command>' | --get NAME | --keys) [--input-type yaml|json|dotenv]");
  if (keys) { process.stdout.write(`${Object.keys(execEnv(file, { inputType })).join('\n')}\n`); return 0; }
  if (get !== undefined) {
    const values = execEnv(file, { inputType });
    if (!(get in values)) throw new Error(`${file} holds no ${get}`);
    process.stdout.write(values[get]);
    return 0;
  }
  if (command.length === 0) throw new Error('no command to run');
  return execWithCustody(file, command.join(' '), { inputType });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`custody-exec: ${error.message}\n`); process.exitCode = 1; }
}
