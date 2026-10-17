// release-host.mjs - what the release host must provide before the L4 row starts, checked in seconds so the cut refuses early instead of failing an hour in:
//   a lockfile install  the root node_modules is the install package-lock.json declares (a package added to the lockfile since the last `npm ci` makes the checks and tests fail late)
//   Docker            a daemon answers: the scaffold e2e, the example images and stacks and the Linux parity container run in it
// No Orca terminal, no reachable Orca and no fresh provider quota are needed: those served only the runtime's live Orca specs and settle smokes, which are gone with
// the runtime specs (owner ruling no-runtime-specs, 2026-10-17), so a cut runs from a plain shell.
import { version as dockerVersion } from '../api/docker/version.mjs';
import { rootInstallProblem } from '../machine/npm-install-state.mjs';

/** The needs of the release host that the live host does not meet: [{need, why, fix}], empty when the cut may start. */
export function releaseHostMissing({ docker = dockerVersion, root = null, install = rootInstallProblem } = {}) {
  const missing = [];
  const drift = root ? install(root) : null;
  if (drift) missing.push({ need: 'the lockfile install', why: drift, fix: 'run npm ci in the runtime root' });
  const daemon = docker();
  if (daemon.error || daemon.status !== 0) {
    missing.push({ need: 'a Docker daemon', why: 'no docker daemon answers: the scaffold e2e, the example images and stacks and the Linux parity container need one', fix: 'start Docker Desktop and wait until docker version answers' });
  }
  return missing;
}

/** One line for a refusal: every missing need with its fix. */
const needLine = (m) => [m.need, ' (', m.why, '; ', m.fix, ')'].join('');
export const releaseHostWhy = (missing) => `the release host is not ready: ${missing.map(needLine).join('; ')}`;
