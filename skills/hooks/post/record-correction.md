# post/record-correction.md

**Scope.** Every skill, front end and back end — any skill whose result a person can reject.

**After the work lands** the job is finished either way; but when the person corrects it — rejects an
option, says "not like that", restates a rule the skill missed — that miss returns next session unless it
is written down. So write it down. Do not fix it silently and move past it.

One file per correction, under `corrections/pending/`, named for the date, the skill that missed
and a short slug:

```
corrections/pending/<date>-<skill-name>-<short-slug>.md

What was corrected: the miss, in a sentence or two.
Why: the reason it was wrong, stated so the fix survives a case its author never saw.
How to apply: the concrete change to the skill — a rule for a manner doc, a step to fix, a reference to write.
status: open
```

That file is the input to `starci-upgrade-plan` and `starci-upgrade-apply`, which fold it into the skill
it targets and then move it to `corrections/applied/`. A correction about the back end is recorded
the same way; only where it *folds* differs — into a BE skill's `SKILL.md` or into `canon/be/`, never into
a front-end manner doc. The exact format an entry obeys is set out in [`corrections/README.md`](../../corrections.md).
