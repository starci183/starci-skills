// release-ci-rows.mjs - the L4 plan of a release cut under `suite: ci` (config.yaml release.suite, modules/supervisor/release-cut.yaml suite.ci): the root suite and the Linux parity container are
// delegated to CI, so the plan holds no `npm test` row and no `linux-parity` row; it holds, beside the packages suites, the checks and the example rows, two rows of its own:
//   affected tests     the specs of the release range (scripts/supervisor/release-affected.mjs), selected as `starci test affected` selects them
//   orca live smokes   the live Orca specs with the L4 env: CI has no Orca
// The delegated rows are named in the plan, the result and the release record as `delegated`, never as green. Pure over the plan it receives.
import { readModuleJson } from '../../engine/runtime-root.mjs';

export const PRELOADS = Object.freeze(['low-priority', 'isolated-temp', 'isolated-registry', 'runtime-copies'].map((name) => `./tests/setup/${name}.mjs`));

/** The declared ci-mode policy of release-cut.yaml. */
export const ciPolicy = () => readModuleJson('modules', 'supervisor', 'release-cut.yaml').suite.ci;

/** The names of the rows a `suite: ci` cut delegates to CI, with the reason of each: [{name, why}]. */
const delegatedRows = (policy = ciPolicy()) => policy.delegated.map(({ name, why }) => ({ name, why }));

/** The plan of `plan` under `suite: ci`: the delegated steps removed, the two local rows added after the other root rows, no Linux step. `env` is the L4 spec env (specEnv). */
export function ciPlan({ plan, repo, env, policy = ciPolicy() }) {
  const gone = new Set(policy.delegated.map((row) => row.name));
  const affected = { name: policy.affected.row, cmd: 'node', args: [policy.affected.script], cwd: repo, affected: true };
  const orca = { name: policy.orca.row, cmd: 'node', args: [...PRELOADS.flatMap((preload) => ['--import', preload]), '--test', ...policy.orca.specs], cwd: repo, env };
  const root = plan.steps.filter((step) => !gone.has(step.name));
  const at = root.findLastIndex((step) => step.cwd === repo) + 1;
  return { ...plan, steps: [...root.slice(0, at), affected, orca, ...root.slice(at)], linux: false, mode: 'ci', delegated: delegatedRows(policy) };
}

/** The schedule settings of a plan: under `suite: ci` the example apps wait for the row the ci policy names (the root suite they wait for in local mode is not planned). */
export const ciSettings = (plan, settings) => (plan.mode === 'ci' ? { ...settings, appsAfter: ciPolicy().appsAfter } : settings);

const SUMMARY_LINE = /^RELEASE_AFFECTED ({.*})s*$/m;

/**
 * The extra fields of the `affected tests` row from its log: `selection`, the summary line the script printed (the range, the bound, the counts of files selected, run, reused, passed and failed, the commits
 * covered by which evidence, the specs not run locally). The script runs each spec file in its own process and keeps no test-level output, so the row holds no skips: the evidence rule's second leg for those specs is CI.
 */
export function affectedRowExtras(text) {
  const hit = SUMMARY_LINE.exec(String(text ?? ''));
  let selection = null;
  try { selection = hit ? JSON.parse(hit[1]) : null; } catch { selection = null; }
  return { skips: [], selection };
}
