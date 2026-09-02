import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { evidence, authority, sourceRefs } = context;
  const { project, objective, discovery, publication, resume } = input;

  // The businesses root is one flat authority root owned by the project backend. The runtime Source
  // owns `.claude/.workspaces`; a project segment below the root is how a second, unfindable
  // authority tree is born.
  if (authority.businessesRootRef !== project.businessesRootRef) {
    errors.push('context.authority.businessesRootRef must equal input.project.businessesRootRef');
  }
  // The root stores one directory per feature under features/, indexed by business-registry-v1.json.
  const expectedHeadRef = `${project.businessesRootRef}/features/${objective.featureId}`;
  if (publication.headRef !== expectedHeadRef) {
    errors.push(`publication.headRef must be exactly ${expectedHeadRef}, the feature directory below the businesses root`);
  }

  const boundSources = new Set(sourceRefs.map((item) => item.ref));
  const routed = sourceRefs.find((item) => item.ref === project.backendSourceRef);
  if (!routed) errors.push('context.sourceRefs must include input.project.backendSourceRef');
  else if (routed.sourceHead !== project.sourceHead) {
    errors.push('the routed backend source must bind input.project.sourceHead');
  }

  // Every claim cites role, path, line range, head, and kind against a bound source. A claim that
  // cites a file nobody bound is indistinguishable from an invented one.
  const claimIds = new Set();
  for (const claim of evidence.claims) {
    if (claimIds.has(claim.claimId)) errors.push(`claim ${claim.claimId} is declared more than once`);
    claimIds.add(claim.claimId);
    if (!boundSources.has(claim.sourceRef)) {
      errors.push(`claim ${claim.claimId} cites unbound source ${claim.sourceRef}`);
    }
    if (claim.lineEnd < claim.lineStart) {
      errors.push(`claim ${claim.claimId} has an inverted line range`);
    }
    if (claim.kind === 'fact' && claim.sourceHead === null) {
      errors.push(`fact claim ${claim.claimId} must bind the observed source head`);
    }
  }

  const consumerIds = new Set();
  for (const consumer of discovery.consumers) {
    if (consumerIds.has(consumer.consumerId)) {
      errors.push(`discovered consumer ${consumer.consumerId} is declared more than once`);
    }
    consumerIds.add(consumer.consumerId);
    if (!boundSources.has(consumer.sourceRef)) {
      errors.push(`discovered consumer ${consumer.consumerId} cites unbound source ${consumer.sourceRef}`);
    }
  }

  const priorHead = authority.heads.find((item) => item.featureId === objective.featureId);
  if (publication.targetState === 'pending') {
    if (priorHead && priorHead.state !== 'rejected') {
      errors.push(`feature ${objective.featureId} already holds a ${priorHead.state} head; pending would overwrite live authority`);
    }
  } else if (!priorHead) {
    errors.push(`target state ${publication.targetState} requires an existing head for ${objective.featureId}`);
  }
  if (objective.intent === 'retire' && publication.targetState !== 'rejected') {
    errors.push('a retire intent may only target the rejected state');
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one evidence, authority, discovery, or approval reference');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
