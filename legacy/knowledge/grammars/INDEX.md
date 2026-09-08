# Grammar families

This catalog names every authored UI Grammar family. It is inventory, not a default-family rule:
the routed request must bind one concrete family, and a missing or ambiguous family never silently
resolves to StarCi.

| Family | Authority | Package snapshot | Reusable style | Product composition |
| --- | --- | --- | --- | --- |
| [`starci`](starci/INDEX.md) | [`family.md`](starci/family.md) | [`DNA.md`](starci/DNA.md) | [`idioms.md`](starci/idioms.md) | [`playbook.md`](starci/playbook.md) |

Common semantics, renderer anatomy, state and accessibility remain owned by
[`knowledge/ui`](../ui/INDEX.md). A family owns its scoped visual realization and promoted idioms;
the product owns its facts, content, routes and approved composition.
