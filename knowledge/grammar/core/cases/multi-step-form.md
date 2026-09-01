# Core case: multi-step form with global progress

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-case-multi-step-form` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `multi step, journey progress, form, validation, draft, back navigation` |
| Dependencies | `fe.grammar-core-object-fields, fe.grammar-core-object-actions` |

## Trigger

One user outcome spans multiple pages or checkpoints with data entry, validation, review, and recovery.

## Decision

Use one global journey-progress owner referenced by every page. Each page owns only its local fields, explanation, validation, and actions. Progress is not route tabs. Keep completed, current, available, blocked, and error concepts in the application state model and map them to neutral package states.

Preserve draft data, explicit back behavior, server validation ownership, retry behavior, and the selected outcome path. Do not expose future fields solely to make a single page look complete.

## Responsive

Progress may compact to a summary or declared small-screen form while preserving current position and total journey context. Actions remain near their affected step or use a proven sticky action pattern.

## Reject and proof

Reject independent per-page progress, tabs as steps, loss of draft on back/retry, hidden validation, and ambiguous completion. Prove every journey state, refresh/re-entry, back/forward, error recovery, and mobile interaction.
