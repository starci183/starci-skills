---
name: starci-fe-consolidate-plan
description: Survey a stated scope of the StarCi frontend for near-duplicate components, group them by real call sites, and settle each group with one verdict — merge, one variant prop, extract the shared shape, or keep apart. Writes a proposal and changes no code. Use when the job is to FIND duplication: "tìm component trùng", "is there already a component for this", "what should we consolidate next".
---

# StarCi FE Consolidate Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Duplication is evidence, not a defect list. Two files holding the same markup say a shape was needed
twice and the vocabulary had no word for it.

The expensive mistake runs the other way, which is why this half is separate: merging two things that
merely LOOK alike produces one owner carrying a flag per call site, which nobody holds in their head
and no story renders honestly. So this half spends its effort on the question a later diff cannot
re-derive — **are these the same thing** — and hands the mechanical part on.

## SCOPE

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

A confirm row for a group you cannot settle alone: the verdict the evidence leans to, what makes it
uncertain, and what changes if the other one is picked. A repository whose lint adoption is failing
cannot be measured honestly either — that is `$starci-fe-lint-sync`, which returns here.

Once the verdict set is approved: append `## plan` to the task file with the SCOPE table,
each group, its members, its call sites and its verdict. Groups left at `keep-apart` do not travel.
Then invite `$starci-fe-consolidate-apply` — it edits one group per diff, updates every measured call
site and proves each still renders what it rendered. Say plainly that the measurement ages from here.
