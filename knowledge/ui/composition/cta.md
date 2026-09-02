# Call to action composition

This file answers one question: within a decision region, which action deserves the emphasis, and
what does its emphasis promise the reader about the consequence?

A call to action is settled from consequence, never from a wish for a larger or brighter control.
The variant, the semantics, the blocked states, and the order of an action group are all decided
before the region is built, because each of them is a promise the rendered page then has to keep.

## CTA-1 — Emphasis follows consequence

Governs which control carries the strongest treatment.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A decision region has one clear next action | `Button variant="primary"`, or `Button` with `href` when the next step is a destination. Exactly one per decision owner |
| Case 2 | Other actions in the same region are real alternatives | A weaker published variant that states their actual consequence, from `secondary`, `tertiary`, `outline`, or `ghost` |
| Case 3 | The direction wants a bigger or brighter control without a change in consequence | That is not a variant decision, and a local button recipe is not an answer |
| Case 4 | The action sits in a dense toolbar, a card, or a page-level decision | `size` is chosen from that interaction context through the published prop, never by restyling a vendor button |

Not this rule: counting how much dominant emphasis a whole page spends is ACCENT-1.

## CTA-2 — Destination or command

Governs which native thing the reader is actually operating.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Activating the control takes the reader to a real address | `TextAction` or `Button` with `href`. The button shape changes the paint and nothing else |
| Case 2 | Activating the control changes application state | `Button`, or `TextAction` when the command must read as text |
| Case 3 | The action carries a directional glyph | The glyph goes in `startContent` or `endContent`, and the visible text label stays |
| Case 4 | The direction wants an icon-only arrow as the continuation | Not for the dominant decision. The primary action keeps a visible text label, and the glyph stays supporting |

Not this rule: how many effects one activation may produce is ACTION-1.

## CTA-3 — Unavailable, pending, and unresolved are three conditions

Governs which of three temporary blocks the control is actually in.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The work cannot start at all, because permission or prerequisites are missing | `isDisabled` on the control |
| Case 2 | This control accepted work that has not settled | `isPending` on that same control, with the visible label and outer box unchanged and duplicate activation blocked |
| Case 3 | Initial content has not resolved and no action has been taken | `isSkeleton` on the owner. Nothing has accepted work, so nothing is pending |
| Case 4 | Some other request is in flight elsewhere on the page | Peer controls keep their own states. Pending never spreads to controls that started nothing |

Not this rule: which owner holds pending once several controls are involved is ACTION-2.

## CTA-4 — Destructive consequence needs its own authority

Governs the final action that cannot be undone.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | An action irreversibly deletes, revokes, or discards valuable state | Explicit destructive copy, a confirmation proportionate to the consequence, and a typed danger action treatment |
| Case 2 | The published `ButtonVariant` offers no danger value | The gap is recorded and the CTA is not shipped on the primary variant instead |
| Case 3 | The direction is tempted to import the vendor danger variant, or to add local red | Refused. Vendor support does not create reusable authority, and paint does not create a consequence |
| Case 4 | The action is a reversible cancel or an ordinary negative outcome | It is not destructive and does not take this treatment |

## CTA-5 — Group order across widths

Governs the sequence of two or more actions that form one decision.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A decision offers a dominant action, an alternative, and a way out | DOM order runs dominant decision, supporting alternative, then escape or recovery, as the product requires |
| Case 2 | The group wraps or stacks at a narrower width | Placement moves; reading order and sequential focus order do not. CSS `order` is not used to reverse the group |
| Case 3 | A translated label grows well past its original length | The group wraps or stacks rather than overlapping, and the direction names the longest label it must hold |
| Case 4 | Two actions live in separate regions | They are not one group and are decided independently |

## What this file does not decide

Which region holds the decision is [Layout](layout.md), and which anchor names it is
[Hierarchy](hierarchy.md). How many effects an activation may produce and who owns pending is
[Action](action.md). How scarce the dominant treatment is across the page is [Accent](accent.md),
and what happens after the action settles is [Feedback](feedback.md). Whether the rendered control
is reachable, named, and visibly focused is [Accessibility](../proof/accessibility.md) and
[Focus](../proof/focus.md).
