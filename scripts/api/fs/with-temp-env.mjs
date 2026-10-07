// with-temp-env.mjs — the spawn options of a child the runtime starts: its environment names the temp root as TEMP, TMP and TMPDIR.
import { tempChildEnv } from '../../../engine/temp-root.mjs';
import { ensureTempRoot } from './ensure-temp-root.mjs';

/** The spawn options with `env` replaced by tempChildEnv of the options' own env (default: the process environment), the temp root ensured first (TEMP_ROOT_UNUSABLE when it cannot be made). */
export function withTempEnv(options = {}) {
  const env = options.env ?? process.env;
  ensureTempRoot({ env });
  return { ...options, env: tempChildEnv(env) };
}
