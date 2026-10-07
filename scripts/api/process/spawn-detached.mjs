// spawn-detached.mjs — start a hidden, detached child of the runtime (a node script handing over to its successor, a
// verifier that outlives its caller's terminal). The runtime's own lib modules never start a process themselves.
import { spawn } from 'node:child_process';
import { withTempEnv } from '../fs/ensure-temp-root.mjs';

/**
 * spawn(file, args, options) detached and hidden, stdio discarded unless the options say otherwise: the seam signature
 * close-verify.mjs closeSelfSafe/releaseSelfSafe take as `spawnFn` (a spec passes a fake with the same shape).
 */
export const spawnDetached = (file, args, options = {}) => spawn(file, args, withTempEnv({ detached: true, stdio: 'ignore', windowsHide: true, ...options }));
