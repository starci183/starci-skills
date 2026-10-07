// scripts/api/docker/lib.mjs — the runner of the docker CLI: `docker <args>` waited for, utf8 text, a hidden window, never a
// shell. The call files beside it (container-inspect.mjs, container-lifecycle.mjs, container-rm.mjs, run.mjs, version.mjs)
// each name one use; nothing outside scripts/api/docker imports this runner. Options past docker and timeout (stdio, env, cwd,
// maxBuffer) pass through to spawnSync, so a long run can write its output to a file instead of a buffer.
import { spawnSync } from 'node:child_process';
import { withTempEnv } from '../../../engine/temp-root.mjs';

/** `<docker> <args>` (docker: the binary, default docker on PATH); the spawnSync result {status, stdout, stderr, error}. */
export const dockerSpawn = (args, { docker = 'docker', timeout = 15_000, ...options } = {}) => spawnSync(docker, args, withTempEnv({ encoding: 'utf8', windowsHide: true, timeout, ...options }));
