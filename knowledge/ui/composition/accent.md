# Accent composition

This file answers one question: the page has a small budget of strongest emphasis, so where is it
spent, and what does spending it there promise?

Accent is scarce by design. Every extra dominant treatment reduces what the previous one meant, so
the decision is about allocation, not about paint. Nothing in this file may change what the product
is claiming; accent only makes an existing claim easier to find.

## ACCENT-1 — One dominant decision accent

Governs how many strongest treatments a decision region may hold.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A decision region offers one clear next action | Exactly one dominant accent sits inside that decision owner, on `Button variant="primary"`, whether it carries `onPress` or `href` |
| Case 2 | Sibling actions share the region | Each sibling carries a weaker published variant that states its real consequence |
| Case 3 | Two peer choices genuinely carry equal consequence | Neither carries the dominant accent, and no paint breaks the tie |
| Case 4 | Separate regions each have their own next step | Each dominant accent is counted within its own decision owner, and none is counted twice |
| Case 5 | The count would change in a compact layout or a loading state | The count of dominant accents is identical in every state and at every width |

## ACCENT-2 — Compact identity accent

Governs the small visual anchor that helps a reader scan peers.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Peer features, rows, or sections need a compact anchor for scanning | `IconTile tone="accent"`, or `Icon` in its declared role, carries it, with a reviewed semantic glyph named in the receipt |
| Case 2 | The anchor sits beside a name | The visible text identity remains, and the mark never replaces it |
| Case 3 | The direction wants a different plate size or shape | The published geometry carries it, at `sm` 32 or `md` 40 nominal CSS pixels, and no coloured rounded square is rebuilt around an icon |
| Case 4 | The glyph would be the only identity for an unfamiliar feature | Every unfamiliar feature carries a name; no glyph is its sole identity |

## ACCENT-3 — Selection, destination, and focus stay distinct

Governs three treatments that tend to collapse into one another.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A region can hold a persistent selection, a destination, a command emphasis, and keyboard focus at once | Each of the four resolves to its own published owner and its own treatment |
| Case 2 | Selection is being expressed | Selection carries a non-colour cue and survives focus moving elsewhere |
| Case 3 | A destination sits inside body copy | It is identifiable as a destination at rest, before hover and before focus |
| Case 4 | Colour is removed, or the viewer is in forced colours | All three remain distinguishable, because none relies on fill alone |
| Case 5 | A brief hover is mistaken for selection | No transient cue carries a persistent value |

## ACCENT-4 — Accent progress requires a real measurement

Governs the accent fill that reads as completion.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Authority supplies a verified value from 0 to 100 | `Progress` carries a truthful `label` and that `value`, and the accent fill presents that measurement only |
| Case 2 | The value has not resolved | `isSkeleton` is bound, and no zero-length bar states a measurement nobody made |
| Case 3 | A bar, ring, or line is decorative, or expresses a ranking rather than completion | It carries no progress semantics at all |
| Case 4 | The fill is tempting to read as an outcome | The fill states a measurement, and a separate outcome owner states the outcome |

## ACCENT-5 — Outcome and destructive authority are not accent

Governs the treatments accent must not stand in for.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Content reports success, warning, danger, pending, or selection | `Badge`, a presentation-state owner, or the current-state owner carries it; the primary accent carries none of them |
| Case 2 | A final destructive CTA is required | A typed danger action treatment is required first, and while `ButtonVariant` publishes no danger value the receipt records that gap |
| Case 3 | Local red would bridge that gap today | No local red and no family repaint of `primary` appears against that action |
| Case 4 | An ordinary primary action looks consequential | Consequence and confirmation are named in the product decision, not inferred from the emphasis |

## What this file does not decide

Which rank the content carries is [Hierarchy](hierarchy.md), and which action deserves the decision
emphasis is [CTA](cta.md). Which conditions the state owners can be in is [State](state.md).
Whether a distinction survives forced colours and reduced motion once rendered is
[Accessibility](../proof/accessibility.md) and [Motion](../proof/motion.md), and whether the
emphasis claims something authority never said is [Render truth](../proof/render-truth.md).
