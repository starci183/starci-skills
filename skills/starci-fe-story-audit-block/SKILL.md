---
name: starci-fe-story-audit-block
description: Decides which library entry one shape of data demands — you arrive holding a single block (a component name, a cropped screenshot, a Storybook story id, or a sentence describing a feature), and it reads the shape out of the back-end code, looks it up in the component matrix, and draws the candidates as widgets instead of listing them in prose. Use it whenever exactly one block is on the table: "audit this card", "what component for this", "is this an accordion or a list", "this block looks wrong", "sai rules", "dựng cái card này", "build the findings block", or a feature sentence like "this is the table-booking part". Use it too when nothing in the set answers the shape, because the outcome then is a proposed entry drawn for a person to rule on rather than a component invented on the spot. Not for arranging several blocks across a page, an overlay, or a route — that is starci-fe-story-audit-composition; not for deciding which tier a component belongs to, which is the tier material under canon/fe/storybook.md.
---

# Auditing a block

Two components in this set wear the same skin on purpose. A screenshot cannot separate a list of
cards from an accordion of cards, and no amount of looking at one ever will — only the records
underneath can, because one of them hides a body and the other does not. That is why this lane asks
a single narrow question, and asks it the same way every time: **which library entry does this shape
of data demand, and does the thing already built match it.**

Reason in one direction: data, then arrangement, then block, then value. Backwards is the failure
this lane exists to stop — picking a component because it looked right on another screen, then
bending the data until it fits.

## The one rule

**UI is a function of data, not of taste.** A list of outcomes is a surface card because a result is
read once and has nothing to open. A list whose items each carry a long body may be an accordion, but
only after one more question, and that question is the whole discipline:

> Does the reader need every body at once, or one at a time?

One at a time means the bodies compete for attention, so they hide and open on demand: an accordion.
All at once means hiding them charges the reader N clicks to reach what they came for: a flat list of
surfaces. **Length alone decides nothing.** A row of five long paragraphs that has to be compared
side by side is not an accordion, however long each paragraph runs.

*Anchored 2026-07-31, first eval run.* This rule once read "a long description has to be hidden", as
if hiding followed from length. It does not, and an agent following it reached the opposite
conclusion by noticing that nothing in the data said "hidden" — correctly. The rule was asserting a
reading behaviour the data never carried.

The reasoning behind the lookup itself lives in `canon/fe/enforce/tiers/architecture.md`, under *Which component a
data shape becomes*. Do not restate it here; open it when a row is close but not obviously right.

## Three inputs, none optional

| Input | Answers | Blocks which failure |
|---|---|---|
| the feature in words | what the person in front of the screen wants | building the right thing nobody needs |
| the front-end code | what shape already exists in this app | re-inventing something already built |
| the back-end code | what the data really is: entity, fields, cardinality, states | inventing fields, inventing states |

Missing one? Go and get it. A guess here poisons every step after it, and the poison is invisible —
the block compiles, renders, and looks fine. If the back-end code is genuinely unreachable, say so
and stop rather than substituting an assumption about the data.

## Where the code is

