---
name: starci-fe-skeleton-apply
description: Builds or repairs the LOADING STATE of a page or region in the front-end app so every data-backed region renders a skeleton that mirrors its loaded shape — routed through `AsyncContent`, with the shimmer travelling down a single `isSkeleton` prop — and so nothing collapses or jumps when the data lands. Reach for it whenever the request is about what the screen looks like before the data arrives: "làm skeleton cho trang dashboard", "sửa loading state", "the page jumps when it loads", "this section shows a spinner, give it a real skeleton", "the skeleton flashes over content on every refetch", "add the empty and error states to this list", "skeleton mirror for the course card". Not for restructuring information architecture or changing what a region contains — that is a layout or block task; not for registering which repo the front end is (use starci-setup-workspace-fe); and not for running the DOM-contract audit afterwards (use starci-fe-contract).
---

# Loading skeleton

A skeleton is not decoration for the wait. It is a **promise about geometry**: this is the shape the
data will occupy, held at the right size before anything has arrived. Break the promise and the page
reflows under a reader's eyes and thumb — the classic mis-tap, where the row someone reached for
moves a hundred pixels as the request resolves.

So the whole skill reduces to one invariant: **the skeleton mirrors the loaded shape, so nothing
collapses and nothing jumps.** Everything below is how that gets built, watched, and proved.

This is the loading-state counterpart to a layout or block task, and deliberately narrower. It does
not restructure what a region contains. It makes the region's *pending* rendering match the region
that is already there.

## House manner

This skill follows the house manner recorded in `skills/prompt.md`: draw options as widgets
instead of describing them, render a large layout as a clickable prototype served on `:8080`
before any code is written, and offer three or four real choices rather than one finished answer
to approve. That manner is not restated here — read `skills/prompt.md` for the three rules and the
reasoning behind each.

