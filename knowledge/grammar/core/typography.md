# Core typography role matrix

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-typography` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `typography, text-xs, text-sm, text-base, normal, medium, bold, semantic priority` |
| Dependencies | `fe.grammar-core-overview` |

Core binds non-heading UI text to semantic role before size or weight:

| Role | Size | Default weight | Permitted priority escalation |
| --- | --- | --- | --- |
| metadata, eyebrow, timestamp, compact delta | 12 (`text-xs`) | normal | medium only when current, interactive, or necessary to scan |
| supporting copy, label, helper, secondary fact, TextLink | 14 (`text-sm`) | normal | medium for control/label identity; bold only for the strongest compact outcome |
| primary body, card title, primary value/action label | base (`text-base`) | normal | medium for local identity/action; bold only for the owner's highest semantic priority |

Use only normal, medium, and bold. Do not introduce semibold or arbitrary numeric weights, promote
all labels to bold, shrink important copy into metadata, or enlarge a compact fact until it competes
with its section owner. Weight escalation must name the semantic priority it expresses; visual variety
is not a reason.

Semantic document headings keep their declared heading level and selected Core heading token. They do
not enter this body-role matrix merely to force a particular pixel size, but they obey the same
priority law: one local owner cannot contain several equally strongest headings.

Prove long translation, dense/sparse content, 150% text zoom, wrap, truncation refusal, interactive
states, and hierarchy without color. Example fixtures do not create page-specific sizes or weights.
