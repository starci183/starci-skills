// run-script.mjs — `node <script> [args]`: one runtime script as a child process with the parent's terminal (stdio
// inherited), the way `starci check` runs each retained self-check. Returns its exit status (1 when it could not start).
import { nodeSpawn } from './lib.mjs';

/** Runs `script` with `args` in `cwd`, output going to this process's terminal; the exit status, 1 when it did not start. */
export const runScript = (script, args = [], { cwd } = {}) => {
  const r = nodeSpawn([script, ...args], { cwd, stdio: 'inherit' });
  return r.error ? 1 : (r.status ?? 1);
};
