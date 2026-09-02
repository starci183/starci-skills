# Coverage composition

This file answers one question: what must the direction receipt actually enumerate, so that a later
operator can exercise the direction instead of guessing at it?

Every other composition topic constrains one decision at a time. This one constrains the receipt as
a whole. Five topics each used to close with a coverage rule of their own, and five copies of one
idea drift apart. Those five are retired into the single rule below and their numbers are never
reused; retired are `ACTION-4`, `STATE-4`, `FEEDBACK-4`, `LAYOUT-5`, and `RESPONSIVE-5`. What the
enumeration is worth is decided elsewhere: layout and taste come from the idioms and the playbook in
`knowledge/grammars/starci`, and this rule only asserts that the receipt says enough for anyone to
check them.

## COVERAGE-1 — What the receipt must enumerate

Governs the fields a decided `fe-direction-decision.json` must carry before it may be emitted.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The direction delivers any action | `coverage.actions[]` is non-empty, and every entry names its pointer route, its keyboard route, and every reachable named state of that action, enabled, disabled, pending, and settled, so no route and no state is left implicit |
| Case 2 | Any action accepts work that does not settle immediately | Every pending path in `coverage.actions[]` names its settlement, cancellation included; no entry declares a pending path whose settlement is absent |
| Case 3 | The direction declares regions | `coverage.regions[]` is non-empty and covers every entry in `regionModel`, and each entry names one idiom in `knowledge/grammars/starci/playbook.md` and one published composition; no region resolves to a bare arrangement |
| Case 4 | The composition changes shape as space changes | `coverage.responsive[]` is non-empty and every branch names exactly one owner, a published container query or a published viewport query; no branch names a device and none names two owners |
| Case 5 | The feature has more than one condition | `coverage.states[]` is non-empty, every entry names its meaning before its carrier, and no carrier appears against two meanings |
| Case 6 | A family or the application adds a delta over a published owner | Each layer is enumerated separately, so a doubled effect, a lost selected state, a lost compact trigger, or a duplicated announcement is attributable to the layer that introduced it |

Not this rule: taking the measurements, running the samples, and counting the announcements is the
audit operator's work; this rule only fixes what the receipt promised.

## What this file does not decide

Which regions exist and who owns their tracks is [Layout](layout.md), and which branch survives a
reflow is [Responsive](responsive.md). Which conditions exist and which carrier holds each is
[State](state.md). What one activation does is [Action](action.md), and what the reader is told at
each outcome is [Feedback](feedback.md). Whether the enumerated paths actually hold once rendered is
[Focus](../proof/focus.md), [Accessibility](../proof/accessibility.md), and
[Render truth](../proof/render-truth.md).
