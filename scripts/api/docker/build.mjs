// build.mjs - build exactly one declared app image from the application root; it never pushes or logs in.
import { dockerSpawn } from './lib.mjs';

const pathAt = (cwd, file) => cwd ? `${String(cwd).replace(/[\\/]+$/, '')}/${file}` : file;

/** The spawn result of `docker build -f <dockerfile> -t <tag> [--no-cache] .`. */
export const dockerBuild = ({ dockerfile, tag, noCache = false }, { cwd, docker = 'docker', timeout = 900_000 } = {}) =>
  dockerSpawn(['build', '-f', pathAt(cwd, dockerfile), '-t', tag, ...(noCache ? ['--no-cache'] : []), cwd ?? '.'], { docker, timeout });
