# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why the proposal is treated as a spec rather than as a hint

An apply pass has all the context needed to notice things the scan missed, and every instinct says to
fix them while the file is open. The rule against it is not about trust; it is about what a review
can distinguish.

A diff containing approved changes and unapproved ones cannot be reviewed as either. The reviewer
either re-audits the whole thing — which is the work the scan already did — or waves it through,
which is what actually happens. Worse, the ledger then describes a state of the tree that no longer
matches, so the next scan's picture is wrong before it starts.

The cost of the rule is one extra round trip when something real is spotted. That is cheap, and the
finding is better for having been graded and ranked against the others rather than fixed because it
was nearby.

## Why the call site is re-read before every edit

Because the two halves are designed to run in different sessions, and a proposal is a claim about a
tree at a moment. Between the scan and the apply the component may have been rewritten, the copy
already fixed by someone else, the surface deleted.

Three outcomes are therefore legitimate, and the skill names all three so that "the finding was
wrong" is a recordable result rather than an embarrassment. A false positive usually means the scan
asserted a relationship the data does not have — which is worth knowing, because that is the scan's
own characteristic failure.

## Why routing exists instead of a single fix path

Because the fixes are not one size. Rewriting copy from mechanism to outcome touches one string.
Adding an onward path that exists nowhere in the flow touches the shell, and doing that from inside a
component-level pass is how a block quietly grows layout responsibilities it will never give back.

So a layout-level finding is marked and left pending rather than forced. That looks like the pass
achieving less; it is the pass declining to make the tree worse in order to close a line item.

## Why the design-system route is the third one

Some conversion findings — most often "this mention should be a real link" — need a component that
does not exist. The tempting move is to write it in the app, because it is needed in exactly one
place, and one place does not feel like a component.

It always becomes several places. The house rule that no component reaches the app without first
being a component and a story in the design system is not a formality here: a reference link has
states — resolved, unresolvable, loading — and the app-local version invariably implements the first
one only, which is precisely the dead-link defect the finding was raised about. `canon/fe/enforce/tiers/architecture.md`
carries the reasoning; `scripts/gates/check-story-coverage.mjs` holds the line.

## Why verification is per surface and includes a click-through

A type check proves the edit compiles. The entire class of defect this pair addresses is type-valid,
lint-clean and renders fine — that is why the audit had to exist in the first place — so ending at
`tsc` would verify nothing about the actual claim.

The rendered-tree contract catches the structural half: a demoted button and a moved link both change
computed style and both are visible to the runner. The click-through catches the rest, and it is the
only check that can say the person now has somewhere to go.

## Why recording the outcome is a numbered step

It is the step that gets dropped, and dropping it makes the next scan cost as much as the first. The
routed findings come back as new, the false positives come back as real, and the reviewer sees a list
they thought they had already decided — which is how a recurring audit loses its credibility after
two runs.

Three groups, not one: fixed, routed and still open, dropped and why. They are read differently
later, and collapsing them into "done" throws away the distinction that makes the ledger useful.

## Why debt has its own tool rather than a note here

A finding deliberately left undone is exactly what `starci-record-debt` exists for: named files, the
rule broken, and the reason it was deferred. A line in a proposal saying "skipped" records the first
two and loses the third, which is the only part a later reader cannot reconstruct from the code.

## What the tests cannot cover

Whether an agent holding this skill stays inside the proposal instead of improving things on the way
past. That is a behavioural property and needs an eval.

`test.mjs` covers the static promises: every canon, patterns, design and sibling-skill path cited
still resolves, no machine path was written in, and the founding invariant survives verbatim rather
than being softened into a suggestion.
