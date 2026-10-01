// run-npm.mjs — `npm <args>` waited for: a package script (`run <script>`, `test`) or an install (`ci`, `install`) whose
// status and output the caller reads. Returns the spawnSync result {status, stdout, stderr, error, signal} (utf8 text).
import { npmSpawn } from './lib.mjs';

/** Runs `npm <args>`; options (cwd, env, timeout, maxBuffer, stdio) pass through. */
export const runNpm = (args, options = {}) => npmSpawn(args, options);
