# StarCi Core — playbook

Which idioms a business shape asks for, and what a supplied reference is allowed to contribute to
that answer. The idioms themselves are in [Idioms](idioms.md); what the package publishes is in
[DNA](DNA.md). A shape not listed here is not a house idiom. It may still be composed for the
approved product direction when existing Common semantics, family anatomy and product facts can
express it; only promotion into the family's reusable idiom set belongs to the family owner.

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

5. **Then resolve the remaining product composition.** Reuse an established idiom where it fits;
   otherwise compose existing Common semantics and family anatomy, extend an existing owner when
   evidence shows its declared gap, and add a new owner only for an evidenced gap. A shape absent
   from this table and a shape seen once are evidence limits on house style, not reasons to stop
   creative work already inside the approved product scope.

`DIRECTION_CHOICE_REQUIRED` is reserved for a material product choice whose acceptable options lead
to different outcomes and whose answer is absent from the request. A reference/idiom conflict is
resolved by the authority split above: product facts and approved region order come from the
request, Common semantics come from `knowledge/ui`, and family anatomy and reusable style come from
this Grammar. A tied score never causes this stop; `interface.generate` applies its deterministic
fallback and continues.

Owner clarification 2026-09-05 on images: imagery can highlight the key idea, explain content,
strengthen recognition or create a relevant, evocative focal point. Deliberate visual emphasis is a
concrete role; an image need not be a functional diagram to earn its place. Name the subject, the
idea or claim it highlights, and the intended order of attention in the direction's `## Images`
table. Judge its scale, contrast and crop on the rendered surface: it should support that hierarchy
without obscuring the content or competing with the primary action. Blank space alone is never a
reason to add an image; filling space or balancing density without a content or emphasis role does
not qualify. Record no image when imagery would not improve the composition.
