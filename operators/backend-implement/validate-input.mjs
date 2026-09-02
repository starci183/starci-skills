import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { authority, patterns, sourceRefs } = context;
  const { project, contract, scope, resume } = input;

  const decisions = authority.decisions.map((item) => item.decisionId);
  if (new Set(decisions).size !== decisions.length) {
    errors.push('authority.decisions repeats a decision identifier');
  }
  const approved = new Set(decisions);

  const aspects = patterns.map((item) => item.aspect);
  if (new Set(aspects).size !== aspects.length) {
    // Two families bound for one aspect means no family is bound: the implementation
    // would be free to pick whichever one it already resembles.
    errors.push('context.patterns binds an aspect more than once');
  }

  const mutable = new Set(scope.mutableFileRefs);
  const observed = new Set(scope.observationOnlyFileRefs);
  for (const ref of mutable) {
    if (observed.has(ref)) errors.push(`file ${ref} cannot be both mutable and observation-only`);
  }

  const operationIds = contract.operations.map((item) => item.operationId);
  if (new Set(operationIds).size !== operationIds.length) {
    errors.push('contract.operations repeats an operationId');
  }

  for (const operation of contract.operations) {
    const at = `operation ${operation.operationId}`;

    // The contract may not name a writer this invocation is not allowed to touch.
    if (!mutable.has(operation.writerRef)) {
      errors.push(`${at} names writer ${operation.writerRef} outside the mutable ceiling`);
    }

    // A business rule nobody approved is exactly what a passing test can legitimise.
    for (const decisionId of operation.authorityDecisionIds) {
      if (!approved.has(decisionId)) {
        errors.push(`${at} cites unapproved business decision ${decisionId}`);
      }
    }
    if (new Set(operation.authorityDecisionIds).size !== operation.authorityDecisionIds.length) {
      errors.push(`${at} repeats a business decision identifier`);
    }

    if (new Set(operation.facets).size !== operation.facets.length) {
      errors.push(`${at} repeats a contract facet`);
    }
    if (new Set(operation.proofKinds).size !== operation.proofKinds.length) {
      errors.push(`${at} repeats a proof kind`);
    }

    // A migration without a replay proof is a schema change nobody re-ran.
    const shipsMigration = operation.migrationRefs.length > 0;
    if (shipsMigration && !operation.proofKinds.includes('migration-replay')) {
      errors.push(`${at} ships a migration without declaring the migration-replay proof`);
    }
    if (shipsMigration && !operation.facets.includes('migration')) {
      errors.push(`${at} ships a migration without declaring the migration facet`);
    }
    if (!shipsMigration && operation.proofKinds.includes('migration-replay')) {
      errors.push(`${at} declares a migration-replay proof but ships no migration`);
    }

    // A mutation arriving through a boundary declared not to mutate.
    if (operation.transactionBoundary === 'read-only' && shipsMigration) {
      errors.push(`${at} is read-only but ships a migration`);
    }

    // A redelivered event applies twice unless something makes the write idempotent.
    if (operation.transport === 'event-consumer' && operation.idempotencyKind === 'none') {
      errors.push(`${at} consumes events with no idempotency and will apply twice on redelivery`);
    }
  }

  const routedSource = sourceRefs.find((item) => item.ref === project.backendSourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.backendSourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('backend source context must bind input.project.sourceHead');
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one authority, contract, pattern, or scope reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
