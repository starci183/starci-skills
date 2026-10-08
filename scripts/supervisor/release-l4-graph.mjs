// release-l4-graph.mjs - the rows of an L4 plan as a schedule graph (release-l4-schedule.mjs runGraph), in the order the release cut runs them (modules/supervisor/release-cut.yaml schedule):
//   prep         the installs and the test-world build, together
//   containers   the Linux parity container starts at once and runs beside everything (it works on its own copy of HEAD inside Docker)
//   root         the root rows one after another (the suite keeps the machine); the spec leg of the parity container follows the suite, its skips decide which spec files it runs
//   apps         when the row named by `appsAfter` has ended, every example app's rows start together, each app's own rows in their order
//   proofs       a Sonar proof starts when its app's rows have ended; the proofs of the apps run together
// A row already green for this commit (or reused from another one) is `carry`: its recorded result stands in and nothing runs.
import { appChainLimit, once } from './release-l4-schedule.mjs';

export const LINUX_ROW = 'linux-parity';
export const SPECS_ROW = 'linux-specs';

const carriedOr = (carry, name, work) => () => carry[name] ?? work();

/** The prep rows, then the root chain (each after the one before), and the id the app chains wait for. */
function rootRows({ steps, settings, carry, tasks, appOf }) {
  const prep = steps.filter((s) => s.install || s.prep);
  const root = steps.filter((s) => !prep.includes(s) && !appOf(s));
  const rows = prep.map((s) => ({ id: s.name, pool: 'prep', after: [], run: carriedOr(carry, s.name, () => tasks.step(s)) }));
  let before = prep.map((s) => s.name);
  for (const s of root) {
    rows.push({ id: s.name, pool: 'root', after: before, run: carriedOr(carry, s.name, () => tasks.step(s)) });
    before = [s.name];
  }
  const gate = root.find((s) => s.name === settings.appsAfter)?.name ?? root.at(-1)?.name;
  return { rows, trigger: gate ? [gate] : before };
}

/** Each app's chain after the trigger, and each proof after the tail of its app's chain: the rows, plus the Linux rows. */
function appRows({ plan, apps, carry, tasks, trigger, appOf }) {
  const rows = [], tails = {};
  for (const app of apps) {
    let before = trigger;
    for (const s of plan.steps.filter((step) => !step.install && !step.prep && appOf(step) === app)) {
      rows.push({ id: s.name, pool: 'apps', after: before, run: carriedOr(carry, s.name, () => tasks.step(s)) });
      before = [s.name];
    }
    tails[app.name] = before;
  }
  for (const name of plan.proofs) {
    const owner = apps.find((app) => name.startsWith(`${app.name}: `));
    rows.push({ id: name, pool: 'proofs', after: owner ? tails[owner.name] : trigger, run: carriedOr(carry, name, () => tasks.proof(name)) });
  }
  return rows;
}

/**
 * The graph of `plan`: {rows, limits}. `tasks` = {step(step), proof(name), parity(), specs()} do the work; `carry` maps a row name to the result that stands in for running it.
 * `deps.hostSample` replaces the host probe that bounds the number of app chains running together.
 */
export function l4Graph({ plan, apps, settings, tasks, carry = {}, deps = {} }) {
  const appOf = (step) => apps.find((app) => step.cwd === app.dir);
  const root = rootRows({ steps: plan.steps, settings, carry, tasks, appOf });
  const rows = [...root.rows, ...appRows({ plan, apps, carry, tasks, trigger: root.trigger, appOf })];
  if (plan.linux && tasks.parity) {
    const evidence = plan.steps.find((s) => s.evidence);
    rows.push(
      { id: LINUX_ROW, pool: 'containers', after: [], run: carriedOr(carry, LINUX_ROW, () => tasks.parity()) },
      { id: SPECS_ROW, pool: 'containers', after: evidence ? [evidence.name] : [], run: () => (carry[LINUX_ROW] ? null : tasks.specs()) },
    );
  }
  const { pools } = settings;
  return { rows, limits: { prep: pools.prep, root: pools.root, apps: once(() => appChainLimit({ settings, deps })), proofs: pools.proofs, containers: pools.containers } };
}
