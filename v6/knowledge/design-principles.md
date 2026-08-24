# Detailed design principles

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.design-principles` |
| Operations | `principle-compile` |
| Search tags | `principles, composition, spacing, hierarchy, responsive, interaction` |
| Dependencies | `fe.layout-composition` |

## Record

Principles resolve product-neutral design decisions that remain open after Flow, state, Layout, Grammar, and source contracts. Each compiled rule must state Situation, Decision, Implementation intent, Negative boundary, and Example or proof.

## Composition

When a child collection has its own repeated schema, row boundaries, or interaction ownership, give it one distinct nested surface owner. The parent keeps page-level framing and labels; the child owns rows. Do not add a nested surface merely to create more border or elevation. Prove ownership by removing the child surface: if grouping, row state, or interaction boundary becomes ambiguous, the nested owner is meaningful.

## Spacing and boundary

Each boundary has one padding owner. Parent-to-child spacing expresses relationship; internal spacing expresses one owner's rhythm. Avoid stacked parent and child padding that creates an accidental moat. Repeated rows share one rhythm and divider owner. Prove with edge alignment, first/last-child treatment, and long-content wrapping.

## Hierarchy

Visual emphasis follows task consequence and information weight. Primary content gets the strongest position and sufficient width; supporting facts remain visible without competing. State markers supplement text and structure, never replace them. Prove that reading order and action order still make sense without color.

## Responsive persistence

Responsive change preserves meaning, reachability, and comparison value; it may change tracks, order, disclosure, or persistence. Sticky requires a declared scroll owner, bounded height, known offset, safe focus/overflow, and a static compact fallback. Prove at wide, intermediate, and compact widths with long and sparse data.

## State and interaction

State treatment must reflect a reachable neutral presentation state supplied by the Product Block. Controls expose label, disabled reason, pending behavior, validation, recovery, focus, and keyboard path. A check marker can increase perceived certainty only when it represents an evidenced affirmative state and remains accompanied by comprehensible text. Never use positive treatment to manufacture trust.
