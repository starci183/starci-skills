// run-program.mjs — run one declared program argv (`file args`, never a shell), waited for: a UAT policy command of an
// assisted run (scripts/uat/assisted-runner.mjs), resolved to its file by scripts/uat/launch.mjs launchFor. Returns the
// spawnSync result {status, stdout, stderr, error, signal} (utf8 text, a hidden window).
import { spawnSync } from 'node:child_process';

/** Runs `file args`; options (cwd, env, timeout, stdio, input) pass through. */
export const runProgram = (file, args, options = {}) => spawnSync(file, args, { encoding: 'utf8', windowsHide: true, ...options });
