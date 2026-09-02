# Output of `git.publish`

The operator returns one closed envelope with `outcome` equal to `published` or `blocked`. It never
emits a handoff or a free-form routing instruction.

## Published receipt

A published receipt contains:

- exact project, route receipt, approval, boundary, policy, head, input, and progress bindings;
- the remote, the ref, `mode: "fast-forward-only"`, and `forced: false`;
- one entry per published head, naming its checkout, branch, exact head, the remote head it replaced,
  and how many commits advanced;
- the annotated continuation tag, or null;
- one result per hook that ran;
- findings for hook enforcement, a clean boundary, each fast-forwarded ref, each created ref, and the
  published tag.

The receipt proves that exactly these heads reached exactly this ref under exactly these hooks. It
proves nothing about the quality of the change, and it carries no verdict, score, or pass claim.

## Findings

| Code | Meaning |
| --- | --- |
| `HOOK_ENFORCED` | This hook ran and was not bypassed. Required for every hook result. |
| `BOUNDARY_CLEAN` | Nothing dirty lay outside the declared boundary. |
| `REMOTE_FAST_FORWARDED` | This ref advanced from the remote head it previously carried. |
| `REMOTE_REF_CREATED` | This ref did not exist on the remote before this publication. |
| `CONTINUATION_TAG_PUBLISHED` | One annotated tag was pushed. Required whenever a tag is published. |

`BOUNDARY_CLEAN` is the only finding a blocked receipt may carry, because it is the only one that
describes an observation rather than a write.

## Blocked receipt

A blocked receipt has no publication. It contains one typed failure, the exact subjects and
references involved, the owning domain, retryability, and, only when retryable, a single-use resume
token with the required material delta.

## Failure codes

| Code | Owning issue | Owner | Valid material delta |
| --- | --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | caller | Corrected input. |
| `ROUTE_UNVERIFIED` | The route receipt is not bound, or belongs to another project. | workspace | A bound route receipt. |
| `APPROVAL_MISSING` | No approval covers this exact boundary unit. | caller | An approval for this unit. |
| `BRANCH_POLICY_VIOLATION` | A head sits on a branch the routed policy forbids. | workspace | Heads returned to the mutation branch. |
| `DIRTY_OUTSIDE_BOUNDARY` | Something dirty lies outside the declared boundary. | source | A clean tree, or corrected write roots. |
| `HOOK_BLOCKED` | A Git hook rejected the publication. | source | A fixed boundary and a new head. |
| `NON_FAST_FORWARD` | The remote carries commits the local ref does not. | remote | A reconciled branch, decided by its owner. |
| `SOURCE_DRIFT` | The observed head differs from the frozen head. | source | A refreshed head binding. |
| `NO_PROGRESS` | A resume adds no effective delta. | caller | Materially new heads, approval, hooks, or remote. |

`HOOK_BLOCKED` and `NON_FAST_FORWARD` are the two failures a publish actually meets in practice, and
both are results rather than obstacles. Each names its subject so the fix has an address: the hook
that rejected the push, and the remote head that diverged.

## Cross-field invariants

- `outcome="published"` requires `receipt.status="published"`, non-null `publication`, null
  `failure`, and null `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `publication`, and non-null
  `failure`. A retryable failure requires a resume; a non-retryable failure forbids one.
- Every failure code carries its own owning domain; a source, workspace, or remote defect can never
  be filed against the caller.
- `HOOK_BLOCKED` and `NON_FAST_FORWARD` each name at least one subject.
- A publication carries the `pre-push` hook result, records `HOOK_ENFORCED` for every hook that ran,
  and contains no failed hook result.
- Every published head advances its ref: `previousRemoteHead` never equals `head`, and
  `commitCount` is at least one.
- Each published head records `REMOTE_FAST_FORWARDED` when it replaced a remote head and
  `REMOTE_REF_CREATED` when it did not.
- Under a `forbidden` worktree policy every published head is on the mutation branch.
- The published `branchRef` names a branch some published head is on, and no checkout appears twice.
- An annotated continuation tag has a matching `refs/tags/<name>` ref, points at a head this
  publication pushed, and is recorded.
- A blocked receipt records no finding other than `BOUNDARY_CLEAN`.
- `artifactRefs` registers the publication record.
- `handoff` is always `null`.

## Practical outcomes

Publish the `api.core` boundary from one checkout on `mtp`: the receipt records the pre-push hook
passing, one head advancing the remote ref by four commits, one annotated continuation tag on that
head, and a clean boundary.

Publish while somebody else has pushed to the same ref: the invocation returns `NON_FAST_FORWARD`
owned by the remote, naming the remote head it observed. Nothing is pushed, nothing is rebased, and
the resume waits for the branch owner's reconciliation.
