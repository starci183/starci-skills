// scripts/api/node/lib.mjs — the runner of the runtime's own scripts as child processes: the node binary that runs this
// process (process.execPath), a hidden window, utf8 text. The call files beside it (run-script.mjs, syntax-check.mjs,
// run-node.mjs, spawn-node.mjs, exec-node.mjs) each name one use; nothing outside scripts/api/node imports this runner.
import { assertMutationFence } from '../../lib/mutation-fence.mjs';
import { execFile, spawn, spawnSync } from 'node:child_process';

/** `node <args>` with this process's node binary, waited for; options pass through last (cwd, stdio, env, timeout, maxBuffer, input). */
export const nodeSpawn = (args, options = {}) => { assertMutationFence({ kind: 'node-effect', args }); return spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, ...options }); };

/** `node <args>` with this process's node binary, started and not waited for: the ChildProcess (detached, stdio, env pass through). */
export const nodeStart = (args, options = {}) => { assertMutationFence({ kind: 'node-effect', args }); return spawn(process.execPath, args, { windowsHide: true, ...options }); };

/** `node <args>` with this process's node binary, waited for without blocking the thread: callback(error, stdout, stderr). */
export const nodeExecFile = (args, options, callback) => { assertMutationFence({ kind: 'node-effect', args }); return execFile(process.execPath, args, { encoding: 'utf8', windowsHide: true, ...options }, callback); };
