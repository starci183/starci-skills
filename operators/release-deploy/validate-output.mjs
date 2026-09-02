import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * A step either mutates the declared target or it does not. Mutating steps carry an observed revision
 * on both sides so every effect is a compare-and-set against the frozen release; the rest carry none,
 * because a revision on a read is an invented fact.
 */
const MUTATING_STEPS = new Set([
  'host-prepare',
  'artifact-publish',
  'migrate',
  'domain-reconcile',
  'rollout',
  'recover',
  'rollback',
]);

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt } = value.output;
  const {
    status,
    binding,
    credentialRefs,
    declaredProbeIds,
    steps,
    monitoring,
    steadyState,
    branch,
    recovery,
    rollback,
    failure,
    resume,
  } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (new Set(credentialRefs).size !== credentialRefs.length) {
    errors.push('credentialRefs repeats a credential handle');
  }
  if (new Set(declaredProbeIds).size !== declaredProbeIds.length) {
    errors.push('declaredProbeIds repeats a probe identifier');
  }

  const stateOf = new Map();
  for (const step of steps) {
    if (stateOf.has(step.step)) errors.push(`step ${step.step} is recorded more than once`);
    stateOf.set(step.step, step);

    const mutating = MUTATING_STEPS.has(step.step);
    if (mutating) {
      if (step.revisionBefore === null || step.revisionAfter === null) {
        errors.push(`step ${step.step} mutates the target and must record both observed revisions`);
        continue;
      }
      // A desired state that already matches is a proved idempotent no-op, never an application.
      if (step.state === 'applied' && step.revisionAfter === step.revisionBefore) {
        errors.push(`step ${step.step} claims to have applied a change without moving the observed revision`);
      }
      if ((step.state === 'no-op' || step.state === 'skipped') && step.revisionAfter !== step.revisionBefore) {
        errors.push(`step ${step.step} moved the observed revision while reporting ${step.state}`);
      }
    } else if (step.revisionBefore !== null || step.revisionAfter !== null) {
      errors.push(`step ${step.step} does not mutate the target and cannot record a revision`);
    }
  }

  // A release that appears mid-run and belongs to neither this release nor the one it replaces is
  // concurrent drift. It is replanned by its own owner, never recovered or rolled back from here.
  const foreign = new Set();
  if (monitoring !== null) {
    for (const observation of monitoring.observations) {
      for (const releaseId of observation.activeReleaseIds) {
        if (releaseId !== binding.releaseId && releaseId !== binding.replacedReleaseId) {
          foreign.add(releaseId);
        }
      }
    }
  }
  if (foreign.size > 0) {
    if (outcome !== 'blocked' || failure === null || failure.code !== 'CONCURRENT_DRIFT') {
      errors.push(`release ${[...foreign].join(', ')} appeared during execution and must stop this run as CONCURRENT_DRIFT`);
    }
    if (recovery !== null) errors.push('a run that observed concurrent drift cannot recover a release it does not own');
    if (rollback !== null) errors.push('a run that observed concurrent drift cannot roll back a release it does not own');
  }

  if (monitoring !== null) {
    if (monitoring.deadlineSeconds !== binding.deadlineSeconds) {
      errors.push('monitoring must observe the bound deadline');
    }
    if (monitoring.elapsedSeconds > monitoring.deadlineSeconds && monitoring.finalCondition !== 'deadline-exceeded') {
      errors.push('monitoring ran past its deadline without reporting deadline-exceeded');
    }
    const observations = monitoring.observations;
    for (let index = 1; index < observations.length; index += 1) {
      if (Date.parse(observations[index].observedAt) <= Date.parse(observations[index - 1].observedAt)) {
        errors.push('monitoring observations must advance in time');
      }
    }
    const last = observations[observations.length - 1];
    if (monitoring.finalCondition === 'steady' && last.condition !== 'steady') {
      errors.push('a steady final condition requires the last observation to be steady');
    }
  }

  // Steady state is proved, never assumed: the immutable digest is active, every declared target is
  // available, no superseded target lingers unless the strategy permits it, and every declared probe
  // passed across the whole window.
  if (steadyState !== null) {
    if (monitoring === null) errors.push('steady state cannot be claimed without monitoring evidence');
    else if (monitoring.finalCondition !== 'steady') {
      errors.push('steady state cannot be claimed while monitoring ends in another condition');
    }
    if (steadyState.activeDigest !== binding.digest) {
      errors.push('the active digest at steady state is not the immutable digest this run deployed');
    }
    if (steadyState.declaredTargets !== binding.declaredTargets) {
      errors.push('steady state must count the bound declared targets');
    }
    if (steadyState.availableTargets !== steadyState.declaredTargets) {
      errors.push('steady state requires every declared target to be available');
    }
    if (steadyState.supersededActive > 0 && binding.strategy !== 'blue-green') {
      errors.push(`the ${binding.strategy} strategy does not permit a superseded target to remain active`);
    }
    if (steadyState.windowSeconds < binding.steadyWindowSeconds) {
      errors.push('steady state was declared before the bound steady window elapsed');
    }
    const passing = new Set(
      steadyState.probeResults.filter((item) => item.status === 'pass').map((item) => item.probeId),
    );
    for (const probeId of declaredProbeIds) {
      if (!passing.has(probeId)) errors.push(`declared probe ${probeId} did not pass across the steady window`);
    }
  }

  if (branch === 'none' && (recovery !== null || rollback !== null)) {
    errors.push('a receipt with no branch cannot carry a recovery or a rollback');
  }
  if (branch === 'recover' && recovery === null) errors.push('the recover branch requires a recovery record');
  if (branch === 'rollback' && rollback === null) errors.push('the rollback branch requires a rollback record');
  if (rollback !== null && branch !== 'rollback') errors.push('a rollback record requires the rollback branch');

  if (recovery !== null) {
    if (branch === 'none') errors.push('a recovery record requires a branch');

    // One transient probe never becomes recovery; a failing condition has to persist.
    const failingCount = (monitoring?.observations ?? []).filter((item) => item.condition === 'failing').length;
    if (failingCount < 2) {
      errors.push('recovery requires at least two failing observations; one transient probe is not a failure');
    }

    // Recovery repeats only approved reversible actions and preserves the same release identity.
    const attempts = [...recovery.attempts].sort((left, right) => left.attempt - right.attempt);
    attempts.forEach((attempt, index) => {
      if (attempt.attempt !== index + 1) errors.push('recovery attempts must be numbered contiguously from one');
      if (attempt.releaseId !== binding.releaseId) {
        errors.push(`recovery attempt ${attempt.attempt} acts on a release other than the one being deployed`);
      }
    });
    if (recovery.exhausted && outcome === 'deployed') {
      errors.push('exhausted recovery cannot end in a successful deployment');
    }
    if (!recovery.exhausted && recovery.attempts.every((item) => item.outcome === 'failed')) {
      errors.push('recovery whose every attempt failed is exhausted');
    }
  }

  if (outcome === 'deployed') {
    if (steadyState === null) errors.push('a deployed release must prove its steady state');
    if (monitoring === null) errors.push('a deployed release must carry its monitoring evidence');
    if (rollback !== null) errors.push('a deployed release cannot also record a rollback');
    if (failure !== null) errors.push('a deployed release cannot carry a failure');
    if (resume !== null) errors.push('a deployed release cannot carry a resume');
    const rollout = stateOf.get('rollout');
    if (rollout === undefined || rollout.state === 'failed') {
      errors.push('a deployed release requires a rollout step that did not fail');
    }
    if (!stateOf.has('monitor')) errors.push('a deployed release requires a monitor step');
    if (!receipt.evidenceRefs.includes(binding.authorizationRef)) {
      errors.push('a deployed release must carry its declared authorization as evidence');
    }
  }

  if (outcome === 'rolled-back') {
    if (branch !== 'rollback') errors.push('a rolled-back run must record the rollback branch');
    if (steadyState !== null) {
      errors.push('a rolled-back run never reaches steady state for the release it rejected');
    }
    if (rollback !== null) {
      // A rolled-back release is its own terminal outcome and must never read as delivery.
      if (rollback.toReleaseId === binding.releaseId) {
        errors.push('a rollback that restores the rejected release is not a rollback');
      }
      if (rollback.toDigest === binding.digest) {
        errors.push('a rollback that restores the rejected artifact is not a rollback');
      }
      if (rollback.revisionAfter === rollback.revisionBefore) {
        errors.push('a rollback must move the observed revision');
      }
    }
    const step = stateOf.get('rollback');
    if (step === undefined || step.state !== 'applied') {
      errors.push('a rolled-back run requires an applied rollback step');
    }
    if (failure !== null) errors.push('a rolled-back run reports its own terminal outcome, not a failure');
    if (resume !== null) errors.push('a rolled-back run cannot carry a resume');
  }

  if (outcome === 'blocked') {
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
    if (steadyState !== null) errors.push('a blocked receipt cannot claim steady state');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
