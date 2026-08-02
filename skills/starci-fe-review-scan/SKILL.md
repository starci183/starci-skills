---
name: starci-fe-review-scan
description: Reviews a front-end surface on three axes in one pass — the copy and its translations, accessibility, and behaviour across widths — grades every finding against the canon rule it breaks, ranks them by what a reader actually loses, and writes a proposal; it changes no code. Reach for it whenever a surface that already exists needs judging rather than building: "review this page", "soi lại trang dashboard", "check i18n and a11y before we ship", "kiểm tra trang có vỡ ở mobile không", "the Vietnamese on this screen reads like a machine wrote it", "is anything here unreachable by keyboard", "audit copy, contrast and breakpoints", "quét lỗi dịch và tương phản trước khi ship" — and before editing an unfamiliar surface, so the drift you are about to inherit is on the table before you add to it. Not for building a surface, a component or a state, and not for changing code at all: an approved finding is handed to starci-fe-review-apply, which is also where a small adjustment to an already-built surface belongs. Not for grading source against the code-style canon either, because this skill judges what a reader meets on the screen rather than how the file is spelled.
---

# Front-end review

Three things leak out of a surface long after it is built, and they leak because each one is small
enough on its own to be left for later: a string nobody translated, a control the keyboard cannot
reach, a region that folds at a width nobody opened. None of them fails a type check. None of them
fails a lint. Every one of them is met by a reader before it is met by us.

They travel together here for one reason. The unit of work is a surface, not an axis:
**one surface is read once and graded on all three axes in that pass.** Reading the same page three times —
once for copy, once for keyboard, once for width — costs three readings and produces three separate
queues that never reconcile, and the third reading is the one that gets skipped.

Nothing here changes code. The output is a ranked proposal; the change is the apply half's job.

