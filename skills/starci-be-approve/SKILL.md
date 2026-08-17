---
name: starci-be-approve
description: Challenge a backend plan against real schema and sibling code, loop until the owner explicitly approves one exact revision and file boundary, then implement exactly that and prove it. Holds a hard stop before the first production write. Use after starci-be-plan.
---

# starci-be-approve

Read [`../skill-shape/en.md`](../skill-shape/en.md) first. This skill contains both the approval loop and
the implementation, with a hard stop between them. The stop is the whole point: everything before it is
reversible, everything after it is in the product.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `approve`. `Touching` is `None` until approval; after approval it becomes the
exact backend paths the approved boundary names, and nothing else.

### 2 — Challenge the plan against reality

Re-read what the plan claims, against the checkout rather than against the plan's own summary:

- does every named file's parent folder exist, and does the family really look like that?
- does every field the plan uses exist in the schema under that name?
- does the exception path derive from the abstract exception, as the siblings do?
- are the enumerated test cases the ones this capability can actually fail on?

A plan that survives this unchanged is rare. Say what changed, and why.

### 3 — Loop until the owner explicitly approves

```text
brief -> feedback -> revision -> brief
```

Batch every known question into one round; do not drip-feed. Record every rejection with its replacement
and the owner's reason in their words. The loop ends only when the owner approves **one exact revision**
and **one exact file boundary** — not "looks good", not silence, not an approval of an earlier revision.

State `Approved revision: <identity>` in the phase output. Nothing below this line runs without it.

### 4 — Hard stop, then baseline

This is the boundary. Confirm the repository, branch and `Touching` with the owner, then commit the
current target state and record `Baseline commit: <sha>` — taken before the first change, so
`git diff <baseline>` is an honest account.

### 5 — Implement exactly the approved revision

Only the approved files. A required path outside the boundary returns to the owner; it never arrives
quietly in the diff. Mirror the sibling family the plan cited: layering, transport, data access,
exception identity, naming. Every exception derives from the abstract exception.

Preserve unrelated work in the tree. Suppressions, weakened gates and skipped tests are not
implementation choices available here.

### 6 — Prove it with the evidence the approval named

Run the enumerated cases, not a cheaper substitute. Then the repository's real gates — lint, typecheck,
build, tests — and the runtime proof the acceptance evidence named, such as a live query or a boot probe.
A gate that fails is repaired; a gate that is unreachable is reported as `OWED`, never as passing.

Do not run end-to-end suites unless the approval asked for them.

### 7 — Close the phase

Append `Applied revision: <same identity>`, the baseline commit and the tracked diff. `CHANGES` lists
every production path in that diff and must match the approved boundary exactly.

## Stops

- No `Approved revision` recorded → the implementation does not begin, whatever the plan says.
- Approval is ambiguous or attached to an older revision → keep looping; ambiguity is not consent.
- The tree is already dirty with unrelated work → stop; a baseline from mixed state proves nothing.
- A required path is outside the boundary → return to the owner rather than widening it silently.
- A gate cannot pass without weakening it → stop; the rule does not bend to the code.

## OUTPUT

The six tables from the skill shape, in order. `REJECTED` carries the owner's words from the loop;
`CHANGES` is the full production tree from `git diff <baseline>`; `OWED` carries any proof that did not
run and the exact command that clears it.
