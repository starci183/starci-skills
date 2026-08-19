---
name: starci-be-approve
description: Challenge a backend plan against real schema and sibling code, loop until the owner explicitly approves one exact revision and file boundary, then implement exactly that and prove it. Holds a hard stop before the first production write. Use when a backend brief is ready for approval and implementation.
---

# starci-be-approve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | the shared reporting contract every skill reads |
| `@workspaces` | `contexts/workspaces/context.md` | context | re-verify checkout, branch and source revision before approval |
| `@be-patterns` | `standards/backend/patterns/context.md` | context | challenge the plan's situation-to-file bindings against current source |
| `@rule-bindings` | `standards/backend/rule-bindings/context.md` | context | refuse an enforced situation whose gate or machine identity drifted |
| `@rule-binding-check` | `machines/rule-bindings/check.mjs` | script | execute backend gate-to-canon parity before approval and after implementation |
| `@plan-schema` | `kernel/approvals/backend-plan.schema.json` | file | validate that the revision being approved carries the complete compiler boundary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | refuse a malformed or incomplete brief before the approval loop |
| `@plan-check` | `machines/backend-plan/check.mjs` | script | refuse stale content identity, invented situations or uncovered files |

## NESTED SKILLS

None. This skill never invokes another skill.


## Run

Read `@skill-shape`, `@workspaces`, `@be-patterns` and `@rule-bindings` in that order. This skill contains both the approval loop and
the implementation, with a hard stop between them. The stop is the whole point: everything before it is
reversible, everything after it is in the product.

## PROCESS

### 1 — Establish the context lock

`Phase` is `approve`. `Touching` is `None` until approval; after approval it becomes the
exact backend paths the approved boundary names, and nothing else.

### 2 — Challenge the plan against reality

Re-read what the plan claims, against the checkout rather than against the plan's own summary:

First validate the exact revision against `@plan-schema` using `@validate-artifact`, then run
`@plan-check`; a prose summary is not an approval identity.

- does every named file's parent folder exist, and does the family really look like that?
- does every field the plan uses exist in the schema under that name?
- does the exception path derive from the abstract exception, as the siblings do?
- are the enumerated test cases the ones this capability can actually fail on?
- does every planned file have a binding with fixed pattern situations and live evidence?
- does each binding still route to the same authority, and does `@rule-binding-check --be` pass?

A plan that survives this unchanged is rare. Say what changed, and why.

### 3 — Loop until the owner explicitly approves

```text
brief -> feedback -> revision -> brief
```

Batch every known question into one round; do not drip-feed. Record every rejection with its replacement
and the owner's reason in their words. The loop ends when the owner selects a revision and boundary, or
replies `OK` to the currently displayed recommended revision and exact boundary. Silence and approval
attached to an older revision do not count.

State `Approved revision: <identity>` in the phase output. Nothing below this line runs without it.

### 4 — Hard stop, then baseline

This is the boundary. Confirm the repository, branch and `Touching` with the owner, then commit the
current target state and record `Baseline commit: <sha>` — taken before the first change, so
`git diff <baseline>` is an honest account.

### 5 — Implement exactly the approved revision

Only the approved files. A required path outside the boundary returns to the owner; it never arrives
quietly in the diff. Mirror the sibling family and every approved pattern binding the plan cited:
layering, transport, data access, exception identity, naming and every other reached situation. Every
exception derives from the abstract exception. A binding is an implementation constraint, not review prose.

Preserve unrelated work in the tree. Suppressions, weakened gates and skipped tests are not
implementation choices available here.

### 6 — Prove it with the evidence the approval named

Run `@rule-binding-check --be`, then the enumerated cases, not a cheaper substitute. Then the repository's real gates — lint, typecheck,
build, tests — and the runtime proof the acceptance evidence named, such as a live query or a boot probe.
A gate that fails is repaired. For an unreachable gate, exhaust safe fallbacks; if owner authority is
required, use `### NEED APPROVALS`, otherwise state the external blocker without claiming a pass.

Do not run end-to-end suites unless the approval asked for them.

### 7 — Close the phase

Append `Applied revision: <same identity>`, the baseline commit and the tracked diff. The diff must list
every production path and match the approved boundary exactly.

## Stops

- No `Approved revision` recorded → the implementation does not begin, whatever the plan says.
- Approval is attached to an older revision, or no default exists and `OK` cannot identify one → ask
  once; `OK` for the displayed default is not ambiguous.
- The tree is already dirty with unrelated work → stop; a baseline from mixed state proves nothing.
- A required path is outside the boundary → return to the owner rather than widening it silently.
- A file has no approved pattern binding, or a binding no longer matches current law/source → return to
  planning; approval cannot repair incomplete compiler input.
- Backend rule-binding parity is red → stop before production write; machine and law disagree.
- A gate cannot pass without weakening it → stop; the rule does not bend to the code.

## OUTPUT

Follow the skill shape's friendly prose contract. Close only after every `own` item is implemented and
proved. Ask only under `### NEED APPROVALS`; after `OK`, apply without repeating the question.
