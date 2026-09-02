import { validatorFor, runValidatorCli } from './validation.mjs';

function sameSet(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

// COVERAGE-1 (knowledge/ui/composition/coverage.md): a decided receipt enumerates what a later
// operator has to exercise. The schema keeps `coverage` optional so older fixtures still parse; a
// decided decision that declares actions, regions, states, or responsive branches must carry the
// matching enumeration here. There is no coverage-specific failure code in the schema enum, so a
// receipt that omits it is rejected with INVALID_INPUT-class semantics: the message names COVERAGE-1.
function coverageErrors(decision) {
  const errors = [];
  const coverage = decision.coverage;
  const declares =
    decision.actionModel.length > 0 ||
    decision.regionModel.length > 0 ||
    decision.stateMatrix.length > 0 ||
    decision.responsiveModel.length > 0;
  if (coverage === undefined || coverage === null) {
    if (declares) errors.push('COVERAGE-1: a decided decision must carry decision.coverage');
    return errors;
  }

  if (decision.actionModel.length > 0) {
    const actions = coverage.actions ?? [];
    if (actions.length === 0) errors.push('COVERAGE-1: coverage.actions must enumerate every declared action');
    for (const entry of actions) {
      for (const path of entry.pendingPaths ?? []) {
        if (!path.settlement) errors.push(`COVERAGE-1: pending path without a settlement: ${entry.action}`);
      }
    }
  }

  if (decision.regionModel.length > 0) {
    const regions = coverage.regions ?? [];
    if (regions.length === 0) errors.push('COVERAGE-1: coverage.regions must enumerate every declared region');
    const covered = regions.map((item) => item.region);
    for (const region of decision.regionModel) {
      if (!covered.includes(region.id)) errors.push(`COVERAGE-1: region is not covered: ${region.id}`);
    }
    for (const region of regions) {
      if (!decision.regionModel.some((item) => item.id === region.region)) {
        errors.push(`COVERAGE-1: coverage names a region the direction does not declare: ${region.region}`);
      }
    }
  }

  if (decision.stateMatrix.length > 0) {
    const states = coverage.states ?? [];
    if (states.length === 0) errors.push('COVERAGE-1: coverage.states must enumerate every named meaning');
    const carriers = states.map((item) => item.carrier);
    if (new Set(carriers).size !== carriers.length) {
      errors.push('COVERAGE-1: two meanings share one carrier in coverage.states');
    }
  }

  if (decision.responsiveModel.length > 0) {
    const branches = coverage.responsive ?? [];
    if (branches.length === 0) errors.push('COVERAGE-1: coverage.responsive must enumerate every responsive branch');
    const names = branches.map((item) => item.branch);
    if (new Set(names).size !== names.length) {
      errors.push('COVERAGE-1: a responsive branch is named twice, so it has more than one owner');
    }
  }

  return errors;
}

function findings(receipt) {
  return [
    ...receipt.challenge.add,
    ...receipt.challenge.change,
    ...receipt.challenge.remove,
    ...receipt.challenge.contradictions,
  ];
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, evidenceRefs, artifactRefs, handoff } = value.output;
  const { decision, alternatives, failure, resume, binding } = receipt;

  if (handoff !== null) errors.push('fe.direction.decide never emits a handoff');
  if (!sameSet(receipt.evidenceRefs, evidenceRefs)) {
    errors.push('receipt.evidenceRefs and output.evidenceRefs must be identical sets');
  }

  const artifactRoot = binding.artifactRootRef.replace(/[\\/]+$/, '');
  for (const ref of artifactRefs) {
    if (!(ref === artifactRoot || ref.startsWith(`${artifactRoot}/`) || ref.startsWith(`${artifactRoot}\\`))) {
      errors.push(`artifact ref must stay under artifactRootRef: ${ref}`);
    }
  }

  if (outcome === 'decided') {
    if (receipt.status !== 'decided' || decision === null || failure !== null || resume !== null) {
      errors.push('decided outcome requires a decided receipt with decision and no failure/resume');
    }
    if (findings(receipt).some((item) => item.severity === 'error')) {
      errors.push('decided receipt cannot retain error findings');
    }
  }

  if (outcome === 'blocked') {
    if (receipt.status !== 'blocked' || decision !== null || failure === null) {
      errors.push('blocked outcome requires a blocked receipt with null decision and typed failure');
    }
  }

  if (failure !== null) {
    if (failure.retryable !== (resume !== null)) {
      errors.push('retryable failure and resume presence must agree');
    }
    if (failure.code === 'DIRECTION_CHOICE_REQUIRED') {
      if (alternatives.length < 3 || alternatives.length > 4) {
        errors.push('DIRECTION_CHOICE_REQUIRED requires three or four alternatives');
      }
      if (resume === null || !sameSet(resume.candidateAlternativeIds, alternatives.map((item) => item.id))) {
        errors.push('choice resume candidate IDs must equal alternative IDs');
      }
    } else if (alternatives.length !== 0) {
      errors.push('only DIRECTION_CHOICE_REQUIRED or selected-alternative may retain alternatives');
    }
  }

  const alternativeIds = alternatives.map((item) => item.id);
  if (new Set(alternativeIds).size !== alternativeIds.length) errors.push('alternative IDs must be unique');
  const directionRefs = alternatives.map((item) => item.directionRef);
  if (new Set(directionRefs).size !== directionRefs.length) errors.push('alternative direction refs must be unique');
  for (const alternative of alternatives) {
    for (const ref of alternative.visualArtifactRefs) {
      if (!artifactRefs.includes(ref)) errors.push(`alternative visual artifact is not registered: ${ref}`);
    }
  }

  if (decision !== null) {
    for (const ref of decision.visualArtifactRefs) {
      if (!artifactRefs.includes(ref)) errors.push(`decision visual artifact is not registered: ${ref}`);
    }
    const orders = decision.regionModel.map((item) => item.order);
    if (new Set(orders).size !== orders.length) errors.push('region order values must be unique');
    errors.push(...coverageErrors(decision));

    if (decision.classification === 'locked-refine') {
      if (binding.changeLevel !== 'refine') errors.push('locked-refine requires changeLevel refine');
      if (alternatives.length !== 0 || decision.selectedAlternativeId !== null) {
        errors.push('locked-refine cannot retain alternatives or a selected alternative');
      }
    }
    if (decision.classification === 'approved-reuse') {
      if (binding.changeLevel === 'refine') errors.push('approved-reuse is for new/reconstruct only');
      if (alternatives.length !== 0 || decision.selectedAlternativeId !== null) {
        errors.push('approved-reuse cannot retain alternatives or a selected alternative');
      }
    }
    if (decision.classification === 'dominant') {
      if (binding.changeLevel === 'refine') errors.push('dominant direction is invalid for refine');
      if (decision.visualArtifactRefs.length === 0) errors.push('dominant direction requires visual artifacts');
      if (alternatives.length !== 0 || decision.selectedAlternativeId !== null) {
        errors.push('dominant direction cannot retain alternatives or a selected alternative');
      }
    }
    if (decision.classification === 'selected-alternative') {
      if (alternatives.length < 3 || alternatives.length > 4) {
        errors.push('selected-alternative must retain three or four alternatives');
      }
      const selected = alternatives.find((item) => item.id === decision.selectedAlternativeId);
      if (!selected) errors.push('selectedAlternativeId must identify a retained alternative');
      else {
        if (selected.directionRef !== decision.directionRef) errors.push('selected directionRef must match the alternative');
        if (selected.fingerprint !== decision.directionFingerprint) errors.push('selected fingerprint must match the alternative');
      }
    } else if (alternatives.length !== 0) {
      errors.push('only selected-alternative decisions may retain alternatives');
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}