## Before anything: resolve the source

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs fe.storybook_url
```

A missing context exits non-zero and prints the command that fixes it. Honour the exit code — see
`skills/starci-setup-workspace-fe`. Never write a machine path into a file you produce here.

## The three flags, which are three different questions

More skeleton work goes wrong on the naming of a boolean than on any amount of markup, because all
three flags are booleans and all three are about waiting. They are not interchangeable:

| Flag | Answers | Lives |
|---|---|---|
| `isLoading` | which branch of the async switch renders | the input to `AsyncContent`, computed in the connected file |
| `isSkeleton` | should this presentational subtree render as shimmer | a prop, threaded down unchanged |
| `isPending` | is an action the user started still in flight | on the control that started it |

The connected half owns *when*: it derives the condition under whatever local name reads best and
injects it once, at the top, as `isSkeleton={…}`. Everything below takes the prop and passes it on
under the same name. `scripts/gates/check-skeleton-prop.mjs` fails a presentational component
that re-labels the shimmer flag, because a subtree that receives `isLoading` and forwards it as
`isSkeleton` has quietly created a second vocabulary for one concept.

Why `isLoading` is not enough on its own, and the exact formula that replaces a bare one, is
`canon/fe/enforce/authoring/loading-and-skeleton.md`. The hooks that produce the flag are
`canon/fe/enforce/authoring/async-data.md`. Which half of a split component holds which is
`canon/fe/enforce/tiers/architecture.md` and `canon/fe/enforce/tiers/split.md`.

## Storybook first, always

No component reaches the app that was never a component and a story in the design-system folder
first. A skeleton is a component like any other, and it is the one most likely to be written
straight into a feature file "just for now" — where no story ever renders it, so nobody sees it
again until a user does.

The loading state is demonstrated through the real wrapper, at the presentational twin `_Name`, with
one instance per state rather than four near-copies. The story conventions, including the
comparison-table shape a skeleton reference story takes, are
`canon/fe/enforce/authoring/storybook-stories.md`; the coverage is gated by
`scripts/gates/check-story-coverage.mjs` and `scripts/gates/check-doc-parity.mjs`.

## The loop

1. **Enumerate every data-backed region on the surface.** Read the connected files and list the
   regions that render from a request, including the ones nobody thinks of as regions: a header
   count, a sidebar badge, an avatar cell. A region that has no pending rendering at all is a
   finding, not an omission to be tidied later — it is the region that will jump.

2. **Route each region through the async wrapper.**
   - 2a. A region holding a hand-rolled chain of `if (error) … if (isLoading) …` gets migrated. The
     priority order is not a preference and does not belong copied into a feature; it lives in one
     place, and the reasoning is in `canon/fe/enforce/authoring/loading-and-skeleton.md`.
   - 2b. When the content branch needs heavy derivation from the resolved data, split it out so the
     connected file holds the request and the switch, and the presentational file receives data that
     is already non-null. A branch that has to guard against `undefined` inside the content arm is a
     sign the switch is in the wrong file.

3. **Build the mirror.** Keep the structural nodes — wrapper, surface, separators, the frames and
   their seams — and replace only the content nodes. Three things have to match, and the third is
   the one people skip:
   - *Structure*: the same rows, columns and nesting. A long list gets a representative handful of
     rows, not one block standing in for many.
   - *Rhythm*: the same seams and insets, declared with the **same** named concept as the node it
     stands in for. A skeleton that declares a different concept from its loaded twin is a jump that
     is already written down — `canon/fe/enforce/spacing/overview.md` states this directly, and
     `canon/fe/explore/registry.mjs` holds the values.
   - *Shape*: approximate height, width and radius per node, matched by picking the piece that
     corresponds to the real node rather than sizing a bare box by eye.

   Where the skeleton lives — its own co-located folder or inline at the call site — is decided by
   size, and the split is written in `canon/fe/enforce/authoring/loading-and-skeleton.md`.

4. **Watch it load.** A skeleton nobody has seen fire is not known to fire. Throttle the network in
   the browser's dev tools and hard-reload, or hold the fetcher briefly and **remove the hold
   again** before the change leaves your hands. There is no debug prop to freeze the state with;
   the story is the place a loading state is meant to be inspected at leisure.

   Compare the two renderings against each other, not against your memory of one. The mismatches
   worth hunting are a missing row, a width or radius that drifts, an edge that does not line up
   with the loaded edge, and any movement at the moment of resolve.

5. **Prove it.** Type-check and lint the app, then run the contract: the source gates in
   `scripts/gates/` and the rendered-tree runner in `scripts/runner/test-runner.ts`. That
   run, and how to read a red one, is `skills/starci-fe-contract`.

## What a jump is telling you

The movement is a symptom, and the useful skill is reading which of four causes produced it, because
each has a different fix.

**The box changes size.** The skeleton stood in for a node it does not match — one solid block for a
list, or a piece whose height was guessed instead of taken from the corresponding real node.

**The box stays but the contents shift.** A seam or an inset differs between the two trees. This is
the case the concept tokens exist to catch: the skeleton declared one named decision, the loaded
tree another, both on the scale, and only the concept can tell you they disagree.

**The skeleton flashes over content the reader was already reading.** The branch input was a bare
loading flag, so a background revalidation re-entered the loading branch with data in hand.

**The skeleton never leaves.** The condition never settles — usually a resolved-but-empty result
still counting as pending. Empty is a state of its own with its own branch, and folding it into the
loading condition is what strands the shimmer forever.

## What this skill will not do

It will not change the information architecture of the surface, invent a region that is not there,
or restyle a block to make the mirror easier. If the mirror is hard to build because the loaded tree
has no structure to mirror, that is a layout finding: record it rather than absorbing it, through
`skills/starci-record-debt`, and fix the loading state of what actually exists.

## Files

| Path | Holds |
|---|---|
| `canon/fe/enforce/authoring/loading-and-skeleton.md` | how an async state is spelled, with real examples |
| `canon/fe/enforce/authoring/async-data.md` | where the flags come from |
| `canon/fe/enforce/authoring/storybook-stories.md` | how the loading state is demonstrated in a story |
| `canon/fe/enforce/spacing/overview.md` | the named seams and insets a mirror must repeat |
| `canon/fe/enforce/tiers/architecture.md` | the presentational and connected halves, and what each may know |
| `scripts/gates/check-skeleton-prop.mjs` | the shimmer prop is `isSkeleton`, everywhere |
| `scripts/gates/check-story-coverage.mjs` | nothing ships without a story |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-skeleton-apply/test.mjs` |
