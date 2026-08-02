# Testing — the DOM contract

Every gate in this system reads source, and reading source is how a layout rule gets lied to. A
regular expression cannot tell a string literal from a render. In one session that style of gate
produced roughly ten separate false readings: markup inside a `code:` string counted as real markup,
a function signature swallowed whole, a comment counted as a usage. A rule that cannot tell a quoted
example from the thing it exemplifies is a rule any story can fool by accident.

So the layout rules are checked a second way, and the second way never reads text. After every story
visits, the runner reads the tree the browser actually produced — real CSS, real computed style, real
scroll geometry — and measures it. It cannot be fooled by a string that merely looks like markup,
because it is not looking at strings.

The runner is `scripts/runner/test-runner.ts`. It resolves its vocabulary from the registry
`canon/fe/explore/registry.mjs` rather than holding a table of its own, so a change to the registry makes
the tests go out of date loudly — failing everywhere at once — instead of drifting quietly.

## Storybook-first, so the story is the only test surface

This codebase is storybook-first: `enforce/tiers/story.md` requires every atom, frame, composite,
and block to carry a `BlockAnatomy` story that renders the whole set of a prop's values, one state
per value, each with the `code` that produced it — "full coverage, per prop", not one value shown and
the rest assumed. That rule is the reason a separate component test is redundant before it is even
written: the story already renders the component in every state it can be in, and the runner above
already re-renders every one of those stories after every commit and measures the box the browser
produced — the real gap, the real padding, the `data-principles` tokens — against the registry.

Add a component-level test on top of that — React Testing Library, Vitest, whatever the label — and
it can only do one of two things. Render the same props the story already renders, in which case it
duplicates the story's `states[]` under a second API that nothing keeps in sync with the first, so
the two drift and a reader has no way to tell which one is current. Or render props the story does
not cover, in which case `story.md`'s full-coverage rule is broken, and the fix is to add the missing
state to the story — where the next reader will actually see it — not to patch the gap in a file nobody
reading the storymap will ever open.

So: **the FE has one kind of test, and this is it.** Not an omission and not a coverage gap waiting
to be closed with a unit-test layer — a deliberate refusal to let a second test surface exist that
could tell a different story than the one in the storybook. The runner proves what the story renders
actually measures out the way its `data-principles` tokens claim; the source gates under
`scripts/gates/` (listed below) prove the questions no render can answer at all — an import direction,
whether a story matches its component, the shape of a story file. Between the two, a design-system
component is covered without a third layer duplicating either.

### Where genuinely-connected logic would be tested, if it ever needed it

Not every line in the FE app is a presentational component with a story. `canon/fe/sync.md` draws the
line: the design system holds the presentational half, and the app's own `src/` tree holds a thin
*connected* twin around it — the fetch, the store slice, the translation. No `data-tier` is ever put
on that wiring, so there is nothing there for the runner to render or measure, and no `code` state for
a story to enumerate, because a fetch or a Zustand store is not a rendered tree — it has no box for
`getComputedStyle` to read.

If a store's own logic — the branch inside `set((state) => …)` in
`enforce/authoring/state-management.md` §5, a selector, a reducer-like transform — ever grew complex
enough to need proof separate from the component that calls it, that would be a plain unit test of a
function: no DOM, no story, no runner, the same shape as any backend unit test. It would not be a
"component test" and it would not compete with this contract, because it would not be testing a
rendered box — it would be testing a function that happens to live in `src/hooks/zustand/`. As of this
writing, no store in that tree has reached that point: every one of them is the plumbing
`state-management.md` describes — a narrow selector, a direct patch, a per-key accessor — not a
computation that needs a proof of its own. The boundary is honest rather than absolute: the day a
store grows a real computation, its test lives beside it as a function test, not as a rewrite of the
component's story.

## The three attributes

Three attributes carry the contract, and they do different jobs. Confusing them is the commonest
mistake, so the difference is worth stating before anything else: two of them are **identity**, and
one is a **claim about layout**.

