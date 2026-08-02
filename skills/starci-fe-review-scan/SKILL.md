---
name: starci-fe-review-scan
description: Reviews a front-end surface on four axes in one pass — copy and its translations, accessibility, behaviour across widths, and conversion (a single honest primary action, copy naming an outcome rather than a mechanism, no dead ends, entity references that are genuinely clickable, and persuasion resting only on numbers the back end can actually produce) — grades every finding against the canon rule or stated criterion it breaks, ranks them by what a reader actually loses, and writes a proposal; it changes no code. Reach for it whenever a surface that already exists needs judging rather than building: "review this page", "soi lại trang dashboard", "check i18n and a11y before we ship", "kiểm tra trang có vỡ ở mobile không", "the Vietnamese on this screen reads like a machine wrote it", "is anything here unreachable by keyboard", "audit copy, contrast and breakpoints", "quét lỗi dịch và tương phản trước khi ship", "does this page go anywhere", "check the funnel", "why is the empty state a dead end", "two buttons here look the same", "soi CTA/link trang này", "check phễu", "link có make sense không" — and before editing an unfamiliar surface, so the drift you are about to inherit is on the table before you add to it. Not for building a surface, a component or a state, and not for changing code at all: an approved finding is handed to starci-fe-review-apply, which is also where a small adjustment to an already-built surface belongs. Not for spacing, tier or component-choice review — those belong to the storybook and component skills — and not for grading source against the code-style canon either, because this skill judges what a reader meets on the screen rather than how the file is spelled.
---

# Front-end review

Four things leak out of a surface long after it is built, and they leak because each one is small
enough on its own to be left for later: a string nobody translated, a control the keyboard cannot
reach, a region that folds at a width nobody opened, a screen that hands the reader nothing to do
next. None of them fails a type check. None of them fails a lint. Every one of them is met by a
reader before it is met by us.

They travel together here for one reason. The unit of work is a surface, not an axis:
**one surface is read once and graded on all four axes in that pass.** Reading the same page four
times — once for copy, once for keyboard, once for width, once for the funnel it sits in — costs
four readings and produces four separate queues that never reconcile, and the last one is the one
that gets skipped. The axes interact besides: a button reading "Consume one build credit" is a copy
defect and the exact moment a reader loses motivation and leaves, which is a conversion finding
wearing copy's clothes.

Nothing here changes code. The output is a ranked proposal; the change is the apply half's job.

## House manner

This skill follows the house manner recorded in `skills/prompt.md`: draw options as widgets
instead of describing them, render a large layout as a clickable prototype served on `:8080`
before any code is written, and offer three or four real choices rather than one finished answer
to approve. That manner is not restated here — read `skills/prompt.md` for the three rules and the
reasoning behind each.

This skill also honours `canon/fe/business-parity.md`: the back end owns each business rule, so it reads the value from the API and obeys the rule exactly, never inventing one beside it — where the server is silent or ambiguous it surfaces the gap rather than guessing.

## Before anything: resolve the source

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs fe.artifacts
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

A missing context exits non-zero and prints the command that fixes it. Honour the exit code — see
`skills/starci-setup-workspace-fe`. Never write a machine path into a proposal you produce here: the
proposal outlives the machine that wrote it.

`fe.artifacts` answers `null` on a project that has no artifacts folder. That is an honest answer,
not a failure; ask where the proposal should live rather than inventing a folder in the source tree.

`be.path` matters more on the conversion axis than on the other three: a claim that a number
persuades honestly, or that a link between two surfaces is missing, is a claim about the schema, and
only the back end settles it.

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
than the English it was measured against. A demoted button and a wired-up reference link both
type-check and render fine — and so, just as cleanly, does a mechanism-copy CTA and an empty state
with no way out. No machine reports any of those, and no machine will.

## The four axes

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

The baseline is `canon/fe/explore/principles/accessibility.md`: every affordance works without
seeing colour, works from the keyboard, and is not silent to a screen reader. Contrast has a second
anchor in `canon/fe/enforce/authoring/styling-tailwind.md` — a background and its foreground travel
together as a pair, and the vendor's own paired variant is preferred over a hand-mixed tint because
its contrast is already tuned. Any place a colour pair was assembled by hand is where this axis pays
for itself, and the ratio is measured, not eyeballed.

