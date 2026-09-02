# Context for `git.publish`

## Purpose

Context is the exact material already available to publish one approved boundary. It answers "what
may this operator read?" before anything reaches a remote. Context never widens the boundary and
never turns a completed change into an approval.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Observations
taken from a checkout additionally bind the observed head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Route receipt | The verified checkout, its head, and its routed Git policy. | Required. A publish never resolves its own checkout. |
| Approval | The record that this exact boundary unit may be published. | Required authority. Completion is not approval. |
| Git policy | Worktree branch policy, mutation branch, and the two non-force constants. | Required law. Closed by construction. |
| Hook inventory | The hooks installed on this checkout, each enforced. | Required. A publish always runs `pre-push`. |
| Remote observation | The remote name, ref, and the head it currently carries. | Required evidence. Decides fast-forwardness. |
| Completion proof | The gates the boundary passed before approval. | Evidence. Never a substitute for approval. |

## Required context

Every invocation requires:

1. one route receipt whose project matches the request and whose status is `bound`;
2. one approval naming exactly `input.boundary.unit`;
3. the routed Git policy;
4. a hook inventory containing `pre-push`;
5. one remote observation for exactly the ref being published.

## The route is read, never rediscovered

This operator does not resolve a project to a checkout. `workspace.bind` does that, and its receipt
arrives here already bound. A publish that resolved its own path could publish from a checkout nobody
verified, which is the failure this separation exists to prevent. A route receipt whose status is not
`bound`, or which names another project, is `ROUTE_UNVERIFIED`.

## Non-force is structural, not advisory

`context.gitPolicy.forcePush` and `context.gitPolicy.historyRewrite` are the constant `false`, and
`input.destructiveOperations` is a closed object whose every member is the constant `false`:
`forcePush`, `historyRewrite`, `resetHard`, `clean`, `stash`, `branchDelete`, `hookBypass`. There is
no representable input that requests any of them.

The reason they are constants rather than prose is that each of them is most tempting exactly when a
publish has just failed. A rejected push, a red hook, and an unexpected dirty file each have an
obvious one-command answer that destroys someone else's work or someone else's evidence. Making the
request unrepresentable removes the decision from the moment it would be made badly.

## A blocked hook is a result

Hooks are enforced, and `enforced: true` is a constant on every entry in the inventory. A failing
`pre-push` hook produces `HOOK_BLOCKED` with the hook named. It is a typed failure owned by the
source, and the delta that clears it is a fixed boundary. It is never a reason to retry with a
bypass, and no bypass is representable in the first place.

## A rejected push is a result

When the remote carries commits the local ref does not, the push is not fast-forward. The operator
returns `NON_FAST_FORWARD` naming the remote head it observed. It does not rebase, amend, squash,
force, or lease-force. Reconciling divergent history is a decision with an owner, and that owner is
not this operator.

## Boundary

Context is read-only. The operator writes only its publication receipt under
`input.artifactRootRef`, plus the push itself: the approved heads on the declared ref, and at most
one annotated continuation tag pointing at a head this same publication pushed.

## Resources

This operator runs end to end on the `sonnet` profile (`claude-sonnet-5`, runtime `claude`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: source write. It never searches the web, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