No path is written down anywhere in this set, because a path is true on exactly one machine and the
failure looks like success. Ask:

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs be.path
```

A missing context exits non-zero and prints the command that fixes it; registering a source is
`skills/starci-setup-workspace-fe/SKILL.md` and its back-end twin.

## Steps

1. **Collect the three inputs.** Name aloud whichever one you could not get.

2. **Read the shape out of the back end, not out of the mockup.**

   2a. The record itself: how many fields, which are free text, which are enums, which are nullable.
   Entities and their relations are governed by `canon/be/modules/database-and-entities.md`; what the
   API actually hands the client is `canon/be/contracts/api-surface.md`, and that is the one that
   matters, because a field that exists in the database and never crosses the wire is not part of
   this block's shape.

   2b. The cardinality and the timing: one record or an array, how many at typical load, which parts
   arrive late. A field that resolves after the first paint is a state, and states are part of the
   shape — see `canon/fe/enforce/authoring/async-data.md` and
   `canon/fe/enforce/authoring/loading-and-skeleton.md`.

3. **Look the shape up.** Describe the data in your own words, never the picture:

   ```bash
   node .claude/scripts/search-component-matrix.mjs shape "an array of rows where each row hides a body"
   ```

   Never open `canon/fe/explore/component/data/matrix.csv` whole, and never enter by a component name you
   already have in mind — reading the table backwards is how the wrong shell survives a review, and a
   wrong shell makes every correct detail inside it worthless. The routing for the other questions the
   table answers, and the fifteen sections it is divided into, are in `canon/fe/explore/component/`;
   what bites inside a section is `canon/fe/explore/component/references/traps.md`; why the table is shaped this
   way is `canon/fe/explore/component/references/general-rules.md`. Write down every candidate the lookup
   returns, not only the first.

4. **Draw the candidates as widgets. Never ask in prose which one to use.**

   | Candidates | What to draw |
   |---|---|
   | two or more valid | all of them, side by side, at one width, and let a person pick |
   | exactly one | that one, with the sentence that the data forces it and there is no option two |
   | none | a gap in the set — see below |

   Each widget carries the real field names from the back-end code and the real record count. A
   widget filled with placeholder text proves nothing about whether the shape fits, and a widget
   showing three rows where production shows three hundred is a lie about the only variable that
   mattered.

   Draw the whole state set while you are there — empty, loading, error, partial, full — not just the
   happy one. Enumerating states after the layout is settled is how a skeleton ends up describing a
   layout that no longer exists.

5. **Give a verdict, then fix exactly what the verdict says.**

6. **Reflect.** Not optional; the last section says what it means.

## One round, worked through

A real case, to show what each step actually produces.

**Input.** The feature in words was "the findings list looks off", with a cropped screenshot. The
front-end code was a findings-list component. The back-end code said each finding carries a `message`
— free text, author-written, several paragraphs long — plus a verdict enum and an icon.

**Shape.** An array. Each item has a short identifier and a long body that nobody needs until they
ask for it. Not a flat list, and not a set of outcomes read once.

**Lookup.** One row came back: an array of expandable rows, a trigger plus a hidden body, answered by
the accordion entry, whose `title` is a plain string. One candidate, so one widget, and the sentence
that there is no second.

**Verdict: grit.** The `message` field was rendered through a markdown component, which emits
block-level markup, and it sat inside the accordion trigger, which is a button. Block markup inside a
button is invalid HTML. It compiled, it rendered, and it looked fine — the exact profile of failure
this lane exists to catch.

**Fix.** The icon moved to the leading slot; `message` became a string through the inline parser.

**Reflect.** Could canon have answered this unasked? Only partly: the tier rule was written, but
nothing stopped a rich node being passed into `title` in the first place. So the outcome went two
places — the code, and a recorded intent to tighten that prop to `string`, filed with
`skills/starci-record-debt/SKILL.md` so the reason survives the session. A prop tightened in the API
deletes a rule instead of restating it, and rules that no longer need writing are the cheapest ones
there are.

The whole round touched one lookup, one prop, and one widget. It opened no reasoning file at all.

## Verdicts

| Verdict | Means | What follows |
|---|---|---|
| pass | comes from the set, values on the scale | done |
| grit | a raw value, a hand-rolled layout, or the wrong step of the right scale | fix here, at the block |
| gap | no entry answers this shape | propose a new entry, drawn as a widget |
| not covered | the material is silent on the question | say so plainly and go and ground it before deciding |

Grit is the common one and it is worth naming precisely, because it is the verdict people soften. A
number typed straight into a class rather than taken from the scale is grit; so is a wrapper added
around a library entry to nudge its spacing. Both mean the same thing: change it in the set, or do
not change it at all. The scale, and why each step is the number it is, is `canon/fe/enforce/spacing/overview.md`;
the values a test compares against live in `patterns/fe/patterns.mjs`.

## A gap is proposed, never enacted

When no entry answers the shape, draw the proposed entry as a widget: its role, its API, its full
state set, its skeleton. A person decides whether it enters the set. Two entries already doing one
job is also a gap — propose the merge, do not merge on your own authority.

A proposed entry is the one case that earns the expensive reading. Open the tier material in
`canon/fe/enforce/tiers/block.md` for what a block may own, and the closed sets under
`canon/fe/enforce/spacing/` for the scales it may use, before drawing it. That cost
is deliberate: a wrong entry is wrong on every screen that ever uses it, whereas a wrong block is
wrong once.

One example is not a rule. A new entry proposed off a single screen is anchored to that screen and
should say so; two independent screens stating the same lack is the bar for building something new.
That bar, and how to write the rule that follows, is `canon/HOW-TO-WRITE.md`.

## Storybook first, without exception

**No component reaches the app that was never a component and a story in the design-system folder
first.** An entry that skipped it has no state matrix anybody can read, which means the state set you
drew in step 4 exists only in the widget. The reasoning is in `canon/fe/enforce/tiers/architecture.md`; how a story
file is spelled is `canon/fe/enforce/authoring/storybook-stories.md`; what a story has to render is
`canon/fe/enforce/tiers/story.md`. It is not left to discipline —
`patterns/fe/gates/check-story-coverage.mjs` requires a story at the mirror path,
`patterns/fe/gates/check-doc-parity.mjs` requires the component's leading spec block and its story's
to be identical, and `patterns/fe/gates/check-one-instance-per-state.mjs` requires each state to be
rendered once rather than bundled into a demo.

## Measure, do not look

Every verdict cites a number or a source line: a computed style, a real prop, a real field. A
screenshot proves what something looks like, never which value produced it, and two components with
the same picture can both be correct at different values because each is anchored to its own source.

Check the viewport before trusting any measurement. With the document hidden or the width at zero,
every rectangle comes back zero and healthy code looks exactly like broken code. The rendered-tree
runner that does this properly, after every story, is `patterns/fe/runner/test-runner.ts`, and the
contract it reads off the DOM is `canon/fe/enforce/testing.md`.

A comment is a claim, not evidence. It sits in the file, it reads with authority, and nothing in the
language ever checks it against the code beside it — least of all a comment saying that something is
intentional or out of scope, since intent and oversight leave identical code behind.

A green gate is not a verdict either. The gates cover a slice of what this lane judges; "the gate
passed" never answers "is this the right shell".

## Reflect, and it is a step rather than a courtesy

Before closing, ask whether someone had to say out loud something the written material should already
have answered.

| Answer | What to do |
|---|---|
| the material was right and simply unread | fix the block, nothing else |
| the material was silent on this case | write the rule now, in this same turn |
| the material taught the opposite of what you measured | fix it, with a dated anchor and the before and after |

A rule no machine can catch belongs in prose, in `canon/fe/` beside the rules it sits with; a rule a
script can decide belongs in `patterns/fe/gates/`, not in prose, because a prose copy of a checkable
fact is a second source of truth that is wrong the day the first one changes. A fix you are
deliberately not making right now belongs in the debt ledger with its reason, not in a comment.
`canon/HOW-TO-WRITE.md` governs all of this, including the rule that a change to a rule changes its
anchor and its date in the same edit.

## Red flags

- "This looks like a card, so use a card." You entered the table backwards. Start from the records.
- "Let me draw four options" when the shape forces one. That is a fake choice, and offering it
  invites a wrong pick from someone who trusted you to have narrowed it.
- "I will sketch it with placeholder text." A widget with lorem in it proves nothing. Use the real
  field names and the real counts.
- "They said it looks cheap, so I will restyle it." Vague feedback means nobody holds a fixed picture
  yet. Draw options; do not guess which one was meant.
- "The set is close enough, I will nudge it here." That is grit by definition. Change it in the set
  or not at all.
- "There is a gap, so I will add the entry." Propose it. Adding an entry unilaterally is a claim
  wearing the clothes of a rule.
- "Fixed the code, canon later." If the material should have answered it, the next round repeats it,
  and the round after that repeats it again.

## Files

| Path | What it is |
|---|---|
| `README.md` | why this lane is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-story-audit-block/test.mjs` |

The lane above this one is `skills/starci-fe-story-audit-composition/SKILL.md`: it decides how many
regions a page has and what sits where, then hands each region here. If you find yourself choosing
between two arrangements rather than two components, you have crossed that line.
