# Pending contrast (awaiting relocation)

Preserved verbatim from the deleted `ui/color.md`. These measured-contrast rules have no successor in `presentation/tone.md`, which states that a contrast failure is repaired by changing the surface but publishes no thresholds, no theme matrix, and no forced-colors requirement. Do not cite these IDs as current routing; they await relocation to an owning file.

## COLOR-3 — Action, destination, selection, and focus differ

### When

The same region contains commands, destinations, persistent selection, or keyboard focus. Hover or
temporary pointer feedback alone is not persistent selection.

### Apply

- Use Common `Button` or `TextAction` with `onPress` for commands and with `href` for destinations, `Tabs`/current props for selection, and the Common focus owner for focus.
- Preserve a non-color cue: native element/anatomy, `aria-current`, selected indicator, or visible focus outline.
- Prove the four states independently with color removed and forced colors active; measure any required UI boundary at at least 3:1 contrast.
- A family may recolor each existing cue; the application may choose destination and command consequence but not merge the contracts.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A current tab has `aria-current`/selection anatomy and a 2 px indicator. | `PASS` | Persistent selection is more than an accent color. |
| Inline destination text is indistinguishable from surrounding copy until hover. | `COMMON_IMPLEMENTATION_GLITCH` | The destination lacks a persistent cue; repair the Common link appearance. |
| Focus and selection use one identical fill with no outline or state attribute. | `APP_OVERRIDE` · `WRONG_OWNER` | Users cannot tell transient focus from current state; restore both owners. |

## COLOR-5 — Themes and measured contrast

### When

A family supports light, dark, system, forced-color, hover, focus, selected, disabled, pending, or
outcome states. An authored token value alone is never a contrast result.

### Apply

- Resolve the active family and theme, then capture computed foreground and actual background after transparency and overlays are composed.
- Require at least 4.5:1 for normal text, 3:1 for large text, and 3:1 for required non-text UI/state boundaries where those WCAG criteria apply.
- Measure every material state and forced-colors result; record token source/formula separately from the numeric ratio.
- Families repair failing paint under their scope; applications may choose page canvas but may not mask a failing Common pair.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| Muted body text measures 4.7:1 in light and 5.1:1 in dark mode. | `PASS` | The rendered pair clears the normal-text threshold in both themes. |
| A source token looks dark enough, but the overlay background was not measured. | `PROOF_MISSING` | Formula is not final pixels; capture computed colors and calculate the ratio. |
| Offset-family selected text falls to 2.6:1 on its soft fill. | `FAMILY_OVERRIDE_GLITCH` · `VALUE_DRIFT` | The family paint fails the rendered threshold; repair the scoped pair and retest all states. |
