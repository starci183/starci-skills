// run-npx.mjs — `npx <args>` waited for: a published package's bin run the way a user runs it. Returns the spawnSync
// result {status, stdout, stderr, error, signal} (utf8 text).
import { npxSpawn } from './lib.mjs';

/** Runs `npx <args>`; options (cwd, env, timeout, maxBuffer, stdio) pass through. */
export const runNpx = (args, options = {}) => npxSpawn(args, options);
