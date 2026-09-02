# Input for `workspace.bind`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the identity to bind and the boundary it may write. Undeclared
fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `workspace.bind`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen project-and-role binding request.

## Context bindings

`context.bootstrapRefs` is non-empty. `context.portableRoute` and `context.hydratedRoute` are always
required, and both must declare exactly `input.project` and `input.role`. `context.identity` is
always required and its credential roster is encrypted; there is no representable input that carries
a plaintext secret.

`context.runtime` is present exactly when `input.runtimeNeed` is `consume`, and null otherwise. Its
`endpointBinding.authority` is the constant `workspace-route-port-projection`, so a caller-selected
URL cannot enter as an endpoint at all.

`context.provenance` and `context.cachedRouteReceipt` are evidence and may be null.

`context.hints` records what merely looks like a route: a similar name, a sibling directory, the
working directory, a browser URL. Every hint carries `authoritative: false` as a constant. The field
exists so a hint can be named and refused, never consulted.

## Route agreement

The portable declaration and the hydrated route must agree on project, role, Git repository, and
branch. A `source` repository kind carries a null directory and hydrates onto the Source root itself;
a `sibling` kind carries a relative directory with no traversal and hydrates beside it. The hydrated
route's workspace root must be `.workspaces` under its own Source root, and its disk path and Git
root must be one checkout.

`input.observedCheckout.diskPath` must be that hydrated checkout. An observation taken anywhere else
is an observation of a different repository.

## Mutation boundary

`input.gitPolicy` carries the routed policy. When `worktreeBranches` is `forbidden`, the observed
branch must be `mutationBranch`; creating or switching to a task, feature, or worktree branch is not
a state this input can describe.

`input.declaredWriteRoots` is non-empty, and every path in `observedCheckout.dirtyPaths` must lie
under one of them. Anything dirty outside the declared boundary belongs to work this invocation does
not own.

`input.frozenSourceHead` is the head the mission froze. It is compared against
`observedCheckout.head` during execution, and a difference is `SOURCE_DRIFT` rather than a silent
rebind.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since. Project, role, frozen head, and artifact root must
equal the blocked receipt. A resume that adds no route, identity, runtime, or provenance delta is
invalid as `NO_PROGRESS`.
