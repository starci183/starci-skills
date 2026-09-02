# Execute `git.publish`

## Single job

Publish one approved boundary from exact mission-owned source heads onto one declared remote ref,
without force and without rewriting history. This is one linear operator invocation. It does not call
another operator, route a workflow, pause internally, or return a free-form instruction.

It decides nothing about the change itself. Whether the work is correct was settled by the gates that
produced `completionProofRefs`, and whether it may be published was settled by the approval. This
operator only performs the write, or reports precisely why it did not.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@receipt/workspace-route-binding/<invocationId>`, `@workspaces/local/routes/<project>/<role>` (the frozen head), `@external/remote/<project>/<role>` (the remote observation) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the route | `@receipt/workspace-route-binding/<invocationId>` (verified checkout, its head, its routed policy), `@workspaces/local/routes/<project>/<role>` | — | `ROUTE_UNVERIFIED` |
| 3 | Bind the approval | input (the approval naming this boundary unit, completion proof) | — | `APPROVAL_MISSING` |
| 4 | Verify the tree | `@workspaces/local/routes/<project>/<role>` (observed head, dirty paths, declared write roots, every branch, routed policy) | — | `DIRTY_OUTSIDE_BOUNDARY`, `BRANCH_POLICY_VIOLATION` |
| 5 | Run the hooks | `@workspaces/<project>/<role>/husky` (the hook inventory, including `pre-push`) | — | `HOOK_BLOCKED` |
| 6 | Push non-force | `@workspaces/local/routes/<project>/<role>` (approved heads, declared ref), `@external/remote/<project>/<role>` (the observed remote head) | `@external/remote/<project>/<role>` | `NON_FAST_FORWARD` |
| 7 | Push the continuation tag | input (the requested tag), `@external/remote/<project>/<role>` (the heads this publication pushed) | `@external/remote/<project>/<role>` (the continuation tag) | — |
| 8 | Emit and stop | everything above | `@artifacts/publication.json` | — |

Validation rejects a route receipt bound elsewhere, an approval for another unit, an inventory without
`pre-push`, a remote observation of a different ref, a checkout listed twice, a branch the routed
policy forbids, a publication with nothing ahead of upstream, a dirty path outside the boundary, and
an unchanged resume. The observed head is confirmed against the frozen head again while verifying the
tree, and a difference returns the same drift failure before anything is pushed.

Binding the route resolves no path of its own: a receipt that is not `bound`, or that belongs to
another project, is refused. Completion proof is evidence that the work is finished; it is never
evidence that it may be published, so exactly one approval must name this boundary unit.

Verification records `BOUNDARY_CLEAN` when nothing strays outside a declared write root. Hooks are
enforced on the push and each hook that ran records `HOOK_ENFORCED`; a failing hook names that hook
and is owned by the source. A remote that rejects the push because it carries commits the local ref
does not names the observed remote head and is owned by the remote, while each ref that advanced
records `REMOTE_FAST_FORWARDED` and each ref this publication created records `REMOTE_REF_CREATED`.
When a continuation tag is requested, exactly one annotated tag is pushed at a head this same
publication pushed and `CONTINUATION_TAG_PUBLISHED` is recorded. Emission writes the publication
record under `input.artifactRootRef`, returns one output conforming to `output.schema.json`, and binds
every fingerprint.

## A blocked hook is a typed failure, not a retry

`HOOK_BLOCKED` is a result. The delta that clears it is a fixed boundary and a new head, supplied
through the resume.

It is not a reason to run the push again with the hook disabled, to move the change onto a branch
whose hooks are lighter, or to commit the hook's own configuration out of the way. None of those are
representable: `input.destructiveOperations.hookBypass` is the constant `false`, every inventory entry
carries `enforced: true`, and a publication that records a failed hook result is rejected by the
output contract.

## A rejected push is a typed failure, not a rebase

`NON_FAST_FORWARD` means the remote moved. Somebody else's commits are on that ref, and this
invocation observed a remote head that its local heads do not contain.

The operator stops and names that head. It does not rebase onto it, amend a commit to make the push
apply, squash the divergence away, force, or lease-force. Reconciling divergent history changes what
other people have already pulled, so it belongs to whoever owns the branch. `forced` is the constant
`false` on every publication, and `mode` is the constant `fast-forward-only`.

The same reasoning covers the three commands that are most tempting when a publish fails and are all
unrepresentable here: `reset --hard` destroys uncommitted work that no receipt has recorded, `clean`
destroys untracked files nobody has reviewed, and `stash` hides a dirty boundary instead of resolving
it. A branch deletion, local or remote, is likewise never part of publishing.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no head, approval, hook, or remote change returns `NO_PROGRESS`.
A re-observed remote must arrive as a new remote head; the same observation cannot yield a different
result.

## Mandatory attacks

The operator cannot publish while any applicable item remains unresolved:

- the route receipt is not bound, or belongs to another project;
- the approval names a different boundary unit;
- a hook failed and the publication would still be emitted;
- the `pre-push` result is absent from the publication;
- a published ref did not actually advance;
- a continuation tag points at a commit this publication did not push;
- a head is published from a branch the routed policy forbids;
- a dirty path outside the boundary would ride along;
- a failure would be filed against a domain that cannot supply its delta.