Findings a reader still has to make: a focus ring that is only the hover style, so a person tabbing
through cannot tell where they are; an icon-only control whose label names the icon rather than the
action, or that kept its old label after the icon's meaning changed with state — a lock replacing a
puzzle piece once a thing is locked, still announced as the puzzle piece; a status told in colour and
nothing else, which has told a colour-blind reader nothing and a screen reader less; a decorative
image announced as content, or an informative one announced as nothing.

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

### Conversion and links

The structural rule is `canon/fe/explore/principles/call-to-action.md`: each surface has exactly one
primary action, fired at the moment the reader has both motivation and ease, with copy naming the
**outcome**, not the mechanism. A second button carrying the same weight is not a second choice
offered — it is Hick's Law splitting the one decision in two — and the demoted action drops to the
rank the prominence ladder already defines in `canon/fe/explore/principles/accent-system.md`. Read
that ladder from the source before proposing a rank; this axis does not invent a hierarchy of its
own. Secondary actions — retry, view details, dismiss — read as subordinate or they compete, which is
the same defect as two primaries wearing different clothes.

The path rule is `canon/fe/explore/principles/content-linking.md`: no screen is a dead end. Every
state has at least one way onward, empty included — an empty state that reports an absence and offers
nothing else is a dead end wearing a friendly tone. A mention of another entity inside a sentence is a
real link through the app's own reference component, or, when the target cannot resolve, honest bold
plain text rather than a link that looks pressable and goes nowhere. A deep link carries the intent
the surface already computed — the specific weakest module a scorecard just measured, not the course's
general page. Resume stays inside the scope of the surface it is on, and only renders once the reader
has actually left that surface —
`canon/fe/explore/principles/resume-cta-only-when-away.md`. Backward navigation has exactly one
affordance; two competing ways back is the same disease as two primaries.

The honesty rule is `canon/fe/explore/principles/persuasion-psychology.md` and
`canon/fe/explore/principles/grounded-in-data.md`: every number used to persuade — a seat count, a
learner count, a quota bar — resolves to a real value the back end can produce. A fallback that
invents a plausible figure when a query fails is a fabricated claim shipped under a real component's
name, and a countdown, a scarcity note or a social-proof figure with no column behind it is prohibited
outright, including when the invented version measures better. So are confirmshaming copy and a nag
that cannot be dismissed.

None of this licenses inventing a funnel. "These two features should link to each other" is easy to
write and expensive to build, and it is wrong whenever no relationship exists in the data. Before
writing a finding that asserts a missing link, check the real relationship — the entities and their
relations under `be.path`, and the nesting of the content itself. A surface with no real connection to
another stands alone, and the honest finding is that it stands alone; record that and move on rather
than forcing a connection through it.

## The pass

1. **Enumerate the surfaces, including the ones that are states.** A page is not one surface. Empty,
   a single item, many items, overflowing, error, and pending are each a surface with its own copy,
   its own focus order, its own behaviour at width and its own path onward — and the empty and error
   states are where untranslated strings and dead ends both collect, because they were written last
   and reviewed least. A surface omitted from the list is a surface nobody reviewed.

2. **Read each surface once, and grade all four axes in that reading.**
   - 2a. Open the story for the component in the design system as well as the running app. The story
     is where states can be put side by side without a server; the app is where the real catalog,
     the real data and the real widths are. Neither on its own is the review.
   - 2b. Grade from the source and the catalog, never from a screenshot. A screenshot cannot tell
     you which of two strings is hard-coded, whether a ring is a focus ring or a hover ring, that the
     other locale is missing, or whether a mention of an entity actually resolves to a link.
   - 2c. Measure the things that are measurable. Contrast is computed, not judged; widths are
     resized to, not imagined.
   - 2d. Check the data relationship before writing any conversion finding that asserts a missing
     link or a broken funnel — see Conversion and links, above.

3. **Write the whole ledger, ranked.** Every finding goes into one file under the front end's own
   artifacts folder — `.artifacts/reviews/<scope>.md` when `fe.artifacts` resolves — one line each,
   carrying its axis, its severity and its state. The ledger is the memory of the review: re-running
   the scan updates it, keeps the state of anything already handled, and adds what is new. It is
   deliberately longer than what gets presented.

