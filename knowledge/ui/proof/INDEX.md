# UI proof

Proof is the decision layer that only exists after the page has rendered:

```text
business
-> composition decides regions, rank, actions, states and emphasis
-> presentation resolves CSS values on app-owned boundaries
-> rendered UI  <- proof observes here
```

Every rule in this folder is consumed by the audit operator. That operator has no access to intent,
only to output: the accessibility tree that was computed, the element that actually holds focus, the
frame where the animation stopped, and the claim the page ended up making. These topics belong
together because none of them can be established by reading source. A `:focus-visible` rule does not
prove a visible indicator, a `label` prop does not prove a computed name, a `motion` attribute does
not prove a transition, and an approved copy deck does not prove what the rendered page asserts.
Each rule therefore states the observation that would falsify it, so a passing verdict always names
something that was looked at.

## Catalog

| Knowledge | What it decides | Rules |
| --- | --- | --- |
| [Accessibility](accessibility.md) | Whether names, relationships, targets and contrast reach every reader | A11Y-1 to A11Y-4 |
| [Focus](focus.md) | Where focus is visible, how far it travels, and where it returns | FOCUS-1 to FOCUS-5 |
| [Motion](motion.md) | Whether meaning survives with the movement stopped, reduced or interrupted | MOTION-1 to MOTION-4 |
| [Render truth](render-truth.md) | Whether every rendered claim traces back to real authority | TRUTH-1 to TRUTH-4 |

## Rule shape

`A11Y-1`, `FOCUS-5`, and the other `PREFIX-n` names are stable ordinal addresses within their topic.
The number is not a severity or a conformance level.

Every rule carries its heading, one line naming what the rule governs, and one table:

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The concrete rendered situation that reaches this rule. | The exact runtime evidence, and what seeing it would falsify. |

The `Observe` cell names a thing that can be captured from the running page — a computed name, an
active element, a measured rectangle, a computed duration, a traced result — and says what a
contrary observation would disprove. It never restates an intention.

A case that belongs to a neighbouring rule is not a table row. It goes on one line after the table,
as `Not this rule: <condition> is PREFIX-n`. Each file closes with a
`## What this file does not decide` section linking its siblings and the composition knowledge that
made the decision being tested.

Component and prop names in these files resolve to `@starci/grammar/common`. Where the published
contract offers no owner for a required behaviour, the audit records a capability gap rather than
approving a local substitute.
