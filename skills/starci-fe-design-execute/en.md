---
title: starci-fe-design-execute · English
---

# starci-fe-design-execute

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@lints-fe` | `gates/fe/lints` | module | prove the frontend source at its real gate |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | reproduce the token digest approved inside each layout |
| `@patterns-fe` | `compilers/patterns/fe` | module | resolve files, exports and import boundaries |
| `@design-registry-schema` | `contexts/worktrees/design-registry.schema.json` | file | validate identity-centric heads and immutable object references |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | require registry v2 heads and projections to be current before source execution |
| `@session` | `skills/skill-shape/session.schema.json` | file | optional audit-history shape; never the lookup authority |
| `@skill-shape` | `skills/skill-shape/en.md` | en | the shared reporting contract every skill reads |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate the session graph before production work |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify the frontend checkout |
| `@worktrees` | `contexts/worktrees/en.md` | en | resolve and verify the registry worktree |

## NESTED SKILLS

None. This skill never invokes another skill.


## Run

Read `@skill-shape` first. This is the only frontend skill that writes
product source, and it is the one that must be hardest to start.
The caller supplies stable `layoutId`; the design registry is the sole implementation lookup authority.

## PROCESS

### 1 — Establish the context lock

`Phase` is `execute`. `Touching` names the exact frontend paths this run may write, and it is confirmed
with the owner before the first write. Detection is not permission.

### 2 — Refuse unless the layout head and every current region block head are accepted

Run `@design-registry-check`. Read `@design-registry-schema` and validate
`registries/design-registry-v2.json`. Resolve the caller's `layoutId` through
`layoutHeads[layoutId].head`, then resolve that immutable layout object through `objects.byHash`. The head
is the accepted layout; do not inspect a session or review to choose another hash. Enumerate every declared
blockId in `layoutHeads[layoutId].regions`, resolve `blockHeads[layoutId/blockId]` for each, and require its
`layoutHash` to equal the current layout hash and its `head` object to exist. This traversal is the complete
implementation input: historical reviews are optional audit history, never authority.

If the layout head or any region block head is missing, malformed, proposed, or unaccepted, **stop and name
it**. A partial start would produce code nobody approved, in the one place the tree cannot undo cheaply.

### 3 — Verify the route, then take the baseline

Read `@workspaces` and verify the `fe` route (`WORKSPACE-5`). Run `@inventory-visual-language`; its digest
must equal every current layout direction's `vocabularyAt`. Only then commit the current target state and record
`Baseline commit: <sha>` — taken **before** the first change, never from a half-edited tree, so
`git diff <baseline>` is the honest account of what this run did.

### 4 — Apply the direction embedded in the layout

Read the exact `direction` object carried by each accepted layout. Reused token decisions must still
resolve in the frontend vocabulary. New token decisions apply only the name and value embedded in the
accepted layout; preview CSS is never copied into product source.

When two accepted layouts in the same implementation scope assign one shared semantic role
incompatibly, stop and return the conflict. There is no separate direction hash to choose between: the
layout hash is the approval that binds the direction it contains.

### 5 — Resolve every class through the principles

The accepted JSON carries no class; that was its law. Each node's classes are now resolved
deterministically:

- one situation code per node per principle, and exactly one className from that code;
- a class that is not a member of the contract's closed union is **unrepresentable** — needing one is a
  contract change that returns to the owner, not a value to approximate;
- two adjacent codes both matching resolves to the smaller rung, not to a preference.

A resolution that requires taste means a principle is incomplete. Record it; do not decide it here.

### 6 — Land the files through the patterns

Where a file lives, what it exports, what it may import and what it is named are decided by
`@patterns-fe`, not by convenience. Patterns are compilers, not gates: they answer a shape
already accepted, so they are read **before** the first line rather than consulted after it, when the
only remaining option is to move code that is already written. The entry's node is **rendered**, not imitated: copying an
entry's classes onto a vendor element drops what that element cannot carry — the `host` — and the
result claims the contract is honoured while the accessibility tree is wrong.

Every `reuse`, `generalize` and `new` verdict in the accepted JSON is carried out as recorded. A
`generalize` verdict updates every measured call site; a rename that leaves one behind is not done.

### 7 — Prove it against the gates

Run the frontend lints from `@lints-fe`. A finding is repaired, not suppressed: no rule is
weakened, disabled or hatched to make a run pass. Then prove the surface renders — the evidence the
approval named, not a substitute that is easier to produce.

### 8 — Close the phase

Close with the applied revision, the baseline commit and the tracked diff. The diff lists every
production path and must match the approved boundary; a path outside `Touching`
returns to its owner instead of arriving quietly.

## Stops

- Any layout or current region block head missing, proposed or unaccepted → stop, name its stable identity and hash.
- An accepted layout's direction references a missing reused token → stop; the visual evidence is stale.
- Accepted layouts assign one shared role incompatibly in the same implementation scope → stop; return the product decision.
- A required class is outside the contract's closed union → contract change, return to owner.
- A principle cannot resolve without preference → record the gap, stop that node.
- A lint finding that cannot be repaired inside `Touching` → return the boundary, do not suppress.
- Baseline commit not possible because the tree is already dirty with unrelated work → stop; a baseline
  taken from mixed state proves nothing.

## OUTPUT

State the `layoutId`, applied revision, material paths and proof in concise prose. A proof that can run is `own` and
must run before the turn ends; only a genuine authority decision may appear under `### NEED APPROVALS`.
