---
name: starci-fe-story-audit-composition
description: Decides what arrangement a volume of data forces — you arrive holding a whole page, overlay, route or layout rather than one component, and it counts the records from the data layer, derives how many regions there are and which of them shrink, draws the workable arrangements as widgets, and then hands each settled region to the block lane. Use it whenever the question is how things sit together: "how should this page be arranged", "this screen feels crowded", "should this be a drawer or a modal", "where does this block go", "build the booking page", "dựng trang X", "sửa layout", "màn hình này chật quá", a full-screen screenshot rather than a cropped one, or any brief describing a whole feature instead of a single component. Not for judging one block on its own or picking which component fills a region — that is starci-fe-story-audit-block; not for deciding which tier a component belongs to, which is the tier material under canon/fe/storybook.md.
---

# Auditing a composition

A page that looks calm in a mockup with four rows is the same page that breaks at four hundred. The
mockup cannot tell you which one you are building, and neither can a screenshot of the current
screen — only the query behind it can. So this lane asks one question and refuses to answer it from a
picture: **how much data is there, and what arrangement does that force.**

Same direction as the block lane, one level up: data, then arrangement, then block, then value. Never
backwards. Choosing a layout because it looked balanced and then feeding the data into it is the
failure this lane exists to stop.

## The one rule

**Volume decides the arrangement.** A lot of data splits into two workspaces because one column
cannot carry it. A little data centres into one workspace because spreading it thin only dilutes it.
Two screens with the same volume share an arrangement, and that is the only reason two screens should
ever match; two screens that merely belong to the same product are not evidence of anything.

The arrangement is not a taste call and not a template borrowed from a screen you liked. What a shell
around a route may own, and what it may never own, is `canon/fe/enforce/tiers/layout.md`;
the reusable shapes below it are `canon/fe/enforce/tiers/composite.md`; a route's own
tier is `canon/fe/enforce/tiers/page.md`; and an overlay is a tier of its own with its
own constraints, `canon/fe/enforce/tiers/overlay.md`.

## Three inputs, none optional

| Input | Answers | Blocks which failure |
|---|---|---|
| the feature in words | what the person is here to do | a technically correct screen with the wrong centre |
| the front-end code | which arrangements this app already has | inventing a layout that already has a name |
| the back-end code | how much data, how it is grouped, what arrives late | choosing a shape for data you imagined |

Missing one? Go and get it. Never guess the volume: count it from the query, not from the mockup.

## Where the code is

