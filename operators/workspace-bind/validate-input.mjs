import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * Route paths arrive from two files written on different machines, so they are compared as
 * normalised strings rather than as raw text: separator style and a trailing slash are notation,
 * not identity.
 */
function comparablePath(value) {
  return value.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
}

function unsafeRelativeDirectory(directory) {
  if (/^([a-zA-Z]:|\/|\\)/.test(directory)) return true;
  return directory
    .replaceAll('\\', '/')
    .split('/')
    .some((segment) => segment === '' || segment === '.' || segment === '..');
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { portableRoute, hydratedRoute, runtime, cachedRouteReceipt } = context;

  // The route is declared for exactly one project and role. A file that disagrees with the
  // identity it was requested under is a foreign route wearing the right filename.
  for (const [label, route] of [['portable', portableRoute], ['hydrated', hydratedRoute]]) {
    if (route.project !== input.project || route.role !== input.role) {
      errors.push(`${label} route declares ${route.project}/${route.role}, not ${input.project}/${input.role}`);
    }
  }

  // A source route lives at the Source root and owns no directory; a sibling route owns a safe
  // relative directory beside it. Any other shape is an untrusted repository kind.
  const { kind, directory } = portableRoute.repository;
  if (kind === 'source' && directory !== null) {
    errors.push('a source route must carry a null repository directory');
  }
  if (kind === 'sibling') {
    if (directory === null) errors.push('a sibling route must carry a relative repository directory');
    else if (unsafeRelativeDirectory(directory)) {
      errors.push('a sibling route directory must be relative and must not traverse directories');
    }
  }

  if (hydratedRoute.repository.gitRepository !== portableRoute.repository.gitRepository) {
    errors.push('the hydrated route names a different Git repository than the portable declaration');
  }
  if (hydratedRoute.repository.branch !== portableRoute.repository.branch) {
    errors.push('the hydrated route names a different branch than the portable declaration');
  }

  // The hydrated route must belong to this Source. One that points at another Source's workspace
  // root is another machine's route file, and following it lands the work in a foreign checkout.
  const sourceRoot = comparablePath(hydratedRoute.sourceRootPath);
  if (comparablePath(hydratedRoute.workspaceRootPath) !== `${sourceRoot}/.workspaces`) {
    errors.push('the hydrated route has a foreign workspace root');
  }
  if (comparablePath(hydratedRoute.repository.diskPath) !== comparablePath(hydratedRoute.repository.gitRoot)) {
    errors.push('the hydrated repository disk path and Git root must be the same checkout');
  }
  if (kind === 'source' && comparablePath(hydratedRoute.repository.diskPath) !== sourceRoot) {
    errors.push('a source route must hydrate to the Source root itself');
  }
  if (kind === 'sibling' && comparablePath(hydratedRoute.repository.diskPath) === sourceRoot) {
    errors.push('a sibling route must hydrate beside the Source, not onto it');
  }

  // The checkout that was observed must be the checkout the route resolved to. A nearby directory
  // with a similar name is a hint, and a hint never becomes the observed route.
  if (comparablePath(input.observedCheckout.diskPath) !== comparablePath(hydratedRoute.repository.diskPath)) {
    errors.push('observedCheckout.diskPath must be the hydrated route checkout');
  }

  if (input.gitPolicy.worktreeBranches === 'forbidden' && input.observedCheckout.branch !== input.gitPolicy.mutationBranch) {
    errors.push(`the routed policy forbids worktree branches, so the checkout must stay on ${input.gitPolicy.mutationBranch}`);
  }

  // Dirty paths outside the declared write roots are a real condition of the checkout, not a
  // malformed input. The operator answers them with the typed CHECKOUT_DIRTY failure (execute.md
  // step 5), so the observation is accepted here and judged there.

  if (input.runtimeNeed === 'consume' && runtime === null) {
    errors.push('a caller that consumes the shared runtime must bind the runtime owner');
  }
  if (input.runtimeNeed === 'none' && runtime !== null) {
    errors.push('a caller that needs no runtime must not bind one');
  }

  if (runtime !== null) {
    if (runtime.endpointBinding.project !== input.project) {
      errors.push('the endpoint binding belongs to another project');
    }
    const services = Object.values(runtime.endpointBinding.services);
    if (new Set(services).size !== services.length) {
      errors.push('endpoint binding service keys must be distinct');
    }
    const ports = Object.values(runtime.endpoints);
    if (new Set(ports).size !== ports.length) {
      errors.push('the frontend, api, and identity endpoints must be distinct');
    }
  }

  if (cachedRouteReceipt !== null && (cachedRouteReceipt.project !== input.project || cachedRouteReceipt.role !== input.role)) {
    errors.push('the cached route receipt belongs to another project and role');
  }

  if (input.resume !== null && input.resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one route, identity, runtime, or provenance reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(input.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
