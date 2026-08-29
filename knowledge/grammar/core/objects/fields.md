# Core object: fields

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-fields` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `field, input, label, help, validation, form group, read only` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-states-accessibility` |

## Responsibility

A field owns one value interaction, its persistent label, support text, validation relationship, and declared affordances. A form group owns relationships among fields; it does not create a surface around each field.

## Render rules

- Keep labels outside the entered value and programmatically associated.
- Reserve one stable supporting region for help, counter, or validation according to interface.
- Distinguish required, optional, invalid, disabled, read-only, pending, and loading.
- Align peer fields when comparison or scanning benefits; allow full width for long or consequential values.
- Keep prefixes, suffixes, units, reveal controls, and clear actions under one interaction owner.

## Error ownership

Client and server validation may coexist, but each message has one owner and priority. Summary errors link to exact fields; local errors remain local. Do not erase a user's input during retry.

## Responsive

Stack labels and controls before reducing readable width. Long translated labels wrap. Dependent fields retain geometry and explain pending or unavailable state.

## Proof

Verify empty, filled, focused, invalid, disabled, read-only, loading, long label/value, autofill, keyboard, screen reader, and narrow-screen fixtures.

## Reject

Reject placeholder-only labels, color-only errors, nested card per field, disappearing dependent fields without explanation, and layout CSS overriding field anatomy.
