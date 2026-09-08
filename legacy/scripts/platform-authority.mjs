import { loadEnvironmentSchema, parseDeclarationReference, stackDeclaration, hostRootOf } from './validate-request.mjs';
const empty = value => value === undefined || value === null || value === '' || value === '—';

export async function platformAuthorityErrors({root, requirements, kind, desiredEffects, operationClasses, hostRoot = hostRootOf(root)}) {
  const errors = [];
  // Authority for the desired state: an approval id, or the environment's own declaration when it marks
  // this operation's class declared. The declaration is read as it stands, hashed, and checked against
  // the environment schema; a reference is refused for a declaration that is absent, moved, belongs to
  // another environment, is refused by its schema, or marks the class person.
  if (empty(requirements.approval)) errors.push('request.json: approval has no default; a shared runtime is never changed on silence, and an environment that authorises the change says so in a declaration the request references');
  else {
    const envSchema = await loadEnvironmentSchema(root);
    const ref = parseDeclarationReference(envSchema, requirements.approval);
    if (ref) {
      if (!empty(requirements.env) && ref.env !== String(requirements.env)) errors.push(`request.json: approval references the ${ref.env} declaration while the operation runs in ${requirements.env}; a declaration authorises its own environment only`);
      const decl = await stackDeclaration(root, ref.env, hostRoot, envSchema);
      if (!decl.exists) errors.push(`request.json: approval references ${decl.rel}, which this installation does not have`);
      else {
        for (const e of decl.errors) errors.push(`request.json: approval references a declaration the environment schema refuses: ${e}`);
        if (decl.hash !== ref.hash) errors.push(`request.json: approval references ${decl.rel} at ${ref.hash} and the file hashes to ${decl.hash}; the declaration moved since it was read, which is AUTHORITY_DRIFT and not an approval`);
        const { classes, unclassified } = operationClasses(kind, desiredEffects);
        if (unclassified.length) errors.push(`request.json: ${unclassified.join(', ')} ${unclassified.length === 1 ? 'belongs' : 'belong'} to no operation class an environment declaration authorises, so approval must be an approval id`);
        if (decl.authorization) for (const c of classes) if (decl.authorization[c] !== 'declared') errors.push(`request.json: ${decl.rel} marks ${c} as ${decl.authorization[c]}, so a declaration reference is not an approval for it; an approval id is required`);
      }
    }
  }
  return errors;
}
