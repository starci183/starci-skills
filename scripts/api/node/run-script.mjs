// run-script.mjs — `node <script> [args]`: one runtime script as a child process with the parent's terminal (stdio
// inherited), the way `starci runtime check` runs each retained self-check. Returns its exit status (1 when it could not start).
import { nodeSpawn } from './lib.mjs';

/** Runs a runtime script with the supplied cwd and env; inherited stdio, child status or 1 if it cannot start. */
export const runScript = (script, args = [], { cwd, env } = {}) => {
  const r = nodeSpawn([script, ...args], { cwd, env, stdio: 'inherit' });
  return r.error ? 1 : (r.status ?? 1);
};
