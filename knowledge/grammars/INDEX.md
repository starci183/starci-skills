# Grammar families

This catalog names every authored UI Grammar family. It is inventory, not a default-family rule:
the selected `.work` design specification names the applicable installed family, if any. A missing
or ambiguous family never silently resolves to StarCi. This catalog supplies historical snapshots,
not a package installer, resolver or requirement that every product use Grammar.

Verify actual package identity/version, exported types, CSS and renderer source in the selected
repository before using snapshot APIs or gaps. Record current source references in the selected
`.work` node; an old source census is not current UAT evidence.

| Family | Authority | Package snapshot | Reusable style | Product composition |
| --- | --- | --- | --- | --- |
| [`starci`](starci/INDEX.md) | [`family.md`](starci/family.md) | [`DNA.md`](starci/DNA.md) | [`idioms.md`](starci/idioms.md) | [`playbook.md`](starci/playbook.md) |

Common semantics, renderer anatomy, state and accessibility remain owned by
[`knowledge/ui`](../ui/INDEX.md). A family owns its scoped visual realization and promoted idioms;
the product owns its facts, content, routes and approved composition.