4. **Present three to five findings, highest severity first.** Not the ledger. A list of forty
   findings is not a decision anybody can make, and the honest outcome of handing one over is that
   nothing gets fixed. Mixing axes inside one batch is right when they share a surface — a
   mechanism-copy button and the dead-end empty state beside it are one visit, one set of fixes, one
   verification.

5. **Stop.** No edit, however small and however obvious, belongs in this half — the moment a scan
   starts fixing things, its ledger stops describing the tree it just changed. Offer the apply lane:
   `skills/starci-fe-review-apply`.

## Show the map, not only the list

A ranked list says which finding is worst. It does not say which *surface* is in trouble, and across
four axes that question gets harder to answer from prose alone. Render the audit as a grid: one row
per surface, one column per axis, each cell carrying its verdict in a readable form, ranked worst
first, with this batch's findings distinguished from what is still queued and from what came back
sound. A person looking at that grid sees the broken page in a second; the same information as forty
sentences takes a minute and gets skimmed.

## How a finding is written

Six fields, and the reason for each is the same: a finding that cannot be acted on without asking
the author what they meant is not finished.

| Field | Holds |
|---|---|
| surface | which page, region and state |
| axis | copy, accessibility, width, or conversion |
| rule | the canon file and section it breaks, or the stated criterion above |
| anchor | the call site, as file and line, in the tree the context resolved |
| fix | one line, what the change is — not a paragraph of options |
| verification | what will be looked at to know it worked |

A finding with no anchor is an impression. A finding with no rule is a preference, and
`canon/HOW-TO-WRITE.md` is the argument for why a preference does not get to be a finding.

Rank by what the reader loses, not by how much work the fix is: a reader who cannot proceed at all
outranks a reader who is confused, who outranks something only we would ever notice. A fix being
one character long does not raise it, and a fix routed to a heavier lane does not lower it either.

## What this skill will not do

It will not change code, and it will not open the fix "since it was right there". It will not invent
a component or a state to make a surface easier to grade — a surface missing a state is a finding,
routed to the build lane that owns it. It will not invent a funnel or a relationship the data does
not have: a surface with no real connection to another stands alone, and recording that is the
finding. It will not re-report what a gate already fails, and it will not grade a component that has
no story: a component that reached the app without ever being a component and a story in the design
system is a `canon/fe/enforce/tiers/architecture.md` violation, and reporting it as a copy or
conversion finding buries the real problem.

Anything real but out of scope for this review is recorded rather than carried in someone's head —
`skills/starci-record-debt`, with the files and the reason.

## Files

| Path | Holds |
|---|---|
| `canon/fe/enforce/authoring/i18n.md` | how translation is spelled, and what a missing key does |
| `canon/fe/enforce/tiers/architecture.md` | which half resolves text, and the Storybook-first law |
| `canon/fe/enforce/authoring/styling-tailwind.md` | the paired colour tokens contrast depends on |
| `canon/fe/explore/principles/accessibility.md` | the accessibility baseline: colour, keyboard, screen reader |
| `canon/fe/enforce/spacing/overview.md` | the four container widths, and what a responsive value may be |
| `canon/fe/enforce/spacing/responsive.md` | why the breakpoints are container queries |
| `canon/fe/explore/principles/call-to-action.md` | one primary per surface, fired at the right moment, copy naming an outcome |
| `canon/fe/explore/principles/content-linking.md` | no dead ends, real entity links, deep-link intent, one way back |
| `canon/fe/explore/principles/persuasion-psychology.md` | which persuasion techniques are honest, and what is forbidden outright |
| `canon/fe/explore/principles/grounded-in-data.md` | never invent a number or a label for the interface |
| `canon/fe/explore/principles/resume-cta-only-when-away.md` | a resume control renders only once the reader has left the task |
| `canon/fe/explore/principles/accent-system.md` | the prominence ladder a demoted action drops to |
| `canon/fe/enforce/testing.md` | what the runner proves, and what it states it cannot |
| `scripts/gates/` | the source gates to run before grading anything by hand |
| `scripts/runner/test-runner.ts` | the rendered-tree runner, including the width sweep |
| `skills/starci-fe-review-apply` | the half that builds the approved findings |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-review-scan/test.mjs` |
