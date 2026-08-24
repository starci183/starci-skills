# Core case: trustworthy list inside a card

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-case-trust-list-in-card` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `SurfaceCard, list inside card, affirmative check, trustworthy, nested surface` |
| Dependencies | `fe.grammar-common-case-surface-inside-surface, fe.grammar-core-object-collections` |

## Trigger

A card presents a small set of peer assertions, benefits, requirements, or facts whose repeated state treatment must feel bounded and credible.

## Decision

The outer SurfaceCard owns the block, external label, summary, and action. A package-provided inner collection owner owns rows and separators. Map each row's domain meaning to a neutral state; Core may render an `affirmative` check treatment, but it never decides what the check means.

Keep the inner border/radius/elevation subordinate. Use one surface for all rows, stable icon/state alignment, readable wrap, and deliberate zero/one/many behavior.

## Responsive

Preserve row grouping and state alignment. Flatten only the inner visual boundary if Core declares that treatment and row ownership remains obvious.

## Reject and proof

Reject card-per-row, decorative inner surface, business-named state props, checks without accessible meaning, or duplicated outer/inner padding. Prove zero, one, many, long row, mixed state, keyboard, and narrow-screen fixtures.
