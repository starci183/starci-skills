# Call to action composition

This file answers one question: within a decision region, which action deserves the emphasis, and
what does its emphasis promise the reader about the consequence?

A call to action is settled from consequence, never from a wish for a larger or brighter control.
The variant, the semantics, the blocked states, and the order of an action group are all decided
before the region is built, because each of them is a promise the rendered page then has to keep.

## CTA-1 — Emphasis follows consequence

Governs which control carries the strongest treatment.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A decision region has one clear next action | Exactly one `Button variant="primary"` sits in that decision owner, carrying `onPress`, or `href` when the next step is a destination |
| Case 2 | Other actions in the same region are real alternatives | Each carries a weaker published variant from `secondary`, `tertiary`, `outline`, or `ghost` that states its actual consequence |
| Case 3 | The direction wants a bigger or brighter control without a change in consequence | The variant is unchanged, and no local button recipe appears against that control |
| Case 4 | The action sits in a dense toolbar, a card, or a page-level decision | `size` is bound through the published prop from that interaction context, and no vendor button is restyled to reach it |

Not this rule: counting how much dominant emphasis a whole page spends is ACCENT-1.

## CTA-2 — Destination or command

Governs which native thing the reader is actually operating.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Activating the control takes the reader to a real address | `TextAction` or `Button` carries `href`, and the button shape changes only the paint |
| Case 2 | Activating the control changes application state | `Button`, or `TextAction` where the command reads as text, carries a real handler |
| Case 3 | The action carries a directional glyph | The glyph sits in `startContent` or `endContent`, and the visible text label remains |
| Case 4 | The direction wants an icon-only arrow as the continuation | The dominant decision keeps a visible text label, and every glyph on it is supporting |

Not this rule: how many effects one activation may produce is ACTION-1.

## CTA-3 — Unavailable, pending, and unresolved are three conditions

Governs which of three temporary blocks the control is actually in.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The work cannot start at all, because permission or prerequisites are missing | `isDisabled` is bound on that control, and no pending carrier is |
| Case 2 | This control accepted work that has not settled | `isPending` is bound on that same control, its visible label and outer box are unchanged, and duplicate activation is refused |
| Case 3 | Initial content has not resolved and no action has been taken | `isSkeleton` is bound on the owner, and no pending carrier appears anywhere for that content |
| Case 4 | Some other request is in flight elsewhere on the page | Peer controls keep their own carriers, and no pending reaches a control that started nothing |

Not this rule: which owner holds pending once several controls are involved is ACTION-2.

## CTA-4 — Destructive consequence needs its own authority

Governs the final action that cannot be undone.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | An action irreversibly deletes, revokes, or discards valuable state | The receipt carries explicit destructive copy, a confirmation proportionate to the consequence, and a typed danger action treatment |
| Case 2 | The published `ButtonVariant` offers no danger value | A `GRAMMAR_REQUIRED` gap records it, and the CTA does not ship on the primary variant instead |
| Case 3 | The direction is tempted to import the vendor danger variant, or to add local red | No vendor danger variant and no local red appears against that control |
| Case 4 | The action is a reversible cancel or an ordinary negative outcome | It carries no destructive treatment and no confirmation earned by destructiveness |

## CTA-5 — Group order across widths

Governs the sequence of two or more actions that form one decision.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A decision offers a dominant action, an alternative, and a way out | DOM order runs dominant decision, supporting alternative, then escape or recovery, as the product requires |
| Case 2 | The group wraps or stacks at a narrower width | Reading order and sequential focus order are identical at every width, and no CSS `order` reverses the group |
| Case 3 | A translated label grows well past its original length | The receipt names the longest label the group must hold, and the group wraps or stacks rather than overlapping at that length |
| Case 4 | Two actions live in separate regions | They belong to separate decision owners in the receipt, and neither ranks against the other |

## What this file does not decide

Which region holds the decision is [Layout](layout.md), and which anchor names it is
[Hierarchy](hierarchy.md). How many effects an activation may produce and who owns pending is
[Action](action.md). How scarce the dominant treatment is across the page is [Accent](accent.md),
and what happens after the action settles is [Feedback](feedback.md). What the receipt must
enumerate about these actions is [Coverage](coverage.md). Whether the rendered control is reachable,
named, and visibly focused is [Accessibility](../proof/accessibility.md) and
[Focus](../proof/focus.md).
