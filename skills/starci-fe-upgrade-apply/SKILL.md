---
name: starci-fe-upgrade-apply
description: Apply trust-tree changes approved by starci-fe-upgrade-review to canon, skills, skill shape or lint rules, then prove the gates remain green. Use only after Review approves each wording, home, test obligation and write boundary.
---

# StarCi FE Upgrade Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print the table, then **confirm `Touching` with the user before the first write.** This is the one
lane whose writes change every future run, so the boundary is worth naming out loud even when the
change is three lines.

Read the approved groups in `<backend-repo>/.workflows/upgrade/<app>/<name>.md`. A group Review did
not approve is not written, however good the evidence looked — and a group the plan never traced to
at least two refusals is not written at all.

## PROCESS

**Fetch the trust tree before writing it.** `.claude` is shared and other sessions edit it; a rule
written on top of a stale checkout is a rule that vanishes at the next pull.

Write each change where the plan said it belongs:

| Home | What goes there | What else the change owes |
|---|---|---|
| `sources/fe/*.mjs` | anything a machine can check | a twin test that fails without the rule, and a mirror sync to every consuming repository |
| `skills/<name>/SKILL.md` | how one phase runs | nothing else, but say it in that skill's own voice |
| `fe/canon/` | what the product MEANS | the Forbidden row and the two-examples pair the page's shape requires |
| `skill-shape.md` | the shape of every run | every skill that contradicts it, updated in the same commit |

**A lint rule ships with its twin test or it does not ship.** The rule is a claim about code; the
test is the only thing that says the claim is still true after somebody edits the rule. Run the
canon gate, then the target repositories' own lint, before calling it done — a rule that turns a
green repository red is a finding, not a success.

**Run the rule against the real tables before enabling it.** Three separate false-positive classes
were found this way in one week, and every one of them looked correct in a unit test: a windowed
regex that read the next entry's field, a class the union admits but Tailwind resolves itself, a
band whose full-bleed classes read as interaction. A rule reported wrong is worse than no rule,
because the next author learns to ignore the message.

If a change turns out to contradict an existing law, that is a confirm row: the two laws are the
founder's to reconcile, and a skill that quietly picks one has just made the tree self-contradictory
in a place nobody will look.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names upgraded rule concepts; `CHANGES` details every
trust, mirror and target path. Append `## apply` with the CONTEXT, twin tests, gate and mirror
results, warnings, rejections and owed work.

Nothing invites anything after this. The next run reads the new rules without being told to.
