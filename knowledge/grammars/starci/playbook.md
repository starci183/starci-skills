# StarCi Core — playbook

Which idioms a business shape asks for, and what a supplied reference is allowed to contribute to
that answer. The idioms themselves are in [Idioms](idioms.md); what the package publishes is in
[DNA](DNA.md). A shape not listed here is not forbidden — it is undecided, and an undecided shape is
a question for the owner, not a guess.

## Shapes

| Business shape | What a supplied reference may contribute | Idiom sequence |
| --- | --- | --- |
| Purchase decision page — one offer, one price, one commitment (subscriptions) | Keep: the order of regions (what is read before the price), which single decision dominates, and what folds away instead of competing with it. Never crosses over: page layout, brand, palette, type scale, component anatomy, or any control the reference draws that this Grammar does not publish. | Explanatory column in `primary` of `PrimaryRailLayout`, decision card in `rail`: **Joined bands in one flush card** for the explanation → **A neutral band opens the card with its summary** for its intro line → **Generated art is a band, not a card** for the journey asset → **Title and one supporting line** for each included outcome → **One highlighted card** on the decision itself → **The card's one action closes the bottom band** for the purchase → **Pending is the same tree, resting** across the offer read. Secondary explanation folds away; whether it folds into a disclosure is a `DIRECTION_CHOICE_REQUIRED` (seen once). |
| Learner dashboard — many peer sections, one intended next step | Keep: which sections exist and their reading order, and which single section is the reader's next action. Never crosses over: grid geometry, card chrome, densities, or a section that would need a renderer this family does not publish. | Per section: **Joined bands in one flush card** → **A neutral band opens the card with its summary** where the section states a measure → **Title and one supporting line** inside every row → **The card's one action closes the bottom band** where a section leads somewhere → **Pending is the same tree, resting** for every read, with `EmptyNotice` for empty and failed. Across the page: **One highlighted card** exactly once, on the resume or next-step section. |
| Sign-in — one surface, several journeys, one submit per step | Keep: the order of the ways in (shortcut before form, or the reverse), which journeys share one surface, and where the way to the other journey sits. Never crosses over: provider branding, illustration, field chrome, or a social-login row this product does not have a provider for. | **Title and one supporting line** as the surface header (`Heading` + muted subtitle) → **Single-column form stack** per step, one `Button variant="primary" type="submit"` each → **Pending is the same tree, resting** through `isPending` and `isDisabled` rather than a replaced tree → the way onward as `TextAction`, last. Whether the provider shortcut precedes the form is seen once; carry the reference's order and say so. |

## How a direction reads this

1. **Business shape first.** Name the shape and the one outcome the surface exists to produce. The
   shape selects the idiom sequence; nothing else does.
2. **Then the reference, if the request supplied one.** A reference contributes region order, which
   decision dominates, and what folds away. It never contributes layout, brand, palette, or
   component anatomy — those are already owned, by this family and by
   [knowledge/ui](../../ui/INDEX.md). A reference that can only be honoured by breaking an idiom is
   evidence about the reference, not about StarCi.
3. **Then the idioms**, composed in the order the shape's row gives, each one taken whole: an idiom
   is a relationship, and half of it is a different shape.
4. **Then [DNA](DNA.md)**, to confirm every renderer and prop the composition names exists, and to
   read the gaps in [Family and DNA](family.md) before promising a capability. A composition that
   needs a recorded gap is not a direction yet.

Anything still open after those four steps is not resolved by preference: it stops with
`DIRECTION_CHOICE_REQUIRED` and goes to the owner. That includes any shape absent from the table
above, any composition that appears only in the idioms file's seen-once table, and any point where
the reference and an idiom disagree.

Owner ruling 2026-09-03 on images: a direction that leaves a region reading empty adds an image made to one claim of the promise, on its own judgement, and records why; it never waits to be asked and never decorates a region the copy and the Grammar objects already carry. `frontend.direction.decide` applies this in its `## Images` table.
