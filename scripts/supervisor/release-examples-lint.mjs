// release-examples-lint.mjs - the L4 row `linux-examples-lint`: the examples workflow's own steps, up to and including its lint and Sonar-report steps, for every
// example app, run in the Linux container of the parity step (scripts/supervisor/release-linux-parity.mjs: HEAD as a tar of the tracked files, a throwaway git
// repository inside the container, every step DERIVED from .github/workflows/examples.yml with its working directory and job env, never restated here).
// It runs under every suite mode: under `suite: local` the full parity row runs these steps too, but under `suite: ci` (where the full parity is delegated to the
// candidate CI) this row stays local. alpha.22's second candidate run was red on examples.yml's `starci app lint` in every example: the sealed copy linked
// node_modules as a symlink, which git on Linux tracks as a file the `node_modules/` ignore line does not match. Only a Linux run of those exact steps sees
// that; the host (Windows) run of the example's own `npm run lint` does not.
import { runParity } from './release-linux-parity.mjs';

export const EXAMPLES_LINT_ROW = 'linux-examples-lint';
const WORKFLOW = 'examples.yml';
/** The builds of each app stay with the host's example rows and the candidate CI: this row proves the steps up to the lint and its Sonar report. */
const LEFT_OUT = /-end build/;

/**
 * The planned parity steps this row keeps (names are `<workflow file>:<job>[<app>]: <step>`): every step of the examples workflow but the builds (its spec suites
 * the parity plan already leaves out), and the root installs of ci.yml (the parity plan runs an identical root install once, under the first workflow that has it).
 */
function examplesLintSelect() {
  return (step) => (step.name.startsWith(`${WORKFLOW}:`) && !LEFT_OUT.test(step.name)) || /^ci.yml:[^:]+: Install /.test(step.name);
}

/** Run the row against `repo` (HEAD): the parity result, renamed to this row. `deps` are runParity's seams. */
export function runExamplesLint(repo, deps = {}) {
  const result = runParity(repo, { ...deps, select: examplesLintSelect() });
  return { ...result, name: EXAMPLES_LINT_ROW };
}
