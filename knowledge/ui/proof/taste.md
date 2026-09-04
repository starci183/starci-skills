# Taste proof

This file answers one question: the surface passed every canon rule, so is it any good to look at?
A render can satisfy each owner, each token and each contract and still be rejected, because canon
decides who owns a value while taste decides what the composition adds up to. The rules below turn
that judgement into criteria measured from a capture, so a rejection names a number rather than a
mood, and so an approval cannot be bought by conformance alone.

Nothing here is settled by reading source. Every `Observe` cell names something countable in the
screenshot the audit already took: a ranked list of element areas, a rectangle of empty band, a set
of left edges, a count of accents, a count of type sizes. Where a criterion overlaps a decision that
was already made before the tree existed, this file cites that composition rule instead of restating
it, because taste tests the outcome and composition tested the intent.

Sources: the owner ruling that a surface which is correct by grammar and ugly by eye is still thrown
away, and the worked example of a console overview that passed every canon rule and still scored
about three out of five, recorded in
[the taste rubric evidence](../../../tests/evidence/20260903-taste-rubric.md); and the ruling that a
choice whose answer the rubric already gives is never a stop, with the density criterion measured
against seeded data and the person's own choice, recorded in
[the dominant-candidate evidence](../../../tests/evidence/20260903-dominant-candidate.md).

## TASTE-1 — One focal point in three seconds

Governs whether a first glance lands somewhere, and on one place only.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The capture is viewed for three seconds | Exactly one element is the largest and heaviest thing in the frame. Two candidates within roughly ten percent of each other in visual weight falsifies it |
| Case 2 | The page has a title and section titles | The page title is at least one scale step above every section title in rendered size, weight, or both. Equal rendered sizes falsifies it |
| Case 3 | The strongest element by weight is measured | It is the element the direction named as the surface's job. A decorative panel or an artwork winning the frame falsifies it |
| Case 4 | A region carries several candidates for its own anchor | One anchor per region wins by a visible step, at every captured viewport |

Not this rule: which content was entitled to the strongest rank in the first place is
[HIERARCHY-2](../composition/hierarchy.md).

## TASTE-2 — No meaningless void

Governs empty area that pays no rent.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A band, cell or panel is measured in the capture | No such area taller than `64px` carries neither content nor a function such as separation, grouping or a deliberate rest between regions |
| Case 2 | A tinted or bordered band is drawn | The tint marks a real boundary. A tinted band whose only occupant is an image or an icon falsifies it |
| Case 3 | A grid row is partly filled | The remaining cells either hold content or the row collapses. A half-row of blank cells at the captured width falsifies it |
| Case 4 | The surface is captured at its narrowest viewport | The void does not grow: a band that was tight when wide and cavernous when narrow falsifies the composition |

Not this rule: which regions exist at all is [LAYOUT-1](../composition/layout.md).

## TASTE-3 — Grid and edges

Governs whether the eye can find a straight line.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Text blocks are stacked inside one region | Their left edges resolve to the same x within `1px`. A stack of two or three different left edges falsifies it |
| Case 2 | Sibling cards or columns sit in one row | Every gutter between them measures the same. One gutter differing from its neighbours falsifies it |
| Case 3 | A region's outer edge is measured against the region above it | Both align to the same container edge, or the difference is a declared inset rather than a drift of a few pixels |
| Case 4 | An element is centred while its neighbours are aligned left | The centring carries meaning. A single centred item inside a left-aligned stack falsifies it |

## TASTE-4 — Monotonic vertical rhythm

Governs whether vertical distance still means anything.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Gaps between regions, sections and rows are measured | The order holds: region gap is greater than section gap, which is greater than row gap. Any inversion falsifies it |
| Case 2 | Two siblings of the same kind are compared | Their separation from the previous sibling is identical. Two different gaps between equal peers falsifies it |
| Case 3 | The number of distinct vertical gaps in the capture is counted | The surface uses a small closed set of steps rather than a continuum of near-equal values |
| Case 4 | The surface is captured at a second viewport | The same order survives; only the values change |

Not this rule: which exact spacing value an app-owned boundary takes is resolved in presentation.

## TASTE-5 — Colour economy

Governs how much colour is spent, and on what.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Accent-filled controls are counted in the capture | Exactly one accent-filled call to action per view, except on a `landing`, which may carry two. A filled accent beyond that allowance, competing with the one that was budgeted, falsifies it |
| Case 2 | A semantic colour appears | It reports a real outcome backed by authority. Success green on a neutral fact, or a status hue used as decoration, falsifies it |
| Case 3 | The view carries a warning or an error | It is visibly distinct from a neutral row in the capture: a different surface, border or icon, not the same grey row with different words |
| Case 4 | Distinct hues in the frame are counted, excluding photography | The count stays within the family's published palette roles. A page reading as a swatch board falsifies it |

