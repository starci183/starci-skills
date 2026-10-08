// release-suite-mode.mjs - where the full suite of a release is judged, read from the checked-out owner config (config.yaml `release.suite`, engine/release-config.mjs):
//   local   the release cut runs the root suite and the Linux parity container, and the pre-push gate asks for their green rows (the shipped default)
//   ci      the owner's recorded choice (modules/kernel/owner-rulings.yaml release-suite-ci): the GitHub workflow runs the suite after the push; the cut and the gate ask for the rows CI cannot give
// The mode is read from the checkout the cut or the hook runs in. A release record names the mode it was cut under, but a record never decides it: the gate accepts a record that says `ci` only
// while this checkout's config says `ci` too. An owner file that is absent, unreadable or invalid reads as `local` (fail closed: the stricter mode).
import { inspectOwnerConfig } from '../../engine/config.mjs';
import { releaseSuiteMode, SUITE_MODES } from '../../engine/release-config.mjs';

export { SUITE_MODES };

/** The suite mode of the owner config under `root`: 'local' or 'ci'. */
export function suiteModeOf(root) {
  const { config, invalid, error } = inspectOwnerConfig(root);
  return invalid || error ? releaseSuiteMode(null) : releaseSuiteMode(config);
}
