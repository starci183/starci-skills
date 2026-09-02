import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { sourceRefs, inventory } = context;
  const { project, constraints, selectionPolicy, approval, resume } = input;

  const boundSources = new Set(sourceRefs.map((item) => item.ref));
  const routed = sourceRefs.find((item) => item.ref === project.backendSourceRef);
  if (!routed) errors.push('context.sourceRefs must include input.project.backendSourceRef');
  else if (routed.sourceHead !== project.sourceHead) {
    errors.push('the routed source must bind input.project.sourceHead');
  }

  // The observed inventory is evidence about what exists. Every component must name the file that
  // evidences it, or the inventory becomes a list of things somebody remembers.
  const componentIds = new Set();
  for (const component of inventory.components) {
    if (componentIds.has(component.componentId)) {
      errors.push(`inventory component ${component.componentId} is declared more than once`);
    }
    componentIds.add(component.componentId);
    if (!boundSources.has(component.evidenceRef)) {
      errors.push(`inventory component ${component.componentId} cites unbound evidence ${component.evidenceRef}`);
    }
  }

  const constraintIds = new Set();
  const kinds = new Set();
  for (const constraint of constraints) {
    if (constraintIds.has(constraint.constraintId)) {
      errors.push(`constraint ${constraint.constraintId} is declared more than once`);
    }
    constraintIds.add(constraint.constraintId);
    kinds.add(constraint.kind);
  }
  if (!kinds.has('fixed-intent')) {
    errors.push('at least one fixed-intent constraint is required, or the decision has no stated purpose');
  }
  if (!kinds.has('measurable')) {
    errors.push('at least one measurable constraint is required, or no alternative can be compared on any axis');
  }

  // An automatic selection policy replaces the owner approval. Carrying both hides which one decided.
  if (selectionPolicy === 'automatic' && approval !== null) {
    errors.push('an automatic selection policy cannot also carry an owner approval');
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one evidence, constraint, inventory, or approval reference');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
