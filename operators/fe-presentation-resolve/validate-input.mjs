import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { knowledge, grammar, sourceRefs } = context;
  const { project, target, scope, resume } = input;

  const topics = knowledge.topics.map((item) => item.topic);
  if (new Set(topics).size !== topics.length) {
    errors.push('knowledge.topics must bind each presentation topic at most once');
  }

  // A rule identifier must belong to the topic that publishes it. GAP-4 cannot arrive
  // under the padding topic, because that is how a fabricated rule enters unnoticed.
  const prefixFor = { gap: 'GAP', padding: 'PADDING', margin: 'MARGIN', surface: 'SURFACE', boundary: 'BOUNDARY', font: 'FONT', tone: 'TONE', measure: 'MEASURE', 'text-flow': 'FLOW', overflow: 'OVERFLOW' };
  const inventory = new Set();
  for (const topic of knowledge.topics) {
    const prefix = prefixFor[topic.topic];
    if (new Set(topic.ruleIds).size !== topic.ruleIds.length) {
      errors.push(`knowledge topic ${topic.topic} repeats a rule identifier`);
    }
    for (const ruleId of topic.ruleIds) {
      if (!ruleId.startsWith(`${prefix}-`)) {
        errors.push(`rule ${ruleId} does not belong to the ${topic.topic} topic`);
      }
      if (inventory.has(ruleId)) errors.push(`rule ${ruleId} is published by more than one topic`);
      inventory.add(ruleId);
    }
  }

  // Every relationship Grammar claims to own must name a rule the knowledge actually publishes.
  for (const owned of grammar.ownedRelationships) {
    if (!inventory.has(owned.ruleId)) {
      errors.push(`grammar ownedRelationships names unpublished rule ${owned.ruleId}`);
    }
    if (!topics.includes(owned.property)) {
      errors.push(`grammar ownedRelationships covers ${owned.property} but that topic is not bound`);
    }
  }

  const routedSource = sourceRefs.find((item) => item.ref === project.frontendSourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.frontendSourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('frontend source context must bind input.project.sourceHead');
  }

  const mutable = new Set(scope.mutableOwnerRefs);
  const observed = new Set(scope.observationOnlyOwnerRefs);
  if (!mutable.has(target.ownerRef)) errors.push('target.ownerRef must be inside mutableOwnerRefs');
  for (const ref of mutable) {
    if (observed.has(ref)) errors.push(`owner ${ref} cannot be both mutable and observation-only`);
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one knowledge, grammar, tree, or scope reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
