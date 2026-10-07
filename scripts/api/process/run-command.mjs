// run-command.mjs — run one declared command line (a proof's check, an example's assertion) through the shell, waited
// for, its output captured. The command text comes from the operation or example that declares it, never from a user
// at runtime. Returns the spawnSync result {status, stdout, stderr, error, signal} (utf8 text).
import { spawnSync } from 'node:child_process';
import { withTempEnv } from '../fs/ensure-temp-root.mjs';

/** Runs `command` through the shell; options (cwd, env, timeout, maxBuffer, stdio) pass through. */
export const runCommand = (command, options = {}) => spawnSync(command, withTempEnv({ shell: true, encoding: 'utf8', windowsHide: true, ...options }));
