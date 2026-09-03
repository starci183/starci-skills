# Contrast proof

This file answers one question: on the page that actually rendered, do the distinctions and the text
the direction relies on survive measurement, in every theme and state, and with colour taken away?

Contrast is never established by reading a token. An authored value is a formula; the evidence is the
computed foreground measured against the background that was actually composed beneath it, after
transparency, overlays, and state opacity. Each rule below names the observation that would falsify
it.

`COLOR-3` and `COLOR-5` are the two surviving addresses of the retired `ui/color.md` topic. The
numbers `COLOR-1`, `COLOR-2`, and `COLOR-4` were retired with it and are not reused.

## COLOR-3 — Action, destination, selection, and focus stay distinguishable

Governs whether four different meanings sharing one region remain four different things once colour
is removed from the evidence.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | One region renders commands and destinations side by side | The command is a `button` element (`data-element="button"`) and the destination an anchor (`data-element="a"`) carrying an `href`, and the destination differs from surrounding copy at rest. A destination whose only resting difference is a colour value, with the underline appearing only on hover, falsifies it |
| Case 2 | Persistent selection is rendered among peers | The selected peer carries `aria-selected="true"` (tabs) or `aria-current` (a current text action), and a non-colour change is measured on it: a selected-indicator rectangle of non-zero height, a computed `font-weight` change, or an underline. A selection whose only measurable change is a colour value falsifies it |
| Case 3 | Keyboard focus lands in the same region | `document.activeElement` is the focused control, and its computed outline rectangle is distinct from the selection cue. Focus and selection sharing one identical fill, with no outline and no state attribute, falsifies both owners at once |
| Case 4 | Colour is removed from the capture, or forced colours are active | Each of the four distinctions still holds through element role, state attribute, outline, or indicator geometry. A distinction carried by fill alone falsifies it |
| Case 5 | A non-text boundary carries the distinction: an indicator, an outline, a field edge | Its measured contrast against the adjacent composed background is at least `3:1`. A `2px` indicator measuring `1.8:1` against its rail falsifies it, however visible it looked in the design file |

Not this rule: the text ratio of the selected or focused label, and how every ratio moves across
themes, is COLOR-5. Where the focus indicator sits and whether an ancestor clips it is FOCUS-1.
Whether every distinction survives at zoom and reflow is A11Y-4. Whether a destination should have
been a command at all is decided in composition, under ACTION-1.

## COLOR-5 — Themes and measured contrast

Governs whether text and required boundaries clear their ratios in every theme and every state the
family renders, measured on the composed pixels rather than on the token.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Normal text renders | The computed `color` measured against the composed background, after transparency, overlays, and any state opacity such as `[data-grammar-state="unavailable"]`, is at least `4.5:1`. A token that looks dark enough on its own, with no composed background captured, proves nothing and is recorded as missing proof |
| Case 2 | Large text renders, at least `24px`, or `18.66px` at bold weight | The same composed measurement is at least `3:1` |
| Case 3 | A required non-text boundary renders: a focus outline, a selected indicator, a field edge, a state edge | Its measured contrast against the colours on each side is at least `3:1`. A field edge that resolves to `transparent` against its canvas has no measurable boundary, and the field's identity must then be carried by something else that was measured |
| Case 4 | The theme changes: light, explicit dark (`data-grammar-theme="dark"` on the Grammar root), or system dark (`data-grammar-theme="system"` under `prefers-color-scheme: dark`) | Every pair is re-measured in each theme actually rendered. A ratio captured in one theme closes nothing in another |
| Case 5 | Forced colours are active | Every pair resolves to the system palette (`Canvas`, `CanvasText`, `Highlight`, `GrayText`) and every distinction still renders. An authored colour surviving into the forced-colours capture falsifies the family's binding |
| Case 6 | The state changes: hover, focus, selected, disabled (`disabled` or `aria-disabled`), pending (`aria-busy` or `data-action-pending="true"`), or an outcome state (`data-grammar-state`) | Each state is measured on its own, and the token source is recorded separately from the numeric ratio. A single default-state measurement closes nothing for the other states |
| Case 7 | A family or the application paints over the pair | The isolated published output, the family delta, and the application delta are measured separately, so the failing layer is named. The application may change its own canvas, but a failing pair inside a published owner remains a finding at the layer that painted it |

Not this rule: whether the distinction exists at all without colour is COLOR-3. Whether the right
tone token was chosen for the copy is decided in presentation, under TONE-1 to TONE-3. Whether the
text is announced at all is A11Y-1 to A11Y-3.

## COLOR-6 — The contrast verdict

Governs how the criteria above become this topic's one row in the receipt's `## Verdict` table.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The lens runs | `COLOR-3` and `COLOR-5` are judged from measured colour in every theme and every state the coverage declares, never from a token name |
| Case 2 | The verdict is computed | The gating set is the whole set: `pass` requires both to pass in every theme, because a distinction that survives one theme and not the other is not a distinction |
| Case 3 | A theme or a state was never measured | The verdict is `blocked` for the topic, not a pass on the themes that were |
| Case 4 | A failure is routed | A measured value below its threshold routes to `resolve`; a distinction that depends on a colour nobody published routes to `direction` |

The scored set is `COLOR-3` and `COLOR-5`; this rule is the arithmetic and is not itself scored. Its
result is the `contrast` row of the audit receipt's `## Verdict` table.

## What this file does not decide

Which tone a piece of copy takes and which surface sits behind it are
[Tone](../presentation/tone.md) and [Surface](../presentation/surface.md); which meanings a region
carries and which of them is a destination is [Action](../composition/action.md) and
[State](../composition/state.md). Names, relationships, and target sizes are
[Accessibility](accessibility.md); where the indicator sits is [Focus](focus.md); whether a state
was reached truthfully is [Render truth](render-truth.md).
