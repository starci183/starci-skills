// temp-root.mjs — the one owner of where the runtime puts its temporary files.
//
// Every temp directory or file the runtime creates (spec fixtures, land scratch, gate staging, dispatch prompts, scan work
// dirs) lives under tempRoot(): env STARCI_TEMP_ROOT (a spec, a one-off run), then the owner config `roots.temp`
// (config.yaml, gitignored), else the OS temp directory of the process (TEMP / TMP / TMPDIR, then os.tmpdir()). The base tier
// only resolves; the directory is made by scripts/api/fs/make-temp-dir.mjs, temp-path.mjs, ensure-temp-root.mjs and with-temp-env.mjs. The
// children the runtime starts get the same directory as TEMP / TMP / TMPDIR (tempChildEnv, applied by withTempEnv in scripts/api/fs/with-temp-env.mjs, which every scripts/api/ spawn wrapper calls).
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.mjs';

export const TEMP_ROOT_ENV = 'STARCI_TEMP_ROOT';

/** The owner's `roots.temp` (config.yaml, validated by engine/invalid-config.mjs), or null. `config` is the owner config (default: loadConfig(), whose error for an invalid config.yaml propagates: the OS directory never replaces a root the owner set wrongly). */
const ownerTemp = (config) => (config === undefined ? loadConfig() : config)?.roots?.temp ?? null;

/** The operating-system temp directory of `env`: TEMP, TMP, TMPDIR, else os.tmpdir(). */
export const osTempDir = (env = process.env) => path.resolve(String(env?.TEMP || env?.TMP || env?.TMPDIR || os.tmpdir()));

/** The one temp root: env STARCI_TEMP_ROOT, then the owner config `roots.temp`, else the OS temp directory. Resolved, not created. */
export function tempRoot({ env = process.env, config = undefined } = {}) {
  return path.resolve(String(env?.[TEMP_ROOT_ENV] || ownerTemp(config) || osTempDir(env)));
}

/** `env` (default: the process environment) as a copy whose TEMP, TMP and TMPDIR name the temp root. */
export function tempChildEnv(env = process.env) {
  const root = tempRoot({ env });
  return { ...env, TEMP: root, TMP: root, TMPDIR: root };
}
