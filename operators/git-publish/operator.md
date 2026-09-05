# git.publish

## Job

Publish one approved Git boundary from the exact commit quality verified, with non-force,
fast-forward-only semantics, and stop with a typed failure rather than reaching for a bypass.

## Done when

Done when the `git-publication` records that the exact commit the quality receipt measured reached
the routed ref on the remote through a non-force push that created or fast-forwarded it with every
hook passed, the session branch was merged and never rebased, at most one annotated tag points at
the head this same publication pushed, and the session worktree, branch and folder are removed.

## It decides nothing about the change

Whether the work is correct was settled by the gates that produced the `quality-verification` receipt,
and whether it may be published was settled by the approval. This operator only performs the write, or
reports precisely why it did not. The receipt it leaves proves that exactly this commit reached
exactly this ref under exactly these hooks; it carries no verdict, no score, and no claim that
anything passed.

## The route is read, never rediscovered

This operator does not resolve a project to a checkout. `workspace.bind` does that, and its receipt
arrives here already bound. A publish that resolved its own path could publish from a checkout
nobody verified, which is the failure this separation exists to prevent. A route receipt whose
status is not `bound`, or which names another project, is `ROUTE_UNVERIFIED`.

## Approval is a person, always

Publishing pushes work out of the session and into a place other people pull from, so `approval` has
no default: an outward-facing act is always something a person said yes to. Completion proof records
the gates the boundary passed; it is evidence that the work is finished and never evidence that it
may be published. Exactly one approval must name this boundary. An approval issued for a different
boundary is a real approval for somebody else's work, which is exactly how unreviewed change rides
along with reviewed change, and it is `APPROVAL_MISSING`.

## The published commit is the verified commit

The `quality-verification` input measured one commit. That commit, and no other, is what this
publication pushes: a head one commit ahead of the verified one carries a change no gate ever saw.
The receipt records the verified commit beside the published head so the two can be compared later
without rerunning anything.

## Non-force is structural, not advisory

Force push, history rewrite, `reset --hard`, `clean`, `stash`, branch deletion and hook bypass are
not fields with a default; they are absent from this operator's vocabulary, so no request, in any
combination and under any justification, can ask for one. The reason is that each of them is most
tempting exactly when a publish has just failed: a rejected push, a red hook and an unexpected dirty
file each have an obvious one-command answer that destroys someone else's work or someone else's
evidence. `reset --hard` destroys uncommitted work no receipt has recorded, `clean` destroys
untracked files nobody has reviewed, and `stash` hides a dirty boundary instead of resolving it.
Making the request unrepresentable removes the decision from the moment it would be made badly. The
publication mode is always fast-forward only, and every publication records that it was not forced.

## The session branch is merged, never rebased

The producer did not write on the person's checked-out branch. It wrote on the session branch
`session/<sessionId>` of the routed checkout, in a git worktree prepared from the frozen head, and
committed its write set once. This operator merges that session branch into the target branch before
it pushes. When the target has not moved since the session base, the merge is a fast-forward and
nothing new is created. When the target has moved, a merge commit is allowed only under two
conditions together: every hunk the merge conflicted on was resolved by the rule set below, and the
gates the verification named were re-run on the merge result and passed. The operator never rebases,
never forces, and never runs with hooks disabled.

## A conflict resolves by rule, or it stops

A session branch is cut from a head and pushed onto a head that has moved, so the conflict this
operator meets is usually not a disagreement about behaviour at all: a lint or format baseline
reformatted the same lines a three-line fix touched, and both sides are right. Handing that to a
person costs a mission and teaches nothing. So the same closed four-rule set the runtime owner
resolves an integration merge under — stated once under *A conflict is resolved by the integrator, not
escalated to a person* in `runtime.serve`, and shared as one module rather than copied
(`scripts/merge-resolution.mjs`) — resolves this merge too, and under the same two conditions: every
resolved hunk is recorded on the receipt, naming the file, the hunk's range in the merged result and
which of the rules applied, and the gates the `quality-verification` named are re-run on the merged
head before the push.

