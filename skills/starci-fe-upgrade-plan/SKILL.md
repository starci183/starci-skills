---
name: starci-fe-upgrade-plan
description: Read every task record for what the founder REFUSED, find the pattern behind the refusals, and propose the rule change that would have prevented them. Writes no rules. Use when the same correction keeps coming back, after a run that was sent back more than once, or on a schedule — "nâng cấp skills", "sao cứ phải nhắc mãi", "học từ mấy lần thầy bác đi".
---

# StarCi FE Upgrade Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Every other skill improves the product. This one improves the RULES, and it has exactly one source of
truth: the `Rejected` tables in `<backend-repo>/.workflows/*/*/*.md`. A rule invented from memory of
what usually goes wrong is a rule nobody can check; a rule traced to three refusals is a rule with
three witnesses.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print the table. `Touching` is the proposal file and nothing else — this half writes no rule, no
skill and no canon page.

Name the window: every record, or the ones since a date, or one app. A sweep over three months of
records and a sweep over yesterday's are different claims, and the reader has to know which one they
are being shown.

## PROCESS

**Read the refusals first, and nothing else.** Every `Rejected` row across every task file, in the
window. Approvals are context; they are not evidence about the rules, because a run that went in
clean tells you the rules were sufficient for that run and nothing more.

**Group by what the rules failed to say**, not by which skill was running. The same missing law
surfaces in three places: "read the legacy exactly" refused a design revision, "don't bend the gate"
refused a lint edit, and "count imports, not strings" refused a survey — three skills, one absent
rule about taking evidence from the source rather than from a reading of it. Grouped by skill, each
of those looks like a one-off.

For each group, establish four things, and refuse the group if any is missing:

| | |
|---|---|
| The refusals | at least two, quoted, with their task files |
| What the rules said at the time | the file and line that was followed, or the silence that was filled |
| What they should have said | one sentence, general enough to cover all the refusals in the group and no more |
| Where it belongs | a canon page, a skill's PROCESS, `skill-shape.md`, or a lint rule — see below |

**Where a change belongs is itself a decision, and the wrong home makes it useless.** A rule a
machine can check belongs in `sources/fe/*.mjs`, where it cannot be forgotten. A rule about how a
phase runs belongs in that skill. A rule about what the product means belongs in canon. A rule about
the shape of every run belongs in `skill-shape.md`. Prose in a skill that a lint rule could have
enforced is a rule that will be broken by the next run that is in a hurry.

**One refusal is a preference until it repeats.** A group with a single witness is recorded as
WATCHED rather than proposed — named, with what would make it a rule. The tree gets worse when every
correction becomes a law, because a law nobody can recite is a law nobody follows.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. Write the proposal to
`<backend-repo>/.workflows/upgrade/<app>/<name>.md` with deduplicated witnesses, one section per group
and the WATCHED list. `OUTPUTS` names proposed rule concepts; `CHANGES` details the workflow path
only. Then invite `$starci-fe-upgrade-review`.
