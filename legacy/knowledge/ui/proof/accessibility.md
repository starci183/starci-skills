# Accessibility proof

This file answers one question: in the tree that actually rendered, can every reader perceive and
operate what the direction intended?

Nothing here is settled by reading source. A prop in the source is an intention; the accessible name
computed from the rendered node is the evidence. Each rule below states the observation that would
falsify it, so a passing claim always names something that was looked at.

## A11Y-1 — Field name and relationships

Governs whether a field's identity and its current guidance reach assistive output.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A field renders with a visible label | The computed accessible name equals the visible label. A name supplied only by a placeholder, or a field with no name at all, falsifies it |
| Case 2 | The field has a hint, an error, or both | The message is programmatically related to that input as its description, and the text is the current one. A visible message with no relation to the control falsifies it |
| Case 3 | The field is required, invalid, or disabled | The rendered semantics match the current business facts. A red border with no invalid semantics falsifies it |
| Case 4 | The reader types and validation runs again | The entered value survives the state change, and the description is the new one rather than a stale message |

Not this rule: whether the failure was placed on the right owner in the first place is decided in
composition, under FEEDBACK-1.

## A11Y-2 — Glyph-only commands still carry a name

Governs commands whose visible content is a glyph.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | `IconButton` renders a glyph-only command | The button role carries an accessible name equal to its `label`. A tooltip as the only explanation falsifies it |
| Case 2 | The button contains a decorative leading glyph | The inner glyph is hidden from assistive output. The same name computed twice, once on the button and once on the icon, falsifies it |
| Case 3 | A standalone glyph itself carries meaning | `Icon.ariaLabel` produces an image role with that name. A meaningful glyph left hidden falsifies it |
| Case 4 | The command can be disabled | Keyboard activation reaches it when enabled, and produces nothing when disabled |

## A11Y-3 — Measurements have an accessible identity

Governs numbers rendered as bars.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A resolved measurement renders | The progressbar exposes an accessible name equal to its label, the current value, a minimum of `0`, and a maximum of `100`, and that value equals the product fact |
| Case 2 | The value has not resolved | The skeleton renders aria-hidden geometry with no progressbar and no label. A named progressbar announcing zero falsifies it |
| Case 3 | `value` was omitted while data was unknown | The non-skeleton renderer defaults it, so the rendered output announces `0`, which falsifies the claim that the value is unknown |
| Case 4 | A decorative bar sits beside the measurement | It carries no progressbar role. A second announced measurement for one fact falsifies the region |

## A11Y-4 — Perceivable and operable at every required state

Governs the evidence that closes an accessibility claim.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A target must be operable by touch | Accordion triggers and controls inside a rail measure at least `44px × 44px` in the current render. Any other target needs its own published contract before a minimum is asserted |
| Case 2 | The task is attempted by keyboard alone | Every required control is reachable and operable. One unreachable required control falsifies the page |
| Case 3 | The page is viewed in forced colours, at reduced contrast, or with colour removed | Every state, selection, and focus distinction survives. A distinction carried by fill alone falsifies it |
| Case 4 | The page is zoomed, the text is scaled, or the viewport narrows | No required content and no focus indicator is clipped |
| Case 5 | A family or the application styles over the published owner | The isolated published output, the family delta, and the application delta are compared separately, so the failing layer is named |

Not this rule: which semantic owner should have been chosen is decided in composition, under
HIERARCHY-1 and STATE-1.

## A11Y-5 — The accessibility verdict

Governs how the criteria above become this topic's one row in the receipt's `## Verdict` table.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The lens runs | `A11Y-1` to `A11Y-4` are each judged at every state the coverage declares, in every colour scheme, from the computed accessibility tree and the measured render rather than from source |
| Case 2 | The verdict is computed | The gating set is the whole set: `pass` requires every criterion to pass, because a reader who cannot reach a control is not partially served. There is no mean and no tolerance here, and averaging this topic into another falsifies it |
| Case 3 | A criterion has no observation behind it | The verdict is `blocked`, never `pass` and never `fail`, because a render nobody measured has earned neither |
| Case 4 | A failure is routed | A missing value routes to `resolve`; a missing structure or relationship routes to `direction`; a capability the published family does not offer routes to `grammar-gap`, never to a local repair in the application |

The scored set is `A11Y-1` to `A11Y-4`; this rule is the arithmetic and is not itself scored. Its
result is the `accessibility` row of the audit receipt's `## Verdict` table, copied from there and
never recomputed downstream.

## What this file does not decide

Which rank, action, or state the direction chose is [Hierarchy](../composition/hierarchy.md),
[Action](../composition/action.md), and [State](../composition/state.md). Where the focus indicator
goes and how far focus may travel is [Focus](focus.md). Whether animation removes meaning is
[Motion](motion.md), and whether the rendered claim matches authority is
[Render truth](render-truth.md).
