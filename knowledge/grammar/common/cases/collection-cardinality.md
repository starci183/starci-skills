# Common case: collection cardinality

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-case-collection-cardinality` |
| Package | `@starci/grammar/common` |
| Operators | `grammar-convergence` |
| Search tags | `collection, zero one many, repeated rows, long content, mixed rows` |
| Dependencies | `fe.grammar-common-contracts, fe.grammar-common-states-accessibility` |

## Trigger

An object renders a repeated collection whose item count or content length varies.

## Goal

Keep the collection complete and stable at zero, one, few, many, and unbounded items.

## Render decision

The collection owner defines empty treatment, row anatomy, separators, grouping labels, selection, expansion, row actions, and overflow. One row must look intentionally complete; many rows must not create redundant outer borders or per-row surfaces.

For unbounded data, use only the package-declared pagination, virtualization, clipping, or scrolling model. Keep primary identity and repeated states in stable positions. Separate static and interactive rows unless a declared mixed-row variant exists.

## Required states

Cover loading, empty, one, many, partial, stale, and error. Preserve already usable rows during partial resolution when the contract supports it.

## Responsive behavior

Prioritize identity, state, and essential action. Wrap or move secondary metadata using a declared alternate row composition; never destroy comparison semantics accidentally.

## Reject

Reject blank framed empty states, orphan separators, card-per-row decoration, unstable action placement, unlimited rendering without an overflow owner, or silent removal of essential fields.

## Proof

Render representative zero, one, long-one, many, mixed-state, partial, and narrow-screen fixtures.
