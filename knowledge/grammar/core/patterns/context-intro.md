# Core pattern: ContextIntro

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-pattern-context-intro` |
| Contract revision | `7.4.0` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `context intro, eyebrow, heading, description, three text layers` |
| Dependencies | `fe.grammar-common-semantic-composition, fe.grammar-core-overview` |

## Trigger

One region introduces a context through one eyebrow, one semantic heading, and one supporting line.
This pattern is not mandatory for every header and does not own a peer action. It is rendered by the
public `SectionHeader` interface with `composition=context-intro`, not a duplicate component.

## Closed anatomy and treatment

1. `eyebrow` (`one`): `text-xs` bound to semantic accent text.
2. `heading` (`one`): the contextual heading token selected by semantic heading level.
3. `description` (`one`): `text-sm` bound to semantic muted text.

Order and Grammar-owned internal gap are closed. Text wrap increases the owner's block size; fixed heights, truncation, and typography
shrinking are forbidden repairs. Product copy, heading level, and whether optional slots exist remain
application authority.

## Proof

Prove heading levels, long translation, 150% text zoom, narrow wrapping,
dark/forced-color treatment, and absence of an orphan gap.