No path is written down in this set, because a path is true on exactly one machine. Ask:

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs be.path
```

Registering a source is `skills/starci-setup-workspace-fe/SKILL.md` and its back-end twin. A missing
context exits non-zero and prints the command that fixes it.

## Steps

1. **Collect the three inputs.** Name aloud whichever one you could not get.

2. **Measure the volume, not the impression.**

   2a. Count from the data layer: how many records at typical load, how many at worst case, what the
   page size is, whether the list is bounded at all. `canon/be/contracts/api-surface.md` governs what
   the API exposes and how a collection is paged; `canon/be/modules/database-and-entities.md` governs
   the relations that decide whether a region holds one record or many.

   2b. Count the regions: how many the feature really has, which are optional, which are empty for a
   new account, and which arrive after the first paint. An async region is a region — see
   `canon/fe/enforce/authoring/async-data.md` and `canon/fe/enforce/authoring/loading-and-skeleton.md` — and a region
   that is empty for most users changes the arrangement more than a region that is merely long.

3. **Derive the arrangement from that count, then go looking for it.** The tier the arrangement lands
   in decides what it is allowed to own, and that is a lookup rather than an opinion:

   ```bash
   node .claude/scripts/search-tier-rules.mjs tier layout
   ```

   The routing for the rest of the tier questions is `canon/fe/storybook.md`. Two rules ride
   along: the seam between regions comes from the scale in `canon/fe/enforce/spacing/overview.md`, never from a
   number typed into a class, and a width that changes with the container is named at the width where
   it changes, `canon/fe/enforce/spacing/responsive.md`. A gap picked by eye is grit
   even when it happens to land on a step.

4. **Draw the arrangements as widgets. Never ask in prose which layout to use.**

   | Candidates | What to draw |
   |---|---|
   | two or more workable | all of them, at the same viewport width, and let a person pick |
   | exactly one | that one, with the sentence that this volume forces it and there is no option two |
   | none | a gap in the set — propose it, drawn, and do not build it |

   Draw with the real region names and the real record counts. An arrangement widget showing three
   items where production shows three hundred is a lie about the only variable that mattered, and it
   is a comfortable lie, because the wrong arrangement looks fine at three.

   Draw each arrangement at more than one width. The narrow form is where arrangements actually fail,
   and it is the form nobody looks at until a person on a phone does.

5. **Hand each settled region to the block lane.** This lane never picks a component. It decides where
   things sit and how many regions there are; `skills/starci-fe-story-audit-block/SKILL.md` decides
   what fills each one.

6. **Reflect.** Not optional; the last section says what it means.

## One round, worked through

**Input.** Two screens needed the same thing: a reading column beside a column of actions that had to
stay stuck to it. The back-end code said the reading column carries one long document and the action
column carries three to five items, never more.

**Volume.** One region unbounded, one region small and fixed. Two regions, not three.

**Arrangement.** Nothing in the set answered it, so both screens reached for a horizontal stack with
a wrap, and both authors wrote the same sentence in a comment: the best available substitute, no
dedicated frame yet.

**Verdict: gap** — and the evidence was exactly what the material asks for, two independent cases
stating the same lack. One case would have been an anchor to that case, not a proposal.

**What the fix taught.** The wrap had no threshold. The main column shrank without limit, so the row
never wrapped: the two columns sat glued together at every width, phones included, on both screens,
with no visible defect until somebody measured. The fix was a real arrangement with a required
breakpoint, and the lesson became a written rule rather than a fixed screen.

**Reflect.** There was no responsive material at all while this was shipping. That absence is why
`canon/fe/enforce/spacing/responsive.md` exists now — written after its traps had
already bitten twice.

## Verdicts

| Verdict | Means | What follows |
|---|---|---|
| pass | the arrangement matches the volume, and every region comes from the set | hand off to the block lane |
| grit | hand-rolled page scaffolding, or a frame doing a job something in the set already owns | fix here |
| gap | nothing in the set answers this volume | propose it, drawn as a widget |
| not covered | the material is silent on the question | say so plainly and go and ground it before deciding |

A gap is proposed, never enacted. Draw the proposal: which regions it has, which one may shrink,
which is pinned, what happens when a region is empty, and what it does at the narrow width. A person
decides whether it enters the set. One example is not a rule — the bar for building something new,
and how to write the rule that follows, is `canon/HOW-TO-WRITE.md`.

## The boundary with the block lane

| This lane owns | The block lane owns |
|---|---|
| how many regions there are, and their relation | which component fills a region |
| which region shrinks and which stays fixed | the values inside that component |
| page or overlay, modal or drawer | the block's own states and its skeleton |

If you find yourself choosing between two components, stop: you crossed the line. Hand the region
over. The modal-or-drawer question stays here because it is an arrangement question — how much room
the content needs and whether the route underneath survives — and how the resulting code is spelled
once decided is `canon/fe/enforce/authoring/overlay-and-feedback.md`.

## Storybook first, without exception

**No component reaches the app that was never a component and a story in the design-system folder
first**, and an arrangement is a component. A layout with no story has no state matrix anybody can
read, which means the empty region and the narrow width you drew in step 4 exist only in the widget.
The reasoning is `canon/fe/enforce/tiers/architecture.md`, what a story has to render is
`canon/fe/enforce/tiers/story.md`, and the line is held by
`patterns/fe/gates/check-story-coverage.mjs` rather than by discipline.

## Measure, do not look

Volume comes from the data layer, never from a screenshot. Cite the query, the page size, or a real
record count.

Spacing comes from a measurement, not from a look. The rendered-tree runner
`patterns/fe/runner/test-runner.ts` measures the computed box against the registry in
`patterns/fe/patterns.mjs`, and the contract it reads off the DOM is `canon/fe/enforce/testing.md`; the
source-reading half is `patterns/fe/gates/check-seams.mjs` and
`patterns/fe/gates/check-pattern-coverage.mjs`. Check the viewport before trusting any measurement:
with the document hidden or the width at zero, every rectangle comes back zero and healthy code looks
exactly like broken code.

A green gate is not a verdict. The gates cover a slice of what this lane judges, and none of them can
tell you that the arrangement is wrong for the volume.

## Reflect, and it is a step rather than a courtesy

Before closing, ask whether someone had to say out loud something the written material should already
have answered.

| Answer | What to do |
|---|---|
| the material was right and simply unread | fix the arrangement, nothing else |
| the material was silent on this case | write the rule now, in this same turn |
| the material taught the opposite of what you measured | fix it, with a dated anchor and the before and after |

A rule no machine can catch belongs in prose under `canon/fe/`; a rule a script can decide belongs in
`patterns/fe/gates/`, because a prose copy of a checkable fact is a second source of truth that goes
wrong the day the first one changes. A fix you are deliberately postponing belongs in the ledger with
its reason, `skills/starci-record-debt/SKILL.md`, rather than in a comment nobody will check.

## Red flags

- "This layout looks balanced." Balance is not a reason. What is the record count?
- "The other screen uses a rail, so use a rail." The other screen has other data. Same volume is the
  only argument for the same arrangement.
- "I will show three rows in the widget." Then the widget is a lie about the variable that decides
  the whole question. Draw the real load.
- "Two workspaces feels more professional." Two workspaces is what a volume forces, not a rank.
- "While I am here I will pick the components too." That is the block lane. Hand off.
- "It is fine on my monitor." Every arrangement is fine on a wide monitor. The narrow width is where
  arrangements fail, and it fails silently.
- "Fixed the page, canon later." If the material should have answered it, the next page repeats it.

## Files

| Path | What it is |
|---|---|
| `README.md` | why this lane is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-story-audit-composition/test.mjs` |