A merge is resolved this way only when **every** conflicting hunk falls under a rule. One hunk that
does not is `NON_FAST_FORWARD`, it terminates, and a person resolves it — the operator never resolves
the rest and pushes the remainder, because a partial resolution publishes a merge nobody decided. The
rule that takes the incoming session's side may only take it inside a file the session's own write set
owns, which is why the `changes` input is what says which files those are. And resolving is not
trusting: a red gate on the merged head stops the publish exactly as a red gate stops the serve.

## An unreceipted session branch is not publishable

A session branch is only ever the tail of a session, so the session that produced it is on disk when
this operator merges it: the session folder exists, and inside it an `interface.generate`,
`interface.fix`, `backend.generate` or `library.update` branch is `done` with the branch head among
its `commits`. That receipt is the
only thing that says which paths were declared, which values were authorized, and which gate passed
them; a session branch with no such receipt carries commits nobody wrote a request for, and merging
it publishes work that never entered the runtime at all. When the chain the session ran includes an
`interface.audit` or a `uat.verify` step, that branch's response and its `screenshot`
artifacts must exist too, because a surface nobody looked at and a journey nobody walked are exactly
the changes this gate is here to catch. Any of those absences is `SESSION_MISSING`, it terminates,
and the answer is to run the operators that owe
the receipt — never to write the receipt now, after the fact, from what the diff happens to contain.

## A blocked hook is a result

Hooks are enforced, always, and `pre-push` is the last gate before the remote. A failing hook
produces `HOOK_BLOCKED` naming the hook, and the delta that clears it is a fixed boundary and a new
head. It is never a reason to run the push again with the hook disabled, to move the change onto a
branch whose hooks are lighter, or to commit the hook's own configuration out of the way. A
publication that carries a failed hook result, or that lacks the `pre-push` result altogether, is
refused.

## A rejected push is a result

When the remote carries commits the local ref does not, the push is not fast-forward. The operator
returns `NON_FAST_FORWARD` naming the remote head it observed. It does not rebase onto it, amend a
commit to make the push apply, squash the divergence away, force, or lease-force. Reconciling
divergent history changes what other people have already pulled, so it belongs to whoever owns the
branch, and that owner is not this operator.

## The boundary is exact

The boundary is the whole of what this publication owns, and the input `changes` names the paths
inside it. Anything dirty outside it is work this boundary does not own, and a publish that carries
it publishes somebody else's unreviewed change; that is `DIRTY_OUTSIDE_BOUNDARY`. Under a forbidden
worktree policy every published head is on the routed mutation branch, and a head on any other
branch is `BRANCH_POLICY_VIOLATION`. A publication that advances nothing is not a publication: the
published head is ahead of its upstream and the ref actually moved.

## The tag is asked for, or there is none

`tag` defaults to null, so a publication carries a continuation tag only when a person named one,
and that tag is annotated and points at a head this same publication pushed. A tag on a head this
run did not push is a label somebody else's commit now wears.

## Cleanup is part of the publish

After the push succeeds, the session worktree and the session branch are removed together with the
session folder, because the evidence they held has just become a published commit. A blocked session
keeps both: the evidence of what was attempted lives there until a person has read it.

The server that served the session's work is not this operator's to stop: the runtime owner holds
the lease and the pid, and releasing them is its own job, reached through the Next table once the
publish is done.

## Boundary

