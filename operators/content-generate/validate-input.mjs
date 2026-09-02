import { validatorFor, runValidatorCli } from './validation.mjs';

const sameSet = (left, right) => {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { sourceRefs } = context;
  const {
    project,
    unit,
    naturalLanguages,
    implementationLanguages,
    stageModes,
    review,
    targets,
    commands,
    resume,
  } = input;

  if (new Set(naturalLanguages).size !== naturalLanguages.length) {
    errors.push('naturalLanguages must not repeat a language');
  }
  if (new Set(implementationLanguages).size !== implementationLanguages.length) {
    errors.push('implementationLanguages must not repeat a language');
  }

  // Every declared edition needs its own destination. A language without one is a language the
  // writing stage cannot deliver, discovered after the brief is already frozen.
  const articleLanguages = targets.articleTargets.map((item) => item.language);
  if (new Set(articleLanguages).size !== articleLanguages.length) {
    errors.push('targets.articleTargets must not name a language twice');
  }
  if (!sameSet(articleLanguages, naturalLanguages)) {
    errors.push('targets.articleTargets must cover exactly the declared naturalLanguages');
  }

  const trackLanguages = targets.trackTargets.map((item) => item.language);
  if (new Set(trackLanguages).size !== trackLanguages.length) {
    errors.push('targets.trackTargets must not name a language twice');
  }
  if (stageModes.code === 'disabled') {
    if (implementationLanguages.length > 0) {
      errors.push('implementationLanguages must be empty when the code stage is disabled');
    }
    if (trackLanguages.length > 0) {
      errors.push('targets.trackTargets must be empty when the code stage is disabled');
    }
  } else {
    if (implementationLanguages.length === 0) {
      errors.push('an enabled code stage requires at least one implementation language');
    }
    if (!sameSet(trackLanguages, implementationLanguages)) {
      errors.push('targets.trackTargets must cover exactly the declared implementationLanguages');
    }
  }

  // An image is generated to a stated intent, so it needs both a destination and a place to keep
  // the prompt that states the intent. One without the other is decoration after the fact.
  if (stageModes.image === 'disabled') {
    if (targets.imageTargetRef !== null || targets.promptTargetRef !== null) {
      errors.push('image and prompt targets must be null when the image stage is disabled');
    }
  } else if (targets.imageTargetRef === null || targets.promptTargetRef === null) {
    errors.push('an enabled image stage requires both an image target and a prompt target');
  }

  const commandLanguages = commands.map((item) => item.language);
  if (new Set(commandLanguages).size !== commandLanguages.length) {
    errors.push('commands must not name a language twice');
  }
  if (stageModes.e2e === 'disabled') {
    if (commands.length > 0) errors.push('commands must be empty when the e2e stage is disabled');
  } else {
    if (stageModes.code === 'disabled') {
      errors.push('an executable check cannot be required for code that is never written');
    }
    if (!sameSet(commandLanguages, implementationLanguages)) {
      errors.push('commands must cover exactly the declared implementationLanguages');
    }
  }

  if (review.round > review.maxRounds) {
    errors.push('review.round cannot exceed the approved review.maxRounds');
  }

  // The critique is a separate artifact from the brief. Writing one over the other would let the
  // producing intent and the independent judgement share a single record.
  if (targets.reviewTargetRef === targets.briefTargetRef) {
    errors.push('the critique target must differ from the brief target');
  }

  if (unit.mode === 'refactor' && unit.existingUnitRef === null) {
    errors.push('a refactor must name the existing unit it refactors');
  }
  if (unit.mode === 'generate' && unit.existingUnitRef !== null) {
    errors.push('a generate run cannot bind an existing unit; refactor that unit instead');
  }

  const routedSource = sourceRefs.find((item) => item.ref === project.contentSourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.contentSourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('content source context must bind input.project.sourceHead');
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one curriculum, source, finding, or scope reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
