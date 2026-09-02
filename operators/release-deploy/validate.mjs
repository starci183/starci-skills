// release.deploy's own law over one branch, on top of the shared step check: the receipt names the
// release, target, approval and rollback identity the request bound; no credential value appears
// anywhere; the two fallbacks are taken in order and recorded, and a branch nobody entered is `none`;
// monitoring stayed inside the deadline, a failing condition persisted across at least two
// observations before recovery, and one transient probe never became a branch; a foreign release
// terminates instead of being recovered; and steady state is proved by the digest, the targets and
// every declared probe across the whole window, never by a single observation.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SECRET = /(?:ghp_[A-Za-z0-9]{16,}|glpat-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})/;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const rows = (text, heading) => tableUnder(text, heading) ?? [];
const fields = (text, heading) => Object.fromEntries(rows(text, heading).map(([k, v]) => [k, v]));

export async function validateReleaseStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'release.deploy') return { errors };
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const has = (f) => existsSync(path.join(branchDir, f));

  if (empty(requirements.approval)) errors.push('request.json: approval has no default; changing what production serves is always something a person said yes to');
  const deadline = Number(requirements.steadyDeadline ?? 600);
  if (!Number.isFinite(deadline) || deadline <= 0) errors.push('request.json: steadyDeadline must be a positive number of seconds');
  const declaredProbes = Array.isArray(requirements.probes) ? requirements.probes : [];
  if (declaredProbes.length && !declaredProbes.some((p) => p.kind === 'public')) errors.push('request.json: at least one declared probe is public, because container health proves nothing a user could see');
  const rollback = requirements.rollbackIdentity ?? null;
  if (rollback && !DIGEST.test(rollback.digest ?? '')) errors.push('request.json: rollbackIdentity names no sha256 digest; a rollback by tag restores whatever the tag now points at');

  // Credentials are names, never values, in the request as much as in the receipt.
  for (const [key, value] of Object.entries(requirements)) {
    if (typeof value !== 'string') continue;
    if (SECRET.test(value) && !value.startsWith('secret-ref://')) errors.push(`request.json: requirements.${key} looks like a resolved credential value; handles are names, never values`);
  }

  // The two fallbacks are ordered: rollback is reachable only through an exhausted recovery.
  const fallbacks = response.fallbacks ?? [];
  if (fallbacks.includes('RECOVERY_EXHAUSTED') && !fallbacks.includes('ROLLOUT_FAILED')) errors.push('response/response.json: RECOVERY_EXHAUSTED was taken without ROLLOUT_FAILED; the rollback branch is reached only through an exhausted recovery');

  let probes = null;
  if (present.has('probes') && has('response/data/probes.json')) { try { probes = JSON.parse(await read('response/data/probes.json')); } catch { probes = null; } }
  if (probes) {
    if (probes.deadlineSeconds !== deadline) errors.push(`response/data/probes.json: monitored to ${probes.deadlineSeconds}s but the request pinned ${deadline}s`);
    if (probes.elapsedSeconds > probes.deadlineSeconds) errors.push('response/data/probes.json: monitoring ran past its own bounded deadline');
    if (probes.backoffSeconds > probes.deadlineSeconds) errors.push('response/data/probes.json: the backoff cannot exceed the deadline it sits inside');
    const declaredIds = new Set(declaredProbes.map((p) => p.probeId));
    for (const o of probes.observations) {
      for (const r of o.probeResults) if (declaredIds.size && !declaredIds.has(r.probeId)) errors.push(`response/data/probes.json: probe ${r.probeId} was observed but the request never declared it`);
      if (declaredIds.size) { const seen = new Set(o.probeResults.map((r) => r.probeId)); for (const id of declaredIds) if (!seen.has(id)) errors.push(`response/data/probes.json: the observation at ${o.observedAt} skipped declared probe ${id}`); }
    }
    // One transient probe never becomes recovery.
    const failing = probes.observations.filter((o) => o.condition === 'failing').length;
    if (fallbacks.includes('ROLLOUT_FAILED') && failing < 2) errors.push('response/data/probes.json: the recovery branch was taken after fewer than two failing observations; one transient probe is not a persistent failure');
    if (probes.finalCondition === 'steady' && probes.observations.at(-1)?.condition !== 'steady') errors.push('response/data/probes.json: the final condition is steady but the last observation is not');
    if (probes.finalCondition === 'deadline-exceeded' && response.status === 'done') errors.push('response/data/probes.json: the deadline was exceeded, which is STEADY_STATE_UNPROVEN, not a deployment');
  } else if (response.status === 'done') errors.push('response/data/probes.json: a done branch needs the monitored probe series');

  if (!(present.has('release-deployment') && has('response/response.md'))) {
    if (response.status === 'done') errors.push('response/response.md: a done branch needs the deployment receipt');
    return { errors };
  }
  const text = await read('response/response.md');
  if (SECRET.test(text)) errors.push('response/response.md: the receipt carries something shaped like a resolved credential value');
  const binding = fields(text, '## Binding');
  const outcome = fields(text, '## Outcome');
  const steps = rows(text, '## Steps');
  const monitoring = fields(text, '## Monitoring');
  const steady = fields(text, '## Steady state');

  if (!empty(requirements.release) && binding.Release !== requirements.release) errors.push(`response/response.md: Binding deploys ${binding.Release} but the request bound ${requirements.release}`);
  if (!empty(requirements.target) && binding.Target !== requirements.target) errors.push(`response/response.md: Binding names target ${binding.Target} but the request bound ${requirements.target}`);
  if (!empty(requirements.approval) && binding.Approval !== requirements.approval) errors.push('response/response.md: Binding names an approval the request did not bind');
  if (!DIGEST.test(binding.Digest ?? '')) errors.push('response/response.md: Binding names no sha256 digest; a release is identified by its digest, never by a tag');
  if (rollback && binding['Rollback identity'] !== rollback.releaseId) errors.push('response/response.md: Binding names a rollback identity the request did not declare');
  if (String(binding['Steady deadline']) !== String(deadline)) errors.push(`response/response.md: Binding says the deadline is ${binding['Steady deadline']} but the request pinned ${deadline}`);

  // The branch the receipt records is the branch the fallbacks say was taken.
  const expectedBranch = fallbacks.includes('RECOVERY_EXHAUSTED') ? 'rollback' : fallbacks.includes('ROLLOUT_FAILED') ? 'recover' : 'none';
  if (outcome.Branch !== expectedBranch) errors.push(`response/response.md: Branch is ${outcome.Branch} but the fallbacks taken say ${expectedBranch}`);
  if (expectedBranch === 'rollback' && outcome.Outcome !== 'rolled-back') errors.push('response/response.md: a rollback branch cannot report a deployed outcome; a restored release is its own terminal');
  if (expectedBranch !== 'rollback' && outcome.Outcome === 'rolled-back') errors.push('response/response.md: the outcome is rolled-back but no rollback branch was taken');
  if (outcome.Outcome === 'rolled-back' && !rollback) errors.push('response/response.md: a rollback happened with no declared rollback identity to restore');

  // Every effect is a compare-and-set: an applied mutating step moved a revision, a reading step did not.
  const MUTATING = new Set(['host-prepare', 'artifact-publish', 'migrate', 'domain-reconcile', 'rollout', 'recover', 'rollback']);
  for (const [step, state, before, after] of steps) {
    const at = `response/response.md: step ${step}`;
    if (MUTATING.has(step)) {
      if (state === 'applied' && (before === '—' || after === '—' || before === after)) errors.push(`${at} claims it applied without moving a revision`);
      if (state === 'no-op' && before !== after) errors.push(`${at} is a no-op and moved a revision anyway`);
    } else if (before !== '—' || after !== '—') errors.push(`${at} reports a revision for a boundary it never touched`);
  }
  const stepNames = new Set(steps.map(([s]) => s));
  if (expectedBranch === 'recover' && !stepNames.has('recover')) errors.push('response/response.md: the recovery fallback was taken but no recover step is recorded');
  if (expectedBranch === 'rollback' && !stepNames.has('rollback')) errors.push('response/response.md: the rollback fallback was taken but no rollback step is recorded');
  if (expectedBranch === 'none' && (stepNames.has('recover') || stepNames.has('rollback'))) errors.push('response/response.md: a branch step is recorded while the run took neither fallback');

  if (probes) {
    if (String(monitoring.Deadline) !== String(probes.deadlineSeconds)) errors.push('response/response.md: Monitoring deadline differs from the measured series');
    if (monitoring['Final condition'] !== probes.finalCondition) errors.push(`response/response.md: Monitoring says ${monitoring['Final condition']} but the series ended ${probes.finalCondition}`);
  }

  // Steady state is proved, not assumed.
  if (outcome.Outcome === 'deployed') {
    if (steady['Active digest'] !== binding.Digest) errors.push('response/response.md: the deployment is reported while another digest is active');
    const [available, of] = (steady['Available targets'] ?? '').split(' of ');
    if (available !== undefined && of !== undefined && Number(available) < Number(of)) errors.push(`response/response.md: ${available} of ${of} targets are available; a partly available target set is not steady state`);
    if (Number(steady['Superseded active'] ?? 0) > 0) errors.push('response/response.md: a superseded target is still active, so the old release is still serving traffic');
    if (probes && probes.finalCondition !== 'steady') errors.push('response/response.md: a deployment is reported while the observed series never reached steady');
    if (probes && probes.observations.length < 2) errors.push('response/response.md: steady state is claimed from a single observation');
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateReleaseStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid release.deploy branch\n');
}
