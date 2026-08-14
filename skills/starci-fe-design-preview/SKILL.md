---
name: starci-fe-design-preview
description: Build the chosen StarCi screen from the real components, contracts and tokens production uses, render every owner state, and propose any backend update it needs. Use after starci-fe-design-plan records a chosen direction in the task file. Writes no production source and ends with the user approving what they can see.
---

# StarCi FE Design Preview

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Preview turns a chosen picture into something that runs. Its output is a screen built the way
production will build it, not an image Apply has to interpret afterwards.

## SCOPE

Print the table. `Touching` is the artifact directory. Read `## plan` in the task file; if there is
no chosen direction, `$starci-fe-design-plan` has not finished.

Feedback that changes the product thesis, ownership or business behavior goes back to Plan. Feedback
about how it looks stays here.

## PROCESS

**Build it with the real vocabulary.** Same framework, same leaves, composites, branches, shells,
contracts, vendor wrappers and tokens production uses. Import the target's components read-only where
they exist. Where an approved new owner does not exist yet, write its exact source here and record
the path it will take. Never substitute hand-written HTML for a StarCi component to match the Plan
picture faster — that is the one shortcut that makes Apply a rewrite.

Read the tier's file in [`../../fe/canon/uxui/layers/`](../../fe/canon/uxui/layers/) BEFORE authoring
that tier, and [`contract`](../../fe/canon/patterns/contract.md) before touching the contract table:
the class vocabulary is a closed union, so one unadmitted token makes the whole table fail to type
and reports as errors in unrelated files.

**Inventory before invention.** Before writing a new entry, composite or row, list the existing keys
whose shape already expresses the same relationship and say REUSE, EXTEND, or NEW because <the
relationship nothing existing can express>. An entry repeating another's class list and child
identities is the same concept under a second name, and `starci-fe/no-duplicate-entry-shape` refuses
it. A row built inline from a leaf plus a glyph is the same failure where no rule can see it.

**Render every owner state**, classified by the owner that can change rather than one flat page
checklist — see [`references/state-coverage.md`](references/state-coverage.md), which also carries
what to do when the browser refuses to screenshot. Skeleton only genuinely pending values; known
labels and totals stay truthful. Never compare a visitor state against an owner state, or loading
against populated.

**Lint as you write, not once at the end.** The rules state their own remedy in the message, so they
are the cheapest design review available and the only one that cannot be talked out of a finding.
Typecheck, lint and build must be green before you ask for anything.

**A field the screen needs and the schema does not serve is a SUB-RUN**, not a blocker:
`$starci-be-feature-plan` designs it and returns here. The screen is still yours to finish.

## OUTPUT

Shape A while anything is stuck. Batch what you know; keep building everything it does not block.

Shape B when the user approves what they are looking at. Name the thing in the question — "approve
this and move on?" — so their one word already carries what it approves. Then append `## review` to
the task file: the SCOPE table, every owner state and whether it rendered, the backend update you are
proposing, the UX calls you took on your own, and what they approved.

Then invite `$starci-fe-design-apply` — it confirms the write boundary with them, applies the backend
update first if there is one, writes the frontend, and opens the real page.
