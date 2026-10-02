// build-env.mjs - the one place the SWC cache of a `next build` is decided. The land gate's spec-run environment and the
// scaffold spec's build both read it, so no one hand-sets a cache directory or an ACL.
// @swc/core refuses a native-binding cache whose ancestor grants write to other accounts (the inherited ACL of a data
// drive on Windows), so the cache lives under the user's home, which never does.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readEnv } from '../lib/env.mjs';

/** The SWC native-binding cache directory: STARCI_SWC_CACHE when set, else `starci-swc-cache` under the user's home. */
export const swcCacheDir = (env = process.env, home = os.homedir()) => readEnv('STARCI_SWC_CACHE', env) ?? path.join(home, 'starci-swc-cache');

/** `env` with SWC_NATIVE_BINDING_CACHE naming the (created) SWC cache directory. */
export function withSwcCache(env = process.env) {
  const dir = swcCacheDir(env);
  fs.mkdirSync(dir, { recursive: true });
  return { ...env, SWC_NATIVE_BINDING_CACHE: dir };
}

/** `env` extended for `next build`: telemetry off and the SWC cache set. */
export const nextBuildEnv = (env = process.env) => ({ ...withSwcCache(env), NEXT_TELEMETRY_DISABLED: '1' });
