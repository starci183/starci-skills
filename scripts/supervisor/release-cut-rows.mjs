// release-cut-rows.mjs - which L4 rows a release cut runs, which stand in from an earlier run, and what is written down afterwards (the reuse rules: release-reuse.mjs).
//   selectionFor   the plan of the cut with the decision per row: run, carry (green on this commit) or reuse (identical inputs on another commit); `--rows` runs only the named rows
//   refusalFor     `--rows` naming a row the plan does not hold, or leaving a row that is not green on this commit: the cut refuses before it runs anything
//   combine        the rows the suite ran together with the stand-in rows, in plan order
//   remember       the ledger of this cut (the green rows with their digests) for the next one
import { exampleApps, planL4 } from './release-l4.mjs';
import { LINUX_ROW } from './release-l4-graph.mjs';
import { chooseRows, readLedgers, signatureOf, treeEntries, writeLedger } from './release-reuse.mjs';

/** The rows of a plan in the order the record lists them: the steps, the proofs, the Linux row. */
const namesOf = (plan) => [...plan.steps.map((s) => s.name), ...plan.proofs, ...(plan.linux ? [LINUX_ROW] : [])];

/** {plan, names, decisions, digests, unknown, carry}: `rows` is the list of --rows names (null for a whole cut), `reuse` false for --no-reuse. Seams: runtimeRoot, treeEntries, ledgers. */
export function selectionFor({ repo, head, rows, reuse, deps = {} }) {
  const plan = planL4(repo, deps.runtimeRoot ? { runtimeRoot: deps.runtimeRoot } : {});
  const names = namesOf(plan);
  const signatures = Object.fromEntries(plan.steps.map((s) => [s.name, signatureOf(s)]));
  const entries = (deps.treeEntries ?? treeEntries)({ repo, commit: head });
  const ledgers = (deps.ledgers ?? (() => readLedgers({ repo })))();
  const chosen = chooseRows({ names, signatures, apps: exampleApps(repo).map((app) => app.name), entries, ledgers, head, only: rows ?? null, noReuse: reuse === false });
  const carry = Object.fromEntries(chosen.decisions.filter((d) => d.row).map((d) => [d.name, d.row]));
  return { plan, names, ...chosen, carry };
}

/** {verdict, why} when --rows cannot be served, else null. */
export function refusalFor(selection, rows) {
  if (!rows) return null;
  if (!rows.length) return { verdict: 'rows-unknown', why: '--rows names no row' };
  if (selection.unknown.length) return { verdict: 'rows-unknown', why: `--rows names ${selection.unknown.join(', ')}, which the plan does not hold (starci release cut --plan lists the rows)` };
  const missing = selection.decisions.filter((d) => d.action === 'missing').map((d) => d.name);
  if (missing.length) return { verdict: 'rows-incomplete', why: `--rows re-runs rows alone only when every other row is green on this commit; not green here: ${missing.join(', ')} (cut without --rows)` };
  return null;
}

/** Whether any Sonar proof will run (SonarCloud is needed only then). */
export const needsSonar = (selection) => selection.decisions.some((d) => d.action === 'run' && d.name.endsWith(': sonar'));

/** The rows of the cut in plan order: stand-in rows and the rows the suite ran; a row the plan does not hold keeps the suite's order after them. */
export function combine(selection, ran) {
  const byName = new Map([...Object.entries(selection.carry), ...ran.map((row) => [row.name, row])]);
  const planned = selection.names.flatMap((name) => byName.get(name) ?? []);
  return [...planned, ...ran.filter((row) => !selection.names.includes(row.name))];
}

/** Leave the ledger of this cut (green rows with their digests); never throws, a ledger that cannot be written costs only the next cut's reuse. */
export function remember({ repo, head, tag, rows, selection, deps = {} }) {
  return (deps.writeLedger ?? writeLedger)({ repo, head, tag, rows, digests: selection.digests });
}

/** The per-row lines of a plan or a result: [{name, action, why, from?}]. */
export const decisionLines = (selection) => selection.decisions.map(({ name, action, why, from }) => ({ name, action, why, ...(from ? { from } : {}) }));
