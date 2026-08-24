# Grammar Common reuse and extension

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-extension` |
| Package | `@starci/grammar/common` |
| Operators | `grammar-convergence` |
| Search tags | `reuse, extend, grammar gap, package request, global css, forbidden` |
| Dependencies | `fe.grammar-common-contracts` |

Classify every required capability:

- `reuse`: an exact public export and effective contract already satisfy it.
- `extend`: the contract explicitly opens the required axis.
- `grammar-gap`: the capability, anatomy, state, or extension axis is absent.

An extension names its base package/export, base contract hash, allowed axis, consumer set, and proof that all closed invariants remain unchanged. A Grammar gap blocks local reconstruction and creates a package request.

Forbidden:

- business elements or business-named states inside Grammar;
- invented exports, props, variants, states, dependencies, or deep imports;
- local copies or anatomy-changing wrappers around package objects;
- competing owners for padding, focus, selection, scrolling, dismissal, or responsive transformation;
- structural overrides in application `global.css`;
- treating example markup, screenshots, or this guide as implementation source.

Application `global.css` may change only color-token values explicitly opened by the selected package contract. Structural change belongs in the Grammar package.
