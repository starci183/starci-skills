# Grammar Common semantic color

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-semantic-color` |
| Contract revision | `7.4.0` |
| Package | `@starci/grammar/common` |
| Operators | `grammar-convergence, direction-generate, contract-freeze, ui-audit` |
| Search tags | `color, accent, purple, semantic role, surface, state` |
| Dependencies | `fe.grammar-common-states-accessibility` |

Color is a rendering consequence of a semantic role, never a role by itself. A decision may bind
`primary-action`, `selected`, `focus`, `accent-text`, `accent-subtle-surface`, or a neutral/state role
to an exact selected-package token. It may not use `purple`, a palette step, hex, RGB, HSL, OKLCH, or
an arbitrary utility class as its semantic reason.

An accent-colored card is legal only when the owning pattern declares the surface role and the
selected package exposes that treatment. Do not use accent to compensate for weak hierarchy, group
unrelated content, imply selection, or manufacture progress/success. Repeated peers share one
deterministic role mapping; random color variation is forbidden.

Grammar convergence rejects an unbound physical color and records a `grammar-gap` when the required
semantic treatment is absent from the package. Visual review still begins with pixels and may find a
bad hierarchy even when the token binding is valid.


