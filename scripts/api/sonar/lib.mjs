// scripts/api/sonar/lib.mjs — the runner of the SonarQube scanner: the scanner command line (`npm run sonar:check -- ...`
// or `npx --yes @sonar/scan ...`) started through the shell, because npm and npx are .cmd shims on Windows. The call file
// beside it (scan-run.mjs) names its one use; nothing outside scripts/api/sonar imports this runner.
import { spawn } from 'node:child_process';
import { withTempEnv } from '../fs/ensure-temp-root.mjs';

/** The ChildProcess of one command line through the shell (stdout and stderr piped, a hidden window). */
export const scannerStart = (line, { cwd, env }) => spawn(line, withTempEnv({ cwd, env, shell: true, windowsHide: true }));
