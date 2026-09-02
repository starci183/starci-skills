# Accent composition

This file answers one question: the page has a small budget of strongest emphasis, so where is it
spent, and what does spending it there promise?

Accent is scarce by design. Every extra dominant treatment reduces what the previous one meant, so
the decision is about allocation, not about paint. Nothing in this file may change what the product
is claiming; accent only makes an existing claim easier to find.

## ACCENT-1 — One dominant decision accent

Governs how many strongest treatments a decision region may hold.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A decision region offers one clear next action | Exactly one dominant accent inside that decision owner, on `Button variant="primary"`, whether it carries `onPress` or `href` |
| Case 2 | Sibling actions share the region | They take weaker published variants that state their real consequence |
| Case 3 | Two peer choices genuinely carry equal consequence | Neither becomes dominant; equal consequence is not a tie to be broken by paint |
| Case 4 | Separate regions each have their own next step | Each may hold its own dominant accent, counted within its own decision owner |
| Case 5 | The count would change in a compact layout or a loading state | It does not. The same count holds in every state and at every width |

## ACCENT-2 — Compact identity accent

Governs the small visual anchor that helps a reader scan peers.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Peer features, rows, or sections need a compact anchor for scanning | `IconTile tone="accent"`, or `Icon` in its declared role, with a reviewed semantic glyph chosen by the direction |
| Case 2 | The anchor sits beside a name | The visible text identity stays. The mark supports recognition and never replaces the name |
| Case 3 | The direction wants a different plate size or shape | It uses the published geometry, at `sm` 32 or `md` 40 nominal CSS pixels, rather than rebuilding a coloured rounded square around an icon |
| Case 4 | The glyph would be the only identity for an unfamiliar feature | Not allowed. An unfamiliar thing gets a name before it gets a mark |

## ACCENT-3 — Selection, destination, and focus stay distinct

Governs three treatments that tend to collapse into one another.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A region can hold a persistent selection, a destination, a command emphasis, and keyboard focus at once | Each keeps its own published owner and its own treatment |
| Case 2 | Selection is being expressed | It has a non-colour cue, and it survives focus moving elsewhere |
| Case 3 | A destination sits inside body copy | It is identifiable as a destination at rest, before it is hovered or focused |
| Case 4 | Colour is removed, or the viewer is in forced colours | Every one of the three remains distinguishable, because none of them relied on fill alone |
| Case 5 | A brief hover is mistaken for selection | It is not selection. A transient cue never carries a persistent value |

## ACCENT-4 — Accent progress requires a real measurement

Governs the accent fill that reads as completion.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Authority supplies a verified value from 0 to 100 | `Progress` with a truthful `label` and that `value`, and the accent fill is presentation of that measurement |
| Case 2 | The value has not resolved | `isSkeleton`, because a zero-length bar states a measurement that nobody made |
| Case 3 | A bar, ring, or line is decorative, or expresses a ranking rather than completion | It carries no progress semantics at all |
| Case 4 | The fill is tempting to read as an outcome | It is not one. A full bar measures; only an outcome owner concludes |

## ACCENT-5 — Outcome and destructive authority are not accent

Governs the treatments accent must not stand in for.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Content reports success, warning, danger, pending, or selection | It stays with `Badge`, a presentation-state owner, or the current-state owner. Primary accent never substitutes for one |
| Case 2 | A final destructive CTA is required | An explicit typed danger action treatment is required first, and the published `ButtonVariant` currently has no danger value, so the gap is recorded |
| Case 3 | Local red would bridge that gap today | It does not. Paint cannot create destructive authority, and a family repainting `primary` as red changes the meaning of a prop it does not own |
| Case 4 | An ordinary primary action looks consequential | Emphasis is not authority. Consequence and confirmation belong to the product decision |

## What this file does not decide

Which rank the content carries is [Hierarchy](hierarchy.md), and which action deserves the decision
emphasis is [CTA](cta.md). Which conditions the state owners can be in is [State](state.md).
Whether a distinction survives forced colours and reduced motion once rendered is
[Accessibility](../proof/accessibility.md) and [Motion](../proof/motion.md), and whether the
emphasis claims something authority never said is [Render truth](../proof/render-truth.md).
