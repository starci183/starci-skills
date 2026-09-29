#!/usr/bin/env node
// sops-exec-env.mjs - `sops exec-env` for a custody file named `<name>.<fmt>.enc` (the one runtime helper; product
// repositories carry no copy).
//
//   node <runtime>/scripts/lib/sops-exec-env.mjs <file>.<yaml|json|env>.enc '<command>'   run <command> with the keys in its env
//   node <runtime>/scripts/lib/sops-exec-env.mjs <file>.<fmt>.enc --get NAME               print one value (a pipe consumer)
//   node <runtime>/scripts/lib/sops-exec-env.mjs <file>.<fmt>.enc --keys                   print the key NAMES only
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
// The age identity is SOPS_AGE_KEY_FILE, default ~/.starci/master.identity.
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveSops } from './test-secrets.mjs';

const FORMATS = { yaml: 'yaml', yml: 'yaml', json: 'json', env: 'dotenv', dotenv: 'dotenv' };

/** The sops input type `<name>.<format>.enc` states, or the explicit override. Throws when neither names one. */
export function custodyInputType(file, override) {
  if (override) {
    if (!Object.values(FORMATS).includes(override)) throw new Error(`unsupported --input-type ${override}`);
    return override;
  }
  const match = /\.([a-z]+)\.enc$/iu.exec(String(file));
  const type = match ? FORMATS[match[1].toLowerCase()] : undefined;
  if (!type) throw new Error(`${file}: name it <name>.<yaml|json|env>.enc or pass --input-type`);
  return type;
}

/** Decrypts a custody file into a `{ NAME: string }` map held in memory only (top-level scalars). */
export function readCustody(file, { inputType, env = process.env, sops = null } = {}) {
  const bin = sops ?? resolveSops(env);
  if (!bin) throw new Error('sops is not installed (Windows: winget install Mozilla.SOPS)');
  const result = spawnSync(bin, ['decrypt', '--input-type', custodyInputType(file, inputType), '--output-type', 'json', file], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
    env: { ...env, SOPS_AGE_KEY_FILE: env.SOPS_AGE_KEY_FILE || path.join(os.homedir(), '.starci', 'master.identity') },
  });
  if (result.status !== 0) throw new Error(`sops could not decrypt ${file} (exit ${String(result.status)}); is the age identity installed?`);
  const values = {};
  for (const [name, value] of Object.entries(JSON.parse(result.stdout))) {
    if (['string', 'number', 'boolean'].includes(typeof value)) values[name] = String(value);
  }
  return values;
}

/** Runs `command` with the custody keys added to its environment; returns the child's exit status. */
export function execWithCustody(file, command, options = {}) {
  const values = readCustody(file, options);
  const child = spawnSync(command, { shell: true, stdio: 'inherit', env: { ...process.env, ...values } });
  return child.status ?? 1;
}

function main(argv) {
  const flag = (name) => { const at = argv.indexOf(name); if (at < 0) return undefined; return argv.splice(at, 2)[1]; };
  const has = (name) => { const at = argv.indexOf(name); if (at < 0) return false; argv.splice(at, 1); return true; };
  const inputType = flag('--input-type');
  const get = flag('--get');
  const keys = has('--keys');
  const [file, ...command] = argv;
  if (!file) throw new Error("usage: sops-exec-env.mjs <file>.<fmt>.enc ('<command>' | --get NAME | --keys) [--input-type yaml|json|dotenv]");
  if (keys) { process.stdout.write(`${Object.keys(readCustody(file, { inputType })).join('\n')}\n`); return 0; }
  if (get !== undefined) {
    const values = readCustody(file, { inputType });
    if (!(get in values)) throw new Error(`${file} holds no ${get}`);
    process.stdout.write(values[get]);
    return 0;
  }
  if (command.length === 0) throw new Error('no command to run');
  return execWithCustody(file, command.join(' '), { inputType });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`sops-exec-env: ${error.message}\n`); process.exitCode = 1; }
}
