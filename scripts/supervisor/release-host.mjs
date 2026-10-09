// release-host.mjs - what the release host must provide before the L4 row starts, checked in seconds so the cut refuses early instead of failing an hour in:
//   an Orca terminal  the live Orca specs run with STARCI_REQUIRE_ORCA_LIVE=1 and the settle smokes own a Run through ORCA_TERMINAL_HANDLE; a cut started outside an Orca terminal
//                     skips them, and a skip from missing infrastructure fails L4 (release-l4.mjs skipReport)
//   Orca              the live Orca runtime answers (the junction probe creates and removes a throwaway repository in it)
//   a lockfile install  the root node_modules is the install package-lock.json declares (a package added to the lockfile since the last `npm ci` makes the checks and specs fail late)
//   Docker            a daemon answers: the example images, the stack-backed specs and the Linux parity container run in it
//   live smokes       the checkout is inside launchTrust and every provider the settle smokes launch has fresh quota (release-host-live.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { status as orcaStatus } from '../api/orca/status.mjs';
import { version as dockerVersion } from '../api/docker/version.mjs';
import { liveRowsMissing } from './release-host-live.mjs';

/** Whether a lockfile entry is installed only on some platforms or only as an optional dependency, so its absence from node_modules is no drift. */
const platformBound = (entry) => entry.optional === true || entry.os !== undefined || entry.cpu !== undefined;

/**
 * Why the root install of `root` is not the one its lockfile declares, or null: every package of package-lock.json that is not optional or platform-bound must be in node_modules/.package-lock.json at the same version.
 * Reads two files; no process is started.
 */
export function rootInstallProblem(root) {
  const read = (file) => { try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).packages ?? null; } catch { return null; } };
  const wanted = read('package-lock.json'), installed = read('node_modules/.package-lock.json');
  if (!wanted) return null;
  if (!installed) return 'node_modules holds no install record (node_modules/.package-lock.json)';
  const drift = Object.entries(wanted).filter(([key, entry]) => key !== '' && !entry.link && !platformBound(entry) && installed[key]?.version !== entry.version).map(([key]) => key.slice(key.lastIndexOf('node_modules/') + 13));
  return drift.length ? `${drift.length} package(s) of package-lock.json are missing or at another version in node_modules (${drift.slice(0, 5).join(', ')})` : null;
}

/** The needs of the release host that `env` and the live host do not meet: [{need, why, fix}], empty when the cut may start. */
export function releaseHostMissing({ env = process.env, orca = orcaStatus, docker = dockerVersion, repo = null, root = null, install = rootInstallProblem, live = liveRowsMissing } = {}) {
  const missing = [];
  const drift = root ? install(root) : null;
  if (drift) missing.push({ need: 'the lockfile install', why: drift, fix: 'run npm ci in the runtime root' });
  if (!String(env.ORCA_TERMINAL_HANDLE ?? '').trim()) {
    missing.push({ need: 'an Orca terminal', why: 'ORCA_TERMINAL_HANDLE is empty: the live Orca specs and the settle smokes would skip, and a skip from missing infrastructure fails L4', fix: 'run starci release cut from a terminal Orca owns (an Orca terminal tab), not from a desktop shell' });
  }
  const orcaState = orca();
  if (!orcaState.ok || !orcaState.reachable) {
    missing.push({ need: 'a reachable Orca', why: `the Orca runtime does not answer (${String(orcaState.error ?? orcaState.state ?? 'no answer').slice(0, 120)})`, fix: 'start Orca and wait until starci reconciler status shows it reachable' });
  }
  const daemon = docker();
  if (daemon.error || daemon.status !== 0) {
    missing.push({ need: 'a Docker daemon', why: 'no docker daemon answers: the example images, the stack-backed specs and the Linux parity container need one', fix: 'start Docker Desktop and wait until docker version answers' });
  }
  // The quota and trust readers need a reachable Orca and a launch repository: without them the needs above already name the refusal.
  if (repo && orcaState.ok && orcaState.reachable) missing.push(...live({ repo }));
  return missing;
}

/** One line for a refusal: every missing need with its fix. */
const needLine = (m) => [m.need, ' (', m.why, '; ', m.fix, ')'].join('');
export const releaseHostWhy = (missing) => `the release host is not ready: ${missing.map(needLine).join('; ')}`;
