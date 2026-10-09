// replay-start-hangs.mjs - a preload (node --import) that stands for the Kernel launch never answering: the watchdog's `start-workflow.mjs` child is answered at once as
// killed at its bound (ETIMEDOUT, no stdout, the last phase line on stderr), the way a launch stuck in its workflow-host step ended on the live host. It is the one stubbed
// seam of the contract-replace replay (the agent launch); every other call of the watchdog is real.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const original = cp.spawnSync;
cp.spawnSync = function spawnSync(command, args, options) {
  const argv = Array.isArray(args) ? args.map(String) : [];
  // The readiness the rotation checks before it closes a seat (workflow-up --check): green, or one required red row when STARCI_REPLAY_HOST_RED names it.
  if (argv.some((arg) => /[\\/]workflow-up\.mjs$/.test(arg))) {
    const red = process.env.STARCI_REPLAY_HOST_RED;
    const out = JSON.stringify(red ? { ok: false, items: [{ id: red, status: 'red', required: true, detail: `${red} is red` }] } : { ok: true, items: [] });
    return { status: red ? 1 : 0, signal: null, pid: 0, output: [null, out, ''], stdout: out, stderr: '' };
  }
  if (!argv.some((arg) => /[\\/]start-workflow\.mjs$/.test(arg))) return original.call(this, command, args, options);
  // STARCI_REPLAY_START_ANSWER: the launch answers this JSON and exits 1 (a refusal the start printed), instead of never answering.
  const answer = process.env.STARCI_REPLAY_START_ANSWER;
  if (answer) return { status: 1, signal: null, pid: 0, output: [null, answer, ''], stdout: answer, stderr: '' };
  const error = Object.assign(new Error('spawnSync node ETIMEDOUT'), { code: 'ETIMEDOUT' });
  return { status: null, signal: 'SIGTERM', pid: 0, output: [null, '', 'start-workflow: phase workflow-host\n'], stdout: '', stderr: 'start-workflow: phase workflow-host\n', error };
};
syncBuiltinESMExports();
