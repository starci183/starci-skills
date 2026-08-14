---
name: starci-workflow-drift
description: Read the task files under <backend-repo>/.workflows/<kind>/<app>/ and ask the source whether it still matches — every file a task recorded writing, anything new inside a boundary the task never named, every state it recorded rendering. Use to check one task or sweep them all: "cái này còn đúng không", "check drift", before trusting an old workflow record.
---

# StarCi workflow drift

Read [`../../skill-shape.md`](../../skill-shape.md) first.

This is what replaced the seal. A seal guarded one run while that run was happening and knew nothing
afterwards; a task file stays, so the comparison stays available — over one task or over all of them,
at any distance from when the work happened.

Drift here is FOUND, not prevented. That is the trade the tree took deliberately: prevention cost a
hash per file and a phase that refused to finish, and detection costs one run over the whole history.

## SCOPE

Print the table. `Touching` is nothing — this skill reads and reports. Say which task files are in
scope: one kind, one app inside it, one id inside that, or every file under `<backend-repo>/.workflows/*/*/`.

## PROCESS

For each task file, take its `## apply` (or `## fix`) section as the claim and the source as the
answer.

**Every file under `WROTE` still exists**, and still holds the thing the task said it holds. A file
that was deleted or replaced is the loudest kind of drift and the easiest to miss, because nothing
fails.

**Nothing new inside `Touching` that `WROTE` never named.** A file added to a boundary a task claimed
is either work somebody else did there — worth knowing, and not drift — or the task itself writing
something it never recorded. Say which, by reading it, rather than reporting a count.

**Every state under `STATES` still renders what it rendered.** Same route, viewport, locale, theme,
persona and fixture; a comparison in another state proves nothing. This is the expensive check, so
run it on the states the task actually recorded rather than inventing a matrix.

**The decisions still hold.** A UX call recorded under `TOOK` that the source now contradicts is
drift even when everything compiles — somebody changed a label, an ordering or a variant without
knowing it had been decided. Name it beside the line that recorded it.

Report what the source says, never what the task file wishes. Where the two disagree, the disagreement
is the finding; do not quietly prefer whichever was read most recently.

## OUTPUT

The four tables — this skill invites nobody, it reports. For each task: matches, or the exact divergence with
the file and the line of the record it contradicts.

Then say which lane clears each one, so the report is actionable rather than a list of complaints: a
render that moved is `$starci-fe-fidelity-plan` when the old state was right, and
`$starci-fe-design-plan` when nobody has decided which of the two is right. A file present that no
task named is neither until somebody reads it.

Do not repair anything here. A skill that both measures and edits destroys its own evidence, which is
the same reason the consolidation survey does not edit either.