| Attribute | Says | Set by | Read by |
|---|---|---|---|
| `data-tier` | which layer this element belongs to | the component's own file, unconditionally | the nesting audit |
| `data-component` | which component this is | the component's own file, unconditionally | the nesting audit, and the structure tree the inspector walks |
| `data-principles` | which named layout decisions this box embodies | the caller for spacing, the frame itself for structure | the pattern audit |

Identity is emitted, never drilled in from a parent — see `canon/fe/enforce/tiers/architecture.md`. Because it is
always on and always local, the inspector can build its structure tree by walking `data-component`
ancestors in the DOM, and no parent can mistype a child's identity or let it drift.

`data-principles` is a different kind of thing entirely. It has no bearing on how a component
renders; it names **why** a gap or an inset is what it is, so a measurement can be checked against a
meaning. It is a space-separated list read like `class`, because one element usually makes several
layout decisions at once — it pads itself and sets the seam between its groups. The concepts and
their values are `canon/fe/enforce/spacing/overview.md`.

Story scaffolding is marked with a tier of `fixture` and deliberately carries no `data-component`.
That makes it transparent to every check below: never a component that forgot its marker, and never a
boundary a nesting walk should stop at.

## What the runner checks, and what each check cannot prove

Five audits run after every story. Each is aimed at something a source scan structurally cannot see,
and each states in the file what it is unable to prove — read those before treating a green run as
more than it is.

**1. Tier nesting.** Two things, both read straight off the tree. Every `data-tier` carries a
`data-component` and the reverse, because a marker that is sometimes half-written is worse than one
that is absent — it reads as compliance in a diff. And an unknown tier value is reported, since a typo
in the literal type-checks anywhere a const assertion does not reach but shows up the instant the
component renders.

Then containment: from every element whose tier has an allowed set, walk down through untagged
wrappers and fixture scaffolding, stop the instant a real tier is found, and check that tier against
the set. What is deeper belongs to that descendant's own audit, on its own turn.

The `frame` tier is deliberately absent from the allowed-set table, and the reason is the sharpest
limit in the whole file. A frame's slot is *designed* to hold caller-injected content of any tier,
and nothing in a rendered tree distinguishes "the frame's own file imports this" from "a page handed
this to the frame's body". That distinction lives in an import graph, not a render. Checking frames
here would flag ordinary correct composition as a violation, so the runner asserts nothing rather
than asserting it wrongly.

The `atom` tier is the opposite case, and it is the one place where *contains* and *imports* are the
same fact: an atom takes no slot at all, so anything found beneath it was put there by the atom's own
file. That rule is therefore checked unconditionally, everywhere in the tree, not only inside an
atom's own story.

**2. The seam is on the scale.** Computed row and column gap on every frame must land on one of the
eight allowed pixel values, within a pixel to absorb sub-pixel drift from browser zoom. This catches a
hand-written gap wherever it was written, including places no source regex looks: an inline style, a
third-party class, a value computed at runtime. A frame with no gap concept at all is not a finding —
some frames centre and pad a single body and have nothing to space apart — but an off-scale one is,
wherever it came from.

**3. Every declared pattern computes its value.** This is the stronger check, and the reason the
concept layer exists. "On the scale" would pass a controls row at twenty-four pixels as happily as at
eight. Only the concept catches a value that is on the ladder and on the wrong rung, and only the
concept catches the wrong-property case a gap-only check cannot see at all.

For each token on each marked element the runner reads the registry entry, learns which computed
properties that concept governs, and compares. A symmetric concept must match on every side it
governs. An asymmetric one is measured on both axes independently and fails if either is wrong — a box
padded evenly where a control was declared is the exact mismatch a symmetric scalar could never make.
An overflow concept accepts either scrolling value. A position concept reads straight back.

Two cases are recorded rather than asserted, and the honesty matters more than the coverage. An auto
margin does not survive into computed style — the browser reports the used pixel value it resolved
to, never the keyword — so the concept is unrecoverable from the rendered box, and the runner says so
instead of checking a number that means nothing. A responsive switch is owned by the sweep below, not
by a single computed value.