Not this rule: which action deserves the dominant accent is [CTA-1](../composition/cta.md), how the
scarce emphasis budget is spent is [ACCENT-1](../composition/accent.md), and whether the chosen
colours survive measurement is [COLOR-3](contrast.md).

## TASTE-6 — Type

Governs how many voices the text speaks in.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Rendered font sizes inside one region are counted | At most three distinct sizes, and at most two weights. A region with five sizes falsifies it |
| Case 2 | A paragraph of running text is measured | Its measure falls between roughly 45 and 80 characters at the captured width. A line running the full width of a wide viewport falsifies it |
| Case 3 | A heading or a label wraps | No last line carries a single orphan word, and no heading breaks mid-phrase in the capture |
| Case 4 | Two pieces of text carry the same rank | They render at the same size and weight. Two same-rank labels rendered differently falsifies it |

## TASTE-7 — Shape consistency

Governs whether the surface was cut by one hand.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Corner radii in the capture are collected | They resolve to one family of steps. A view mixing a sharp card, a soft card and a pill container with no reason falsifies it |
| Case 2 | Card nesting depth is counted | No card sits more than two levels deep. A bordered box inside a card inside a card falsifies it |
| Case 3 | Borders and shadows are compared across peers | Equal peers carry equal elevation treatment. One shadowed card among flat siblings falsifies it |
| Case 4 | A control sits inside a container | The control's radius is equal to or smaller than the container's, so the shapes nest rather than collide |

## TASTE-8 — Imagery earns its place

Governs pictures, illustration and decorative artwork.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | An image renders | It carries meaning or brand identity. An illustration whose removal changes nothing but the amount of empty space falsifies it |
| Case 2 | Decorative images are counted in the view | At most one. Two or more ornaments in a single view falsifies it |
| Case 3 | An image sits in an otherwise empty band | It is not the band's justification: the same area with the image removed must still read as a deliberate region, or the band fails TASTE-2 as well |
| Case 4 | The image is measured against the focal element | It is not the heaviest thing in the frame unless the surface's job is the image itself |

## TASTE-9 — Density fits the surface class

Governs how much of the surface is doing work.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The density of a capture is taken | It is the summed bounding rectangles of content and action nodes divided by the captured area. The class the coverage declared sets the band: `console` at least sixty percent, `catalog` at least fifty, `reader` between forty and seventy, `form` between twenty-five and fifty, `landing` at most forty |
| Case 2 | The class's band is a ceiling rather than a floor, as it is for `landing` and for the upper half of `form` and `reader` | The breathing room that keeps density under it is continuous rather than scattered pockets. Empty area broken into unrelated gaps falsifies it |
| Case 3 | The estimate is taken | The rectangles counted are named in the receipt, so a second reader can repeat the estimate and land within about ten percent |
| Case 4 | A dense class is captured at a narrow viewport | Density is achieved by ordering and grouping, not by shrinking targets below their minimum |
| Case 5 | The density depends on how many records the data supplies | It is measured at the flow's representative seeded volume: the count of records the flow's seed places for the entity the surface lists. A served workspace below that volume is not judged: the Measured cell reads `below-volume` with the volume served and the volume the seed places, and the row routes to `seed` — the operator that owns the data brings the workspace to volume and the entry is captured again — never to `direction` and never to a person |
| Case 6 | The density still fails at representative volume | The Measured cell reads `data-bound` with the volume it was measured at; the row keeps its score and its fail, and `TASTE-13` Case 6 leaves it out of the verdict, so it blocks neither quality nor UAT |

Not this rule: whether a target is still operable at that density is
[A11Y-4](accessibility.md).

## TASTE-10 — Designed states

Governs the renders that are not the happy path.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The loading state is captured | It has a composition: skeletons occupy the same regions, at the same ranks, as the resolved content. A blank frame or a lone spinner in a void falsifies it |
| Case 2 | The empty state is captured | It carries a title, one line of explanation and the action that ends the emptiness. A bare sentence centred in the region falsifies it |
| Case 3 | The error state is captured | It states what failed and what to do next, inside the region that failed rather than replacing the page |
| Case 4 | The states are compared with the loaded state | No region moves or resizes when content arrives, so the layout does not jump between them |

## TASTE-11 — Touch and feedback

Governs whether the surface answers when touched.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Interactive targets are measured | Every one meets the minimum [A11Y-4](accessibility.md) names, including its padded hit area. A row of icon-only controls under that size falsifies it |
| Case 2 | Hover and focus captures are compared with the resting capture | Each state is visibly different from resting and from each other. A hover indistinguishable from rest falsifies it |
| Case 3 | The hover or focus capture is diffed against the resting one | No element changes position or size. A border appearing on hover that shifts the row falsifies it |
| Case 4 | A control performs work | The capture during that work shows a pending treatment on the control itself, not only elsewhere on the page |

