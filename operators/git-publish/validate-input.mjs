import { validatorFor, runValidatorCli } from './validation.mjs';

function comparablePath(value) {
  return value.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { routeReceipt, approval, gitPolicy, hookInventory, remote } = context;

  if (routeReceipt.project !== input.project) {
    errors.push('the route receipt was bound for another project');
  }

  // Completion is not approval. An approval issued for a different unit is a real approval for
  // somebody else's boundary, which is exactly how unreviewed work rides along with reviewed work.
  if (approval.scopeUnit !== input.boundary.unit) {
    errors.push(`the approval covers ${approval.scopeUnit}, not ${input.boundary.unit}`);
  }

  // A publish always runs pre-push. An inventory without it describes a checkout where the last
  // gate before the remote does not exist.
  const hooks = hookInventory.map((item) => item.hook);
  if (new Set(hooks).size !== hooks.length) errors.push('hookInventory lists a hook more than once');
  if (!hooks.includes('pre-push')) errors.push('hookInventory must include the pre-push hook');

  if (remote.ref !== input.publication.branchRef) {
    errors.push('the observed remote ref must be the ref being published');
  }

  const branches = input.sourceHeads.map((item) => item.branch);
  const publishedBranch = input.publication.branchRef.slice('refs/heads/'.length);
  if (!branches.includes(publishedBranch)) {
    errors.push(`no source head is on ${publishedBranch}`);
  }

  const checkoutRefs = input.sourceHeads.map((item) => item.checkoutRef);
  if (new Set(checkoutRefs).size !== checkoutRefs.length) {
    errors.push('sourceHeads must name each checkout at most once');
  }

  if (gitPolicy.worktreeBranches === 'forbidden') {
    for (const head of input.sourceHeads) {
      if (head.branch !== gitPolicy.mutationBranch) {
        errors.push(`the routed policy forbids worktree branches, so ${head.checkoutRef} cannot publish from ${head.branch}`);
      }
    }
  }

  // A publication that advances nothing is not a publication. It is either a mistaken invocation
  // or an attempt to re-point a ref that is already where it should be.
  if (!input.sourceHeads.some((head) => head.aheadCount >= 1)) {
    errors.push('at least one source head must be ahead of its upstream');
  }

  for (const head of input.sourceHeads) {
    if (head.upstreamHead === null && head.behindCount !== 0) {
      errors.push(`${head.checkoutRef} has no upstream but reports commits behind it`);
    }
    if (head.upstreamHead !== null && head.aheadCount === 0 && head.head !== head.upstreamHead) {
      errors.push(`${head.checkoutRef} reports no commits ahead while its head differs from upstream`);
    }
  }

  // Anything dirty outside the declared write roots is work this boundary does not own, and a
  // publish that carries it publishes somebody else's unreviewed change.
  const writeRoots = input.boundary.writeRoots.map(comparablePath);
  const insideBoundary = (candidate) =>
    writeRoots.some((root) => candidate === root || candidate.startsWith(`${root}/`));
  for (const dirty of input.workingTree.dirtyPaths) {
    if (!insideBoundary(comparablePath(dirty))) {
      errors.push(`dirty path ${dirty} lies outside the declared boundary`);
    }
  }

  const exclusions = new Set(input.boundary.exclusionRefs.map(comparablePath));
  for (const target of input.boundary.targetRefs) {
    if (exclusions.has(comparablePath(target))) {
      errors.push(`${target} is both a boundary target and an exclusion`);
    }
  }

  if (input.resume !== null && input.resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one head, approval, hook, or remote reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(input.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
