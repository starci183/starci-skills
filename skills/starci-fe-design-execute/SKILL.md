---
name: starci-fe-design-execute
description: Implement an accepted frontend design in the real frontend source — resolving every class through the principles, landing files through the patterns, and proving the result against the lints. Use only when every reachable layout and block hash in the session is accepted. Refuses to start on a proposed hash.
---

# starci-fe-design-execute

Read [`../skill-shape/en.md`](../skill-shape/en.md) first. This is the only frontend skill that writes
product source, and it is the one that must be hardest to start.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `execute`. `Touching` names the exact frontend paths this run may write, and it is confirmed
with the owner before the first write. Detection is not permission.

### 2 — Refuse unless every reachable hash is accepted

Walk the session. For the surfaces in scope, every layout hash and every block hash reachable from them
must be **accepted**, not proposed.

If any is unaccepted, **stop and name it**. There is no orchestrator to have checked this earlier, and
nothing else in the tree makes a proposed hash acceptable. A partial start is the failure mode this
skill exists to prevent: it produces code nobody approved, in the one place the tree cannot undo it
cheaply.

### 3 — Verify the route, then take the baseline

Verify the `fe` route (`WORKSPACE-5`). Then commit the current target state and record
`Baseline commit: <sha>` — taken **before** the first change, never from a half-edited tree, so
`git diff <baseline>` is the honest account of what this run did.

### 4 — Resolve every class through the principles

The accepted JSON carries no class; that was its law. Each node's classes are now resolved
deterministically:

- one situation code per node per principle, and exactly one className from that code;
- a class that is not a member of the contract's closed union is **unrepresentable** — needing one is a
  contract change that returns to the owner, not a value to approximate;
- two adjacent codes both matching resolves to the smaller rung, not to a preference.

A resolution that requires taste means a principle is incomplete. Record it; do not decide it here.

### 5 — Land the files through the patterns

Where a file lives, what it exports, what it may import and what it is named are decided by the
frontend patterns, not by convenience. The entry's node is **rendered**, not imitated: copying an
entry's classes onto a vendor element drops what that element cannot carry — the `host` — and the
result claims the contract is honoured while the accessibility tree is wrong.

Every `reuse`, `generalize` and `new` verdict in the accepted JSON is carried out as recorded. A
`generalize` verdict updates every measured call site; a rename that leaves one behind is not done.

### 6 — Prove it against the gates

Run the frontend lints and the pattern checks. A finding is repaired, not suppressed: no rule is
weakened, disabled or hatched to make a run pass. Then prove the surface renders — the evidence the
approval named, not a substitute that is easier to produce.

### 7 — Close the phase

Append the workflow with the applied revision, the baseline commit and the tracked diff. `CHANGES` lists
every production path in that diff and it must match the approved boundary; a path outside `Touching`
returns to its owner instead of arriving quietly.

## Stops

- Any reachable hash unaccepted → stop, name it.
- A required class is outside the contract's closed union → contract change, return to owner.
- A principle cannot resolve without preference → record the gap, stop that node.
- A lint finding that cannot be repaired inside `Touching` → return the boundary, do not suppress.
- Baseline commit not possible because the tree is already dirty with unrelated work → stop; a baseline
  taken from mixed state proves nothing.

## OUTPUT

The six tables from the skill shape, in order. `CHANGES` is the full production tree from
`git diff <baseline>`; `WARNINGS` carries anything proved by a weaker path than the approval named;
`OWED` carries proofs that did not run.
