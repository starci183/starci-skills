# Grammar Common semantic color

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-semantic-color` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile, fe/direction-generate, fe/request-compile, fe/visual-fidelity` |
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

`IconTile` is the canonical compact accent carrier for one subject identity: one purpose-bound glyph
uses `accent-text` on `accent-subtle-surface`, while adjacent text owns the accessible identity. The
tile is not an action, state badge, rank mark, decorative card fill, or evidence of selection,
success, completion, or progress. A domain illustration or arbitrary icon inside a Button cannot
borrow this role.

A header owned by a `surface-secondary` region keeps `surface-secondary` parity with that region in
wide and compact projections. It may use the selected package's divider to mark its boundary, but it
must not switch to a primary/background surface, introduce an unbound tint, or imply a second surface
owner. Header parity is semantic ownership, not a page-specific color recipe.

Rank placement and movement colors follow
`fe.grammar-common-case-ranked-collection-semantics`. Improvement/demotion is not generic
success/failure, and an unknown delta remains neutral/absent rather than receiving an inferred tone.

Grammar convergence rejects an unbound physical color and follows `fe.grammar-common-extension` when
the required semantic token/treatment is absent: exact Grammar-owner repair/publish, then recompile;
never a local palette utility. Visual review still begins with pixels and may find bad hierarchy even
when the token binding is valid.
