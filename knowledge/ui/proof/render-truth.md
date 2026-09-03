# Render truth proof

This file answers one question: does every visible and announced claim on the rendered page trace
back to something the product actually established?

A claim is anything the page asserts: a word, a glyph, a tone, a state, a live announcement, a
promise of recovery. The audit inventories the claims that were rendered and traces each to its
source. A claim with no source is invented, whichever layer invented it.

## TRUTH-1 — Neutral facts stay neutral

Governs content that authority supplied without any status attached.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Authority supplied a plain fact | It renders as ordinary text with no status role, no success or error state, and no urgency. An alert role on default text falsifies it |
| Case 2 | A glyph, a tone, or a placement was added around the fact | None of them reads as an outcome or an endorsement. A tick mark and a success treatment on a capability statement falsifies it |
| Case 3 | A family paints the region | Neutral facts stay neutral under that paint. A whole set of plan facts painted as warnings falsifies it |
| Case 4 | The state or the viewport changes | The claim is re-inventoried there, because a fact that was neutral at one width may not be at another |

## TRUTH-2 — Availability follows authority

Governs claims about what the current reader may do.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Authority confirms a static capability is unavailable here | The row carries `state="unavailable"` with an exact label and a description naming the verified condition. Copy implying the feature is already enabled falsifies it |
| Case 2 | The unavailable thing is a command rather than a static capability | The action owner carries `isDisabled`, and the disabled semantics are in the rendered output |
| Case 3 | The state mark alone would be the evidence | It is decorative or absent here, so the accessible truth still depends on the supplied text. Inferring a spoken unavailable status from paint falsifies it |
| Case 4 | An action is visible and is taken as proof of permission | Visibility is not permission. Permission is resolved from authority and then drives the real owner |
| Case 5 | A family paints the unavailable row | It stays inactive. Affirmative paint over an unavailable fact falsifies it |

## TRUTH-3 — Progress is not an outcome

Governs the boundary between work in flight and a result.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A command has accepted work | Progress stays on that command, its label survives, and duplicate activation is blocked while the work runs |
| Case 2 | A result is claimed | Authority confirmed it first. A success message rendered while the request is still pending falsifies it |
| Case 3 | Navigation is claimed | The navigation effect actually exists. A message saying the reader is being taken somewhere, when nothing started, falsifies it, and a navigation status rendered as an error falsifies it twice |
| Case 4 | Pending and outcome would occupy the same moment | They do not. A family painting affirmative over a pending control falsifies the current state |
| Case 5 | A recovery or a route is stated in the copy | It exists and can be reached. A promised retry with no wired recovery falsifies the promise |

## TRUTH-4 — Claim evidence and falsifiers

Governs what closes a render-truth claim.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Any reachable state is being closed | Every claim carried by text, icon, shape, tone, placement, motion, native state, live region, and accessibility semantics is inventoried in that state |
| Case 2 | A claim has been inventoried | It is traced to business authority, the current runtime result, the current permission, and the effect or recovery that actually exists |
| Case 3 | The state, the theme, or the viewport changes | The inventory is rerun there. One theme or one stale-and-refreshed state left unchecked closes nothing |
| Case 4 | A family or the application adds a delta | The isolated published output, the family delta, the application delta, and the current pixels are compared separately |
| Case 5 | Copy review or source props are offered as the evidence | They are not sufficient. A rendered claim is proved by the rendered output and its traced authority |

## TRUTH-5 — The render-truth verdict

Governs how the criteria above become this topic's one row in the receipt's `## Verdict` table.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The lens runs | `TRUTH-1` to `TRUTH-4` are judged on every capture that renders a fact, an availability, a progress signal or an outcome, each traced to the authority behind it |
| Case 2 | The verdict is computed | The gating set is the whole set: `pass` requires every criterion to pass, because one claim the page cannot back is one claim a reader will act on |
| Case 3 | There is no store or authority the claims can be checked against | The verdict is `blocked`. Approving claims because they look plausible falsifies it |
| Case 4 | A failure is routed | A claim that was designed wrong routes to `direction`; a claim whose authority is missing routes to the flow owner, because no value and no composition can supply a fact the product does not hold |

The scored set is `TRUTH-1` to `TRUTH-4`; this rule is the arithmetic and is not itself scored. Its
result is the `render-truth` row of the audit receipt's `## Verdict` table.

## What this file does not decide

Which rank a fact receives is [Hierarchy](../composition/hierarchy.md), which conditions exist and
which carrier holds each is [State](../composition/state.md), and where a message belongs is
[Feedback](../composition/feedback.md). Whether the claim is announced correctly is
[Accessibility](accessibility.md), whether movement implies it is [Motion](motion.md), and whether
the reader can reach the control that acts on it is [Focus](focus.md).
