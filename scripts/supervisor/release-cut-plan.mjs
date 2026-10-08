// release-cut-plan.mjs - the two read-only looks of the release cut at what a release needs, before any suite runs:
//   definitionRefusal   the release definition (scripts/guards/release-definition.mjs) as far as it can hold before the cut has run anything:
//                       the version moved past the remote main's, the dated CHANGELOG section. The tag and the L4 record come from the cut itself.
//   sonarCloudRefusal    SonarCloud as far as the Sonar proofs need it (scripts/supervisor/release-sonarcloud.mjs): refused in seconds, before a 40-minute suite, when SONAR_TOKEN or SONAR_ORGANIZATION is absent, the token is rejected or the API is unreachable.
//   publishPlanRefusal  the publish plan of scripts/gates/release-plan.mjs: refused in seconds when it reports a package to publish or a blocker (the examples install the registry copy, so a cut over an unpublished package judges stale bytes for an hour).
//   planOf              `starci release cut --plan`: what the cut would run and push, and what the pre-push hook will then require. Nothing is run,
//                       tagged or pushed.
import { releaseFindings, RECEIPT_STEPS } from '../guards/release-definition.mjs';
import { exampleApps, planL4 } from './release-l4.mjs';
import { sonarCloudFindings } from './release-sonarcloud.mjs';
import { buildPlan, planSummary } from '../gates/release-plan.mjs';
import { npmRegistry } from '../gates/release-registry.mjs';

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

/** The refusal of a cut before any suite runs: the release definition, the publish plan, then SonarCloud; null when none refuses. */
export async function preSuiteRefusal({ repo, run, cwd, head, remote, branch, tag, deps = {} }) {
  return definitionRefusal({ run, cwd, head, remote, branch, tag, deps }) ?? publishPlanRefusal({ repo, deps }) ?? await sonarCloudRefusal({ repo, deps });
}

/** The result of `release cut --plan`: the steps the cut runs on this commit, the push it makes, the record the pre-push hook then asks for. */
export function planOf({ repo, head, tag, remote, branch, out }) {
  const l4 = planL4(repo);
  const steps = [...l4.steps.map((s) => s.name), ...l4.proofs, ...(l4.linux ? ['linux parity'] : [])];
  return { ...out, ok: true, verdict: 'plan', head, tag, steps, notPlanned: l4.notPlanned, receiptSteps: [...RECEIPT_STEPS],
    why: `would run ${steps.length} step(s) on ${head.slice(0, 9)} under the host lock, write the release record of that commit (green rows required: ${RECEIPT_STEPS.join(', ')}), create the annotated tag ${tag}, and push ${branch} with it to ${remote} in one atomic push; nothing was run, tagged or pushed` };
}
