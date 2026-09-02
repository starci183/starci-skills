# Feedback composition

This file answers one question: when something fails, succeeds, or needs correcting, who says so,
and how small is that owner?

Feedback is decided at the smallest place that can actually be corrected or recovered. A failure
announced further out than it can be fixed makes the reader hunt for the cause, and a page-level
recovery for a single failed panel throws away work that never failed.

## FEEDBACK-1 — Correct at the nearest owner

Governs where a validation failure lives.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | One field has a current validation failure the reader can fix at that field | `Input.errorMessage` carries the failure and the correction, with `isError` set from the same invalid fact |
| Case 2 | The field has standing guidance that is true whether or not it failed | `hint`, which is not an error and does not come and go with validation |
| Case 3 | The same failure would also be summarised above the form | It is not. One field-owned correction avoids two owners for one fact |
| Case 4 | The message is navigation or general status rather than a rejected value | It is rendered as status somewhere else. It is not labelled as validation |
| Case 5 | The value changes, or validation runs again | The error is updated or removed with it, and the reader's entry is preserved |

## FEEDBACK-2 — Recover at the smallest actionable owner

Governs where a retry lives.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | One region is empty or failed and has a real next step | `EmptyNotice` names the affected region, with `actionLabel` and `onAction` for that step and an optional `description` |
| Case 2 | The recovery action has accepted work | `isActionPending` while it runs, and only for that action |
| Case 3 | A page-level reload would be simpler to wire | It is not the answer for one failed panel. Recovery is scoped to the operation that failed |
| Case 4 | Repeating the operation is not safe, as with a purchase | A safe recovery backed by authority is supplied instead of a generic retry |
| Case 5 | The reader has unsaved work elsewhere on the page | It survives the recovery. Only the failed region is replaced |

## FEEDBACK-3 — Settlement must be known before it is claimed

Governs the moment a result may be stated.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A command is waiting on a result | Pending clears only from a real settlement, and the result copy matches the outcome that actually arrived |
| Case 2 | A non-urgent result should be announced | `Text live="polite"` on the smallest owner of that status |
| Case 3 | The message is genuinely urgent and interrupting is warranted | `live="assertive"`, which is reserved for exactly that |
| Case 4 | The same result would appear in two places | It does not. One announcement owner updates only when the result changes |
| Case 5 | The message describes navigation | It is rendered from an actual navigation effect, and a navigation status is not an error by default |
| Case 6 | The result matters after the moment passes | It stays somewhere durable, where the reader can review or act on it |

## FEEDBACK-4 — Paths the direction commits to

Governs the outcomes the audit will be asked to exercise.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A flow can fail, be corrected, retried, or cancelled | Every reachable failure, correction, retry, success, error, and cancellation path is named |
| Case 2 | Recovery replaces part of the surface | Preserved input and the actual recovered operation are in scope, not only the visible message |
| Case 3 | Any path leaves work in flight | No path ends with pending that can never settle |
| Case 4 | A family or the application adds a delta | Each layer is isolated, so a duplicated announcement can be attributed |

Not this rule: counting announcements and tracing request results is the audit operator's work.

## What this file does not decide

Who owns pending among several controls is [Action](action.md), and which conditions exist at all is
[State](state.md). Which action the reader is being pushed towards is [CTA](cta.md). Whether a
message is programmatically related to its field, and whether it is announced once, is
[Accessibility](../proof/accessibility.md) and [Render truth](../proof/render-truth.md).