Context is read-only apart from the merge and the push. The operator writes only `response/` of its
own branch, the target branch of the routed checkout, and the push to `@remote/git/<project>/<role>`:
the approved head on the routed ref, and at most one annotated continuation tag pointing at a head
this same publication pushed. It does not force push, lease-force push, or rewrite published history;
does not run reset, clean, or stash; does not delete a branch other than the session branch it is
cleaning up; does not bypass, skip, or disable a Git hook; does not amend, rebase, or squash a commit
to make a rejected push succeed; does not publish a head outside the approved boundary; and does not
publish without a verified route and an approval bound to this exact boundary.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/local/routes/<project>/<role>` | the checkout, its session branch and its target branch, read at the frozen head | yes |
| `@workspaces/<project>/<role>/husky` | `pre-commit` and `pre-push`, which always run | yes |
| `@remote/git/<project>/<role>` | the publication target and the remote head observed at invocation time | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `workspace-route-binding` | `workspace.bind`; a publish never resolves its own checkout | yes |
| `changes` | `interface.generate`, `interface.fix`, `backend.generate` or `library.update`, the exact file set this publication carries | yes |
| `quality-verification` | `quality.verify`, the receipt whose measured commit is the one this publication pushes | yes |
| `business-reconciliation` | `business.reconcile`, the comparison of the promise head against the delivered source that admits this publication; absent when the mission promised nothing to reconcile | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `boundary` | id | — | The one boundary being published, exactly as the approval names it |
| `approval` | id | — | The approval record that covers this boundary; completion is not approval |
| `tag` | `{name, message}` | null | One annotated continuation tag on the head this publication pushes, or none |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume | `resume` | `request/request.json`, @workspaces/local/routes/<project>/<role> at the frozen head, @remote/git/<project>/<role> as observed | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the route | — | input `workspace-route-binding`: the verified checkout, its head and its routed policy, and @workspaces/local/routes/<project>/<role> | — | `ROUTE_UNVERIFIED` |
| 3 | Bind the approval to this exact boundary | `boundary`, `approval` | `request/request.json` requirements, input `changes` as the file set, input `quality-verification` as the measured commit | — | `APPROVAL_MISSING` |
| 4 | Verify the tree: dirty outside the boundary, branch policy | — | @workspaces/local/routes/<project>/<role>, the dirty paths, every branch, the routed policy | — | `DIRTY_OUTSIDE_BOUNDARY`, `BRANCH_POLICY_VIOLATION` |
| 5 | Run the hooks | — | @workspaces/<project>/<role>/husky: the installed hooks, `pre-push` among them | @tools/shell | `HOOK_BLOCKED` |
| 6 | Bind the session's receipts, then merge the session branch into the target branch, resolving each conflicting hunk under the shared rule set and recording it | — | the session folder: `state.json`, the `interface.generate`, `interface.fix`, `backend.generate` or `library.update` branch whose `commits` carry the session head, and the `interface.audit` and `uat.verify` branches with their `screenshot` artifacts when the chain has them; input `changes` for the files the session's write set owns; @workspaces/local/routes/<project>/<role> for the target head, the session base and the session head | @workspaces/local/routes/<project>/<role>, the target branch of that checkout, @tools/git | `SESSION_MISSING`, `NON_FAST_FORWARD` |
| 7 | Re-run the gates the verification named on the merged head when the merge resolved a hunk | — | input `quality-verification` for the gates it ran, @workspaces/local/routes/<project>/<role> at the merged head, @tools/shell | @tools/shell | `NON_FAST_FORWARD` |
| 8 | Push non-force, fast-forward only | — | @workspaces/local/routes/<project>/<role> for the approved head, @remote/git/<project>/<role> at the observed remote head, @tools/ci | @remote/git/<project>/<role>, @tools/git | `NON_FAST_FORWARD` |
| 9 | Push the continuation tag | `tag` | @workspaces/local/routes/<project>/<role> for the head this publication pushed | @remote/git/<project>/<role>, @tools/git | — |
| 10 | Remove the worktree and the session branch, write the receipt and emit | — | everything above | @workspaces/local/routes/<project>/<role>, `response/response.md`, `response/response.json`, @tools/git | — |

Creating a remote ref and fast-forwarding one are different acts with different reviewers, so the
published head records which of the two it performed. A resume begins again at validation, reuses
only unchanged fingerprinted observations, and consumes the exact delta; a resume that adds no head,
approval, hook or remote change is `NO_PROGRESS`, and a re-observed remote must arrive as a new
remote head because the same observation cannot yield a different result.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `git-publication` | `response/response.md` | md | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `ROUTE_UNVERIFIED` | terminate |
| `SESSION_MISSING` | terminate |
| `APPROVAL_MISSING` | terminate |
| `BRANCH_POLICY_VIOLATION` | terminate |
| `DIRTY_OUTSIDE_BOUNDARY` | terminate |
| `HOOK_BLOCKED` | terminate |
| `NON_FAST_FORWARD` | terminate |

## Next

| When | Operator |
| --- | --- |
| the boundary is published and the head must reach an environment | `release.deploy` |
| the session is cleaned up and the runtime owner must release the lease of the session it served and stop what it started | `runtime.serve` |
