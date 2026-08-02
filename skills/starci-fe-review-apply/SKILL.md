---
name: starci-fe-review-apply
description: Turns approved review findings into real changes in the front-end app — a missing or unnatural translation, a control the keyboard cannot see, a colour pair that fails contrast, a region that breaks at a width — and is also the lane for a small, single-piece adjustment to a surface that is already built, each change verified in the story before the app and left with its ledger updated and its leftovers recorded. Reach for it when the decision is already made and the change is bounded: "apply the review findings", "sửa layout", "chỉnh lại chỗ này một chút", "áp các finding đã duyệt", "fix the contrast on that chip", "add the missing aria-label", "this label wraps in Vietnamese, shorten it", "nudge the spacing on that card", "make the empty state say something useful". Not for deciding what is wrong — that is starci-fe-review-scan, and a finding that is not in the proposal goes back there rather than being fixed on the way past. Not for building a new component, a new state or a new shell either: that work starts in the design system as a component and a story, and belongs to the build lane that owns the surface.
---

# Front-end review, applied

This half exists because a decision and its execution are different kinds of work, and running them
together is how a review turns into an afternoon of untracked edits. The scan decided. This skill
lands what was decided, proves it, and writes down what it did not do.

It carries a second lane deliberately. A small adjustment to a surface that is already built — move
that, shorten this label, the ring is invisible on the dark surface — arrives constantly and has no
natural home, and every place it gets absorbed does damage: a build skill that also takes
adjustments slowly becomes a general-purpose editor, and an adjustment made with no lane at all is
made with no verification. Both lanes are the same shape of work, so they share one procedure:
**the unit of work is one named piece, with one stated reason, verified where it was built.** The
only thing that differs is where the reason comes from — a proposal, or the sentence the person just
said. Either way it is written down before the edit, not after.

