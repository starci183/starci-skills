// live-launch-trust.mjs - the launch-trust step of an explicit live run (STARCI_ORCA_LIVE=1), which starts real agents in the
// owner's real agent homes. A spec run never writes agent trust unless it is re-rooted (scripts/agent/trust.mjs trustTargets),
// so the live smoke gives the trust step an environment without the test-runner marker: the targets are the real homes, and the
// owner's launchTrust roots still decide whether the launch repository is trusted (a root outside them is declined, nothing written).
import { ensureLaunchTrust } from '../../scripts/agent/trust-launch.mjs';

const TEST_RUNNER_MARKER = 'NODE_TEST_CONTEXT';

/** `env` as a copy without the test-runner marker. */
export const unmarkedEnv = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([name]) => name !== TEST_RUNNER_MARKER));

/** ensureLaunchTrust for startAgent's `io.spawn.trust` seam, run on the unmarked environment. */
export const liveLaunchTrust = (args) => ensureLaunchTrust({ ...args, env: unmarkedEnv(args.env) });
