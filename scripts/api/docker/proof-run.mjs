// proof-run.mjs - start one proof container detached, labelled to its StarCi project, with no published ports.
import { dockerSpawn } from './lib.mjs';

/** The spawn result; stdout is the exact container id. No -p or -P option is admitted here. */
export const proofRun = ({ tag, project }, { docker = 'docker', timeout = 30_000 } = {}) =>
  dockerSpawn(['run', '--detach', '--label', `starci.project=${project}`, tag], { docker, timeout });
