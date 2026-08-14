---
name: starci-fe-consolidate-plan
description: Survey a stated StarCi frontend scope for near-duplicate components and brief each group as merge, prop-variant, extract-composite or keep-apart. Use when finding duplicate components or deciding what to consolidate. Writes no production code and hands the frozen groups to starci-fe-consolidate-review.
---

# StarCi FE Consolidate Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Duplication is evidence, not a defect list. Two files holding the same markup say a shape was needed
twice and the vocabulary had no word for it.

The expensive mistake runs the other way, which is why this half is separate: merging two things that
merely LOOK alike produces one owner carrying a flag per call site, which nobody holds in their head
and no story renders honestly. So this half spends its effort on the question a later diff cannot
re-derive — **are these the same thing** — and hands the mechanical part on.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print the table. `Touching` is the artifact directory: editing while surveying destroys the evidence
the proposal rests on, because a call-site count measured against a tree that no longer exists cannot
be checked by anybody reviewing it.

State the scope explicitly — the whole app, one route, one feature folder, a named file set. A survey
with no stated scope reports whatever it happened to walk, and its ranking cannot be compared with
the last one.

## PROCESS

**Count imports and call sites, never string occurrences.** A grep for a component name also matches
its own definition, its story, its re-export and every comment mentioning it, and a group inflated
that way outranks one that is genuinely three times worse.

Two call sites anchor a pair. Three is a pattern. Extracting a NEW owner needs three, for the same
reason canon promotes an observation to a rule only when it repeats: the second file may be the one
about to change.

**Three questions settle each group:**

Does either copy know a domain entity, and is it the same one? A component taking `courseId` is a
block wherever its folder sits. Two blocks over two different entities that render identically are
not one block — they are two blocks with a [`composite`](../../fe/canon/uxui/layers/composite.md)
hiding inside them. The shape earns a name; the meaning stays where it is.

How many flags would unification cost? One named variant is a variant. A boolean per call site means
they were two components and the survey found a coincidence.

Would the merged owner need a `className` to serve both callers? Then it is not a consolidation —
[`SLOTS-6`](../../fe/canon/patterns/props-and-slots.md) refuses the appearance slot outright, because
a caller who can restyle a node has become its second owner.

Each group ends at exactly one verdict: `merge`, `prop-variant`, `extract-composite` or `keep-apart`.
Record `keep-apart` with the fact that distinguishes the pair — a different vendor primitive, slot
identity or domain entity. "They feel different" is a pair nobody compared.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

A confirm row for a group you cannot settle alone: the verdict the evidence leans to, what makes it
uncertain, and what changes if the other one is picked. A repository whose lint adoption is failing
cannot be measured honestly either — that is `$starci-fe-lint-sync-plan`, which returns here.

Append `## plan` to `.workflows/consolidation/<app>/<name>.md` with each proposed group, member,
call site and candidate verdict. Print the six canonical tables: `OUTPUTS` holds the consolidation
brief and `CHANGES` the workflow path only. Then invite `$starci-fe-consolidate-review`.
