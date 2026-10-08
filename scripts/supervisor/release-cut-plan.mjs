// release-cut-plan.mjs - the two read-only looks of the release cut at what a release needs, before any suite runs:
//   definitionRefusal   the release definition (scripts/guards/release-definition.mjs) as far as it can hold before the cut has run anything:
//                       the version moved past the remote main's, the dated CHANGELOG section. The tag and the L4 record come from the cut itself.
//   sonarCloudRefusal    SonarCloud as far as the Sonar proofs need it (scripts/supervisor/release-sonarcloud.mjs): refused in seconds, before a 40-minute suite, when SONAR_TOKEN or SONAR_ORGANIZATION is absent, the token is rejected or the API is unreachable.
//   publishPlanRefusal  the publish plan of scripts/gates/release-plan.mjs: refused in seconds when it reports a package to publish or a blocker (the examples install the registry copy, so a cut over an unpublished package judges stale bytes for an hour).
//   planOf              `starci release cut --plan`: what the cut would run and push, and what the pre-push hook will then require. Nothing is run,
//                       tagged or pushed.
import { releaseFindings, RECEIPT_STEPS, RECEIPT_STEPS_CI } from '../guards/release-definition.mjs';
import { exampleApps } from './release-l4.mjs';
import { decisionLines } from './release-cut-rows.mjs';
import { sonarCloudFindings } from './release-sonarcloud.mjs';
import { buildPlan, planSummary } from '../gates/release-plan.mjs';
import { npmRegistry } from '../gates/release-registry.mjs';
import { leftoversRefusal } from '../gates/release-leftovers.mjs';

/** The head the remote main points at ('' for a remote with no main), or null when the remote cannot be read. */
function remoteMainHead({ run, cwd, remote, branch }) {
  const r = run(['ls-remote', remote, `refs/heads/${branch}`], { cwd });
  return r.ok ? r.stdout.split(/\s+/)[0] : null;
}

/** {verdict, why, findings} when the commit cannot become the release `tag` of `remote`, else null. `deps.findings` replaces the definition in specs. */
function definitionRefusal({ run, cwd, head, remote, branch, tag, deps = {} }) {
  const remoteHead = remoteMainHead({ run, cwd, remote, branch });
  if (remoteHead === null) return { verdict: 'remote-unreachable', why: `could not read ${branch} of ${remote}`, findings: [] };
  const findings = (deps.findings ?? releaseFindings)({ cwd, commit: head, remoteCommit: remoteHead || null, tag, needTag: false, needReceipt: false });
  if (!findings.length) return null;
  return { verdict: 'release-definition', why: findings.map((f) => `${f.missing} (${f.fix})`).join('; '), findings };
}

/** {verdict, why, findings} when SonarCloud cannot serve the Sonar proofs of L4, else null. `deps.sonarCloud` replaces the check in specs. */
export async function sonarCloudRefusal({ repo, deps = {} }) {
  const findings = await (deps.sonarCloud ?? sonarCloudFindings)(exampleApps(repo));
  if (!findings.length) return null;
  const described = findings.map((f) => `${f.what} (${f.fix})`);
  return { verdict: 'sonar-cloud', why: `the Sonar proofs cannot reach SonarCloud: ${described.join('; ')}`, findings };
}

/** {verdict, why, findings} when the publish plan reports packages to publish or blockers, else null. `deps.publishPlan` replaces the registry read in specs. */
export function publishPlanRefusal({ repo, deps = {} }) {
  const summary = deps.publishPlan ? deps.publishPlan(repo) : planSummary(buildPlan({ root: repo, registry: npmRegistry({ root: repo }), scope: 'packages' }));
  const findings = [...summary.blockers, ...summary.toPublish.map((name) => `${name} is not on the registry: publish it`)];
  if (!findings.length) return null;
  return { verdict: 'publish-plan', why: `the publish plan (starci release check) is not clean: ${findings.join('; ')}`, findings };
}

/** The refusal of a cut before any suite runs: leftovers in the checkout, the release definition, the publish plan, then SonarCloud (only when a Sonar proof will run); null when none refuses. */
export async function preSuiteRefusal({ repo, run, cwd, head, remote, branch, tag, deps = {}, sonar = true }) {
  return leftoversRefusal({ repo, deps }) ?? definitionRefusal({ run, cwd, head, remote, branch, tag, deps }) ?? publishPlanRefusal({ repo, deps }) ?? (sonar ? await sonarCloudRefusal({ repo, deps }) : null);
}

/** The result of `release cut --plan`: every row of the cut with what happens to it (run, or stand in from this commit or an earlier one, and why), the push it makes, the record the pre-push hook then asks for. */
export function planOf({ head, tag, remote, branch, out, selection }) {
  const l4 = selection.plan;
  const rows = decisionLines(selection);
  const running = rows.filter((row) => row.action === 'run');
  const delegated = rows.filter((row) => row.action === 'delegated');
  const required = l4.mode === 'ci' ? RECEIPT_STEPS_CI : RECEIPT_STEPS;
  const named = delegated.map((row) => [row.name, row.why].join(': ')).join('; ');
  const suite = l4.mode === 'ci' ? `suite: ci - the full suite is CI's (${named}); the record lists them as delegated, never green. ` : 'suite: local. ';
  return { ...out, ok: true, verdict: 'plan', head, tag, suiteMode: l4.mode, steps: selection.names, rows, notPlanned: l4.notPlanned, receiptSteps: [...required],
    why: `${suite}would run ${running.length} of ${rows.length - delegated.length} row(s) on ${head.slice(0, 9)} under the host lock (${rows.length - delegated.length - running.length} stand in from green runs, listed in rows), write the release record of that commit (rows RUN on it, never reused: ${required.join(', ')}), create the annotated tag ${tag}, and push ${branch} with it to ${remote} in one atomic push; nothing was run, tagged or pushed` };
}
