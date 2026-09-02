# Action composition

This file answers one question: when the reader activates something, what exactly happens, and who
owns it?

Action decisions come before the tree exists because they settle the count of owners and the count
of effects. A single activation reaching two handlers, or a command wearing anchor semantics, is a
composition mistake that no later styling can repair.

## ACTION-1 — One activation, one effect

Governs how many things may respond to a single press.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | An activation changes application state | `Button` for a regular command, or `TextAction` when the command must read as text. One `onPress` owner |
| Case 2 | The command participates in a form | `Button.type` is chosen deliberately, so submit behaviour is intended rather than inherited |
| Case 3 | The direction wants the whole row or container to be clickable too | It picks one owner. A clickable wrapper around a published command creates a second owner and a second effect |
| Case 4 | An ancestor or a document-level listener exists on the same path | It must not become a second owner of the same activation |

Not this rule: whether the surface itself is the action is STATE-5.

## ACTION-2 — Pending belongs to the initiator

Governs which control shows that work is in flight.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A command accepted work that has not settled | `isPending` on that command, which keeps its label, exposes busy state, and refuses a second activation |
| Case 2 | The work was started by the recovery action inside an empty or failed region | `EmptyNotice.isActionPending`, which forwards to the button that region owns |
| Case 3 | Other controls are visible while that work runs | They keep their own states. A page-wide lock or spinner is not a substitute |
| Case 4 | The direction is tempted to swap in `isDisabled` for the duration | It does not. Disabled says the work cannot start; pending says it already has |
| Case 5 | The owner that needs pending publishes no pending prop | The gap is recorded before any application workaround is written |

## ACTION-3 — Consequence chooses the semantics

Governs the native element the reader operates.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The consequence is following a real address | `TextAction` keeps its `href`, and remains an anchor whatever appearance it wears |
| Case 2 | The consequence is a state change | `Button` or `TextAction`, with a real handler |
| Case 3 | The direction wants to observe a follow before it happens | `TextAction.onFollow` observes; it does not turn a missing or invented destination into a command contract |
| Case 4 | An anchor is being used with a click handler and no destination | It is replaced by the command owner. Simulating one kind with the other is never the answer |

## ACTION-4 — Paths the direction commits to

Governs what the audit will be asked to exercise.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Any action is delivered | Both the pointer route and the keyboard route are in scope for it |
| Case 2 | The action has blocked or transient states | Every reachable enabled, disabled, pending, and settled state is named |
| Case 3 | The action is a destination | The route result itself is in scope, not merely the element type |
| Case 4 | A family or the application adds a delta over the published owner | Each layer is isolated, so a doubled effect can be attributed to the layer that introduced it |

Not this rule: recording callback counts and route results is the audit operator's work.

## What this file does not decide

Which action deserves emphasis and what its variant promises is [CTA](cta.md). Which surface is
itself an action, and which controlled values persist, is [State](state.md). What the reader is told
after the action settles is [Feedback](feedback.md). Whether the rendered target is named, sized,
and visibly focusable is [Accessibility](../proof/accessibility.md) and [Focus](../proof/focus.md),
and whether the resulting claim is true is [Render truth](../proof/render-truth.md).
