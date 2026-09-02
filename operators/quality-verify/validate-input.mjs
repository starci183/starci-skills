import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { predecessors, sourceRefs } = context;
  const { project, delivery, gates, declaredDebts, resume } = input;

  // Two predecessors on different heads describe two different deliveries, and gating
  // their union measures something nobody built.
  const heads = new Set(predecessors.map((item) => item.sourceHead));
  if (heads.size > 1) {
    errors.push('context.predecessors disagree about the source head');
  }
  for (const predecessor of predecessors) {
    if (predecessor.sourceHead !== project.sourceHead) {
      errors.push(`predecessor ${predecessor.receiptRef} was observed on a different head than the frozen source`);
    }
  }
  const predecessorRefs = predecessors.map((item) => item.receiptRef);
  if (new Set(predecessorRefs).size !== predecessorRefs.length) {
    errors.push('context.predecessors repeats a receipt reference');
  }

  const planned = gates.map((item) => item.gate);
  if (new Set(planned).size !== planned.length) {
    errors.push('input.gates plans the same gate more than once');
  }

  // The end-to-end suite runs only when the caller asked for it in this invocation.
  if (planned.includes('e2e') && !input.explicitE2eRequest) {
    errors.push('the e2e gate cannot be planned without an explicit request');
  }

  // A green Sonar gate on a new-code scope says nothing about the project beneath it,
  // so the receipt has to know which of the two was measured.
  if (planned.includes('sonar') && input.sonarScope === 'not-planned') {
    errors.push('the sonar gate is planned but no sonar scope is declared');
  }
  if (!planned.includes('sonar') && input.sonarScope !== 'not-planned') {
    errors.push('a sonar scope is declared but the sonar gate is not planned');
  }

  const debtIds = declaredDebts.map((item) => item.debtId);
  if (new Set(debtIds).size !== debtIds.length) {
    errors.push('input.declaredDebts repeats a debt identifier');
  }
  const observedAt = Date.parse(input.observedAt);
  for (const debt of declaredDebts) {
    if (!planned.includes(debt.gate)) {
      errors.push(`debt ${debt.debtId} covers ${debt.gate}, which is not a planned gate`);
    }
    if (Date.parse(debt.expiresAt) <= observedAt) {
      errors.push(`debt ${debt.debtId} has an approval that expired before this verification`);
    }
  }

  // A frontend mission reaching quality is verification-only by then, so a debt recorded
  // here would be a repair decision taken in the wrong place.
  if (delivery.kind === 'frontend' && declaredDebts.length > 0) {
    errors.push('a frontend delivery is verification-only and cannot declare quality debt');
  }

  const routedSource = sourceRefs.find((item) => item.ref === project.sourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.sourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('source context must bind input.project.sourceHead');
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one predecessor, gate, debt, or source reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
