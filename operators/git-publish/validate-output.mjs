import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * A publish failure belongs to whoever can supply the delta. A red hook and a dirty tree are fixed
 * in the source; a divergent remote is reconciled by whoever owns the remote branch; an unverified
 * route is fixed in the workspace. Filing any of them against the caller returns the block to
 * someone who can only retry it unchanged.
 */
const OWNING_DOMAIN = {
  INVALID_INPUT: 'caller',
  NO_PROGRESS: 'caller',
  APPROVAL_MISSING: 'caller',
  ROUTE_UNVERIFIED: 'workspace',
  BRANCH_POLICY_VIOLATION: 'workspace',
  DIRTY_OUTSIDE_BOUNDARY: 'source',
  HOOK_BLOCKED: 'source',
  SOURCE_DRIFT: 'source',
  NON_FAST_FORWARD: 'remote',
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, binding, publication, findings, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'published') {
    if (publication === null) errors.push('a published receipt requires a publication');
    if (failure !== null) errors.push('a published receipt cannot carry a failure');
    if (resume !== null) errors.push('a published receipt cannot carry a resume');
  } else {
    if (publication !== null) errors.push('a blocked receipt cannot carry a publication');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  if (failure !== null) {
    const expected = OWNING_DOMAIN[failure.code];
    if (expected !== undefined && failure.owningDomain !== expected) {
      errors.push(`${failure.code} is owned by ${expected}, not ${failure.owningDomain}`);
    }
    if (failure.code === 'HOOK_BLOCKED' && failure.subjects.length === 0) {
      errors.push('a blocked hook must be named, or the fix has no address');
    }
    if (failure.code === 'NON_FAST_FORWARD' && failure.subjects.length === 0) {
      errors.push('a rejected push must name the remote head it observed');
    }
  }

  const findingKeys = new Set();
  for (const finding of findings) {
    const key = `${finding.code}|${finding.subject}`;
    if (findingKeys.has(key)) errors.push(`finding ${finding.code} repeats subject ${finding.subject}`);
    findingKeys.add(key);
    if (publication === null && finding.code !== 'BOUNDARY_CLEAN') {
      errors.push(`a blocked receipt cannot record ${finding.code}`);
    }
  }

  if (publication !== null) {
    if (!artifactRefs.includes(publication.publicationRecordRef)) {
      errors.push('artifactRefs must register the publication record');
    }

    // The pre-push hook is the last gate before the remote. A publication that does not carry its
    // passing result either bypassed it or never ran it.
    const prePush = publication.hookResults.find((item) => item.hook === 'pre-push');
    if (prePush === undefined) {
      errors.push('a publication must carry the pre-push hook result');
    }
    for (const hookResult of publication.hookResults) {
      if (hookResult.outcome === 'failed') {
        errors.push(`the ${hookResult.hook} hook failed, so this cannot be a publication`);
      }
      if (!findingKeys.has(`HOOK_ENFORCED|${hookResult.hook}`)) {
        errors.push(`the ${hookResult.hook} hook ran but its enforcement was not recorded`);
      }
    }

    const publishedBranch = publication.branchRef.slice('refs/heads/'.length);
    const branches = publication.publishedHeads.map((item) => item.branch);
    if (!branches.includes(publishedBranch)) {
      errors.push(`no published head is on ${publishedBranch}`);
    }

    const checkoutRefs = publication.publishedHeads.map((item) => item.checkoutRef);
    if (new Set(checkoutRefs).size !== checkoutRefs.length) {
      errors.push('publishedHeads must name each checkout at most once');
    }

    const heads = new Set();
    for (const head of publication.publishedHeads) {
      heads.add(head.head);

      // A ref that ends where it started did not move, and reporting it as published hides a
      // push that never happened.
      if (head.previousRemoteHead === head.head) {
        errors.push(`${head.checkoutRef} reports a publication that did not advance the remote ref`);
      }

      if (binding.worktreeBranches === 'forbidden' && head.branch !== binding.mutationBranch) {
        errors.push(`a forbidden worktree policy cannot publish ${head.checkoutRef} from ${head.branch}`);
      }

      // Creating a remote ref and fast-forwarding one are different acts with different reviewers,
      // so each publication states which one it performed.
      const expectedCode = head.previousRemoteHead === null ? 'REMOTE_REF_CREATED' : 'REMOTE_FAST_FORWARDED';
      if (!findingKeys.has(`${expectedCode}|${head.checkoutRef}`)) {
        errors.push(`${head.checkoutRef} must record ${expectedCode}`);
      }
    }

    if (publication.annotatedTag !== null) {
      const tag = publication.annotatedTag;
      if (tag.ref !== `refs/tags/${tag.name}`) {
        errors.push('the continuation tag ref must name the tag it publishes');
      }
      // A continuation tag is only portable if it points at something this publication pushed.
      if (!heads.has(tag.head)) {
        errors.push(`the continuation tag points at ${tag.head}, which this publication did not push`);
      }
      if (!findingKeys.has(`CONTINUATION_TAG_PUBLISHED|${tag.name}`)) {
        errors.push('a published continuation tag must be recorded');
      }
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
