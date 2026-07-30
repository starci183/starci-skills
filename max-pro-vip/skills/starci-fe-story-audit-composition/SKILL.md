---
name: starci-fe-story-audit-composition
description: Use this skill whenever the question is how blocks sit together on a page, an overlay, or a layout. Triggers on "how should this page be arranged", "this screen feels crowded", "should this be a drawer or a modal", "where does this block go", "build the booking page", a full-screen screenshot rather than a cropped one, or any brief describing a whole feature instead of one component. It decides the arrangement from how much data there is, and renders the arrangements as widgets instead of asking in prose. Not for judging a single block on its own — that is starci-fe-story-audit-block.
---

# Auditing a composition

One question: **how much data is there, and what arrangement does that force.**

> Read first: [`house-rules.md`](../../references/house-rules.md)

## The one rule

**Volume decides the arrangement.** A lot of data splits into two workspaces because one column
cannot carry it. A little data centres into one workspace because spreading it thin only dilutes it.
The arrangement is not a taste call and not a template you liked on another screen.

Same direction as the block lane, one level up: `data -> arrangement -> block -> value`. Never
backwards. Picking a layout because it looks balanced, then forcing the data to fit it, is the
failure this lane exists to stop.

## Three inputs, none optional

| Input | Answers | Blocks which failure |
|---|---|---|
| `text` — the feature in words | what the user is here to do | a technically correct screen with the wrong centre |
| `fe code` | which arrangements already exist in this app | inventing a layout that already has a name |
| `be code` | how much data, how it is grouped, what arrives late | choosing a shape for data you imagined |

Missing one? Go get it. Never guess the volume — count it from the query, not from the mockup.

## Steps

1. **Collect the three inputs.** Name what you could not get.

2. **Measure the volume**, not the impression: how many records at typical load, how many at worst
   case, how many regions the feature really has, which of them are optional, which are async.

3. **Derive the arrangement** from that volume, then look it up in `library/composites/`.

4. **Render the arrangements as widgets.** Never ask in prose which layout to use — draw them.

   | Candidates | Draw |
   |---|---|
   | two or more workable | all of them, at the same viewport width, teacher picks |
   | exactly one | that one, plus *"this volume forces it, there is no option two"* |
   | none | a **library gap** in `composites/` — propose it as a widget |

   Draw with the real region names and the real record counts. An arrangement widget that shows
   three items where production shows three hundred is a lie about the only variable that matters.

5. **Then hand each region to `starci-fe-story-audit-block`.** This lane never picks a component. It
   decides where things sit and how many regions there are; the block lane decides what fills them.

6. **Reflect.** Mandatory, see the last section.

## One round, worked through

A real case from this system.

**Input.** Two screens needed the same thing: a reading column beside a column of actions that had
to stay stuck to it. `be code` said the reading column carries one long document; the action column
carries three to five items, never more.

**Volume.** One region unbounded, one region small and fixed. Two regions, not three.

**Arrangement.** No composite answered it, so both screens reached for `StackH gap="section" wrap`
and both authors wrote the **same sentence** in a comment: *the best-available substitute, no
dedicated frame yet.*

**Verdict — `library gap`,** and the evidence was exactly what canon asks for: **two independent
cases stating the same lack**. That is the bar for building something new. One case would have been
a note, not a proposal.

**What the fix taught.** `wrap` had no threshold. The main column shrank without limit, so the row
**never wrapped** — the two columns sat glued together at every width, mobile included, on both
screens, with no visible defect until someone measured. The fix was a real composite with a
required breakpoint, and the lesson became a `judgement.md` rule plus an API-packaged one.

**Reflect.** Canon had no `responsive` axis at all while this was shipping. That gap is why the axis
exists now — created 2026-07-30, after its traps had already bitten.

## Verdicts

| Verdict | Means | Next |
|---|---|---|
| `pass` | the arrangement matches the volume, regions come from `composites/` | hand off to the block lane |
| `grit` | hand-rolled page scaffolding, or a frame doing a job a composite already owns | fix here |
| `library gap` | no composite answers this volume | propose it — **as a widget** |
| `NOT COVERED` | an axis tree accepts nothing | [`research-when-silent.md`](../../references/research-when-silent.md) |

A library gap is **proposed, never enacted**. Draw the proposed composite: which regions, which one
can shrink, which is pinned, what happens when a region is empty. The teacher decides.

## The boundary with the block lane

| This lane owns | The block lane owns |
|---|---|
| how many regions, and their relation | what component fills a region |
| which region shrinks, which stays fixed | the values inside that component |
| page vs overlay, modal vs drawer | the block's own states and skeleton |

If you find yourself choosing between two components, stop — you crossed the line. Hand the region
over.

## Measure, don't look

Volume comes from the data layer, never from a screenshot. A page that looks calm in a mockup with
four rows is the same page that breaks at four hundred. Cite the query, the pagination size, or the
real record count.

## Reflect — the last step, not optional

Before closing, ask: **did the teacher have to say something canon should already have answered?**

| Answer | Do |
|---|---|
| no, canon was right and unread | fix the arrangement only |
| canon was silent on this case | write the rule now, in this same turn |
| canon taught the opposite of what was measured | fix canon, with a dated anchor and before/after |

One example is not a rule — a general rule needs two independent sources, otherwise anchor it to
this exact case and say so. See [`writing-canon.md`](../../references/writing-canon.md).

## Red flags

- "This layout looks balanced" → balance is not a reason. What is the record count?
- "The other screen uses a rail, use a rail" → the other screen has other data. Two screens with the
  same volume share an arrangement; that is the only reason they should match.
- "I'll show three rows in the widget" → then the widget is a lie. Draw the real load.
- "While I'm here I'll pick the components too" → that is the block lane. Hand off.
- "Two workspaces feels more professional" → two workspaces is what a volume forces, not a rank.
- "Fixed the page, canon later" → if canon should have answered it, the next round repeats it.
