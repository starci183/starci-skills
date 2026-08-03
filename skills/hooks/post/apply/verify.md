# post/verify.md

**Scope.** Every apply skill — the lanes that change code. A plan skill proposes and has nothing to prove
yet; an apply skill does.

**Before you call the change done**, prove it. A change that type-checks is not a change that is correct,
and a skill that reports a success it did not watch is worse than one that reports a failure it did.

- Run the skill's own `test.mjs`.
- Run the gates the change touches under `scripts/gates/`.
- For a front-end surface, run the rendered-tree contract (`starci-fe-contract`) — a layout breaks at a
  width without ever failing a type check.

Report what ran and what it said. If a check could not run here — no container, no design system on this
machine — say so plainly; do not report a pass you did not see.
