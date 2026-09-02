# Feedback composition

This file answers one question: when something fails, succeeds, or needs correcting, who says so,
and how small is that owner?

Feedback is decided at the smallest place that can actually be corrected or recovered. A failure
announced further out than it can be fixed makes the reader hunt for the cause, and a page-level
recovery for a single failed panel throws away work that never failed.

## FEEDBACK-1 — Correct at the nearest owner

Governs where a validation failure lives.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | One field has a current validation failure the reader can fix at that field | `Input.errorMessage` on that field carries the failure and the correction, and `isError` is bound to the same invalid fact |
| Case 2 | The field has standing guidance that is true whether or not it failed | That guidance sits in `hint`, and it does not appear or disappear with validation |
| Case 3 | The same failure would also be summarised above the form | Exactly one owner states that failure, and it is the field |
| Case 4 | The message is navigation or general status rather than a rejected value | No validation carrier holds it; it resolves to a status owner elsewhere |
| Case 5 | The value changes, or validation runs again | The error updates or clears with the fact, and the reader's entry survives unchanged |

## FEEDBACK-2 — Recover at the smallest actionable owner

Governs where a retry lives.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | One region is empty or failed and has a real next step | `EmptyNotice` names the affected region and carries `actionLabel` and `onAction` for that step, with `description` optional |
| Case 2 | The recovery action has accepted work | `isActionPending` is bound while that action runs, and to no other action |
| Case 3 | A page-level reload would be simpler to wire | The recovery is scoped to the operation that failed; no page-level reload stands in for one failed region |
| Case 4 | Repeating the operation is not safe, as with a purchase | The recovery is a distinct safe operation backed by authority, not a repeat of the unsafe one |
| Case 5 | The reader has unsaved work elsewhere on the page | Only the failed region is replaced, and work outside it survives the recovery |

## FEEDBACK-3 — Settlement must be known before it is claimed

Governs the moment a result may be stated.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A command is waiting on a result | Pending clears only on a real settlement, and the result copy names the outcome that actually arrived |
| Case 2 | A non-urgent result should be announced | `Text live="polite"` sits on the smallest owner of that status |
| Case 3 | The message is genuinely urgent and interrupting is warranted | `live="assertive"` is bound only there, and to nothing else in the tree |
| Case 4 | The same result would appear in two places | Exactly one announcement owner holds that result, and it updates only when the result changes |
| Case 5 | The message describes navigation | It is produced by an actual navigation effect, and it carries no error semantics unless the navigation itself failed |
| Case 6 | The result matters after the moment passes | A durable owner holds it after the announcement, where the reader can review or act on it |

Retired: FEEDBACK-4 is retired into COVERAGE-1 and is not reused; the address stays spent.

## What this file does not decide

Who owns pending among several controls is [Action](action.md), and which conditions exist at all is
[State](state.md). Which action the reader is being pushed towards is [CTA](cta.md). What the
receipt must enumerate about these outcome paths is [Coverage](coverage.md). Whether a message is
programmatically related to its field, and whether it is announced once, is
[Accessibility](../proof/accessibility.md) and [Render truth](../proof/render-truth.md).
