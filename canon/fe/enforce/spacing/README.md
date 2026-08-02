# principles — the closed sets every tier picks from

`elements/` says **who** may decide a thing and **why**. This folder says **what** may be said.

A file here holds one closed set: its steps or members, a sentence per member saying *when*, and the
type that makes it enforceable. Nothing here is advice — if a value is not in one of these files, it
does not compile.

| file | type | answers |
|---|---|---|
| [`gap.md`](gap.md) | `AllowedGap` | how far apart are two things on a track |
| [`padding.md`](padding.md) | `AllowedPadding` | how much air a surface gives what it holds |
| [`margin.md`](margin.md) | *(none, deliberately)* | where every real use of margin goes instead |
| [`position.md`](position.md) | `AllowedClassName` | what a caller may say about where a child sits |
| [`responsive.md`](responsive.md) | `Responsive<T>` | how any of the above may vary with width |

## The two layers

A scale is one axis of measurement — `gap-2` is 8px. It cannot say **why** a seam is 8px, and two
correct 8px seams mean different things. So a second layer rides on top: **`data-principles`**, a named
concept (`flex-action`, `card-padding`, `group-boundary`) that a container declares on itself. The
scale gives the number; the pattern gives the meaning, and a rendered-tree test checks that the
concept computes the step its name promises. Each scale file lists its own concepts.

## Two rules for this folder

**One place.** A value is written out **here** and nowhere else. `elements/` links to it; the code's
lookup table implements it. Moving a union here leaves the rules file holding the *reasoning*, which is
what a rules file is for.

**A step earns its place by being chosen.** Not by existing in Tailwind, and not because the scale
looks tidy with eight rungs. A step is on the ladder because a real, recurring relationship needs it —
where industry systems converge on a number, that convergence is reference, never a substitute for the
relationship the step names.

## What is not here

Colour, type scale, radius, shadow, motion. Those are appearance — they belong to the atom that owns
them, and a caller never picks from them, it picks a `tone`, a `size`, a `variant`. The sets in this
folder are the opposite case: **arrangement**, where the caller genuinely knows something the component
cannot, and therefore must be given a finite vocabulary to say it in.

---

Architecture: [`../concept.md`](../concept.md) · Rules: [`../elements/`](../elements/) ·
Worked examples: [`../examples/`](../examples/)
