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

## Green is not the goal — correct is

A check passing is not the change being right, and the gap between them is where the shortcut lives. If
the only way to make a check pass would leave a fix that contradicts a decision made earlier in this
session — a prop just removed, a rule just set, a shape just agreed — **stop**. Do the change that
decision implies (usually the fuller removal, not the patch that keeps the old thing quietly alive), and
say the contradiction out loud. Satisfying the checker while keeping the inconsistency is the move this
hook exists to refuse: the tool goes green and the debt goes silent.

And hold a stance. When the work in front of you disagrees with the principle the session just set — even
when the disagreement is your OWN earlier patch — argue it, do not quietly comply. A skill that only ever
agrees is not verifying; it is rubber-stamping.
