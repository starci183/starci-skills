# Grammar Common reuse and extension

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-extension` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile` |
| Search tags | `reuse, extend, grammar gap, package request, global css, forbidden` |
| Dependencies | `fe.grammar-common-capabilities` |

Classify every required capability:

- `reuse`: an exact public export and effective interface already satisfy it.
- `extend`: the interface explicitly opens the required axis.
- `grammar-gap`: a required semantic rule, token, component/export, anatomy, state, or extension axis
  is absent.

An extension names its base package/export, base interface hash, allowed axis, consumer set, and proof
that all closed invariants remain unchanged.

## Gap versus visual ambiguity

A `grammar-gap` is missing reusable authority, not visual ambiguity and not a frontend choice wait. Return an
exact Grammar-owner repair request naming the absent semantic contract, affected consumers, selected
package/version/hash, and required proof. The Grammar owner repairs and publishes the package; the
frontend mission then recompiles against the new exact export/token/interface hash before apply.

Application code must not improvise the missing contract with local CSS, raw utilities, a copied
component, an anatomy-changing wrapper, a guessed prop/variant, or a page-specific token. No
exception converts a missing Grammar contract into valid UI.

Visual ambiguity exists only after every required semantic rule, token, component, state, and
responsive contract is available and several materially valid compositions still remain. Then
`generate` renders three or four realistic Grammar-valid directions for selection. When one direction
materially dominates, render one realistic preview and continue without manufacturing alternatives.

Forbidden:

- business elements or business-named states inside Grammar;
- invented exports, props, variants, states, dependencies, or deep imports;
- local copies or anatomy-changing wrappers around package objects;
- competing owners for padding, focus, selection, scrolling, dismissal, or responsive transformation;
- structural overrides in application `global.css`;
- treating example markup, screenshots, or this guide as implementation source.

Application `global.css` may change only color-token values explicitly opened by the selected package interface. Structural change belongs in the Grammar package.
