// start-program.mjs — start one declared program argv (`file args`, never a shell) and return its ChildProcess: an
// assisted UAT session's driver, or a command held in a UAT slot (scripts/uat/assisted-runner.mjs, uat-slots.mjs),
// resolved to its file by scripts/uat/launch.mjs launchFor. The caller owns its stdio, its exit and its kill.
import { spawn } from 'node:child_process';
import { tempChildEnv } from '../../../engine/temp-root.mjs';

/** The ChildProcess of `file args`; options (cwd, env, stdio, windowsHide) pass through, hidden unless they say otherwise. */
export const startProgram = (file, args, options = {}) => spawn(file, args, { windowsHide: true, ...options, env: tempChildEnv(options.env ?? process.env) });
