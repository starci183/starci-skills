// scripts/api/cloudflared/lib.mjs — the runner of cloudflared: one long-running tunnel process, hidden, never a shell. The
// call file beside it (tunnel-run.mjs) names its one use; nothing outside scripts/api/cloudflared imports this runner.
import { spawn } from 'node:child_process';
import { withTempEnv } from '../fs/with-temp-env.mjs';

/**
 * Start `<command> <args>` (command: the cloudflared binary on PATH, or a stand-in a spec names) and return the
 * ChildProcess. `env` is the child's whole environment with TEMP/TMP/TMPDIR set to the temp root; stdio defaults to ignore/pipe/pipe.
 */
export const cloudflaredStart = (args, { command = 'cloudflared', env = process.env, stdio = ['ignore', 'pipe', 'pipe'] } = {}) =>
  spawn(command, args, withTempEnv({ env, stdio, windowsHide: true }));
