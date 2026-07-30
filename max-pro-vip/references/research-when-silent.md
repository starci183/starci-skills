---
name: research-when-silent
description: Run this when an axis comes back NOT COVERED — the axis applies, but walking the whole decision tree, no branch claims it. Produces a PROPOSAL, does not write to canon directly.
---

# Research when canon is silent

Canon being silent means you're genuinely **stuck**. Two wrong paths and one right one:

| Path | What it is |
|---|---|
| wrong | pick some value yourself and move on — next time it becomes a false precedent |
| wrong | write `N/A` to get it out of sight — the gap disappears from the log, and the next session gets stuck at the same spot |
| right | research the industry, bring back a **sourced proposal** for the teacher to decide |

## Step 1 — can this silence even be researched

The most important step. Get this wrong and you research all afternoon for something useless.

| Type | Sign | Handling |
|---|---|---|
| **nobody's hit this yet** | a question with an **objective** answer: what size, is contrast sufficient, how many px of touch target | researchable — the industry has already answered it |
| **product decision** | *"what matters most on this screen"*, *"should this number show or not"*, *"what should this copy say"* | **not researchable.** Ask the teacher directly |

The test: **would two people who carefully read the same industry docs reach the same answer?** Yes → researchable. No → it's a decision.

## Step 2 — research in authority order

Find it at a higher tier, don't go down to a lower one.

| # | Source | Why it's ranked here |
|---|---|---|
| 1 | standard specs — W3C, WCAG, WAI-ARIA | highest authority, mostly **measurable**, not opinion |
| 2 | major design systems that **publish their reasoning** — Material, HIG, Carbon, Polaris, Primer, Radix | don't take their numbers, take their **reasoning** |
| 3 | docs for the library actually in use — HeroUI, Tailwind, react-aria | matches directly with the running code |
| 4 | personal blogs | reference only, never a standalone basis |

**Threshold: two independent sources** reaching the same conclusion before proposing it as a general rule. A single source can still be presented, but must state clearly *"one source, not enough to be a rule."* The internet doesn't get to lower the bar.

## Step 3 — translate into our house scale

The easiest place to break this. **Don't copy their number.**

If the industry says "44px minimum touch target," the proposal must state **which step of our own scale** achieves that, not append a stray `44px` value outside the scale. If the industry has six steps and ours has four, **map it**, don't import it wholesale.

If, after translating, our scale turns out to be **missing a real step**, that's the proposal itself — say so, don't quietly carve out an exception to dodge it.

## Proposal format

```markdown
### NOT COVERED — <axis> · <region>
- question canon doesn't answer:
- type: researchable | product decision (if it's a decision, STOP, ask the teacher)
- source 1: <name + link> — what it says
- source 2: <name + link> — what it says
- do the two sources agree:
- translated to our house scale: <which step, or scale is missing a step>
- PROPOSAL: <one rule statement, general enough to apply to a later case of the same nature but different shape>
- where to anchor it: <which axis, which section>
```

Present it **within the same round**, don't save it for the end of the session — the teacher is looking at that exact screen right now.

## Forbidden

- **The internet never outranks a real anchor measured on the spot.** If a component has real `src`, measure `src`, even when the whole industry does it differently. The internet is only for where canon is **silent**, never to argue against what canon has already said.
- **Never say "the industry does it this way" without citing the source name.** That sentence can't be verified, so it's opinion wearing evidence's clothes.
- **Never write directly into `principles/`.** This step produces a proposal; the teacher approves it, only then does it get written.
- **Never research for a cell that's already off.** Canon has already answered it — reaching for outside sources to argue against canon reverses the authority order.

## Stop when

If the silence type is a product decision, stop immediately and ask the teacher. If two sources disagree, present both along with each side's reasoning — don't pick a side yourself and hide the other one. If no source exists at all, say plainly that the industry has no standard either — that's real information, not a failure.
