// release-host.mjs - what the release host must provide before the L4 row starts, checked in seconds so the cut refuses early instead of failing an hour in:
//   an Orca terminal  the live Orca specs run with STARCI_REQUIRE_ORCA_LIVE=1 and the settle smokes own a Run through ORCA_TERMINAL_HANDLE; a cut started outside an Orca terminal
//                     skips them, and a skip from missing infrastructure fails L4 (release-l4.mjs skipReport)
//   Orca              the live Orca runtime answers (the junction probe creates and removes a throwaway repository in it)
//   Docker            a daemon answers: the example images, the stack-backed specs and the Linux parity container run in it
//   live smokes       the checkout is inside launchTrust and every provider the settle smokes launch has fresh quota (release-host-live.mjs)
import { status as orcaStatus } from '../api/orca/status.mjs';
import { version as dockerVersion } from '../api/docker/version.mjs';
import { liveRowsMissing } from './release-host-live.mjs';

/** The needs of the release host that `env` and the live host do not meet: [{need, why, fix}], empty when the cut may start. */
export function releaseHostMissing({ env = process.env, orca = orcaStatus, docker = dockerVersion, repo = null, live = liveRowsMissing } = {}) {
  const missing = [];
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
