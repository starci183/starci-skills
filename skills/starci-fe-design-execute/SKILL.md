---
name: starci-fe-design-execute
description: Implement an accepted frontend design in the real frontend source — applying the visual direction embedded in its layout, resolving every class through the principles, landing files through the patterns, and proving the result against the lints. Use only when every reachable layout and block hash in the session is accepted. Refuses to start on a proposed hash.
---

# starci-fe-design-execute

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@lints-fe` | `gates/fe/lints/context.md` | context | prove the frontend source at its real gate |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | reproduce the token digest approved inside each layout |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | resolve files, exports and import boundaries |
| `@session` | `skills/skill-shape/session.schema.json` | file | the shape a design session is written in |
| `@skill-shape` | `skills/skill-shape/context.md` | context | the shared reporting contract every skill reads |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate the session graph before production work |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend checkout |

## NESTED SKILLS

None. This skill never invokes another skill.


## Run

Read `@skill-shape` first. This is the only frontend skill that writes
product source, and it is the one that must be hardest to start.

## PROCESS

### 1 — Establish the context lock

`Phase` is `execute`. `Touching` names the exact frontend paths this run may write, and it is confirmed
with the owner before the first write. Detection is not permission.

### 2 — Refuse unless every reachable hash is accepted

Validate the session with `@validate-artifact` and `@session`. Reachable means the one queue entry whose
layout state is currently `accepted`, plus block entries whose `layoutHash` equals it. Historical
`rejected` and `superseded` entries remain evidence but are not implementation inputs. For each reachable
region, exactly one block may be current; an entry still `queued` is unanswered and refuses.

If any is unaccepted, **stop and name it**. There is no orchestrator to have checked this earlier, and
nothing else in the tree makes a proposed hash acceptable. A partial start is the failure mode this
skill exists to prevent: it produces code nobody approved, in the one place the tree cannot undo it
cheaply.

### 3 — Verify the route, then take the baseline

Read `@workspaces` and verify the `fe` route (`WORKSPACE-5`). Run `@inventory-visual-language`; its digest
must equal every reachable `direction.vocabularyAt`. Only then commit the current target state and record
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

- Any reachable hash unaccepted → stop, name it.
- An accepted layout's direction references a missing reused token → stop; the visual evidence is stale.
- Accepted layouts assign one shared role incompatibly in the same implementation scope → stop; return the product decision.
- A required class is outside the contract's closed union → contract change, return to owner.
- A principle cannot resolve without preference → record the gap, stop that node.
- A lint finding that cannot be repaired inside `Touching` → return the boundary, do not suppress.
- Baseline commit not possible because the tree is already dirty with unrelated work → stop; a baseline
  taken from mixed state proves nothing.

## OUTPUT

State the applied revision, material paths and proof in concise prose. A proof that can run is `own` and
must run before the turn ends; only a genuine authority decision may appear under `### NEED APPROVALS`.
