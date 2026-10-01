// exec-node.mjs — `node <args>` with this process's node binary, waited for without blocking the calling thread (the
// reconciler engine has one thread; a spawnSync there stops its timers). Resolves {error, stdout, stderr}; never rejects.
import { nodeExecFile } from './lib.mjs';

/** Runs `node <args>` asynchronously; options (cwd, env, timeout, killSignal, maxBuffer) pass through. */
export const execNode = (args, options = {}) => new Promise((resolve) => {
  nodeExecFile(args, options, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
});