Not this rule: whether the focus indicator is perceivable and where focus travels is
[FOCUS-1](focus.md).

## TASTE-12 — Reference match

Governs whether the surface belongs to the class it claims.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The direction decision is read | It names the reference standards this surface is aiming at, by class rather than by adjective. A direction naming none falsifies the audit before any capture is scored |
| Case 2 | The capture is placed beside those references | A reader who knows neither product would sort the surface into the same class. Sorting it into a plainer class falsifies it |
| Case 3 | The gap is described | The receipt names which of the criteria above accounts for the distance, so the difference is a finding rather than an impression |
| Case 4 | The references disagree with a canon rule | Canon wins and the reference is dropped, because taste may reject a conforming surface but may never license a non-conforming one |

## TASTE-13 — Scoring and the taste verdict

Governs how the criteria above become one decision.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The taste lens runs | Every criterion from `TASTE-1` to `TASTE-12` carries a pass or fail and a score from 1 to 5, each backed by the measurement its own rule names |
| Case 2 | The verdict is computed | `ship` requires no fail on `TASTE-1`, `TASTE-2`, `TASTE-5`, `TASTE-8` or `TASTE-12`, and a mean score of at least 4 across the twelve. Anything else is `fix-first` |
| Case 3 | Every canon rule passed and the taste verdict is `fix-first` | The surface is still `fix-first`. A receipt shipping a surface because canon was green falsifies the lens |
| Case 4 | A taste criterion fails | It routes to `direction`, never to `resolve`, because a value swap cannot repair a composition |
| Case 5 | A score is recorded with no measurement | The entry is void, and the lens is incomplete until the measurement is captured |
| Case 6 | A row is `below-volume` or `data-bound` (`TASTE-9` Case 5 and 6) | A `below-volume` row makes the verdict `blocked`, routed to `seed`, until the entry is captured at volume; a `data-bound` row is left out of the mean and out of the gating set, so the verdict is computed over the criteria the data could answer |
| Case 7 | The person chose the surface's candidate from a printed sheet whose scores showed this criterion failing for that candidate at choice time | The Measured cell reads `person-accepted` and names the branch of the decision the person approved, beside the measurement; the row keeps its score and its fail and is left out of the mean and the gating set, because the rubric never overturns a decision the person took on its own evidence in the same session. A `person-accepted` row that names no branch, names a decision the operator took by itself, or covers a criterion the chosen candidate was not shown failing, is void |
| Case 8 | Audit scope selects primary surfaces or explicitly requests an exhaustive state matrix | Read the frozen audit scope carried by `interface.audit`. Missing selected entries still block. Declared secondary states outside a primary scope are `deferred`, never passed: the state-comparison criterion permitted by the audit scope schema carries `verdict: deferred`, null score and the deferred state names, and is excluded from the mean. An exhaustive audit missing a declared state remains blocked. Scope-limited completion proves only the selected surfaces; different scopes are not compared to consume a round budget |
| Case 9 | The lens is scored | The same auditor scored the three anchor sheets of [the calibration set](calibration/calibration.json) in the same round, and each anchor landed inside its `taste` band within the tolerance that file publishes; the receipt carries the three anchor scores beside the surface's. An anchor that drifts further, or a lens scored with no anchors, is void, because a score taken on a scale nobody proved cannot be compared with another sheet's or with an earlier round's |

The scored set is `TASTE-1` to `TASTE-12`; this rule is the arithmetic and is not itself scored. The
five criteria that gate `ship` are the ones a reader notices before reading a word: the focal point,
the void, the colour spend, the imagery, and the class the surface lands in. A score of 3 means the
criterion is met without conviction, so a surface can pass every criterion and still be `fix-first`
on the mean alone, which is the intended outcome for a merely inoffensive page. Taste findings never
carry a canon base verdict and never become a `grammar-gap`: a criterion that cannot be satisfied
with the published family is a direction problem until composition proves otherwise.

## What this file does not decide

Which rank, action, region or emphasis the direction chose is
[Hierarchy](../composition/hierarchy.md), [CTA](../composition/cta.md),
[Layout](../composition/layout.md) and [Accent](../composition/accent.md). Which CSS value an
app-owned boundary takes is presentation. Whether the render is perceivable and operable is
[Accessibility](accessibility.md) and [Focus](focus.md), whether distinctions survive measurement is
[Contrast](contrast.md), whether movement keeps meaning is [Motion](motion.md), and whether the
rendered claim traces to authority is [Render truth](render-truth.md).
