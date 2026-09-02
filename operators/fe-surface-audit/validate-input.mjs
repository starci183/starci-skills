import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { knowledge, applied, sourceRefs } = context;
  const { project, target, runtime, matrix, scope, resume } = input;

  const topicNames = knowledge.topics.map((item) => item.topic);
  if (new Set(topicNames).size !== topicNames.length) {
    errors.push('knowledge.topics must bind each topic at most once');
  }

  // A rule identifier must belong to the topic that publishes it. An identifier filed under a topic
  // whose prefix it does not carry is how a fabricated rule acquires the look of authority.
  const inventory = new Set();
  const prefixes = new Set();
  for (const topic of knowledge.topics) {
    if (prefixes.has(topic.rulePrefix)) {
      errors.push(`rule prefix ${topic.rulePrefix} is claimed by more than one topic`);
    }
    prefixes.add(topic.rulePrefix);

    if (new Set(topic.ruleIds).size !== topic.ruleIds.length) {
      errors.push(`knowledge topic ${topic.topic} repeats a rule identifier`);
    }
    for (const ruleId of topic.ruleIds) {
      if (!ruleId.startsWith(`${topic.rulePrefix}-`)) {
        errors.push(`rule ${ruleId} does not carry the ${topic.rulePrefix} prefix of topic ${topic.topic}`);
      }
      if (inventory.has(ruleId)) errors.push(`rule ${ruleId} is published by more than one topic`);
      inventory.add(ruleId);
    }
  }

  // The surface under observation must be the surface that was applied.
  if (applied.appliedSourceHead !== project.sourceHead) {
    errors.push('context.applied.appliedSourceHead must equal input.project.sourceHead');
  }

  const claimedNodes = new Set();
  for (const claim of applied.claims) {
    if (claimedNodes.has(claim.nodePath)) {
      errors.push(`node ${claim.nodePath} carries more than one claim entry`);
    }
    claimedNodes.add(claim.nodePath);
    if (new Set(claim.claimedIdentifiers).size !== claim.claimedIdentifiers.length) {
      errors.push(`node ${claim.nodePath} repeats an identifier in its claim`);
    }
  }

  const routedSource = sourceRefs.find((item) => item.ref === project.frontendSourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.frontendSourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('frontend source context must bind input.project.sourceHead');
  }

  const matrixIds = matrix.map((item) => item.matrixId);
  if (new Set(matrixIds).size !== matrixIds.length) {
    errors.push('matrix must declare each matrixId at most once');
  }
  const conditions = matrix.map(
    (item) => `${item.viewportWidth}x${item.viewportHeight}|${item.colorScheme}|${item.state}`,
  );
  if (new Set(conditions).size !== conditions.length) {
    errors.push('matrix repeats the same viewport, scheme, and state condition under two ids');
  }

  if (!scope.observedOwnerRefs.includes(target.ownerRef)) {
    errors.push('target.ownerRef must be inside observedOwnerRefs');
  }

  if (runtime.routePath.includes('?')) {
    errors.push('runtime.routePath must not carry a query string');
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one knowledge, applied source, matrix, or runtime reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