## Before anything: resolve the source

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs fe.artifacts
```

A missing context exits non-zero and prints the command that fixes it. Honour the exit code — see
`skills/starci-setup-workspace-fe`. Never write a machine path into a proposal you produce here: the
proposal outlives the machine that wrote it.

`fe.artifacts` answers `null` on a project that has no artifacts folder. That is an honest answer,
not a failure; ask where the proposal should live rather than inventing a folder in the source tree.

## What the machine already catches, and why that decides the territory

A review that re-checks what a gate already fails wastes the only expensive thing in the room, which
is judgement. Before grading anything, run what runs by itself: the source gates in
`scripts/gates/` and the rendered-tree runner `scripts/runner/test-runner.ts`. Between them
they already own a large share of two of these axes — the gap that is off the scale, the concept
token nothing can resolve, the responsive switch that fires at a width nobody named, the story that
does not exist. What each check can and cannot prove is written out in `canon/fe/enforce/testing.md`, and it
is worth reading the *cannot* column, because that column is this skill's territory.

What is left over is the whole point: **the failure that type-checks, lints clean, passes every gate
and renders fine.** A translation that is grammatically correct and reads like a machine wrote it. A
label on an icon button that names the icon instead of the action. A column that survives the
breakpoint sweep and still collapses under a real Vietnamese sentence, because Vietnamese runs longer
than the English it was measured against. No machine reports any of those, and no machine will.

## The three axes

### Copy and translation

How translation is spelled — `next-intl`, the hook, the key shape, the ban on a hard-coded
user-facing string, ICU rather than concatenation, and the rule that both catalogs mirror each other
— is `canon/fe/enforce/authoring/i18n.md`. Where the resolution happens is a tier question and lives in
`canon/fe/enforce/tiers/architecture.md`: text is data, so the connected half resolves it and the presentational
half is handed the finished string. A presentational file that calls a translation hook has reached
past its props, and it can no longer be rendered in a story.

Read the catalogs, not the screen. The findings that only a reader of the real strings can make:

- A key present in one catalog and absent from the other. The fallback is what a user sees, and in
  the good case it is the other language; in the bad case it is the raw dotted key.
- Vietnamese translated word for word from English. It parses, it is wrong, and the tell is that
  reading it aloud is uncomfortable. An English word left standing where an ordinary Vietnamese word
  exists is the same finding wearing different clothes.
- Labels in one group drifting apart in length and grammatical shape, so a row of peers stops
  reading as a row of peers.
- Emoji, and shouting capitals, in any string a user reads.
- A locale ternary choosing between two UI strings in the component. `canon/fe/enforce/authoring/i18n.md`
  records this as an anti-pattern that still exists in older route files and must not spread.

### Accessibility

There is no accessibility page in `canon/` yet, and pretending otherwise would be worse than saying
so. Two parts of this axis are already grounded, and the rest is graded against the criteria below.

Contrast is grounded, in `canon/fe/enforce/authoring/styling-tailwind.md`: a background and its foreground
travel together as a pair, and the vendor's own paired variant is preferred over a hand-mixed tint
because its contrast is already tuned. That file carries the anchor that makes the rule real — a
hand-mixed translucent hue over a matching text colour, which failed contrast, in the source, with
the component's own comment recording it. Any place a colour pair was assembled by hand is where
this axis pays for itself, and the ratio is measured rather than eyeballed.

The rest, stated as criteria so a finding can quote one:

- Everything a pointer can operate, a keyboard can reach and can be *seen* to have reached. A focus
  ring that is only the hover style is not a focus ring: a person tabbing through cannot tell where
  they are.
- An icon-only control carries a label naming **the action, not the icon**. When the icon changes
  meaning with state — a lock replacing a puzzle piece once a thing is locked — the label changes
  with it, or it now describes a control that is no longer there.
- Colour is never the only channel. A status that is red and nothing else has told a colour-blind
  reader nothing, and told a screen reader less.
- A decorative image is announced as nothing; an informative one is announced as what it means.

When the same accessibility ruling has to be re-derived on a third surface, it has stopped being a
judgement and become a rule, and it belongs in `canon/` — written the way `canon/HOW-TO-WRITE.md`
requires, with the files it was read from and the day it was measured.

### Width

The four container steps, why they are container queries rather than viewport queries, and what a
responsive value may look like are `canon/fe/enforce/spacing/responsive.md` and the
widths section of `canon/fe/enforce/spacing/overview.md`. The runner already sweeps ten widths and proves that a
frame changes shape only at a named one — `canon/fe/enforce/testing.md` — and it also states plainly what it
cannot prove: that the frame changes at the *right* one of the four.

So the human half of this axis is content, not geometry:

- The longest real string, in both locales, in every label — not the fixture string, and not the
  English one. A tab bar that fits in English and wraps to two lines in Vietnamese is the commonest
  finding on this axis.
- Overflow with real data: the long course title, the twelve-item chip row, the number that grew a
  digit.
- Collapse order. When the container narrows, the things that disappear or move should be the
  things that matter least. A sidebar outliving the primary action is a priority written by
  accident.
- A viewport media query inside a tiered component. The shell that establishes the container is the
  only place allowed to ask about the screen, and a component that asks behaves as if a narrow
  drawer were a wide desktop.

## The pass

1. **Enumerate the surfaces, including the ones that are states.** A page is not one surface. Empty,
   a single item, many items, overflowing, error, and pending are each a surface with its own copy,
   its own focus order and its own behaviour at width — and the empty and error states are where
   untranslated strings collect, because they were written last and seen least. A surface omitted
   from the list is a surface nobody reviewed.

2. **Read each surface once, and grade all three axes in that reading.**
   - 2a. Open the story for the component in the design system as well as the running app. The story
     is where states can be put side by side without a server; the app is where the real catalog,
     the real data and the real widths are. Neither on its own is the review.
   - 2b. Grade from the source and the catalog, never from a screenshot. A screenshot cannot tell
     you which of two strings is hard-coded, whether a ring is a focus ring or a hover ring, or that
     the other locale is missing.
   - 2c. Measure the things that are measurable. Contrast is computed, not judged; widths are
     resized to, not imagined.

3. **Write the whole ledger, ranked.** Every finding goes into one file under the front end's own
   artifacts folder — `.artifacts/reviews/<scope>.md` when `fe.artifacts` resolves — one line each,
   carrying its axis, its severity and its state. The ledger is the memory of the review: re-running
   the scan updates it, keeps the state of anything already handled, and adds what is new. It is
   deliberately longer than what gets presented.

4. **Present three to five findings, highest severity first.** Not the ledger. A list of forty
   findings is not a decision anybody can make, and the honest outcome of handing one over is that
   nothing gets fixed. Mixing axes inside one batch is right when they share a surface: one visit,
   one set of fixes, one verification.

5. **Stop.** No edit, however small and however obvious, belongs in this half — the moment a scan
   starts fixing things, its ledger stops describing the tree it just changed. Offer the apply lane:
   `skills/starci-fe-review-apply`.

## How a finding is written

Six fields, and the reason for each is the same: a finding that cannot be acted on without asking
the author what they meant is not finished.

| Field | Holds |
|---|---|
| surface | which page, region and state |
| axis | copy, accessibility, or width |
| rule | the canon file and section it breaks, or the stated criterion above |
| anchor | the call site, as file and line, in the tree the context resolved |
| fix | one line, what the change is — not a paragraph of options |
| verification | what will be looked at to know it worked |

A finding with no anchor is an impression. A finding with no rule is a preference, and
`canon/HOW-TO-WRITE.md` is the argument for why a preference does not get to be a finding.

Rank by what the reader loses, not by how much work the fix is: a reader who cannot proceed at all
outranks a reader who is confused, who outranks something only we would ever notice. A fix being
one character long does not raise it.

## What this skill will not do

It will not change code, and it will not open the fix "since it was right there". It will not invent
a component or a state to make a surface easier to grade — a surface missing a state is a finding,
routed to the build lane that owns it. It will not re-report what a gate already fails, and it will
not grade a component that has no story: a component that reached the app without ever being a
component and a story in the design system is a `canon/fe/enforce/tiers/architecture.md` violation, and reporting
it as a copy finding buries the real problem.

Anything real but out of scope for this review is recorded rather than carried in someone's head —
`skills/starci-record-debt`, with the files and the reason.

## Files

| Path | Holds |
|---|---|
| `canon/fe/enforce/authoring/i18n.md` | how translation is spelled, and what a missing key does |
| `canon/fe/enforce/tiers/architecture.md` | which half resolves text, and the Storybook-first law |
| `canon/fe/enforce/authoring/styling-tailwind.md` | the paired colour tokens contrast depends on |
| `canon/fe/enforce/spacing/overview.md` | the four container widths, and what a responsive value may be |
| `canon/fe/enforce/spacing/responsive.md` | why the breakpoints are container queries |
| `canon/fe/enforce/testing.md` | what the runner proves, and what it states it cannot |
| `scripts/gates/` | the source gates to run before grading anything by hand |
| `scripts/runner/test-runner.ts` | the rendered-tree runner, including the width sweep |
| `skills/starci-fe-review-apply` | the half that builds the approved findings |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-review-scan/test.mjs` |
