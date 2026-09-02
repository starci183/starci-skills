import { validatorFor, runValidatorCli } from './validation.mjs';

const contextArrays = [
  'knowledgeRefs',
  'sourceRefs',
  'uatRefs',
  'auditRefs',
  'visualRefs',
  'previousDirectionRefs',
  'externalReferenceRefs',
];

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { project, target, scope, approvedDirection, decisionPolicy, resume } = input;

  if (!context.requestRefs.some((item) => item.ref === input.objectiveRef)) {
    errors.push('context.requestRefs must include input.objectiveRef');
  }
  if (context.business.projectId !== project.id) {
    errors.push('business authority project must match input.project.id');
  }
  for (const [name, binding] of [['backend', context.backend], ['architecture', context.architecture]]) {
    if (binding !== null && binding.projectId !== project.id) {
      errors.push(`${name} authority project must match input.project.id`);
    }
  }

  const mutable = new Set(scope.ownerCeiling.mutableOwnerRefs);
  const observed = new Set(scope.ownerCeiling.observationOnlyOwnerRefs);
  if (!mutable.has(target.ownerRef)) errors.push('target.ownerRef must be inside mutableOwnerRefs');
  for (const ref of mutable) {
    if (observed.has(ref)) errors.push(`owner ${ref} cannot be both mutable and observation-only`);
  }
  if (scope.ownerCeiling.kind === 'surface-only' && mutable.size !== 1) {
    errors.push('surface-only owner ceiling requires exactly the target owner to be mutable');
  }

  const routedSource = context.sourceRefs.find((item) => item.ref === project.frontendSourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.frontendSourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('frontend source context must bind input.project.sourceHead');
  }

  if (input.changeLevel !== 'refine' && decisionPolicy.mode === 'preserve' && approvedDirection === null) {
    errors.push('new/reconstruct preserve mode requires an exact approvedDirection');
  }
  if (approvedDirection !== null) {
    const previousRefs = new Set(context.previousDirectionRefs.map((item) => item.ref));
    if (!previousRefs.has(approvedDirection.directionRef)) {
      errors.push('previousDirectionRefs must include approvedDirection.directionRef');
    }
    if (!previousRefs.has(approvedDirection.approvalRef)) {
      errors.push('previousDirectionRefs must include approvedDirection.approvalRef');
    }
  }
  if (decisionPolicy.mode === 'compare' && !context.requestRefs.some((item) => item.ref === decisionPolicy.comparisonAuthorityRef)) {
    errors.push('compare mode authority must occur in context.requestRefs');
  }

  const allContextRefs = new Set(context.requestRefs.map((item) => item.ref));
  for (const key of contextArrays) {
    for (const item of context[key]) allContextRefs.add(item.ref);
  }
  allContextRefs.add(context.business.receiptRef);
  allContextRefs.add(context.grammar.packageRef);
  allContextRefs.add(context.grammar.manifestRef);
  if (context.backend) allContextRefs.add(context.backend.receiptRef);
  if (context.architecture) allContextRefs.add(context.architecture.receiptRef);

  if (resume !== null) {
    if (!context.previousDirectionRefs.some((item) => item.ref === resume.blockedReceiptRef)) {
      errors.push('previousDirectionRefs must include resume.blockedReceiptRef');
    }
    for (const ref of resume.addedContextRefs) {
      if (!allContextRefs.has(ref)) errors.push(`resume added context ref is not supplied: ${ref}`);
    }
    if (resume.addedContextRefs.length === 0 && resume.selectedAlternativeId === null) {
      errors.push('resume must add context or select one exact alternative');
    }
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
