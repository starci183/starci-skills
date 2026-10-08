// release-cut-plan.mjs - the two read-only looks of the release cut at what a release needs, before any suite runs:
//   definitionRefusal   the release definition (scripts/guards/release-definition.mjs) as far as it can hold before the cut has run anything:
//                       the version moved past the remote main's, the dated CHANGELOG section. The tag and the L4 record come from the cut itself.
//   sonarHostRefusal    the docker host as far as the local Sonar stack needs it (scripts/supervisor/release-sonar-host.mjs): refused in seconds, before a 40-minute suite, when the stack cannot come up.
//   planOf              `starci release cut --plan`: what the cut would run and push, and what the pre-push hook will then require. Nothing is run,
//                       tagged or pushed.
import { releaseFindings, RECEIPT_STEPS } from '../guards/release-definition.mjs';
import { exampleApps, planL4 } from './release-l4.mjs';
import { sonarHostFindings } from './release-sonar-host.mjs';

/** The head the remote main points at ('' for a remote with no main), or null when the remote cannot be read. */
function remoteMainHead({ run, cwd, remote, branch }) {
  const r = run(['ls-remote', remote, `refs/heads/${branch}`], { cwd });
  return r.ok ? r.stdout.split(/\s+/)[0] : null;
}

/** {verdict, why, findings} when the commit cannot become the release `tag` of `remote`, else null. `deps.findings` replaces the definition in specs. */
export function definitionRefusal({ run, cwd, head, remote, branch, tag, deps = {} }) {
  const remoteHead = remoteMainHead({ run, cwd, remote, branch });
  if (remoteHead === null) return { verdict: 'remote-unreachable', why: `could not read ${branch} of ${remote}`, findings: [] };
  const findings = (deps.findings ?? releaseFindings)({ cwd, commit: head, remoteCommit: remoteHead || null, tag, needTag: false, needReceipt: false });
  if (!findings.length) return null;
  return { verdict: 'release-definition', why: findings.map((f) => `${f.missing} (${f.fix})`).join('; '), findings };
}

/** {verdict, why, findings} when the docker host cannot bring up the local Sonar stack the L4 proofs need, else null. `deps.sonarHost` replaces the check in specs. */
export async function sonarHostRefusal({ repo, deps = {} }) {
  const findings = await (deps.sonarHost ?? sonarHostFindings)(exampleApps(repo));
  if (!findings.length) return null;
  return { verdict: 'sonar-host', why: `the local Sonar stack cannot come up on this host: ${findings.map((f) => `${f.what} (${f.fix})`).join('; ')}`, findings };
}

/** The result of `release cut --plan`: the steps the cut runs on this commit, the push it makes, the record the pre-push hook then asks for. */
export function planOf({ repo, head, tag, remote, branch, out }) {
  const l4 = planL4(repo);
  const steps = [...l4.steps.map((s) => s.name), ...l4.proofs, ...(l4.linux ? ['linux parity'] : [])];
  return { ...out, ok: true, verdict: 'plan', head, tag, steps, receiptSteps: [...RECEIPT_STEPS],
    why: `would run ${steps.length} step(s) on ${head.slice(0, 9)} under the host lock, write the release record of that commit (green rows required: ${RECEIPT_STEPS.join(', ')}), create the annotated tag ${tag}, and push ${branch} with it to ${remote} in one atomic push; nothing was run, tagged or pushed` };
}
