// proof-build.mjs - build one release-proof image from its declared Dockerfile and app-root context.
import { dockerSpawn } from './lib.mjs';

/** The spawn result of `docker build -f <dockerfile> -t <tag> .`. */
export const proofBuild = ({ dockerfile, tag }, { cwd, docker = 'docker', timeout = 900_000 } = {}) =>
  dockerSpawn(['build', '-f', dockerfile, '-t', tag, '.'], { cwd, docker, timeout });
