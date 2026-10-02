// run-node.mjs — `node <args>` with this process's node binary, waited for: a runtime script (or `-e`/`--test`) as a child
// whose output the caller reads. Returns the spawnSync result {status, stdout, stderr, error, signal} (utf8 text).
import { nodeSpawn } from './lib.mjs';

/** Runs `node <args>`; options (cwd, env, timeout, input, maxBuffer, stdio) pass through. */
export const runNode = (args, options = {}) => nodeSpawn(args, options);
