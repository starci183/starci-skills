# Action composition

This file answers one question: when the reader activates something, what exactly happens, and who
owns it?

Action decisions come before the tree exists because they settle the count of owners and the count
of effects. A single activation reaching two handlers, or a command wearing anchor semantics, is a
composition mistake that no later styling can repair.

## ACTION-1 — One activation, one effect

Governs how many things may respond to a single press.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | An activation changes application state | Exactly one node owns the effect, and it is `Button`, or `TextAction` where the command reads as text; no second node carries `onPress` for the same activation |
| Case 2 | The command participates in a form | The receipt names the chosen `Button.type`, so submit behaviour is stated rather than inherited from the enclosing form |
| Case 3 | The direction wants the whole row or container to be clickable too | The receipt names one owner for that activation; no clickable wrapper encloses a published command that owns the same effect |
| Case 4 | An ancestor or a document-level listener exists on the same path | No ancestor or document listener on that path responds to the same activation |

Not this rule: whether the surface itself is the action is STATE-5.

## ACTION-2 — Pending belongs to the initiator

Governs which control shows that work is in flight.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A command accepted work that has not settled | The node that initiated the work binds `isPending`; its label is unchanged, its busy state is exposed, and a second activation is refused |
| Case 2 | The work was started by the recovery action inside an empty or failed region | `EmptyNotice.isActionPending` carries it, and it resolves to the button that region owns |
| Case 3 | Other controls are visible while that work runs | No other node changes state for that work, and no page-wide lock or spinner stands in for the initiator's pending |
| Case 4 | The direction is tempted to swap in `isDisabled` for the duration | The receipt binds `isPending`, not `isDisabled`, for accepted work; disabled appears only where the work cannot start |
| Case 5 | The owner that needs pending publishes no pending prop | A `GRAMMAR_REQUIRED` gap naming that owner exists in the receipt, and no application-level pending substitute appears in the tree |

## ACTION-3 — Consequence chooses the semantics

Governs the native element the reader operates.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The consequence is following a real address | The node keeps `TextAction` with its `href` and stays an anchor under every appearance it is given |
| Case 2 | The consequence is a state change | The node is `Button` or `TextAction` and carries a real handler, not a destination |
| Case 3 | The direction wants to observe a follow before it happens | `TextAction.onFollow` is present only as an observer; the node still carries a real destination |
| Case 4 | An anchor is being used with a click handler and no destination | No such node exists in the tree; the command owner carries the effect instead |

Retired: ACTION-4 is retired into COVERAGE-1 and is not reused; the address stays spent.

## What this file does not decide

Which action deserves emphasis and what its variant promises is [CTA](cta.md). Which surface is
itself an action, and which controlled values persist, is [State](state.md). What the reader is told
after the action settles is [Feedback](feedback.md). What the receipt must enumerate about these
actions is [Coverage](coverage.md). Whether the rendered target is named, sized, and visibly
focusable is [Accessibility](../proof/accessibility.md) and [Focus](../proof/focus.md), and whether
the resulting claim is true is [Render truth](../proof/render-truth.md).
