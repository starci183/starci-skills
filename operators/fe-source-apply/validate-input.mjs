import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { resolution: boundResolution, sourceRefs } = context;
  const { project, target, resolution, scope, writeSet, resume } = input;

  // The caller must name the same receipt it bound. Naming one receipt and binding another is
  // how an already-superseded set of decisions reaches product source unnoticed.
  if (resolution.receiptRef !== boundResolution.receiptRef) {
    errors.push('input.resolution.receiptRef must equal context.resolution.receiptRef');
  }
  if (resolution.fingerprint !== boundResolution.fingerprint) {
    errors.push('input.resolution.fingerprint must equal context.resolution.fingerprint');
  }

  if (new Set(boundResolution.classNames).size !== boundResolution.classNames.length) {
    errors.push('context.resolution.classNames repeats a class');
  }
  if (new Set(boundResolution.appliedRuleIds).size !== boundResolution.appliedRuleIds.length) {
    errors.push('context.resolution.appliedRuleIds repeats a rule identifier');
  }

  const routedSource = sourceRefs.find((item) => item.ref === project.frontendSourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.frontendSourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('frontend source context must bind input.project.sourceHead');
  }

  const observed = new Set(scope.observationOnlyOwnerRefs);
  const rootFor = new Map();
  for (const owner of scope.mutableOwners) {
    if (rootFor.has(owner.ownerRef)) errors.push(`owner ${owner.ownerRef} is declared mutable twice`);
    rootFor.set(owner.ownerRef, owner.rootPath);
    if (observed.has(owner.ownerRef)) {
      errors.push(`owner ${owner.ownerRef} cannot be both mutable and observation-only`);
    }
  }
  if (!rootFor.has(target.ownerRef)) errors.push('target.ownerRef must be a mutable owner');

  // Owner membership alone is not the ceiling. A mutable owner ref attached to a path outside its
  // own root is exactly how a write escapes the ceiling while still looking authorised.
  const seenPaths = new Set();
  for (const entry of writeSet) {
    if (seenPaths.has(entry.path)) errors.push(`write set repeats path ${entry.path}`);
    seenPaths.add(entry.path);

    const root = rootFor.get(entry.ownerRef);
    if (root === undefined) {
      errors.push(`write set path ${entry.path} names non-mutable owner ${entry.ownerRef}`);
      continue;
    }
    if (!entry.path.startsWith(`${root}/`)) {
      errors.push(`write set path ${entry.path} lies outside the root of owner ${entry.ownerRef}`);
    }
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one resolution, write set, or scope reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