**An unregistered token is a hard failure on its own.** A marker the registry cannot resolve is a
claim nothing can check, and a typo in a token is otherwise invisible: it renders fine and audits
clean.

**4. Ellipsis actually happens.** A truncation class is not evidence a truncation fired. Three
outcomes exist and only one is a bug. If the element itself overflows its own box, the class is doing
its job. If the element does not overflow but its nearest flex or grid ancestor does, the label never
got a bounded box to truncate inside and the row grew instead — the classic missing minimum-width
guard on a flex child, and a real finding: the class is present and inert. If neither overflows, this
story's content is simply short enough not to need truncation, which is not a finding and also not
something the runner may call a pass, because it never observed the class fire. That third case is
recorded as information, never as a failure.

**5. The responsive switch fires at a named width.** The runner sweeps ten widths — both edges of each
of the four container breakpoints, plus a point inside each of the five bands they create — and
collects a shape signature for every frame at each width. Any pair of widths inside one band must
produce identical signatures, because no legal breakpoint sits inside a band; a container query's
change is a step function, so identical at both ends means identical throughout. When a band
disagrees, a short binary search inside that band reports the pixel where the change happened rather
than only the band, and it runs only on a band already known to disagree, so a compliant frame never
pays for it.

That directly catches both things the responsive rule forbids. A content-driven threshold changes at
a point that depends on this story's text, font and translation, so it will essentially never land
exactly on a named edge and the sweep finds it wherever it actually falls. A viewport breakpoint or an
arbitrary width has the same signature: a change at a width that is real and is not one of the four.

What the sweep does **not** prove is that a given frame changes at the *right* one of the four. A
component documented as switching at the page-column width and actually switching one step earlier
passes. Confirming that needs the prop the story passed, matched against the width the DOM changed
at; the runner holds the second half only.

## How a failure reads

Findings are split into two kinds and only one of them fails a story. Hard findings fail. Information
findings — the present-but-unprovable cases, the concepts the DOM does not expose, the frames with
nothing to measure — are printed alongside a failure, or on demand through the verbose environment
switch, and never fail on their own. That split is what keeps the runner honest: a check that cannot
observe something says so, rather than quietly counting it as a pass.

Every finding carries the chain of tiered ancestors from the root down to the offending node, so a
story that renders more than one thing still points at exactly which one.

## Where the source-reading gates still belong

The rendered tree is the stronger evidence, but it cannot see everything, and the source gates in
`scripts/gates/` cover what a render structurally cannot:

- an import direction, and whether a frame imported a shape or was handed one —
  `scripts/gates/check-seams.mjs`, `scripts/gates/check-passthrough-block.mjs`
- whether a component exists in the design system at all, and whether its story matches it —
  `scripts/gates/check-story-coverage.mjs`, `scripts/gates/check-doc-parity.mjs`,
  `scripts/gates/check-story-ids.mjs`
- whether a frame that realises a seam actually named it —
  `scripts/gates/check-pattern-coverage.mjs`
- the shape of a story: one prop per leaf, one instance per state, no namespace —
  `scripts/gates/check-one-instance-per-state.mjs`,
  `scripts/gates/check-member-as-state.mjs`, `scripts/gates/check-no-namespace.mjs`
- declarations that no render exposes — `scripts/gates/check-inline-types.mjs`,
  `scripts/gates/check-skeleton-prop.mjs`, `scripts/gates/check-src-sb-import.mjs`,
  `scripts/gates/check-deps-coverage.mjs`, `scripts/gates/check-orphan-parts.mjs`

The division is worth holding in mind when adding a check. If the question is *what does this file
say*, it is a source gate. If the question is *what did the browser do*, it belongs in the runner,
where a string cannot answer for a box.

## Running it

Resolve the roots rather than remembering them, then run the runner against the design system the
context names:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs fe.storybook_url
```

A missing context exits non-zero and prints the command that fixes it. Honour that exit code:
continuing with an empty string builds a path that fails somewhere far from the cause.
