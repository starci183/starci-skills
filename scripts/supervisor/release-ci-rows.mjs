// release-ci-rows.mjs - the L4 plan of a release cut under `suite: ci` (config.yaml release.suite, modules/supervisor/release-cut.yaml suite.ci): the Linux parity container is
// delegated to CI, so the plan holds no `linux-parity` row; the root rows (the package clean-test, the scaffold e2e, the check) and the example rows stay local.
// The delegated rows are named in the plan, the result and the release record as `delegated`, never as green. Pure over the plan it receives.
import { readModuleJson } from '../../engine/runtime-root.mjs';

/** The declared ci-mode policy of release-cut.yaml. */
export const ciPolicy = () => readModuleJson('modules', 'supervisor', 'release-cut.yaml').suite.ci;

/** The names of the rows a `suite: ci` cut delegates to CI, with the reason of each: [{name, why}]. */
const delegatedRows = (policy = ciPolicy()) => policy.delegated.map(({ name, why }) => ({ name, why }));

/** The plan of `plan` under `suite: ci`: the delegated steps removed, no Linux step. */
export function ciPlan({ plan, policy = ciPolicy() }) {
  const gone = new Set(policy.delegated.map((row) => row.name));
  return { ...plan, steps: plan.steps.filter((step) => !gone.has(step.name)), linux: false, mode: 'ci', delegated: delegatedRows(policy) };
}

/** The schedule settings of a plan: under `suite: ci` the example apps wait for the row the ci policy names. */
export const ciSettings = (plan, settings) => (plan.mode === 'ci' ? { ...settings, appsAfter: ciPolicy().appsAfter } : settings);
