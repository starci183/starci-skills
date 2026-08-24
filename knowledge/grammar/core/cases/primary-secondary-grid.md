# Core case: primary content with secondary facts

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-case-primary-secondary-grid` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `grid, col span 2, col span 1, dense primary, small secondary` |
| Dependencies | `fe.grammar-core-object-surface-card` |

## Trigger

One content block carries the task's main explanation or interaction while a peer contains shorter facts, summary, evidence, or support.

## Decision

Give the primary block the wider span and the secondary block the narrower span. Equal spans are reserved for truly peer responsibilities with similar information weight. Align starting edges and critical regions; do not stretch the smaller block with filler.

The narrower block may be sticky only when its summary or action must remain available throughout the primary task. Apply `fe.grammar-common-case-sticky-scroll-owner` when sticky is selected.

## Responsive

Stack primary before secondary unless the task dependency proves another order. Convert sticky to inline or the declared mobile action pattern.

## Reject and proof

Reject span based only on visual symmetry, a tiny fact card stretched to equal height, or secondary content placed first because of desktop coordinates. Prove content weight, task order, wide/narrow/stacked layouts, long copy, and focused control visibility.
