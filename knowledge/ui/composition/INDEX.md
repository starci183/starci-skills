# UI composition

Composition is the decision layer that runs before any DOM exists:

```text
business
-> composition decides regions, rank, actions, states and emphasis
-> presentation resolves CSS values on app-owned boundaries
-> rendered UI
```

Every rule in this folder is consumed by the direction operator. That operator answers the questions
that must be settled while the page is still a description: which regions the page has, which
content outranks which, which action carries the decision, which conditions the feature can be in,
what the reader is told at each outcome, and where the scarce dominant emphasis is spent. These
topics belong together because each of them is a commitment made before rendering, and because they
constrain one another — a region without an anchor has no hierarchy to spend accent on, and a state
with no carrier has nothing for feedback to describe. Nothing here can be repaired by a later CSS
value, which is exactly why it is decided first.

## Catalog

| Knowledge | What it decides | Rules |
| --- | --- | --- |
| [Layout](layout.md) | Which visible task regions exist, who owns their tracks and scrolling | LAYOUT-1 to LAYOUT-5 |
| [Hierarchy](hierarchy.md) | Which information rank each piece of meaning receives | HIERARCHY-1 to HIERARCHY-5 |
| [Responsive](responsive.md) | What survives as space changes, and which query owns the change | RESPONSIVE-1 to RESPONSIVE-5 |
| [CTA](cta.md) | Which action carries the decision, and what its emphasis promises | CTA-1 to CTA-5 |
| [Action](action.md) | What one activation does, and who owns the effect and the pending state | ACTION-1 to ACTION-4 |
| [State](state.md) | Which conditions exist, and which published carrier holds each one | STATE-1 to STATE-7 |
| [Feedback](feedback.md) | Who reports a failure, a correction, a recovery, and a result | FEEDBACK-1 to FEEDBACK-4 |
| [Accent](accent.md) | Where the scarce strongest emphasis is spent | ACCENT-1 to ACCENT-5 |

## Rule shape

`LAYOUT-1`, `STATE-5`, and the other `PREFIX-n` names are stable ordinal addresses within their
topic. The number is not a severity, a component variant, or a value on a scale.

Every rule carries its heading, one line naming what the rule governs, and one table:

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The concrete situation that reaches this rule. | What the direction must settle, in language the product can read. |

The `Decide` cell states a commitment, not a class name. It may name a published component or prop
where that is the decision, but it never resolves a CSS value; that belongs to presentation.

A case that belongs to a neighbouring rule is not a table row. It goes on one line after the table,
as `Not this rule: <condition> is PREFIX-n`. Each file closes with a
`## What this file does not decide` section linking its siblings and the proof knowledge that
observes the result.

Component and prop names in these files resolve to `@starci/grammar/common`. An API that does not
exist there is not written into a rule; a required capability that is missing is recorded as a gap.
