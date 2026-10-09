// replay-start-hangs.mjs - a preload (node --import) that stands for the Kernel launch never answering: the watchdog's `start-workflow.mjs` child is answered at once as
// killed at its bound (ETIMEDOUT, no stdout, the last phase line on stderr), the way a launch stuck in its workflow-host step ended on the live host. It is the one stubbed
// seam of the contract-replace replay (the agent launch); every other call of the watchdog is real.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const original = cp.spawnSync;
cp.spawnSync = function spawnSync(command, args, options) {
  const argv = Array.isArray(args) ? args.map(String) : [];
  if (!argv.some((arg) => /[\\/]start-workflow\.mjs$/.test(arg))) return original.call(this, command, args, options);
  const error = Object.assign(new Error('spawnSync node ETIMEDOUT'), { code: 'ETIMEDOUT' });
  return { status: null, signal: 'SIGTERM', pid: 0, output: [null, '', 'start-workflow: phase workflow-host\n'], stdout: '', stderr: 'start-workflow: phase workflow-host\n', error };
};
syncBuiltinESMExports();
