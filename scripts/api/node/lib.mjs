// scripts/api/node/lib.mjs — the runner of the runtime's own scripts as child processes: the node binary that runs this
// process (process.execPath), a hidden window, utf8 text. The call files beside it (run-script.mjs, syntax-check.mjs) each
// name one use; nothing outside scripts/api/node imports this runner.
import { spawnSync } from 'node:child_process';

/** `node <args>` with this process's node binary; options pass through last (cwd, stdio, env, timeout, maxBuffer). */
export const nodeSpawn = (args, options = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, ...options });
