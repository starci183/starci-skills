// build.mjs - build exactly one declared app image from the application root; it never pushes or logs in.
import { dockerSpawn } from './lib.mjs';

const pathAt = (cwd, file) => {
  if (!cwd) return file;
  const value = String(cwd);
  let end = value.length;
  while (end > 0 && (value[end - 1] === '/' || value[end - 1] === '\\')) end -= 1;
  return `${value.slice(0, end)}/${file}`;
};

/** The spawn result of `docker build -f <dockerfile> -t <tag> [--no-cache] .`. */
export const build = ({ dockerfile, tag, noCache = false }, { cwd, docker = 'docker', timeout = 900_000 } = {}) =>
  dockerSpawn(['build', '-f', pathAt(cwd, dockerfile), '-t', tag, ...(noCache ? ['--no-cache'] : []), cwd ?? '.'], { docker, timeout });