## Before anything: resolve the source

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs fe.storybook_url
```

A missing context exits non-zero and prints the command that fixes it. Honour the exit code — see
`skills/starci-setup-workspace-fe`.

## The two ways in

**From a proposal.** Read the ledger and the batch written by `skills/starci-fe-review-scan`, take
the findings that were approved, and take nothing else. A finding you would rather fix differently
goes back to the scan and comes out as a changed finding; rewriting it here leaves the ledger
describing a change that never happened.

**From a stated adjustment.** Someone names a piece and what is wrong with it. Before editing, write
the same fields a finding carries — the surface, the piece, the reason, the call site, what the
change is, and how it will be checked. If the reason will not survive being written down, that is
the finding: the adjustment is a preference, and it needs a decision rather than an edit.

Both lanes converge on the loop below.

## Where a change is allowed to land

Two rules decide this, and between them they answer most of the "where do I put this" questions
before they are asked.

**Storybook first, without exception.** No component reaches the app that was never a component and
a story in the design system first — `canon/fe/enforce/tiers/architecture.md`. A review fix never gives birth to a
component at a call site. If the honest fix is a piece that does not exist yet, this skill stops and
hands the work to the build lane; the fix that stays here is the one that lands on a piece already
there.

**`className` stops at the vocabulary.** An atom, a frame and a composite take a class from their
caller; a block does not, and a page composes none — also `canon/fe/enforce/tiers/architecture.md`. So an
appearance fix aimed at a block is a fix one tier down, in the composite or the atom, where every
other screen inherits it. A class squeezed onto a block to correct its look is the exact escape
hatch the tier rule exists to close, and it produces an undocumented variant that only that call
site knows about.

Text is the third case and follows the same logic from the other side. Translation is data, so it is
resolved in the connected half and handed down as a finished string — `canon/fe/enforce/tiers/architecture.md`,
with the spelling in `canon/fe/enforce/authoring/i18n.md`. A copy fix therefore lands in the catalogs and,
where the key itself is wrong, in the connected file. It never lands as a literal in a
presentational component, however small the word is.

## The loop, per finding

1. **Re-read the call site before touching it.** The scan may be an hour old or a week old, and the
   file may have moved, been renamed, or already been fixed. A finding applied to a line that no
   longer says what the proposal quoted is a change nobody reviewed.

2. **Confirm the route is still the right one.**
   - 2a. A fix that lands on one existing piece — a catalog string, an accessible label, a focus
     ring on an atom, a colour pair swapped for the paired token, a responsive value named as a prop
     — is applied here.
   - 2b. A fix that needs the shell rebuilt, a region re-ordered, or a component that does not exist
     is routed out to the build lane and left unfixed in the ledger with the route recorded. Forcing
     it in here is how a review turns into a redesign nobody agreed to.

3. **Make the change in the design system first, then let the app see it.** Where a component and a
   story exist, the story is where the change is made and looked at: it is the only place the states
   sit side by side with no server. How a story is written is
   `canon/fe/enforce/authoring/storybook-stories.md`; that it exists at all is gated by
   `patterns/fe/gates/check-story-coverage.mjs`, and that its spec block still matches the
   component's by `patterns/fe/gates/check-doc-parity.mjs`.

4. **Fix the axis on its own terms.**
   - *Copy* — the key exists in both catalogs and they mirror each other, interpolation is ICU in
     the JSON rather than concatenation in the component, and the Vietnamese reads as something a
     person would say rather than as the English sentence with the words replaced. All of this is
     `canon/fe/enforce/authoring/i18n.md`.
   - *Accessibility* — a colour pair comes from the paired tokens in
     `canon/fe/enforce/authoring/styling-tailwind.md` rather than a hand-mixed tint; a focus ring is
     distinct from the hover style; an icon-only control's label names the action and changes when
     the icon's meaning changes with state; a status carries a second channel besides colour.
   - *Width* — a shape that changes names the width it changes at, as a prop, on the four container
     steps and nowhere else: `canon/fe/enforce/spacing/responsive.md` and
     `canon/fe/enforce/spacing/overview.md`. A seam or an inset that has to move moves by its named concept, not
     by a hand-written class, and `patterns/fe/patterns.mjs` holds what each concept must compute
     to.

5. **Prove it, on the axis you touched.** Type-check and lint, then run the contract: the source
   gates in `patterns/fe/gates/` and the rendered-tree runner `patterns/fe/runner/test-runner.ts`,
   whose reach and limits are `canon/fe/enforce/testing.md`. Then look, because the runner does not read:
   a copy fix is read in both locales; an accessibility fix is tabbed to with a keyboard and its
   contrast measured; a width fix is resized through the four steps with real strings in both
   languages, not fixture text. A fix nobody watched work is a fix nobody knows works.

6. **Close the finding where it was written.** Mark it in the ledger the scan produced, so a
   re-scan picks up what is genuinely left instead of re-raising what is done.

## When you finish, say what you did not do

Three outcomes, and all three have to leave the session in writing, because the one that goes
unrecorded is the one somebody re-derives next month:

- **Applied** — which findings, on which surfaces, and what each turned out to be.
- **Routed** — findings that needed a shell, a region order, or a component that does not exist,
  named with the lane they went to and left open in the ledger.
- **Dropped** — findings that were wrong. A false positive is worth more written down than deleted:
  the reason it was wrong is what stops the next scan raising it again, and if the same false
  positive appears a third time the criterion that produced it is the thing that needs changing.

Anything real, out of scope, and deliberately left undone is recorded through
`skills/starci-record-debt` with the files and the reason. A deferral held in someone's memory is
indistinguishable, next month, from code nobody ever looked at.

## What this skill will not do

It will not invent a finding on the way past. "While I was in there" is how a two-line fix becomes
an unreviewable diff, and how a change nobody asked for arrives with no reason attached to it. It
will not restructure a shell, will not author a component or a state, and will not reach for a class
on a block to avoid dropping a tier. It will not silently widen an approved fix: a finding that
turns out to be bigger than the proposal said goes back to `skills/starci-fe-review-scan` and comes
back as a finding that matches the work.

## Files

| Path | Holds |
|---|---|
| `skills/starci-fe-review-scan` | the half that decides, and writes the ledger this one reads |
| `canon/fe/enforce/tiers/architecture.md` | Storybook first, the tiers, and where `className` stops |
| `canon/fe/enforce/authoring/i18n.md` | how a copy fix is spelled, and where it lands |
| `canon/fe/enforce/authoring/styling-tailwind.md` | the paired colour tokens a contrast fix uses |
| `canon/fe/enforce/spacing/overview.md` | the named seams, insets and container widths |
| `canon/fe/enforce/spacing/responsive.md` | naming the width a shape changes at |
| `canon/fe/enforce/authoring/storybook-stories.md` | how the change is demonstrated before it ships |
| `patterns/fe/gates/` | the source gates, run before this is called done |
| `patterns/fe/runner/test-runner.ts` | the rendered-tree runner, including the width sweep |
| `skills/starci-record-debt` | where a deliberate deferral goes |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-review-apply/test.mjs` |
