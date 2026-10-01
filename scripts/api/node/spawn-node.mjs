// spawn-node.mjs — `node <args>` with this process's node binary, started and not waited for: a long-running runtime
// process (a server, an engine, a detached helper). Returns the ChildProcess.
import { nodeStart } from './lib.mjs';

/** Starts `node <args>`; options (cwd, env, stdio, detached) pass through. */
export const spawnNode = (args, options = {}) => nodeStart(args, options);
