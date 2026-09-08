# Motion proof

This file answers one question: if the movement stopped, was interrupted, or was never allowed to
run, would the reader still know everything the page was telling them?

Motion is always supplementary. A rendered page is judged on the frame where nothing is moving, and
on the frame where the animation was cut off halfway. Each rule below names the observation that
would falsify it.

## MOTION-1 — Meaning exists without movement

Governs whether any essential meaning is carried by movement alone.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Accepted work is in progress | The initiating command still shows its name, exposes busy state, and refuses a second activation in a static frame. A spinner as the only sign that work exists falsifies it |
| Case 2 | A state changed | A persistent carrier holds it: stable copy, native state, a controlled value, geometry, or a published relationship. A pulsing paint as the only selected cue falsifies it |
| Case 3 | Animation is disabled entirely | The same meaning is readable. Anything that disappears with the animation was never carried |
| Case 4 | Content is animating out | Once it is hidden it leaves no focus stop and no accessibility node. A hidden but still focusable exiting link falsifies it |
| Case 5 | Only an animated capture exists as evidence | Nothing is closed. The static frame and the interrupted outcome are still unknown |

## MOTION-2 — Preference changes choreography, not outcome

Governs what a reduced-motion preference is allowed to change.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The system preference or the published motion mode changes | The trigger, the content, the landmark, the focus order, and the final geometry are identical before and after. Different collapsed content under the reduced path falsifies it |
| Case 2 | A rail publishes `motion` as `static`, `animated`, or `reduced` | The attribute is present, but the published CSS changes animated scroll behaviour and does not implement a rail-collapse transition. Claiming choreography from the prop name alone falsifies the finding |
| Case 3 | Reusable rail-collapse choreography is genuinely required | No published path provides it, so the missing capability is recorded rather than assumed |
| Case 4 | Application CSS animates that collapse in the meantime | It is a tracked workaround with an owner and a removal condition, not a new contract |
| Case 5 | A family supplies scoped choreography | It supplies an equivalent reduced path, ending in the same final state |

## MOTION-3 — Timing comes from the owner that published it

Governs where duration, delay, and easing are read from.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A transition runs on a published element, such as a tooltip, a whole-card response, or a decorative highlight | The computed duration, delay, and easing match the rule that actually won in the current render, not a source string or a fallback variable |
| Case 2 | A family adds its own timing | It stays inside its `data-grammar-family` scope. Timing appearing in an unrelated tree falsifies the scoping |
| Case 3 | The application sets a duration on published anatomy | That reaches through an owner it does not have. The application decides when state changes, never how the renderer choreographs it |
| Case 4 | A published timing value was quoted from source | It is measured in the selected family before it is believed, because the selected family may have replaced it |

## MOTION-4 — Motion evidence and falsifiers

Governs what closes a motion claim.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Any reachable motion is being closed | Normal, reduced, interrupted, reversed, backgrounded and resumed, zoomed, and responsive paths are all exercised |
| Case 2 | The capture is taken | Owner, trigger, prior and final state, the alternative cue, computed duration, delay and easing, animation events, focus, the accessibility tree, and the settled result are recorded together |
| Case 3 | Motion is interrupted partway | It settles to a valid state. A stale intermediate state, or lost focus, falsifies it |
| Case 4 | Anything flashes | It stays at or below three flashes per second. A four-flash urgency cue falsifies safety outright |
| Case 5 | A family or the application adds a delta | Each layer is attributed independently, and a smooth video with no preference or interruption evidence closes nothing |

## MOTION-5 — The motion verdict

Governs how the criteria above become this topic's one row in the receipt's `## Verdict` table.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The lens runs | `MOTION-1` to `MOTION-4` are judged on the capture pair the coverage requires: one with the reduced-motion preference unset and one with it set to reduce |
| Case 2 | The verdict is computed | The gating set is the whole set: `pass` requires every criterion to pass, because movement that loses meaning once has lost it |
| Case 3 | One of the two captures is missing | The verdict is `blocked`; a lens run on the ordinary capture alone has not tested the preference at all |
| Case 4 | A failure is routed | A duration or an easing outside the published scale routes to `resolve` with an off-scale cause; wrong choreography, a lost outcome or a reflow routes to `direction` |

The scored set is `MOTION-1` to `MOTION-4`; this rule is the arithmetic and is not itself scored. Its
result is the `motion` row of the audit receipt's `## Verdict` table.

## What this file does not decide

Which states exist and which carrier holds each is [State](../composition/state.md), and which
action owns pending is [Action](../composition/action.md). Whether the resting cue is distinguishable
without colour is [Accent](../composition/accent.md) and [Accessibility](accessibility.md). Whether
focus survives an exit is [Focus](focus.md), and whether the movement implies a result nobody
confirmed is [Render truth](render-truth.md).
